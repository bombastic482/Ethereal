import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { activity, exerciseKcal } from '@/lib/calc/exercise';
import { addExercise } from '@/lib/food-store';
import { confetti, haptic } from '@/lib/fx';
import { beep, holdScreen, hush, say, unlockAudio } from '@/lib/train/cues';
import { exerciseById, type Exercise } from '@/lib/train/exercises';
import {
  neighbour,
  suggestions,
  workoutKcal,
  type Suggestion,
  type TrainSetup,
  type Workout,
} from '@/lib/train/program';
import {
  buildSteps,
  lastPerformance,
  loggedSets,
  startValue,
  withSwaps,
  type Step,
} from '@/lib/train/session';
import { trainStore, type InProgress, type WorkoutLog } from '@/lib/train/store';
import { Icon } from '../ui/Icon';
import { Layer } from '../ui/Layer';
import { Figure } from './Figure';

interface Props {
  setup: TrainSetup;
  /** The session as planned, before any swaps. */
  workout: Workout;
  date: string;
  weightKg: number;
  resume?: InProgress | null;
  /** The variant the session was built with, saved so a resume rebuilds the same steps. */
  options?: { short?: boolean; comeback?: boolean };
  onClose: () => void;
}

/** Seconds of "get ready" before a timed move starts. */
const READY_MS = 5000;

type Phase = 'ready' | 'go';
interface Timer {
  phase: Phase;
  total: number;
  endsAt: number;
  left: number;
  /** Set once the halfway "switch sides" cue has played. */
  half?: boolean;
}

const isTimed = (s: Step | undefined): boolean =>
  !!s &&
  (s.kind === 'rest' ||
    s.kind === 'warm' ||
    s.kind === 'cool' ||
    (s.kind === 'work' && s.p.exercise.unit === 'seconds'));

const exerciseOf = (s: Step | undefined): Exercise | undefined =>
  !s
    ? undefined
    : s.kind === 'rest'
      ? s.next?.p.exercise
      : s.kind === 'walk'
        ? undefined
        : s.p.exercise;

/** How long a timed step holds, in seconds, before doubling for each-side moves. */
function holdSeconds(
  s: Step,
  values: Record<number, number>,
  index: number,
  last: number[] | null,
) {
  if (s.kind === 'rest') return s.sec;
  if (s.kind === 'walk') return s.minutes * 60;
  if (s.kind === 'work') return values[index] ?? startValue(s.p, s.set, last);
  return s.p.high;
}

function stepLabel(s: Step, w: Workout): string {
  switch (s.kind) {
    case 'warm':
      return `Warm-up ${s.index + 1} of ${s.of}`;
    case 'cool':
      return `Cool-down ${s.index + 1} of ${s.of}`;
    case 'work':
      return `Exercise ${s.slot + 1} of ${w.main.length} · Set ${s.set + 1} of ${s.p.sets}`;
    case 'rest':
      return 'Rest';
    case 'walk':
      return 'Finish with a walk';
  }
}

