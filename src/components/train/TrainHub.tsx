import { lazy, Suspense } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { logStore } from '@/lib/log';
import { planProfile, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { exerciseById, type Equipment } from '@/lib/train/exercises';
import {
  buildWorkout,
  DEFAULT_WEEKDAYS,
  defaultSetup,
  LADDERS,
  pick,
  sessionOn,
  startingRungs,
  weekOf,
  type Session,
  type TrainSetup,
} from '@/lib/train/program';
import { weekStreak } from '@/lib/train/session';
import { trainStore } from '@/lib/train/store';
import { isGentleDay, mindStore } from '@/lib/mind';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { Figure } from './Figure';

const WorkoutPlayer = lazy(() => import('./WorkoutPlayer'));

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EQUIPMENT: Array<{ id: Exclude<Equipment, 'none'>; label: string; hint: string }> = [
  { id: 'towel', label: 'A towel', hint: 'Rows and curls' },
  { id: 'chair', label: 'A sturdy chair', hint: 'Squats, dips, split squats' },
  { id: 'bed', label: 'A bed or sofa', hint: 'Incline push-ups, hip thrusts' },
  { id: 'table', label: 'A sturdy table', hint: 'Rows under it' },
  { id: 'door', label: 'A doorframe', hint: 'Rows holding the frame' },
  { id: 'wall', label: 'A clear wall', hint: 'Wall push-ups and wall sits' },
  { id: 'treadmill', label: 'A treadmill', hint: 'Incline walks' },
];

const LADDER_LABEL: Record<string, string> = {
  push: 'Push',
  shoulders: 'Shoulders',
  squat: 'Squat',
  lunge: 'Lunge',
  pull: 'Pull',
  back: 'Upper back',
  bridge: 'Glutes',
  hinge: 'Hinge',
  plank: 'Plank',
  core: 'Core',
  cardio: 'Cardio',
  arms: 'Arms',
};

const DAY = 864e5;
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

function TrainHubInner() {
  const [state, patch] = trainStore.use();
  const [profile] = useProfile();
  const [weights] = logStore.use();
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [short, setShort] = useState(false);
  const [mind] = mindStore.use();
  const [today, setToday] = useState('');
  useEffect(() => setToday(todayIso()), []);
  // /train/#start (from the Now card on Today) opens the player straight away.
  useEffect(() => {
    if (!today || !location.hash.startsWith('#start')) return;
    const wantShort = location.hash === '#start-short';
    history.replaceState(history.state, '', location.pathname + location.search);
    if (!trainStore.get().setup) return;
    setShort(wantShort);
    setPlaying(true);
  }, [today]);

  const { setup, log, current } = state;
  const weightKg = planProfile(profile, weights.entries).weightKg;

  if (!today) return <div class="surface h-[48rem] animate-pulse" aria-hidden="true" />;

  if (!setup || editing) {
    return (
      <SetupForm
        initial={setup}
        today={today}
        onCancel={setup ? () => setEditing(false) : undefined}
        onSave={(next) => {
          patch({ setup: next });
          setEditing(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  const week = weekOf(setup, today);
  const lastSession = log[log.length - 1]?.session;
  const session: Session = lastSession === 'A' ? 'B' : 'A';
  const doneToday = log.filter((l) => l.date === today);
  const trainingDay = sessionOn(setup, today) !== null;
  const resume = current && current.date === today ? current : null;
  // Back after a long gap: the same moves at week-one volume. A low day offers ten minutes.
  const lastDate = log[log.length - 1]?.date;
  const gap = lastDate
    ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`)) / 864e5)
    : 0;
  const comeback = gap >= 10;
  const gentle = isGentleDay(mind.checkins.find((c) => c.date === today));
  const options = resume?.opts ?? { short, comeback };
  const workout = buildWorkout(setup, resume?.session ?? session, resume?.week ?? week, options);
  const nextDay = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(today, i);
      if (setup.weekdays.includes(weekdayOf(d))) return d;
    }
    return null;
  })();
  const streak = weekStreak(log, setup.startedOn, today);

  return (
    <div class="grid gap-6">
      <TodayCard
        setup={setup}
        workout={workout}
        week={week}
        doneMinutes={doneToday.reduce((n, l) => n + l.minutes, 0)}
        done={doneToday.length > 0}
        trainingDay={trainingDay}
        resuming={!!resume}
        nextDay={nextDay}
        comebackDays={!resume && comeback ? gap : 0}
        gentle={!resume && gentle && !short}
        short={!!options.short}
        onStart={() => setPlaying(true)}
        onShort={() => {
          setShort(true);
          setPlaying(true);
        }}
      />

      <WeekStrip setup={setup} today={today} log={log} />

      <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section class="surface p-5 sm:p-6" aria-labelledby="session-h">
          <div class="flex items-baseline justify-between gap-3">
            <h2 id="session-h" class="text-lg font-bold tracking-tight">
              Session {workout.session}
            </h2>
            <span class="text-muted text-sm">
              Week {workout.week} · about {workout.estimatedMinutes} min
            </span>
          </div>
          {workout.week === 1 && (
            <p class="text-muted mt-1 text-sm">
              Week one is deliberately light: two sets each. The only job this week is showing up.
            </p>
          )}
          <ol class="stagger mt-4 grid gap-2">
            {workout.main.map((p, i) => (
              <li key={p.exercise.id} style={{ '--i': i }}>
                <a
                  href={withBase(`/train/exercises/${p.exercise.id}/`)}
                  class="surface-muted pressable flex items-center gap-3 rounded-2xl p-2 pr-3"
                >
                  <span class="player-thumb">
                    <Figure
                      keys={p.exercise.keys}
                      props={p.exercise.props}
                      muscles={p.exercise.muscles}
                      peak={p.exercise.peak}
                      towel={p.exercise.towel}
                      label={p.exercise.name}
                      class="h-full w-full"
                    />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-semibold">{p.exercise.name}</span>
                    <span class="text-muted block text-xs">
                      {p.sets} sets × {p.low}–{p.high}{' '}
                      {p.exercise.unit === 'seconds' ? 'seconds' : 'reps'}
                      {p.exercise.perSide ? ' each side' : ''}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} class="text-subtle flex-none" />
                </a>
              </li>
            ))}
          </ol>
          <p class="text-muted mt-4 text-sm">
            Plus a two-minute warm-up, a slow cool-down and a {workout.walkMinutes}-minute walk.{' '}
            {workout.walkTip}
          </p>
        </section>

        <div class="grid content-start gap-6">
          <section class="surface p-5 sm:p-6" aria-labelledby="stats-h">
            <h2 id="stats-h" class="text-lg font-bold tracking-tight">
              So far
            </h2>
            {log.length === 0 ? (
              // Three zeros say nothing kind; the first session is the whole point right now.
              <p class="text-muted mt-2 text-sm leading-relaxed">
                Nothing yet, and that is fine. The first session is the hardest one to start, so
                this week asks only that you turn up. Your sessions, streak and minutes gather here
                after it.
              </p>
            ) : (
              <dl class="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Sessions', log.length],
                  ['Week streak', streak],
                  ['Minutes', log.reduce((n, l) => n + l.minutes, 0)],
                ].map(([k, v]) => (
                  <div key={k} class="surface-muted rounded-2xl p-3">
                    <dt class="text-subtle text-[11px] font-semibold">{k}</dt>
                    <dd class="font-display tabular mt-1 text-2xl">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <Ladders setup={setup} />
        </div>
      </div>

      {log.length > 0 && <History log={log} />}

      <section class="surface flex flex-wrap items-center gap-3 p-5" aria-label="Training settings">
        <div class="min-w-0 flex-1">
          <p class="font-semibold">
            <span class="whitespace-nowrap">
              {setup.weekdays.length === 7 ? 'Every day' : `${setup.weekdays.length} days a week`}
            </span>{' '}
            <span class="whitespace-nowrap">· {setup.minutes} minutes</span>
          </p>
          <p class="text-muted text-sm">
            {[
              setup.weekdays.length === 7
                ? ''
                : [...setup.weekdays].sort((a, b) => a - b).join() === '1,2,3,4,5'
                  ? 'Monday to Friday'
                  : [...setup.weekdays]
                      .sort((a, b) => a - b)
                      .map((d) => DAY_NAMES[d])
                      .join(', '),
              setup.easyOnLegs ? 'easy on the legs' : '',
            ]
              .filter(Boolean)
              .join(' · ') || 'Sessions A and B alternate, so each muscle still rests'}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary h-10 text-sm"
          onClick={() => setEditing(true)}
        >
          Change plan
        </button>
      </section>

      {playing && (
        <Suspense fallback={null}>
          <WorkoutPlayer
            setup={setup}
            workout={workout}
            date={today}
            weightKg={weightKg}
            resume={resume}
            options={options}
            onClose={() => {
              setPlaying(false);
              setShort(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function TodayCard({
  setup,
  workout,
  week,
  done,
  doneMinutes,
  trainingDay,
  resuming,
  nextDay,
  comebackDays,
  gentle,
  short,
  onStart,
  onShort,
}: {
  setup: TrainSetup;
  workout: ReturnType<typeof buildWorkout>;
  week: number;
  done: boolean;
  doneMinutes: number;
  trainingDay: boolean;
  resuming: boolean;
  nextDay: string | null;
  comebackDays: number;
  gentle: boolean;
  short: boolean;
  onStart: () => void;
  onShort: () => void;
}) {
  const hero = workout.main[0]?.exercise;
  const title = done
    ? 'Done for today'
    : resuming
      ? 'Pick up where you left off'
      : trainingDay
        ? `Session ${workout.session} is ready`
        : 'Rest day';
  const lede = done
    ? `${doneMinutes} minutes in the bank. Eat some protein, drink water, sleep well: that is when the muscle is built.`
    : resuming
      ? 'Your progress is saved. Carry on from the exact set you stopped at.'
      : comebackDays
        ? `Welcome back after ${comebackDays} days. Today is lighter on purpose: the same moves, two sets each. Next time, back to normal.`
        : gentle
          ? 'A low day. Do the full session if you feel like it once you start, or the ten-minute version. Both count.'
          : trainingDay
            ? `${workout.main.length} exercises, about ${workout.estimatedMinutes} minutes, all on the floor of your room.`
            : `Recovery is part of the plan. A ${workout.walkMinutes}-minute walk still helps.${
                nextDay ? ` Next session ${DAY_LONG[weekdayOf(nextDay)]}.` : ''
              }`;
  return (
    <section class="train-hero surface overflow-hidden" aria-labelledby="train-today-h">
      <div class="grid items-center gap-2 sm:grid-cols-[1.1fr_1fr]">
        <div class="p-5 sm:p-7">
          <p class="eyebrow">
            Today · Week {week}
            {setup.easyOnLegs ? ' · easy on the legs' : ''}
          </p>
          <h2 id="train-today-h" class="font-display text-3xl tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p class="text-muted mt-2">{lede}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            {!done && (
              <button type="button" class="btn btn-primary h-12 px-6 text-base" onClick={onStart}>
                <Icon name="play" size={18} />
                {resuming ? 'Resume' : trainingDay ? 'Start workout' : 'Train anyway'}
              </button>
            )}
            {!done && !resuming && (gentle || !trainingDay) && !short && (
              <button type="button" class="btn btn-secondary h-12 px-5" onClick={onShort}>
                10-minute version
              </button>
            )}
            {done && (
              <span class="chip h-9 px-3 text-sm">
                <Icon name="check" size={16} /> Logged to your diary
              </span>
            )}
          </div>
        </div>
        {hero && (
          <div class="train-hero-stage" aria-hidden="true">
            <Figure
              keys={hero.keys}
              props={hero.props}
              muscles={hero.muscles}
              peak={hero.peak}
              towel={hero.towel}
              label={hero.name}
              align="bottom"
              fit
              class="h-full w-full"
            />
          </div>
        )}
      </div>
    </section>
  );
}

function WeekStrip({
  setup,
  today,
  log,
}: {
  setup: TrainSetup;
  today: string;
  log: ReadonlyArray<{ date: string }>;
}) {
  // The current week, Saturday to Friday or Sunday to Saturday depending on where it starts.
  const start = addDays(today, -weekdayOf(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const done = new Set(log.map((l) => l.date));
  const planned = days.filter((d) => setup.weekdays.includes(weekdayOf(d))).length;
  const doneThisWeek = days.filter((d) => done.has(d)).length;
  return (
    <section class="surface p-4 sm:p-5" aria-labelledby="week-h">
      <div class="flex items-baseline justify-between gap-3">
        <h2 id="week-h" class="font-bold tracking-tight">
          This week
        </h2>
        <span class="text-muted tabular text-sm">
          {doneThisWeek} of {planned} sessions
        </span>
      </div>
      <ol class="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const wd = weekdayOf(d);
          const isTraining = setup.weekdays.includes(wd);
          const isDone = done.has(d);
          const isToday = d === today;
          const past = d < today;
          const state = isDone ? 'done' : isTraining ? (past ? 'missed' : 'planned') : 'rest';
          return (
            <li
              key={d}
              class={`week-day week-${state} ${isToday ? 'week-today' : ''}`}
              aria-label={`${DAY_LONG[wd]}: ${
                state === 'done'
                  ? 'done'
                  : state === 'planned'
                    ? 'training'
                    : state === 'missed'
                      ? 'missed'
                      : 'rest'
              }${isToday ? ', today' : ''}`}
            >
              <span class="text-[11px] font-semibold">{DAY_NAMES[wd]}</span>
              <span class="week-dot" aria-hidden="true">
                {isDone && <Icon name="check" size={14} />}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Ladders({ setup }: { setup: TrainSetup }) {
  const used = ['push', 'squat', 'pull', 'bridge', 'plank', 'core'];
  return (
    <section class="surface p-5 sm:p-6" aria-labelledby="ladders-h">
      <h2 id="ladders-h" class="text-lg font-bold tracking-tight">
        Your moves
      </h2>
      <p class="text-muted mt-1 text-sm">
        Each move climbs a ladder. Hit the top of the range on every set and you move up a rung.
      </p>
      <ul class="mt-4 grid gap-3">
        {used.map((key) => {
          const rungs = LADDERS[key] ?? [];
          const e = pick(key, setup);
          if (!e) return null;
          const i = rungs.indexOf(e.id);
          const next = rungs
            .slice(i + 1)
            .map((id) => exerciseById(id))
            .find(Boolean);
          return (
            <li key={key}>
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="text-muted">{LADDER_LABEL[key]}</span>
                <a
                  class="truncate font-semibold hover:underline"
                  href={withBase(`/train/exercises/${e.id}/`)}
                >
                  {e.name}
                </a>
              </div>
              <div class="mt-1.5 flex gap-1" aria-hidden="true">
                {rungs.map((id, j) => (
                  <span
                    key={id}
                    class={`h-1.5 flex-1 rounded-full ${j <= i ? 'bg-brand-500' : 'bg-muted'}`}
                  />
                ))}
              </div>
              <p class="sr-only">
                Rung {i + 1} of {rungs.length}
                {next ? `, next ${next.name}` : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function History({ log }: { log: ReturnType<typeof trainStore.get>['log'] }) {
  const recent = [...log].reverse().slice(0, 6);
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  return (
    <section class="surface p-5 sm:p-6" aria-labelledby="hist-h">
      <h2 id="hist-h" class="text-lg font-bold tracking-tight">
        Recent sessions
      </h2>
      <ul class="mt-3 divide-y divide-[var(--border)]">
        {recent.map((l) => (
          <li key={l.id} class="flex items-center gap-3 py-2.5 text-sm">
            <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 grid h-9 w-9 flex-none place-items-center rounded-xl font-bold">
              {l.session}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{fmt(l.date)}</span>
              <span class="text-muted block text-xs">
                {l.sets.length} sets · {l.minutes} min · {l.kcal} kcal
                {l.feel ? ` · felt ${['', 'easy', 'about right', 'hard'][l.feel]}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SetupForm({
  initial,
  today,
  onSave,
  onCancel,
}: {
  initial: TrainSetup | null;
  today: string;
  onSave: (s: TrainSetup) => void;
  onCancel?: () => void;
}) {
  const base = initial ?? defaultSetup(today);
  const [equipment, setEquipment] = useState<Equipment[]>(base.equipment);
  const [weekdays, setWeekdays] = useState<number[]>(base.weekdays);
  const [minutes, setMinutes] = useState<TrainSetup['minutes']>(base.minutes);
  const [level, setLevel] = useState<TrainSetup['level']>(base.level);
  const [easyOnLegs, setEasy] = useState(base.easyOnLegs);

  const preview = useMemo(
    () =>
      buildWorkout(
        { ...base, equipment, weekdays, minutes, level, easyOnLegs, rungs: startingRungs(level) },
        'A',
        2,
      ),
    [equipment, weekdays, minutes, level, easyOnLegs],
  );

  const toggleEquip = (id: Equipment) =>
    setEquipment(equipment.includes(id) ? equipment.filter((e) => e !== id) : [...equipment, id]);
  const toggleDay = (d: number) =>
    setWeekdays(
      weekdays.includes(d)
        ? weekdays.filter((x) => x !== d)
        : [...weekdays, d].sort((a, b) => a - b),
    );

  const save = () => {
    const levelChanged = !initial || initial.level !== level;
    onSave({
      equipment,
      weekdays: weekdays.length ? weekdays : DEFAULT_WEEKDAYS[3]!,
      minutes,
      level,
      easyOnLegs,
      startedOn: initial?.startedOn ?? today,
      rungs: levelChanged ? startingRungs(level) : initial.rungs,
    });
  };

  return (
    <section class="surface grid gap-7 p-5 sm:p-7" aria-labelledby="setup-h">
      <div>
        <p class="eyebrow">{initial ? 'Change your plan' : 'Two minutes to set up'}</p>
        <h2 id="setup-h" class="font-display text-3xl tracking-tight">
          {initial ? 'Adjust your training' : 'A plan for your room, your body, your week'}
        </h2>
        <p class="text-muted mt-2 max-w-2xl">
          No gym, no gear. Everything works on the floor, and anything you have below just adds
          options. You can change all of this later.
        </p>
      </div>

      <fieldset>
        <legend class="label">Besides floor space, what do you have?</legend>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT.map((e) => {
            const on = equipment.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={on}
                class={`pressable flex items-center gap-3 rounded-2xl border p-3 text-left ${
                  on
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-400/10'
                    : 'border-line hover:bg-muted'
                }`}
                onClick={() => toggleEquip(e.id)}
              >
                <span
                  class={`grid h-6 w-6 flex-none place-items-center rounded-full border ${
                    on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong'
                  }`}
                  aria-hidden="true"
                >
                  {on && <Icon name="check" size={14} />}
                </span>
                <span>
                  <span class="block text-sm font-semibold">{e.label}</span>
                  <span class="text-muted block text-xs">{e.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend class="label">Which days suit you?</legend>
        <div class="grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((n, d) => {
            const on = weekdays.includes(d);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                class={`pressable h-12 rounded-xl text-sm font-semibold ${
                  on ? 'bg-brand-600 text-white' : 'bg-muted text-muted hover:text-fg'
                }`}
                onClick={() => toggleDay(d)}
              >
                {n}
                <span class="sr-only">{DAY_LONG[d]!.slice(3)}</span>
              </button>
            );
          })}
        </div>
        <p class="text-muted mt-2 text-sm">
          {weekdays.length < 2
            ? 'Pick at least two days. Three is the sweet spot for most people.'
            : weekdays.length > 4
              ? 'That is a lot of days. Sessions alternate, so each muscle still gets rest.'
              : `${weekdays.length} days a week. Sessions A and B alternate.`}
        </p>
      </fieldset>

      <Segmented
        label="How long per session?"
        name="train-minutes"
        value={String(minutes) as '20' | '30' | '45'}
        onChange={(v) => setMinutes(Number(v) as TrainSetup['minutes'])}
        options={[
          { value: '20', label: '20 min', hint: 'Busy days' },
          { value: '30', label: '30 min', hint: 'Recommended' },
          { value: '45', label: '45 min', hint: 'More volume' },
        ]}
      />

      <Segmented
        label="Where are you starting?"
        name="train-level"
        value={String(level) as '1' | '2' | '3'}
        onChange={(v) => setLevel(Number(v) as TrainSetup['level'])}
        options={[
          { value: '1', label: 'New', hint: "Or it's been a while" },
          { value: '2', label: 'Some', hint: 'A few push-ups' },
          { value: '3', label: 'Regular', hint: 'I train already' },
        ]}
      />

      <label class="flex items-start gap-3">
        <input
          type="checkbox"
          class="mt-0.5 h-5 w-5 accent-[var(--color-brand-600)]"
          checked={easyOnLegs}
          onChange={(e) => setEasy(e.currentTarget.checked)}
        />
        <span>
          <span class="block font-semibold">Go easy on my knees and legs</span>
          <span class="text-muted block text-sm">
            No jumping, lunging or deep single-leg work, and flat walks. Pain that is sharp, or
            lasts more than a couple of weeks, is worth showing a doctor or physio.
          </span>
        </span>
      </label>

      <div class="surface-muted rounded-2xl p-4">
        <p class="text-sm font-semibold">A typical session for you</p>
        <p class="text-muted mt-1 text-sm">
          {preview.main.map((p) => p.exercise.name).join(' · ')}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary h-12 px-6 text-base"
          disabled={weekdays.length < 1}
          onClick={save}
        >
          {initial ? 'Save changes' : 'Build my plan'} <Icon name="arrow" size={18} />
        </button>
        {onCancel && (
          <button type="button" class="btn btn-ghost h-12" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}

export default function TrainHub() {
  return (
    <ErrorBoundary area="training">
      <TrainHubInner />
    </ErrorBoundary>
  );
}
