import { lazy, Suspense } from 'preact/compat';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { scale } from '@/lib/calc/nutrition';
import { slopeKgPerDay, trendSeries } from '@/lib/calc/trend';
import { dayStore } from '@/lib/day';
import { diaryStore } from '@/lib/food-store';
import { haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import {
  daysAway,
  dismiss,
  ENERGY,
  guardrails,
  isComeback,
  isDismissed,
  isGentleDay,
  mindStore,
  MOODS,
  saveCheckIn,
} from '@/lib/mind';
import { buildPlanSummary, planProfile, planStore } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { trainStore } from '@/lib/train/store';
import { withBase } from '@/lib/url';
import { Icon } from '../ui/Icon';

const Breathe = lazy(() => import('./Breathe'));

/** A small face for a mood from 1 (rough) to 5 (great): the mouth turns up as the day does. */
function MoodFace({ level }: { level: number }) {
  const curve = (level - 3) * 2.6;
  const y = 15.2 - curve * 0.3;
  return (
    <svg viewBox="0 0 24 24" class="mood-face" aria-hidden="true">
      <circle cx="12" cy="12" r="11" />
      <circle cx="8.4" cy="9.8" r="1.35" class="mood-feature" />
      <circle cx="15.6" cy="9.8" r="1.35" class="mood-feature" />
      <path d={`M7.6 ${y} Q12 ${y + curve} 16.4 ${y}`} class="mood-mouth" />
    </svg>
  );
}

/** Energy from 1 (empty) to 5 (full), as a battery. */
function EnergyCell({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 26 16" class="mood-battery" aria-hidden="true">
      <rect x="1" y="2" width="21" height="12" rx="3.5" class="mood-battery-case" />
      <rect x="23" y="5.5" width="2" height="5" rx="1" class="mood-battery-case" />
      <rect x="3" y="4" width={(17 * level) / 5} height="8" rx="2" class="mood-battery-fill" />
    </svg>
  );
}

function Scale({
  label,
  words,
  value,
  onPick,
  kind,
}: {
  label: string;
  words: readonly string[];
  value: number | null;
  onPick: (v: number) => void;
  kind: 'mood' | 'energy';
}) {
  return (
    <fieldset>
      <legend class="text-muted mb-1.5 text-xs font-semibold">{label}</legend>
      <div class="grid grid-cols-5 gap-1.5">
        {words.map((w, i) => (
          <button
            key={w}
            type="button"
            aria-pressed={value === i + 1}
            class={`mood-pick mood-${i + 1} ${value === i + 1 ? 'mood-on' : ''}`}
            onClick={() => onPick(i + 1)}
          >
            {kind === 'mood' ? <MoodFace level={i + 1} /> : <EnergyCell level={i + 1} />}
            {w}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The human side of Today: a ten-second check-in that can turn the day gentle, a welcome back
 * after a gap, the occasional guardrail, and a breathing break.
 */
export default function TodayMind({ date }: { date: string }) {
  const [mind] = mindStore.use();
  const [train] = trainStore.use();
  const [diary] = diaryStore.use();
  const [weights] = logStore.use();
  const [plan] = planStore.use();
  const [profile] = useProfile();
  const [{ ticks }] = dayStore.use();
  const [mood, setMood] = useState<number | null>(null);
  const [breathe, setBreathe] = useState(false);
  const [editing, setEditing] = useState(false);

  // The wind-down step on the Now card asks for a breathing break.
  useEffect(() => {
    const open = () => setBreathe(true);
    window.addEventListener('ethereal:breathe', open);
    return () => window.removeEventListener('ethereal:breathe', open);
  }, []);
  const today = mind.checkins.find((c) => c.date === date);
  const gentle = isGentleDay(today);

  const away = useMemo(
    () =>
      daysAway(
        [
          ...diary.food.map((f) => f.date),
          ...weights.entries.map((e) => e.date),
          ...train.log.map((l) => l.date),
          ...mind.checkins.map((c) => c.date),
          ...Object.keys(ticks).filter((d) => (ticks[d]?.length ?? 0) > 0),
        ].filter((d) => d < date),
        date,
      ),
    [diary.food, weights.entries, train.log, mind.checkins, ticks, date],
  );
  const comeback = isComeback(away) && !isDismissed(mind.dismissed, `comeback-${date}`, date);

  const rails = useMemo(() => {
    const intake: Record<string, number> = {};
    for (const f of diary.food)
      intake[f.date] = (intake[f.date] ?? 0) + scale(f.per100g, f.grams).kcal;
    let floor = 0;
    try {
      if (plan.active) floor = buildPlanSummary(planProfile(profile, weights.entries), plan).floor;
    } catch {
      floor = 0;
    }
    const trend = trendSeries(weights.entries);
    const slope = trend.length >= 14 ? slopeKgPerDay(trend, 21) : null;
    return guardrails({
      today: date,
      workouts: train.log.map((l) => l.date),
      feels: train.log.map((l) => l.feel),
      intake,
      floorKcal: floor,
      lossPerWeekKg: slope === null ? null : slope * 7,
      weightKg: trend.at(-1)?.trendKg ?? profile.weightKg,
      checkins: mind.checkins,
    }).filter((g) => !isDismissed(mind.dismissed, g.id, date));
  }, [diary.food, plan, profile, weights.entries, train.log, mind.checkins, mind.dismissed, date]);

  const save = (energy: number) => {
    saveCheckIn({ date, mood: mood ?? 3, energy });
    setMood(null);
    setEditing(false);
    haptic([10, 30, 10]);
  };

  return (
    <>
      {comeback && (
        <section class="surface comeback-card p-5" aria-labelledby="back-h">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="eyebrow mb-1">Welcome back</p>
              <h3 id="back-h" class="font-display text-2xl tracking-tight">
                No catching up needed.
              </h3>
            </div>
            <button
              type="button"
              class="btn btn-ghost h-8 w-8 flex-none p-0"
              aria-label="Dismiss"
              onClick={() => dismiss(`comeback-${date}`, date)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p class="text-muted mt-1">
            {away} days off happens to everyone. The plan picks up from today, gently. Do one small
            thing and the day counts.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            {train.setup && (
              <a class="btn btn-primary h-10 text-sm" href={withBase('/train/#start')}>
                <Icon name="play" size={16} /> An easier session
              </a>
            )}
            <button
              type="button"
              class="btn btn-secondary h-10 text-sm"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('ethereal:add-food', { detail: {} }))
              }
            >
              <Icon name="utensils" size={16} /> Log one meal
            </button>
            <button
              type="button"
              class="btn btn-secondary h-10 text-sm"
              onClick={() => setBreathe(true)}
            >
              <Icon name="leaf" size={16} /> Two minutes of calm
            </button>
          </div>
        </section>
      )}

      {!today || editing ? (
        <section class="surface grid gap-3 p-4 sm:p-5" aria-labelledby="mood-h">
          <h3 id="mood-h" class="font-bold tracking-tight">
            How are you, really?
          </h3>
          <Scale
            kind="mood"
            label="Mood"
            words={MOODS}
            value={mood ?? today?.mood ?? null}
            onPick={setMood}
          />
          {(mood !== null || editing) && (
            <Scale
              kind="energy"
              label="Energy"
              words={ENERGY}
              value={today?.energy ?? null}
              onPick={save}
            />
          )}
        </section>
      ) : (
        <section
          class={`surface flex flex-wrap items-center gap-3 p-4 ${gentle ? 'gentle-card' : ''}`}
          aria-label="Today's check-in"
        >
          <span class={`mood-${today.mood} flex-none`} aria-hidden="true">
            <MoodFace level={today.mood} />
          </span>
          <span class="min-w-0 flex-1 text-sm">
            {gentle ? (
              <>
                <strong>A gentle day.</strong> Feeling {MOODS[today.mood - 1]!.toLowerCase()},
                energy {ENERGY[today.energy - 1]!.toLowerCase()}. Training is optional today: a
                ten-minute version is ready, and a walk counts just as much.
              </>
            ) : (
              <>
                Feeling <strong>{MOODS[today.mood - 1]!.toLowerCase()}</strong>, energy{' '}
                <strong>{ENERGY[today.energy - 1]!.toLowerCase()}</strong>.
              </>
            )}
          </span>
          <span class="flex flex-wrap gap-2 [&>*]:whitespace-nowrap">
            {gentle && train.setup && (
              <a class="btn btn-secondary h-9 px-3 text-sm" href={withBase('/train/#start-short')}>
                10-minute session
              </a>
            )}
            <button
              type="button"
              class="btn btn-secondary h-9 px-3 text-sm"
              onClick={() => setBreathe(true)}
            >
              <Icon name="leaf" size={15} /> Breathe
            </button>
            <button
              type="button"
              class="btn btn-ghost h-9 px-2 text-sm"
              onClick={() => {
                setMood(today.mood);
                setEditing(true);
              }}
            >
              Change
            </button>
          </span>
        </section>
      )}

      {rails.map((g) => (
        <section key={g.id} class="health-prompt" aria-label={g.title}>
          <Icon name="info" size={20} class="mt-0.5 flex-none" />
          <div class="min-w-0 flex-1">
            <p class="font-bold">{g.title}</p>
            <p class="mt-0.5 text-sm">{g.text}</p>
          </div>
          <button
            type="button"
            class="btn btn-ghost h-8 w-8 flex-none p-0"
            aria-label={`Dismiss: ${g.title}`}
            onClick={() => dismiss(g.id, date)}
          >
            <Icon name="close" size={16} />
          </button>
        </section>
      ))}

      {breathe && (
        <Suspense fallback={null}>
          <Breathe onClose={() => setBreathe(false)} />
        </Suspense>
      )}
    </>
  );
}
