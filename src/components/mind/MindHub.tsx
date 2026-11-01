import { lazy, Suspense } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { averages, ENERGY, mindStore, MOODS } from '@/lib/mind';
import { todayIso } from '@/lib/plan';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';

const Breathe = lazy(() => import('./Breathe'));
const DAYS = 28;

function MindHubInner() {
  const [mind] = mindStore.use();
  const [today, setToday] = useState('');
  const [breathe, setBreathe] = useState<null | 'calm' | 'box' | 'sleep'>(null);
  useEffect(() => setToday(todayIso()), []);
  if (!today) return <div class="surface h-[32rem] animate-pulse" aria-hidden="true" />;

  const week = averages(mind.checkins, today, 7);
  const month = averages(mind.checkins, today, DAYS);
  const dates = Array.from({ length: DAYS }, (_, i) =>
    new Date(Date.parse(`${today}T00:00:00Z`) - (DAYS - 1 - i) * 864e5).toISOString().slice(0, 10),
  );
  const by = new Map(mind.checkins.map((c) => [c.date, c]));
  const recharges = mind.recharges.filter((d) => dates.includes(d)).length;

  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div class="grid gap-4 sm:grid-cols-3">
        {[
          [
            'Mood this week',
            week ? MOODS[Math.round(week.mood) - 1] : '—',
            week ? `${week.count} check-ins` : 'Check in on Today',
          ],
          [
            'Energy this week',
            week ? ENERGY[Math.round(week.energy) - 1] : '—',
            month ? `Month average ${month.energy}/5` : '',
          ],
          ['Recharges', String(recharges), 'Breathing sessions in four weeks'],
        ].map(([k, v, sub]) => (
          <div key={k} class="surface p-5">
            <p class="text-subtle text-xs font-semibold tracking-wide uppercase">{k}</p>
            <p class="font-display mt-1 text-3xl tracking-tight">{v}</p>
            <p class="text-muted mt-1 text-sm">{sub}</p>
          </div>
        ))}
      </div>

      <section class="surface p-5 sm:p-6" aria-labelledby="mood-hist-h">
        <h2 id="mood-hist-h" class="text-lg font-bold tracking-tight">
          The last four weeks
        </h2>
        {mind.checkins.length === 0 ? (
          <p class="text-muted mt-2 text-sm">
            Check in on{' '}
            <a class="underline" href={withBase('/today/')}>
              Today
            </a>
            : two taps, mood and energy. Patterns show up here, and low days get a gentler plan.
          </p>
        ) : (
          <div class="mt-4 grid gap-4">
            {(['mood', 'energy'] as const).map((k) => (
              <div key={k}>
                <p class="text-sm font-semibold">{k === 'mood' ? 'Mood' : 'Energy'}</p>
                <div
                  class="mood-strip mt-1.5"
                  role="img"
                  aria-label={`${k === 'mood' ? 'Mood' : 'Energy'} over the last four weeks`}
                >
                  {dates.map((d) => {
                    const c = by.get(d);
                    return (
                      <span
                        key={d}
                        class={c ? `mood-${c[k]}` : ''}
                        title={c ? `${d}: ${(k === 'mood' ? MOODS : ENERGY)[c[k] - 1]}` : d}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <p class="text-subtle text-xs">Oldest on the left. Red is rough, green is great.</p>
          </div>
        )}
      </section>

      <section class="surface grid gap-4 p-5 sm:p-6" aria-labelledby="recharge-h">
        <div>
          <h2 id="recharge-h" class="text-lg font-bold tracking-tight">
            Recharge
          </h2>
          <p class="text-muted text-sm">
            A few minutes of slow breathing lowers your heart rate and takes the edge off a hard
            day. Eyes closed is fine: the phone taps gently at each change.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['calm', 'Calm', 'In 4, out 6. Any time.'],
              ['box', 'Box', 'In, hold, out, hold. Before something hard.'],
              ['sleep', 'Sleep', 'In 4, hold 7, out 8. Lights out.'],
            ] as const
          ).map(([k, t, d]) => (
            <button
              key={k}
              type="button"
              class="surface-muted pressable rounded-2xl p-4 text-left"
              onClick={() => setBreathe(k)}
            >
              <span class="flex items-center gap-2 font-bold">
                <Icon name="leaf" size={18} class="text-brand-600 dark:text-brand-300" /> {t}
              </span>
              <span class="text-muted mt-1 block text-sm">{d}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="surface p-5 sm:p-6" aria-labelledby="rails-h">
        <h2 id="rails-h" class="text-lg font-bold tracking-tight">
          When Ethereal speaks up
        </h2>
        <ul class="text-muted mt-3 grid gap-2 text-sm">
          <li>Seven training days in a row: a nudge to rest.</li>
          <li>Three hard sessions running: a nudge to ease off.</li>
          <li>Three logged days under your calorie floor: a nudge to eat.</li>
          <li>Losing more than 1% of your weight a week: a nudge to slow down.</li>
          <li>
            Most of a week feeling rough: a nudge to be kind to yourself, and to talk to someone.
          </li>
        </ul>
        <p class="text-subtle mt-3 text-xs">
          After a few days away, Today welcomes you back without catching up, and training picks up
          lighter.
        </p>
      </section>

      {breathe && (
        <Suspense fallback={null}>
          <Breathe initial={breathe} onClose={() => setBreathe(null)} />
        </Suspense>
      )}
    </div>
  );
}

export default function MindHub() {
  return (
    <ErrorBoundary area="mind">
      <MindHubInner />
    </ErrorBoundary>
  );
}
