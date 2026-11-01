import { useEffect, useMemo, useState } from 'preact/hooks';
import { achievements, ordered, type Achievement } from '@/lib/achievements';
import { bodyStore, composition } from '@/lib/body';
import { diaryStore } from '@/lib/food-store';
import { confetti, haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import { todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { trainStore } from '@/lib/train/store';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';

const RECENT_DAYS = 3;

function useAchievements(): Achievement[] {
  const [profile] = useProfile();
  const [log] = logStore.use();
  const [train] = trainStore.use();
  const [diary] = diaryStore.use();
  const [body] = bodyStore.use();
  return useMemo(
    () =>
      achievements({
        entries: log.entries,
        workouts: train.log,
        foodDates: diary.food.map((f) => f.date),
        measures: body.measures,
        composition: composition(
          body.measures,
          log.entries,
          { sex: profile.sex, heightCm: profile.heightCm },
          profile.weightKg,
        ),
        sex: profile.sex,
      }),
    [
      log.entries,
      train.log,
      diary.food,
      body.measures,
      profile.sex,
      profile.heightCm,
      profile.weightKg,
    ],
  );
}

/**
 * Celebrates a milestone the first time it is seen: confetti and a short note. Only recent ones,
 * so opening the app after an update never sets off a backlog of bursts.
 */
function useCelebration(list: Achievement[]) {
  const [fresh, setFresh] = useState<Achievement | null>(null);
  useEffect(() => {
    if (!list.length) return;
    const { seen } = bodyStore.get();
    const today = todayIso();
    const recent = (d: string) =>
      Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`) <= RECENT_DAYS * 864e5;
    const unseen = list.filter((a) => a.on && !seen.includes(a.id));
    if (!unseen.length) return;
    const toCelebrate = unseen
      .filter((a) => recent(a.on!))
      .sort((a, b) => b.on!.localeCompare(a.on!))[0];
    bodyStore.patch({ seen: [...seen, ...unseen.map((a) => a.id)] });
    if (toCelebrate) {
      setFresh(toCelebrate);
      haptic([20, 50, 20, 50, 40]);
      window.setTimeout(() => confetti({ x: 0.5, y: 0.25 }, 120), 250);
      window.setTimeout(() => setFresh(null), 7000);
    }
  }, [list]);
  return [fresh, () => setFresh(null)] as const;
}

function Toast({ a, onClose }: { a: Achievement; onClose: () => void }) {
  return (
    <div class="milestone-toast" role="status">
      <span class="milestone-icon milestone-on" aria-hidden="true">
        <Icon name={a.icon} size={20} />
      </span>
      <span class="min-w-0 flex-1">
        <span class="text-subtle block text-[11px] font-semibold">Milestone</span>
        <span class="block font-bold">{a.title}</span>
        <span class="text-muted block text-sm">{a.detail}</span>
      </span>
      <button
        type="button"
        class="btn btn-ghost h-8 w-8 flex-none p-0"
        aria-label="Close"
        onClick={onClose}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function MilestonesInner({ celebrateOnly = false }: { celebrateOnly?: boolean }) {
  const list = useAchievements();
  const [fresh, close] = useCelebration(list);
  const [all, setAll] = useState(false);
  if (celebrateOnly) return fresh ? <Toast a={fresh} onClose={close} /> : null;
  const sorted = ordered(list);
  const done = sorted.filter((a) => a.on).length;
  const shown = all ? sorted : sorted.slice(0, 6);
  return (
    <section class="surface p-5 sm:p-6" aria-labelledby="ms-h">
      {fresh && <Toast a={fresh} onClose={close} />}
      <div class="flex items-baseline justify-between gap-3">
        <h2 id="ms-h" class="text-lg font-bold tracking-tight">
          Milestones
        </h2>
        <span class="text-muted tabular text-sm">
          {done} of {sorted.length}
        </span>
      </div>
      <ul class="stagger mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a, i) => (
          <li key={a.id} class={`milestone ${a.on ? 'milestone-done' : ''}`} style={{ '--i': i }}>
            <span class={`milestone-icon ${a.on ? 'milestone-on' : ''}`} aria-hidden="true">
              <Icon name={a.on ? a.icon : a.icon} size={18} />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{a.title}</span>
              {a.on ? (
                <span class="text-muted block text-xs">
                  {new Date(`${a.on}T12:00:00`).toLocaleDateString('en', {
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · {a.detail}
                </span>
              ) : (
                <span class="mt-1.5 block">
                  <span class="milestone-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${a.progress})` }} />
                  </span>
                  <span class="sr-only">{Math.round(a.progress * 100)}% of the way</span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > 6 && (
        <button
          type="button"
          class="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold"
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </section>
  );
}

export default function Milestones({ celebrateOnly = false }: { celebrateOnly?: boolean }) {
  return (
    <ErrorBoundary area="milestones">
      <MilestonesInner celebrateOnly={celebrateOnly} />
    </ErrorBoundary>
  );
}
