import { useState } from 'preact/hooks';
import type { WeighIn } from '@/lib/calc/trend';
import { cmToIn, round } from '@/lib/calc/units';
import type { Measure, Site } from '@/lib/body';
import { BodyFigure, type Label } from './BodyFigure';
import { ALL_SITES, SITES } from './sites';

/** Every reading of a site, oldest first, from tape sessions and weigh-ins together. */
export function siteHistory(site: Site, measures: readonly Measure[], entries: readonly WeighIn[]) {
  const fromEntries: Partial<Record<Site, keyof WeighIn>> = {
    waistCm: 'waistCm',
    hipsCm: 'hipsCm',
    chestCm: 'chestCm',
    armCm: 'armCm',
    thighCm: 'thighCm',
  };
  const byDate = new Map<string, number>();
  const key = fromEntries[site];
  if (key)
    for (const e of entries) if (typeof e[key] === 'number') byDate.set(e.date, e[key] as number);
  for (const m of measures) if (m[site] !== undefined) byDate.set(m.date, m[site]!);
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cm]) => ({ date, cm }));
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220;
  const h = 56;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const pts = values.map(
    (v, i) =>
      [(i / (values.length - 1)) * (w - 12) + 6, h - 8 - ((v - lo) / span) * (h - 16)] as const,
  );
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} class="h-14 w-full" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="var(--color-brand-500)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="chart-line"
        pathLength={1}
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === pts.length - 1 ? 4 : 2.4}
          fill={i === pts.length - 1 ? 'var(--color-brand-500)' : 'var(--fg-subtle)'}
        />
      ))}
      <circle cx={last[0]} cy={last[1]} r="8" fill="var(--color-brand-500)" opacity="0.15" />
    </svg>
  );
}

/**
 * Your measurements pinned to the body, each with its change since the first reading. Tap one
 * to see its history.
 */
export function BodyMap({
  sex,
  imperial,
  measures,
  entries,
}: {
  sex: 'male' | 'female';
  imperial: boolean;
  measures: readonly Measure[];
  entries: readonly WeighIn[];
}) {
  const len = (cm: number) => (imperial ? `${round(cmToIn(cm), 1)} in` : `${round(cm, 1)} cm`);
  const histories = ALL_SITES.map((s) => ({
    site: s,
    rows: siteHistory(s, measures, entries),
  })).filter((h) => h.rows.length);
  const [pick, setPick] = useState<Site | null>(
    histories.find((h) => h.site === 'waistCm')?.site ?? histories[0]?.site ?? null,
  );
  if (!histories.length) return null;
  const labels: Label[] = histories.map(({ site, rows }) => {
    const first = rows[0]!.cm;
    const lastCm = rows[rows.length - 1]!.cm;
    const diff = lastCm - first;
    return {
      site,
      text: `${SITES[site].short} ${len(lastCm)}`,
      sub:
        rows.length > 1
          ? Math.abs(diff) < 0.25
            ? 'no change'
            : `${diff < 0 ? '−' : '+'}${len(Math.abs(diff))}`
          : 'first reading',
      tone: rows.length < 2 || Math.abs(diff) < 0.25 ? 'flat' : diff < 0 ? 'down' : 'up',
    };
  });
  const sel = histories.find((h) => h.site === pick);
  return (
    <section
      class="surface grid gap-4 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      aria-labelledby="map-h"
    >
      <div class="md:order-2">
        <h2 id="map-h" class="text-lg font-bold tracking-tight">
          Your measurements
        </h2>
        <p class="text-muted text-sm">
          Changes since your first reading. Tap a site for its history.
        </p>
        {sel && (
          <div class="surface-muted mt-4 rounded-2xl p-4" aria-live="polite">
            <div class="flex items-baseline justify-between gap-3">
              <p class="font-bold">{SITES[sel.site].label}</p>
              <p class="tabular text-sm">{sel.rows.length} readings</p>
            </div>
            <Sparkline values={sel.rows.map((r) => r.cm)} />
            <ul class="mt-2 grid gap-1 text-sm">
              {[...sel.rows]
                .reverse()
                .slice(0, 5)
                .map((r, i, arr) => {
                  const prev = arr[i + 1];
                  const d = prev ? r.cm - prev.cm : 0;
                  return (
                    <li key={r.date} class="flex justify-between gap-3">
                      <span class="text-muted">
                        {new Date(`${r.date}T12:00:00`).toLocaleDateString('en', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                      <span class="tabular font-semibold">
                        {len(r.cm)}
                        {prev && Math.abs(d) >= 0.25 && (
                          <span
                            class={`ml-2 text-xs ${d < 0 ? 'text-brand-700 dark:text-brand-300' : 'text-amber-700 dark:text-amber-300'}`}
                          >
                            {d < 0 ? '−' : '+'}
                            {len(Math.abs(d))}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
        <div class="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Pick a site">
          {histories.map((h) => (
            <button
              key={h.site}
              type="button"
              aria-pressed={pick === h.site}
              class={`rounded-full px-3 py-1 text-sm ${pick === h.site ? 'bg-brand-600 text-white' : 'bg-muted text-muted hover:text-fg'}`}
              onClick={() => setPick(h.site)}
            >
              {SITES[h.site].short}
            </button>
          ))}
        </div>
      </div>
      <div class="body-map-stage md:order-1">
        <BodyFigure sex={sex} labels={labels} onPick={setPick} class="h-full w-full" />
      </div>
    </section>
  );
}
