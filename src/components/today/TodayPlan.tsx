import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bodyStore } from '@/lib/body';
import { activity, exerciseKcal } from '@/lib/calc/exercise';
import { buildDay, dayStore, missedItems, nowItem, toggleTick, type DayItem } from '@/lib/day';
import { addExercise, diaryStore } from '@/lib/food-store';
import { confetti, haptic } from '@/lib/fx';
import { lifeStore, toMinutes } from '@/lib/life';
import { logStore } from '@/lib/log';
import { listPhotos, photosSupported } from '@/lib/photos';
import { planProfile, todayIso } from '@/lib/plan';
import { prayerTimes } from '@/lib/prayer';
import { DEFAULT_EVENTS, eventsFrom, moonPhase } from '@/lib/sky';
import { useProfile } from '@/lib/profile';
import { buildWorkout, weekOf } from '@/lib/train/program';
import { trainStore } from '@/lib/train/store';
import { withBase } from '@/lib/url';
import { lastGood, mindStore } from '@/lib/mind';
import { GoodThing } from '../mind/GoodThing';
import TodayMind from '../mind/TodayMind';
import { DayDial, KIND_ICON, KindIcon } from './DayDial';
import { PrayerStrip } from './PrayerStrip';
import { SkyScene } from './SkyScene';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';

const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** "07:30" in the device's own clock style. */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function relative(item: DayItem, now: number): string {
  let diff = toMinutes(item.time) - now;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;
  if (Math.abs(diff) <= 5) return 'Now';
  const span = (m: number) =>
    m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  if (diff > 0) return `In ${span(diff)}`;
  if (item.end && toMinutes(item.end) > now) return 'Now';
  return `${span(-diff)} ago`;
}

/** 'Yesterday', or the weekday for a note from two or three days back. */
function echoWhen(from: string, today: string): string {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5;
  return days <= 1
    ? 'Yesterday'
    : `On ${new Date(`${from}T12:00:00`).toLocaleDateString('en', { weekday: 'long' })}`;
}

/** One line under the greeting that says where the day stands, in words. */
function dayLine(current: DayItem | null, done: number, total: number, now: number): string {
  const tally =
    done === 0
      ? now < 660
        ? 'A fresh day.'
        : 'Nothing ticked yet.'
      : done >= total
        ? 'Everything is done.'
        : `${done} done, ${total - done} to go.`;
  if (!current) return done >= total ? 'Everything is done. Rest well.' : `${tally} Rest well.`;
  const when = relative(current, now);
  // Mid-sentence, but prayer names keep their capital.
  const what =
    current.kind === 'prayer'
      ? current.title
      : current.title.charAt(0).toLowerCase() + current.title.slice(1);
  if (when === 'Now') return `${tally} Now: ${what}.`;
  if (when.endsWith('ago')) return `${tally} Still to tick off: ${what}.`;
  return `${tally} Next, ${what} at ${clock(current.time)}.`;
}

function greeting(now: number, name: string): string {
  const part =
    now < 300
      ? 'Still up'
      : now < 720
        ? 'Good morning'
        : now < 1020
          ? 'Good afternoon'
          : 'Good evening';
  return name.trim() ? `${part}, ${name.trim()}` : part;
}