export default function WorkoutPlayer({
  setup,
  workout,
  date,
  weightKg,
  resume,
  options,
  onClose,
}: Props) {
  const [main, setMain] = useState<string[]>(
    () => resume?.main ?? workout.main.map((p) => p.exercise.id),
  );
  const [step, setStep] = useState(resume?.step ?? 0);
  const [values, setValues] = useState<Record<number, number>>(resume?.values ?? {});
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** Taps on the rep pad this step: the first tap starts the count from one. */
  const [taps, setTaps] = useState(0);
  /** The short celebration after a set, keyed so each one replays. */
  const [burst, setBurst] = useState<{
    id: number;
    title: string;
    sub: string;
    best: boolean;
  } | null>(null);
  const [{ sound, voice, log }, patchTrain] = trainStore.use();
  const [, setFrame] = useState(0);

  const timer = useRef<Timer | null>(null);
  const activeMs = useRef(resume?.activeMs ?? 0);
  const lastTick = useRef(0);
  const prefs = useRef({ sound, voice });
  prefs.current = { sound, voice };

  const current = useMemo(() => withSwaps(workout, main, setup), [workout, main, setup]);
  const steps = useMemo(() => buildSteps(current), [current]);
  const s = steps[step];
  const ex = exerciseOf(s);
  const last = ex ? lastPerformance(log, ex.id) : null;

  const cue = (text: string) => {
    if (prefs.current.voice) say(text);
  };
  const tone = (high = false) => {
    if (prefs.current.sound) beep(high);
  };

  // Keep the screen on and the page underneath still while the player is open.
  useEffect(() => {
    const release = holdScreen();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      release();
      hush();
      root.style.overflow = prev;
    };
  }, []);

  // Save progress at every step so a closed tab or a phone call never loses the session.
  useEffect(() => {
    if (finished || !started) return;
    trainStore.patch({
      current: {
        date,
        session: workout.session,
        week: workout.week,
        main,
        step,
        values,
        activeMs: activeMs.current,
        ...(options && (options.short || options.comeback) ? { opts: options } : {}),
      },
    });
  }, [step, values, main, started, finished]);

  const startTimer = (phase: Phase, ms: number) => {
    timer.current = { phase, total: ms, endsAt: performance.now() + ms, left: ms };
    setFrame((f) => f + 1);
  };

  // Entering a step: timed steps count themselves in, rep steps wait for the tap.
  useEffect(() => {
    if (!started || finished || !s) return;
    setHowTo(false);
    setTaps(0);
    timer.current = null;
    if (s.kind === 'rest') {
      startTimer('go', s.sec * 1000);
      cue(s.next ? `Rest. Next, ${s.next.p.exercise.name}.` : 'Rest.');
    } else if (s.kind === 'warm' || s.kind === 'cool') {
      startTimer('ready', READY_MS);
      cue(`${s.p.exercise.name}. ${s.p.high} seconds${s.p.exercise.perSide ? ' each side' : ''}.`);
    } else if (s.kind === 'work') {
      const unit = s.p.exercise.unit === 'seconds' ? 'seconds' : 'reps';
      if (unit === 'seconds') startTimer('ready', READY_MS);
      cue(
        `${s.p.exercise.name}. Set ${s.set + 1} of ${s.p.sets}. ${s.p.low} to ${s.p.high} ${unit}${
          s.p.exercise.perSide ? ' each side' : ''
        }.`,
      );
    } else if (s.kind === 'walk') {
      cue(`Last part. Walk for ${s.minutes} minutes.`);
    }
    setFrame((f) => f + 1);
  }, [step, started, finished]);

  /** A set is in: flash it, and make a fuss when it beats last time. */
  const celebrate = (v: number) => {
    if (!s || s.kind !== 'work') return;
    const before = last?.[s.set];
    const best = before !== undefined && v > before;
    const unit = s.p.exercise.unit === 'seconds' ? 's' : ' reps';
    setBurst({
      id: Date.now(),
      title: best ? 'New best' : `Set ${s.set + 1} done`,
      sub: best ? `${v}${unit}, up from ${before}` : `${v}${unit}`,
      best,
    });
    if (best) {
      confetti({ x: 0.5, y: 0.35 }, 70);
      cue(`New best. ${v}.`);
    }
    window.setTimeout(() => setBurst((b) => (b && Date.now() - b.id >= 1300 ? null : b)), 1400);
  };

  const advance = () => {
    timer.current = null;
    haptic(14);
    if (step + 1 >= steps.length) finish();
    else setStep(step + 1);
  };

  const finish = () => {
    timer.current = null;
    setFinished(true);
    hush();
    cue('Workout done. Well done.');
  };

  // One clock for everything: active time, countdowns, beeps and auto-advance.
  useEffect(() => {
    if (!started || finished) return;
    lastTick.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      if (!paused) activeMs.current += now - lastTick.current;
      lastTick.current = now;
      const t = timer.current;
      if (!t || paused || !s) return;
      const before = Math.ceil(t.left / 1000);
      t.left = Math.max(0, t.endsAt - now);
      const after = Math.ceil(t.left / 1000);
      if (after !== before && after > 0 && after <= 3) tone();
      // Each-side holds switch at halfway.
      if (
        ex?.perSide &&
        s.kind !== 'rest' &&
        t.phase === 'go' &&
        !t.half &&
        t.left <= t.total / 2
      ) {
        t.half = true;
        tone(true);
        cue('Switch sides.');
      }
      if (t.left <= 0) {
        if (t.phase === 'ready') {
          tone(true);
          cue('Go.');
          const secs = holdSeconds(s, values, step, last);
          startTimer('go', secs * 1000 * (ex?.perSide && s.kind !== 'walk' ? 2 : 1));
        } else {
          tone(true);
          if (s.kind === 'work') {
            const held = values[step] ?? holdSeconds(s, values, step, last);
            setValues((v) => ({ ...v, [step]: held }));
            celebrate(held);
          }
          if (s.kind === 'walk') setValues((v) => ({ ...v, [step]: s.minutes }));
          advance();
        }
        return;
      }
      setFrame((f) => f + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [started, finished, paused, step, steps, values]);

  const togglePause = () => {
    const t = timer.current;
    if (t) {
      if (paused) t.endsAt = performance.now() + t.left;
      else t.left = Math.max(0, t.endsAt - performance.now());
    }
    setPaused(!paused);
    haptic(10);
  };

  const begin = () => {
    unlockAudio();
    setStarted(true);
    haptic([10, 40, 10]);
  };

  const swap = (direction: 'harder' | 'easier') => {
    if (!s || s.kind !== 'work') return;
    const to = neighbour(s.p.ladder, s.p.exercise.id, direction, setup);
    if (!to) return;
    const next = [...main];
    next[s.slot] = to.id;
    setMain(next);
    // Forget numbers typed for this slot's remaining sets: they were for the other move.
    setValues((v) => {
      const out = { ...v };
      steps.forEach((x, i) => {
        if (i >= step && x.kind === 'work' && x.slot === s.slot) delete out[i];
      });
      return out;
    });
    const fresh = trainStore.get().setup;
    if (fresh)
      trainStore.patch({ setup: { ...fresh, rungs: { ...fresh.rungs, [s.p.ladder]: to.id } } });
    setNote(`Switched to ${to.name}. It stays your ${s.p.ladder} move until you change it.`);
    cue(`Switched to ${to.name}.`);
    window.setTimeout(() => setNote(null), 4200);
  };

  const setValue = (n: number) =>
    setValues((v) => ({ ...v, [step]: Math.max(0, Math.min(300, n)) }));

  /** Tap with each rep: the first tap starts from one, so the pad counts what you actually did. */
  const countRep = () => {
    if (!s || s.kind !== 'work') return;
    const n = taps === 0 ? 1 : (values[step] ?? 0) + 1;
    setValue(n);
    setTaps(taps + 1);
    const hitTarget = n === s.p.low || n === s.p.high;
    haptic(hitTarget ? [12, 40, 12] : 8);
    if (hitTarget) tone(n === s.p.high);
  };

  // Keyboard: space for the main action, arrows to change the count, Escape to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setLeaving(true);
        return;
      }
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (!started && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        begin();
        return;
      }
      if (!s || !started) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (isTimed(s)) togglePause();
        else primary();
      } else if (s.kind === 'work' && s.p.exercise.unit === 'reps') {
        const v = values[step] ?? startValue(s.p, s.set, last);
        if (e.key === 'ArrowUp' || e.key === '+') setValue(v + 1);
        if (e.key === 'ArrowDown' || e.key === '-') setValue(v - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Done with a rep set, or skip a timed step (logging what was held so far). */
  function primary() {
    if (!s) return;
    if (s.kind === 'work') {
      const t = timer.current;
      let v = values[step];
      if (s.p.exercise.unit === 'seconds') {
        const secs = holdSeconds(s, values, step, last);
        v =
          t && t.phase === 'go' ? Math.round((t.total - t.left) / 1000 / (ex?.perSide ? 2 : 1)) : 0;
        v = Math.min(v, secs);
      } else v ??= startValue(s.p, s.set, last);
      setValues((x) => ({ ...x, [step]: v ?? 0 }));
      if (v) celebrate(v);
    }
    if (s.kind === 'walk') {
      const t = timer.current;
      const mins = t ? Math.round((t.total - t.left) / 60000) : s.minutes;
      setValues((x) => ({ ...x, [step]: mins }));
    }
    advance();
  }

  if (finished) {
    return (
      <Summary
        setup={setup}
        workout={current}
        steps={steps}
        values={values}
        date={date}
        weightKg={weightKg}
        activeMs={activeMs.current}
        onDone={onClose}
      />
    );
  }

  const t = timer.current;
  const left = t ? Math.ceil(t.left / 1000) : 0;
  const frac = t ? t.left / t.total : 0;
  const repValue =
    s?.kind === 'work' && s.p.exercise.unit === 'reps'
      ? (values[step] ?? startValue(s.p, s.set, last))
      : 0;
  const harder =
    s?.kind === 'work' ? neighbour(s.p.ladder, s.p.exercise.id, 'harder', setup) : undefined;
  const easier =
    s?.kind === 'work' ? neighbour(s.p.ladder, s.p.exercise.id, 'easier', setup) : undefined;
  const progress = started ? step / steps.length : 0;

  return (
    <Layer>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Workout"
        class="player fixed inset-0 z-[70] flex flex-col"
      >
        <header class="player-top">
          <button
            type="button"
            class="btn btn-ghost h-10 w-10 rounded-full p-0"
            aria-label="Leave workout"
            onClick={() => setLeaving(true)}
          >
            <Icon name="close" size={20} />
          </button>
          <div class="min-w-0 flex-1">
            <div class="player-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p
              class="text-muted mt-1.5 truncate text-center text-xs font-semibold"
              aria-live="polite"
            >
              {started && s
                ? stepLabel(s, current)
                : `Session ${workout.session} · Week ${workout.week}`}
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost h-10 w-10 rounded-full p-0"
            aria-pressed={sound}
            aria-label={sound ? 'Beeps on' : 'Beeps off'}
            title={sound ? 'Beeps on' : 'Beeps off'}
            onClick={() => {
              unlockAudio();
              patchTrain({ sound: !sound });
            }}
          >
            <Icon name={sound ? 'volume' : 'mute'} size={19} />
          </button>
          <button
            type="button"
            class={`btn btn-ghost h-10 w-10 rounded-full p-0 ${voice ? 'text-brand-600 dark:text-brand-300' : ''}`}
            aria-pressed={voice}
            aria-label={voice ? 'Spoken cues on' : 'Spoken cues off'}
            title={voice ? 'Spoken cues on' : 'Spoken cues off'}
            onClick={() => {
              if (voice) hush();
              else say('Spoken cues on.');
              patchTrain({ voice: !voice });
            }}
          >
            <Icon name="speak" size={19} />
          </button>
        </header>

        {!started ? (
          <Intro workout={current} resume={!!resume} onStart={begin} />
        ) : s ? (
          <div class="player-body" key={step}>
            <div class={`player-stage ${s.kind === 'rest' ? 'player-stage-rest' : ''}`}>
              {ex ? (
                <Figure
                  keys={ex.keys}
                  props={ex.props}
                  muscles={ex.muscles}
                  peak={ex.peak}
                  towel={ex.towel}
                  paused={paused}
                  speed={s.kind === 'rest' ? 0.8 : 1}
                  align="bottom"
                  fit
                  label={`${ex.name}, animated demonstration`}
                  class="h-full w-full"
                />
              ) : (
                <div class="grid h-full place-items-center">
                  <span class="player-walk">
                    <Icon name="leaf" size={56} />
                  </span>
                </div>
              )}
              {t?.phase === 'ready' && left <= 3 && left > 0 && !paused && (
                <span class="player-countin" key={`in-${left}`} aria-hidden="true">
                  {left}
                </span>
              )}
              {t?.phase === 'go' && s.kind !== 'rest' && t.total - t.left < 800 && (
                <span class="player-countin player-go" aria-hidden="true">
                  Go
                </span>
              )}
              {s.kind === 'rest' && t && (
                <div class="player-rest-ring">
                  <CountRing frac={frac} label={`${left}`} sub="rest" />
                </div>
              )}
            </div>

            <div class="player-info">
              {s.kind === 'rest' ? (
                <>
                  <p class="eyebrow mb-1">Up next</p>
                  <h2 class="font-display text-3xl tracking-tight">
                    {s.next?.p.exercise.name ?? 'Cool-down'}
                  </h2>
                  {s.next && (
                    <p class="text-muted mt-1">
                      Set {s.next.set + 1} of {s.next.p.sets} · {s.next.p.low}–{s.next.p.high}{' '}
                      {s.next.p.exercise.unit === 'seconds' ? 'seconds' : 'reps'}
                      {s.next.p.exercise.perSide ? ' each side' : ''}
                    </p>
                  )}
                  <p class="text-subtle mt-3 text-sm">
                    Breathe slowly. Shake out your arms. Sip water.
                  </p>
                </>
              ) : s.kind === 'walk' ? (
                <>
                  <h2 class="font-display text-3xl tracking-tight">Walk {s.minutes} minutes</h2>
                  <p class="text-muted mt-2">{s.tip}</p>
                  <p class="text-subtle mt-2 text-sm">
                    Now or later today. It counts just the same.
                  </p>
                </>
              ) : (
                <>
                  <h2 class="font-display text-3xl tracking-tight">{s.p.exercise.name}</h2>
                  <ol class="mt-2 grid gap-1.5 text-sm">
                    {s.p.exercise.cues.map((c, i) => (
                      <li key={c} class="flex gap-2.5">
                        <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold">
                          {i + 1}
                        </span>
                        <span class="text-muted">{c}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    class="text-brand-700 dark:text-brand-300 mt-2 text-sm font-semibold"
                    aria-expanded={howTo}
                    onClick={() => setHowTo(!howTo)}
                  >
                    {howTo ? 'Hide common mistakes' : 'Common mistakes'}
                  </button>
                  {howTo && (
                    <ul class="mt-2 grid gap-1.5 text-sm">
                      {s.p.exercise.mistakes.map((c) => (
                        <li key={c} class="text-muted flex gap-2">
                          <Icon name="warn" size={16} class="mt-0.5 flex-none text-amber-600" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {note && (
                <p class="chip mt-3" role="status">
                  {note}
                </p>
              )}
            </div>

            <div class="player-controls">
              {s.kind === 'work' && s.p.exercise.unit === 'reps' ? (
                <>
                  <p class="text-muted text-center text-sm">
                    Target {s.p.low}–{s.p.high}
                    {s.p.exercise.perSide ? ' each side' : ''}
                    {last && <> · Last time {last.join(' · ')}</>}
                  </p>
                  <div class="flex items-center justify-center gap-5">
                    <button
                      type="button"
                      class="player-step"
                      aria-label="One fewer rep"
                      onClick={() => setValue(repValue - 1)}
                    >
                      <Icon name="minus" size={24} />
                    </button>
                    <RepPad
                      value={repValue}
                      low={s.p.low}
                      high={s.p.high}
                      counting={taps > 0}
                      taps={taps}
                      onTap={countRep}
                    />
                    <button
                      type="button"
                      class="player-step"
                      aria-label="One more rep"
                      onClick={() => setValue(repValue + 1)}
                    >
                      <Icon name="plus" size={24} />
                    </button>
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary h-14 w-full text-base"
                    onClick={primary}
                  >
                    <Icon name="check" size={20} /> Done, {repValue} reps
                  </button>
                  <p class="text-subtle -mt-1 text-center text-xs">
                    {taps > 0
                      ? 'Counting. Tap the number with each rep.'
                      : 'Tap the number with each rep to count, or set it with − and +.'}
                  </p>
                </>
              ) : isTimed(s) && t ? (
                <>
                  {s.kind !== 'rest' && (
                    <div class="flex justify-center">
                      <CountRing
                        frac={frac}
                        label={`${left}`}
                        sub={
                          t.phase === 'ready'
                            ? 'get ready'
                            : ex?.perSide && t.left > t.total / 2
                              ? 'first side'
                              : ex?.perSide
                                ? 'second side'
                                : 'seconds'
                        }
                        small
                      />
                    </div>
                  )}
                  <div class="grid grid-cols-3 gap-2">
                    <button type="button" class="btn btn-secondary h-14" onClick={togglePause}>
                      <Icon name={paused ? 'play' : 'pause'} size={20} />
                      {paused ? 'Resume' : 'Pause'}
                    </button>
                    {s.kind === 'rest' ? (
                      <button
                        type="button"
                        class="btn btn-secondary h-14"
                        onClick={() => {
                          t.endsAt += 15000;
                          t.left += 15000;
                          t.total += 15000;
                          setFrame((f) => f + 1);
                        }}
                      >
                        +15 s
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" class="btn btn-primary h-14" onClick={primary}>
                      <Icon name="skip" size={18} />
                      {s.kind === 'rest' ? 'Skip' : t.phase === 'ready' ? 'Skip' : 'Done'}
                    </button>
                  </div>
                </>
              ) : s.kind === 'walk' ? (
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="btn btn-secondary h-14"
                    onClick={() => {
                      setValues((v) => ({ ...v, [step]: 0 }));
                      finish();
                    }}
                  >
                    Later
                  </button>
                  {t ? (
                    <button type="button" class="btn btn-primary h-14" onClick={primary}>
                      <Icon name="check" size={20} /> Done · {Math.ceil(t.left / 60000)} min left
                    </button>
                  ) : (
                    <button
                      type="button"
                      class="btn btn-primary h-14"
                      onClick={() => startTimer('go', s.minutes * 60000)}
                    >
                      <Icon name="timer" size={20} /> Start timer
                    </button>
                  )}
                </div>
              ) : null}
              {s.kind === 'work' && (harder || easier) && (
                <div class="flex justify-center gap-2">
                  {easier && (
                    <button
                      type="button"
                      class="btn btn-ghost h-9 px-3 text-sm"
                      onClick={() => swap('easier')}
                    >
                      Too hard
                    </button>
                  )}
                  {harder && (
                    <button
                      type="button"
                      class="btn btn-ghost h-9 px-3 text-sm"
                      onClick={() => swap('harder')}
                    >
                      Too easy
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {burst && (
          <div
            class={`player-burst ${burst.best ? 'player-burst-best' : ''}`}
            key={burst.id}
            role="status"
          >
            <span class="player-burst-ring" aria-hidden="true" />
            <span class="player-burst-badge" aria-hidden="true">
              <Icon name={burst.best ? 'spark' : 'check'} size={30} />
            </span>
            <strong>{burst.title}</strong>
            <span>{burst.sub}</span>
          </div>
        )}

        {leaving && (
          <div class="player-sheet" role="alertdialog" aria-modal="true" aria-labelledby="leave-h">
            <div class="surface grid w-full max-w-sm gap-3 p-5">
              <h2 id="leave-h" class="text-lg font-bold tracking-tight">
                Leave the workout?
              </h2>
              <p class="text-muted text-sm">
                Your progress is saved. You can pick up where you left off any time today.
              </p>
              <button
                type="button"
                class="btn btn-primary h-12"
                autofocus
                onClick={() => setLeaving(false)}
              >
                Keep going
              </button>
              {started && Object.keys(values).length > 0 && (
                <button
                  type="button"
                  class="btn btn-secondary h-12"
                  onClick={() => {
                    setLeaving(false);
                    finish();
                  }}
                >
                  Finish now and save what I did
                </button>
              )}
              <button type="button" class="btn btn-secondary h-12" onClick={onClose}>
                Pause and come back later
              </button>
              <button
                type="button"
                class="btn btn-ghost h-10 text-sm text-red-600 dark:text-red-400"
                onClick={() => {
                  trainStore.patch({ current: null });
                  onClose();
                }}
              >
                Discard this session
              </button>
            </div>
          </div>
        )}
      </div>
    </Layer>
  );
}

/**
 * The rep count as a big tap target. A ring fills towards the top of the range, with a notch at
 * the bottom of it, so you can see how close you are without reading numbers mid-set.
 */
function RepPad({
  value,
  low,
  high,
  counting,
  taps,
  onTap,
}: {
  value: number;
  low: number;
  high: number;
  counting: boolean;
  taps: number;
  onTap: () => void;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / Math.max(1, high)));
  const lowAt = (low / Math.max(1, high)) * 360 - 90;
  const [nx, ny] = [
    50 + r * Math.cos((lowAt * Math.PI) / 180),
    50 + r * Math.sin((lowAt * Math.PI) / 180),
  ];
  const inRange = value >= low;
  return (
    <button
      type="button"
      class={`rep-pad ${counting ? 'rep-pad-on' : ''} ${inRange ? 'rep-pad-hit' : ''}`}
      aria-label={`Count a rep. ${value} reps${counting ? ' counted' : ''}`}
      onClick={onTap}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} class="rep-pad-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          class="rep-pad-fill"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - frac)}
          transform="rotate(-90 50 50)"
        />
        {low < high && <circle cx={nx} cy={ny} r="2.6" class="rep-pad-notch" />}
      </svg>
      {taps > 0 && <span class="rep-pad-pulse" key={taps} aria-hidden="true" />}
      <output class="player-count tabular" aria-live="polite">
        {value}
      </output>
    </button>
  );
}

function CountRing({
  frac,
  label,
  sub,
  small = false,
}: {
  frac: number;
  label: string;
  sub: string;
  small?: boolean;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      class={`count-ring ${small ? 'count-ring-sm' : ''}`}
      role="timer"
      aria-label={`${label} seconds, ${sub}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} class="count-ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          class="count-ring-fill"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - Math.max(0, Math.min(1, frac)))}
        />
      </svg>
      <span class="count-ring-label">
        <span class="tabular">{label}</span>
        <small>{sub}</small>
      </span>
    </div>
  );
}

function Intro({
  workout,
  resume,
  onStart,
}: {
  workout: Workout;
  resume: boolean;
  onStart: () => void;
}) {
  const items = [...workout.warmUp, ...workout.main, ...workout.coolDown];
  return (
    <div class="player-body">
      <div class="player-info flex-1 overflow-y-auto">
        <p class="eyebrow mb-1">{resume ? 'Pick up where you left off' : 'Ready when you are'}</p>
        <h2 class="font-display text-4xl tracking-tight">
          Session {workout.session}, about {workout.estimatedMinutes} minutes
        </h2>
        <p class="text-muted mt-2">
          Warm up, {workout.main.length} exercises, then a slow cool-down. Each move is shown as you
          go. Turn on spoken cues (the speech bubble) to train without watching the screen.
        </p>
        <ol class="mt-5 grid gap-2">
          {items.map((p, i) => (
            <li
              key={`${p.exercise.id}-${i}`}
              class="surface-muted flex items-center gap-3 rounded-2xl p-2 pr-3"
            >
              <span class="player-thumb">
                <Figure
                  keys={p.exercise.keys}
                  props={p.exercise.props}
                  peak={p.exercise.peak}
                  towel={p.exercise.towel}
                  paused
                  label={p.exercise.name}
                  class="h-full w-full"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{p.exercise.name}</span>
                <span class="text-muted block text-xs">
                  {p.ladder === 'mobility'
                    ? `${p.high} seconds${p.exercise.perSide ? ' each side' : ''}`
                    : `${p.sets} × ${p.low}–${p.high} ${p.exercise.unit === 'seconds' ? 's' : 'reps'}${p.exercise.perSide ? ' each side' : ''}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div class="player-controls">
        <button
          type="button"
          class="btn btn-primary h-14 w-full text-base"
          autofocus
          onClick={onStart}
        >
          <Icon name="play" size={20} /> {resume ? 'Resume' : 'Start'}
        </button>
      </div>
    </div>
  );
}

function Summary({
  setup,
  workout,
  steps,
  values,
  date,
  weightKg,
  activeMs,
  onDone,
}: {
  setup: TrainSetup;
  workout: Workout;
  steps: Step[];
  values: Record<number, number>;
  date: string;
  weightKg: number;
  activeMs: number;
  onDone: () => void;
}) {
  const sets = loggedSets(steps, values);
  const minutes = Math.max(1, Math.round(activeMs / 60000));
  const walkIndex = steps.findIndex((x) => x.kind === 'walk');
  const walked = walkIndex >= 0 ? (values[walkIndex] ?? 0) : 0;
  const strengthMinutes = Math.max(1, minutes - walked);
  const kcal = workoutKcal(workout, sets, weightKg, strengthMinutes);
  const walkKey =
    setup.equipment.includes('treadmill') && !setup.easyOnLegs ? 'walk-incline' : 'walk-brisk';
  const walkKcal = walked > 0 ? exerciseKcal(activity(walkKey)?.met ?? 4.3, weightKg, walked) : 0;
  const reps = sets
    .filter((x) => exerciseById(x.exerciseId)?.unit === 'reps')
    .reduce((n, x) => n + x.value, 0);
  const offers = suggestions(workout, sets, setup);
  // Growth you can see: against the last session of the same kind, and how many you have done.
  const history = trainStore.get().log;
  const prevSame = [...history].reverse().find((l) => l.session === workout.session);
  const repsOf = (l: WorkoutLog) =>
    l.sets
      .filter((x) => exerciseById(x.exerciseId)?.unit === 'reps')
      .reduce((n, x) => n + x.value, 0);
  const prevReps = prevSame ? repsOf(prevSame) : null;
  const sessionNo = history.length + 1;
  const [accept, setAccept] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(offers.map((o) => [o.ladder, true])),
  );
  const [feel, setFeel] = useState<1 | 2 | 3 | undefined>();
  const [toDiary, setToDiary] = useState(true);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    haptic([20, 60, 20, 60, 40]);
    window.setTimeout(() => confetti({ x: 0.5, y: 0.3 }, 140), 150);
  }, []);

  const save = () => {
    const state = trainStore.get();
    const entry: WorkoutLog = {
      id: `${date}-${Date.now().toString(36)}`,
      date,
      session: workout.session,
      week: workout.week,
      minutes,
      sets,
      kcal: kcal + walkKcal,
      ...(feel ? { feel } : {}),
    };
    let rungs = state.setup?.rungs ?? setup.rungs;
    offers.forEach((o: Suggestion) => {
      if (accept[o.ladder]) rungs = { ...rungs, [o.ladder]: o.to };
    });
    trainStore.set({
      ...state,
      setup: state.setup ? { ...state.setup, rungs } : state.setup,
      log: [...state.log, entry],
      current: null,
    });
    if (toDiary) {
      if (sets.length)
        addExercise({ date, activity: 'bodyweight', minutes: strengthMinutes, kcal });
      if (walked > 0) addExercise({ date, activity: walkKey, minutes: walked, kcal: walkKcal });
    }
    onDone();
  };

  return (
    <Layer>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="done-h"
        class="player fixed inset-0 z-[70] flex flex-col"
      >
        <div class="player-body overflow-y-auto">
          <div class="player-info">
            <span class="player-badge" aria-hidden="true">
              <Icon name="check" size={34} />
            </span>
            <h2 id="done-h" class="font-display mt-4 text-4xl tracking-tight">
              {sets.length ? 'Session done.' : 'You showed up.'}
            </h2>
            <p class="text-muted mt-2">
              {sets.length
                ? 'That is the part most people skip. The rest is just repeating it.'
                : 'Even a warm-up keeps the habit alive. Next time, one exercise more.'}
            </p>
            <dl class="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                ['Minutes', String(minutes)],
                ['Sets', String(sets.length)],
                [reps ? 'Reps' : 'kcal', String(reps || kcal + walkKcal)],
              ].map(([k, v]) => (
                <div key={k} class="surface-muted rounded-2xl p-3">
                  <dt class="text-subtle text-xs font-semibold">{k}</dt>
                  <dd class="font-display tabular mt-1 text-3xl">{v}</dd>
                </div>
              ))}
            </dl>
            {sets.length > 0 && (
              <div class="summary-growth">
                <p class="flex items-start gap-2">
                  {prevReps !== null && reps > prevReps && (
                    <Icon name="spark" size={16} class="mt-1 flex-none" />
                  )}
                  <span>
                    {prevReps === null || reps === 0 ? (
                      <>
                        Your first session {workout.session}. Next time, this is the number to beat.
                      </>
                    ) : reps > prevReps ? (
                      <>
                        <strong>{reps - prevReps} more reps</strong> than last session{' '}
                        {workout.session}.
                      </>
                    ) : (
                      <>
                        Last session {workout.session}: {prevReps} reps. Matching it on a busy week
                        still counts.
                      </>
                    )}
                  </span>
                </p>
                <p class="text-subtle mt-0.5 text-xs">
                  {sessionNo === 1
                    ? 'Session one. The hardest one to start.'
                    : `Session ${sessionNo} so far.`}
                </p>
              </div>
            )}

            <fieldset class="mt-6">
              <legend class="label">How did that feel?</legend>
              <div class="grid grid-cols-3 gap-2">
                {(
                  [
                    [1, 'Easy'],
                    [2, 'About right'],
                    [3, 'Hard'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={feel === v}
                    class={`btn h-12 ${feel === v ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFeel(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {feel === 3 && (
                <p class="text-muted mt-2 text-sm">
                  Hard is fine now and then. If every session feels like this, use Too hard on the
                  move that broke you, or pick 20 minutes in your plan.
                </p>
              )}
            </fieldset>

            {offers.length > 0 && (
              <div class="mt-6 grid gap-2">
                <p class="label">For next time</p>
                {offers.map((o) => {
                  const from = exerciseById(o.from);
                  const to = exerciseById(o.to);
                  return (
                    <label
                      key={o.ladder}
                      class="surface-muted flex items-start gap-3 rounded-2xl p-3"
                    >
                      <input
                        type="checkbox"
                        class="mt-1 h-5 w-5 accent-[var(--color-brand-600)]"
                        checked={accept[o.ladder]}
                        onChange={(e) =>
                          setAccept({ ...accept, [o.ladder]: e.currentTarget.checked })
                        }
                      />
                      <span class="text-sm">
                        {o.direction === 'harder' ? (
                          <>
                            <strong>Level up:</strong> you hit the top of the range on every set of{' '}
                            {from?.name}. Move to <strong>{to?.name}</strong>.
                          </>
                        ) : (
                          <>
                            <strong>Step back:</strong> {from?.name} was a stretch today. Build up
                            on <strong>{to?.name}</strong> first.
                          </>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <label class="mt-6 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                class="h-5 w-5 accent-[var(--color-brand-600)]"
                checked={toDiary}
                onChange={(e) => setToDiary(e.currentTarget.checked)}
              />
              Add to today's diary (about {kcal + walkKcal} kcal)
            </label>
          </div>
        </div>
        <div class="player-controls">
          <button
            type="button"
            class="btn btn-primary h-14 w-full text-base"
            autofocus
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </Layer>
  );
}
