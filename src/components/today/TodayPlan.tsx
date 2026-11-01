import { useEffect, useMemo, useState } from 'preact/hooks';
import { activity, exerciseKcal } from '@/lib/calc/exercise';
import {
  buildDay,
  dayStore,
  missedItems,
  nowItem,
  toggleTick,
  type DayItem,
  type DayKind,
} from '@/lib/day';
import { addExercise, diaryStore } from '@/lib/food-store';
import { haptic } from '@/lib/fx';
import { GOALS, lifeStore, toMinutes } from '@/lib/life';
import { logStore } from '@/lib/log';
import { listPhotos, photosSupported } from '@/lib/photos';
import { planProfile, todayIso } from '@/lib/plan';
import { prayerTimes } from '@/lib/prayer';
import { useProfile } from '@/lib/profile';
import { buildWorkout, weekOf } from '@/lib/train/program';
import { trainStore } from '@/lib/train/store';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon, type IconName } from '../ui/Icon';

const ICON: Record<DayKind, IconName> = {
  wake: 'sun',
  meal: 'utensils',
  med: 'pill',
  prayer: 'moon',
  workout: 'dumbbell',
  walk: 'walk',
  weigh: 'scale',
  photo: 'camera',
  wind: 'leaf',
  sleep: 'bed',
  busy: 'clock',
};

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
  const [profile] = useProfile();
  const [date, setDate] = useState('');
  const [now, setNow] = useState(0);
  const [lastPhoto, setLastPhoto] = useState<string | null | undefined>(undefined);
  const [all, setAll] = useState(false);
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
      ticks: new Set(ticks[date] ?? []),
      minutesOf: (d) => d.getHours() * 60 + d.getMinutes(),
    });
  }, [date, life, train, diary.food, weights.entries, ticks, lastPhoto]);

  if (!day)
    return <div class="surface mb-8 h-[54rem] animate-pulse sm:h-[46rem]" aria-hidden="true" />;

  const current = nowItem(day, now);
  const missed = missedItems(day, now).filter((i) => i.id !== current?.id);
  const actionable = day.filter((i) => !i.passive);
  const doneCount = actionable.filter((i) => i.done).length;
  const upcoming = current ? day.slice(day.indexOf(current) + 1).filter((i) => !i.done) : [];
  const shown = all ? day : upcoming.slice(0, 3);
  const why = life.why.trim();
  const firstGoal = GOALS.find((g) => g.id === life.goals[0]);

  const tick = (item: DayItem) => {
    if (item.auto) return;
    toggleTick(date, item.id);
    haptic(item.done ? 8 : [12, 30, 12]);
  };

  return (
    <section class="today-plan mb-8 grid gap-4" aria-labelledby="plan-h">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="eyebrow mb-1">
            {new Date(`${date}T12:00:00`).toLocaleDateString('en', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <h2 id="plan-h" class="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {greeting(now, life.name)}
          </h2>
          <p class="text-muted text-sm">
            {doneCount} of {actionable.length} done today
            {firstGoal ? ` · working on: ${firstGoal.label.toLowerCase()}` : ''}
          </p>
        </div>
        <a
          class="text-brand-700 dark:text-brand-300 text-sm font-semibold"
          href={withBase('/you/#day')}
        >
          Edit my day
        </a>
      </div>
      <div class="plan-progress" aria-hidden="true">
        <span
          style={{ transform: `scaleX(${actionable.length ? doneCount / actionable.length : 0})` }}
        />
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

      {current ? (
        <NowCard
          item={current}
          now={now}
          date={date}
          weightKg={planProfile(profile, weights.entries).weightKg}
          onTick={() => tick(current)}
        />
      ) : (
        <div class="now-card surface p-5 sm:p-6">
          <p class="eyebrow">That's the day</p>
          <h3 class="font-display text-3xl tracking-tight">
            {doneCount >= actionable.length - 1
              ? 'Everything done. Rest well.'
              : 'Rest now. Tomorrow is a fresh page.'}
          </h3>
          {why && <p class="text-muted mt-2 italic">“{why}”</p>}
        </div>
      )}

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
          <p class="text-subtle px-2 pt-1 pb-2 text-xs font-semibold tracking-wide uppercase">
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
  return (
    <li
      class={`tl-row ${item.done ? 'tl-done' : ''} ${current ? 'tl-current' : ''} ${item.passive ? 'tl-passive' : ''}`}
    >
      <span class="tl-time tabular">{clock(item.time)}</span>
      <span class="tl-dot" aria-hidden="true">
        <Icon name={item.done ? 'check' : ICON[item.kind]} size={14} />
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
    </li>
  );
}

function NowCard({
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
      case 'photo':
        return (
          <a class="btn btn-primary h-12 px-5" href={withBase('/track/#photos')}>
            <Icon name="camera" size={18} /> Take photos
          </a>
        );
      default:
        return (
          <button type="button" class="btn btn-primary h-12 px-5" onClick={onTick}>
            <Icon name="check" size={18} /> Done
          </button>
        );
    }
  })();
  const hasOwnAction = ['meal', 'workout', 'weigh', 'photo'].includes(item.kind);
  return (
    <div class={`now-card now-${item.kind} surface overflow-hidden`} aria-live="polite">
      <div class="flex items-start gap-4 p-5 sm:p-6">
        <span class="now-icon" aria-hidden="true">
          <Icon name={ICON[item.kind]} size={26} />
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
          <div class="mt-4 flex flex-wrap gap-2">
            {action}
            {hasOwnAction && (
              <button type="button" class="btn btn-secondary h-12 px-4" onClick={onTick}>
                {item.kind === 'meal' ? 'Ate, skip logging' : 'Done'}
              </button>
            )}
          </div>
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