function TodayPlanInner() {
  const [life] = lifeStore.use();
  const [train] = trainStore.use();
  const [diary] = diaryStore.use();
  const [weights] = logStore.use();
  const [{ ticks }] = dayStore.use();
  const [body] = bodyStore.use();
  const [profile] = useProfile();
  const [{ goods }] = mindStore.use();
  const [date, setDate] = useState('');
  const [now, setNow] = useState(0);
  const [lastPhoto, setLastPhoto] = useState<string | null | undefined>(undefined);
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [catchUp, setCatchUp] = useState(false);

  // A live clock: the Now card moves on by itself, and a new day starts at midnight.
  useEffect(() => {
    const tick = () => {
      setDate(todayIso());
      setNow(minutesNow());
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  useEffect(() => {
    if (!photosSupported()) return setLastPhoto(null);
    listPhotos()
      .then((ps) =>
        setLastPhoto(
          ps
            .map((p) => p.date)
            .sort()
            .pop() ?? null,
        ),
      )
      .catch(() => setLastPhoto(null));
  }, []);

  const day = useMemo(() => {
    if (!date) return null;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const p = life.prayer;
    const prayers =
      p.on && p.lat !== null && p.lon !== null
        ? prayerTimes(date, p.lat, p.lon, { method: p.method, asr: p.asr, ramadan: life.fasting })
        : null;
    const setup = train.setup;
    const workout = setup ? buildWorkout(setup, 'A', weekOf(setup, date)) : null;
    const photoDue =
      lastPhoto !== undefined &&
      (lastPhoto === null ||
        Date.parse(`${date}T00:00:00Z`) - Date.parse(`${lastPhoto}T00:00:00Z`) >=
          (life.photoWeeks * 7 - 1) * 864e5);
    const logged = new Set(
      diary.food.filter((f) => f.date === date).map((f) => f.meal) as Array<
        'breakfast' | 'lunch' | 'dinner' | 'snack'
      >,
    );
    return buildDay({
      date,
      weekday,
      life,
      prayers,
      trainingDay: !!setup && setup.weekdays.includes(weekday),
      trained: train.log.some((l) => l.date === date),
      sessionMinutes: workout ? Math.max(15, workout.estimatedMinutes) : 25,
      walkMinutes: workout?.walkMinutes ?? 20,
      logged,
      weighed: weights.entries.some((e) => e.date === date),
      photoDue,
      measureDue: (() => {
        const last = body.measures.at(-1)?.date;
        return (
          !last ||
          Date.parse(`${date}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`) >=
            (life.photoWeeks * 7 - 1) * 864e5
        );
      })(),
      ticks: new Set(ticks[date] ?? []),
      minutesOf: (d) => d.getHours() * 60 + d.getMinutes(),
    });
  }, [date, life, train, diary.food, weights.entries, ticks, lastPhoto, body.measures]);

  // The sky needs the sun's day even when prayers are off; a set city makes it exact.
  const sky = useMemo(() => {
    if (!date) return null;
    const p = life.prayer;
    if (p.lat === null || p.lon === null) return { events: DEFAULT_EVENTS, prayers: null };
    const t = prayerTimes(date, p.lat, p.lon, {
      method: p.method,
      asr: p.asr,
      ramadan: life.fasting,
    });
    const m = (d: Date) => d.getHours() * 60 + d.getMinutes();
    const mins = {
      fajr: m(t.fajr),
      sunrise: m(t.sunrise),
      dhuhr: m(t.dhuhr),
      asr: m(t.asr),
      maghrib: m(t.maghrib),
      isha: m(t.isha),
    };
    return { events: eventsFrom(mins), prayers: p.on ? mins : null };
  }, [date, life.prayer, life.fasting]);

  // Finishing the whole day, there and then, gets one celebration. Loading a finished day, or a
  // new day starting, does not.
  const doneNow = day ? day.filter((i) => !i.passive && i.done).length : 0;
  const totalNow = day ? day.filter((i) => !i.passive).length : 0;
  const seen = useRef<{ date: string; done: number } | null>(null);
  useEffect(() => {
    if (!date || !totalNow) return;
    const prev = seen.current;
    seen.current = { date, done: doneNow };
    if (prev && prev.date === date && prev.done < totalNow && doneNow === totalNow) {
      confetti({ x: 0.5, y: 0.3 }, 130);
      haptic([14, 40, 14, 40, 24]);
    }
  }, [date, doneNow, totalNow]);

  if (!day || !sky)
    return <div class="surface mb-8 h-[54rem] animate-pulse sm:h-[46rem]" aria-hidden="true" />;

  const current = nowItem(day, now);
  const missed = missedItems(day, now).filter((i) => i.id !== current?.id);
  const actionable = day.filter((i) => !i.passive);
  const doneCount = actionable.filter((i) => i.done).length;
  const upcoming = current ? day.slice(day.indexOf(current) + 1).filter((i) => !i.done) : [];
  const shown = all ? day : upcoming.slice(0, 3);
  const why = life.why.trim();
  // Mornings start with what you said was good last night.
  const echo = now < 720 ? lastGood(goods, date) : null;
  const picked = sel ? (day.find((i) => i.id === sel) ?? null) : null;

  const tick = (item: DayItem) => {
    if (item.auto) return;
    toggleTick(date, item.id);
    haptic(item.done ? 8 : [12, 30, 12]);
  };

  return (
    <section class="today-plan mb-8 grid gap-4" aria-labelledby="plan-h">
      <div class="today-hero surface">
        <SkyScene now={now} events={sky.events} moon={moonPhase(new Date(`${date}T21:00:00`))}>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="sky-eyebrow">
                {new Date(`${date}T12:00:00`).toLocaleDateString('en', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <h2 id="plan-h" class="sky-title">
                {greeting(now, life.name)}
              </h2>
              <p class="sky-sub">{dayLine(current, doneCount, actionable.length, now)}</p>
            </div>
            <a class="sky-chip" href={withBase('/you/#day')} aria-label="Edit my day">
              <Icon name="edit" size={14} />
              <span class="sky-chip-label">Edit my day</span>
            </a>
          </div>
        </SkyScene>
        {echo && (
          <div class="echo-card">
            <Icon name="spark" size={18} />
            <p>
              <span class="echo-when">{echoWhen(echo.date, date)}, your good thing</span>
              {`“${echo.text}”`}
            </p>
          </div>
        )}
        {sky.prayers && <PrayerStrip times={sky.prayers} now={now} />}
        <div class="today-hero-grid">
          <DayDial
            items={day}
            now={now}
            selected={sel}
            onSelect={(id) => setSel(sel === id ? null : id)}
            center={
              picked ? (
                <>
                  <span class={`dial-center-icon kind-${picked.kind}`}>
                    <KindIcon kind={picked.kind} size={18} />
                  </span>
                  <span class="dial-center-time">{clock(picked.time)}</span>
                  <span class="dial-center-title">{picked.title}</span>
                  {!picked.passive && (
                    <button
                      type="button"
                      class={`dial-center-tick ${picked.done ? 'is-done' : ''}`}
                      disabled={picked.auto}
                      onClick={() => tick(picked)}
                    >
                      <Icon name="check" size={14} />
                      {picked.done ? 'Done' : 'Mark done'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span class="dial-center-clock tabular">
                    {clock(
                      `${String(Math.floor(now / 60)).padStart(2, '0')}:${String(now % 60).padStart(2, '0')}`,
                    )}
                  </span>
                  <span class="dial-center-sub tabular">
                    {doneCount} of {actionable.length} done
                  </span>
                </>
              )
            }
          />
          <div class="min-w-0">
            <div>
              {current ? (
                <NowCard
                  bare
                  item={current}
                  now={now}
                  date={date}
                  weightKg={planProfile(profile, weights.entries).weightKg}
                  onTick={() => tick(current)}
                />
              ) : (
                <div class="py-2">
                  <p class="eyebrow">That's the day</p>
                  <h3 class="font-display text-3xl tracking-tight">
                    {doneCount >= actionable.length - 1
                      ? 'Everything done. Rest well.'
                      : 'Rest now. Tomorrow is a fresh page.'}
                  </h3>
                  {why && <p class="text-muted mt-2 italic">“{why}”</p>}
                  <div class="mt-4">
                    <GoodThing date={date} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!life.ready && life.goals.length === 0 && (
        <a
          href={withBase('/you/')}
          class="surface-muted pressable flex items-center gap-3 rounded-2xl p-3 text-sm"
        >
          <Icon name="spark" size={18} class="text-brand-600 dark:text-brand-300 flex-none" />
          <span class="min-w-0 flex-1">
            <strong>Make this day yours.</strong> Tell Ethereal when you wake, eat and work, and
            this plan fits around you.
          </span>
          <Icon name="chevron" size={16} class="text-subtle flex-none" />
        </a>
      )}

      <TodayMind date={date} />

      {missed.length > 0 && (
        <div class="surface-muted rounded-2xl">
          <button
            type="button"
            class="flex w-full items-center gap-3 p-3 text-left text-sm"
            aria-expanded={catchUp}
            onClick={() => setCatchUp(!catchUp)}
          >
            <Icon name="reset" size={18} class="text-brand-600 dark:text-brand-300 flex-none" />
            <span class="min-w-0 flex-1">
              <strong>Catch me up.</strong> {missed.length} thing{missed.length === 1 ? '' : 's'}{' '}
              slipped past. No guilt: tick what you did, let the rest go.
            </span>
            <Icon
              name="chevron"
              size={16}
              class={`text-subtle flex-none transition ${catchUp ? 'rotate-90' : ''}`}
            />
          </button>
          {catchUp && (
            <ul class="timeline px-2 pb-2">
              {missed.map((i) => (
                <Row key={i.id} item={i} onTick={() => tick(i)} />
              ))}
            </ul>
          )}
        </div>
      )}

      {(shown.length > 0 || all) && (
        <div class="surface p-2 sm:p-3">
          <p class="text-subtle px-2 pt-1 pb-2 text-xs font-semibold">
            {all ? 'Your whole day' : 'Coming up'}
          </p>
          <ol class="timeline">
            {shown.map((i) => (
              <Row key={i.id} item={i} current={i.id === current?.id} onTick={() => tick(i)} />
            ))}
          </ol>
          <button
            type="button"
            class="text-brand-700 dark:text-brand-300 w-full p-2 text-center text-sm font-semibold"
            aria-expanded={all}
            onClick={() => setAll(!all)}
          >
            {all ? 'Show less' : `See the whole day (${day.length})`}
          </button>
        </div>
      )}
    </section>
  );
}

function Row({
  item,
  current = false,
  onTick,
}: {
  item: DayItem;
  current?: boolean;
  onTick: () => void;
}) {
  // Swipe right to tick. Vertical movement hands the gesture back to the page scroll.
  const canSwipe = !item.passive && !item.auto;
  const [dx, setDx] = useState(0);
  // A small pop at the moment something is ticked, never on a plain re-render.
  const wasDone = useRef(item.done);
  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    if (item.done && !wasDone.current) {
      setJustDone(true);
      const t = window.setTimeout(() => setJustDone(false), 700);
      wasDone.current = true;
      return () => window.clearTimeout(t);
    }
    wasDone.current = item.done;
  }, [item.done]);
  const drag = useRef<{ x: number; y: number; locked: boolean; moved: boolean } | null>(null);
  const THRESHOLD = 72;
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.locked && dx >= THRESHOLD) {
      haptic([10, 30, 10]);
      onTick();
    }
    setDx(0);
  };
  return (
    <li
      class={`tl-row kind-${item.kind} ${item.done ? 'tl-done' : ''} ${current ? 'tl-current' : ''} ${item.passive ? 'tl-passive' : ''} ${dx ? 'is-dragging' : ''} ${justDone ? 'is-just-done' : ''}`}
      onPointerDown={(e) => {
        if (!canSwipe || e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, locked: false, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const mx = e.clientX - d.x;
        const my = e.clientY - d.y;
        if (!d.locked) {
          if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.5) {
            d.locked = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } else if (Math.abs(my) > 10) {
            drag.current = null;
            return;
          } else return;
        }
        d.moved = true;
        const next = Math.max(0, Math.min(120, mx));
        if (dx < THRESHOLD && next >= THRESHOLD) haptic(8);
        setDx(next);
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        drag.current = null;
        setDx(0);
      }}
      onClickCapture={(e) => {
        // A swipe that ends over the tick button is not also a tap on it.
        if (dx > 0) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {canSwipe && (
        <span class="tl-swipe" style={{ opacity: Math.min(1, dx / THRESHOLD) }} aria-hidden="true">
          <Icon name={item.done ? 'reset' : 'check'} size={18} />
        </span>
      )}
      <span class="tl-body" style={dx ? { transform: `translateX(${dx}px)` } : undefined}>
        <span class="tl-time tabular">{clock(item.time)}</span>
        <span class="tl-dot" aria-hidden="true">
          <Icon name={item.done ? 'check' : KIND_ICON[item.kind]} size={14} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="tl-title block truncate">
            {item.title}
            {item.end && <span class="text-subtle font-normal"> · until {clock(item.end)}</span>}
          </span>
          {item.detail && !item.passive && (
            <span class="text-muted block truncate text-xs">{item.detail}</span>
          )}
        </span>
        {!item.passive && (
          <button
            type="button"
            class="tl-tick"
            aria-pressed={item.done}
            aria-label={
              item.auto
                ? `${item.title}: done from your log`
                : `${item.title}: ${item.done ? 'done' : 'mark done'}`
            }
            disabled={item.auto}
            onClick={onTick}
          >
            <Icon name="check" size={16} />
          </button>
        )}
      </span>
    </li>
  );
}

function NowCard({
  bare = false,
  item,
  now,
  date,
  weightKg,
  onTick,
}: {
  item: DayItem;
  now: number;
  date: string;
  weightKg: number;
  onTick: () => void;
  /** Inside the Today hero: no card of its own. */
  bare?: boolean;
}) {
  const when = relative(item, now);
  const logWalk = () => {
    const mins = Number(/^(\d+)/.exec(item.title)?.[1] ?? 20);
    addExercise({
      date,
      activity: 'walk-brisk',
      minutes: mins,
      kcal: exerciseKcal(activity('walk-brisk')?.met ?? 4.3, weightKg, mins),
    });
    onTick();
  };
  const action = (() => {
    switch (item.kind) {
      case 'meal':
        return (
          <button
            type="button"
            class="btn btn-primary h-12 px-5"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('ethereal:add-food', { detail: { meal: item.meal } }),
              )
            }
          >
            <Icon name="plus" size={18} /> Log {item.title.toLowerCase()}
          </button>
        );
      case 'workout':
        return (
          <a class="btn btn-primary h-12 px-5" href={withBase('/train/#start')}>
            <Icon name="play" size={18} /> Start workout
          </a>
        );
      case 'walk':
        return (
          <button type="button" class="btn btn-primary h-12 px-5" onClick={logWalk}>
            <Icon name="check" size={18} /> Walked it, log it
          </button>
        );
      case 'weigh':
        return (
          <a class="btn btn-primary h-12 px-5" href={withBase('/progress/#quick-weight')}>
            <Icon name="scale" size={18} /> Weigh in
          </a>
        );
      case 'measure':
        return (
          <a class="btn btn-primary h-12 px-5" href={withBase('/progress/body/')}>
            <Icon name="ruler" size={18} /> Measure
          </a>
        );
      case 'photo':
        return (
          <a class="btn btn-primary h-12 px-5" href={withBase('/track/#photos')}>
            <Icon name="camera" size={18} /> Take photos
          </a>
        );
      case 'wind':
        return (
          <button
            type="button"
            class="btn btn-primary h-12 px-5"
            onClick={() => window.dispatchEvent(new Event('ethereal:breathe'))}
          >
            <Icon name="leaf" size={18} /> Breathe for two minutes
          </button>
        );
      default:
        return (
          <button type="button" class="btn btn-primary h-12 px-5" onClick={onTick}>
            <Icon name="check" size={18} /> Done
          </button>
        );
    }
  })();
  const hasOwnAction = ['meal', 'workout', 'weigh', 'photo', 'measure', 'wind'].includes(item.kind);
  // Through its window when it has one and it is under way; filling over the last hour before
  // it starts; nothing for things that have already slipped past.
  const start = toMinutes(item.time);
  const finish = item.end ? toMinutes(item.end) : null;
  const progress =
    finish !== null && now >= start && now < finish
      ? (now - start) / (finish - start)
      : start > now && start - now <= 60
        ? 1 - (start - now) / 60
        : null;
  return (
    <div
      class={`now kind-${item.kind} ${bare ? '' : 'now-card surface overflow-hidden'}`}
      role="region"
      aria-label="What's next"
      aria-live="polite"
    >
      <div class={`flex items-start gap-4 ${bare ? '' : 'p-5 sm:p-6'}`}>
        <span class="now-icon" aria-hidden="true">
          <Icon name={KIND_ICON[item.kind]} size={26} />
        </span>
        <div class="min-w-0 flex-1">
          <p class="eyebrow mb-1">
            {when === 'Now'
              ? 'Now'
              : when.endsWith('ago')
                ? `Was ${when}`
                : `Next · ${when.toLowerCase()}`}{' '}
            · {clock(item.time)}
          </p>
          <h3 class="font-display text-3xl leading-tight tracking-tight">{item.title}</h3>
          {item.detail && <p class="text-muted mt-1">{item.detail}</p>}
          {progress !== null && (
            <div class="now-bar" aria-hidden="true">
              <span style={{ '--p': progress.toFixed(3) }} />
            </div>
          )}
          <div class="mt-4 flex flex-wrap gap-2">
            {action}
            {hasOwnAction && (
              <button type="button" class="btn btn-secondary h-12 px-4" onClick={onTick}>
                {item.kind === 'meal' ? 'Ate, skip logging' : 'Done'}
              </button>
            )}
          </div>
          {(item.kind === 'wind' || item.kind === 'sleep') && (
            <div class="mt-4">
              <GoodThing date={date} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TodayPlan() {
  return (
    <ErrorBoundary area="today's plan">
      <TodayPlanInner />
    </ErrorBoundary>
  );
}
