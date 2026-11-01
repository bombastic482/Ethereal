import { useEffect, useState } from 'preact/hooks';
import { bodyFatBands } from '@/lib/calc/body-fat';
import { cmToIn, formatWeight, round } from '@/lib/calc/units';
import type { Measure, Site } from '@/lib/body';
import { confetti } from '@/lib/fx';
import { CountUp } from '../ui/CountUp';
import { Icon } from '../ui/Icon';
import { BodyFigure, type Label } from './BodyFigure';
import { ALL_SITES, SITES } from './sites';

/**
 * The moment after measuring: body fat counts up, today's numbers sit on the body next to how
 * they've changed since last time, and real progress gets a small celebration.
 */
export function MeasureResult({
  sex,
  imperial,
  weightKg,
  result,
  onClose,
}: {
  sex: 'male' | 'female';
  imperial: boolean;
  weightKg: number;
  result: { m: Measure; bf: number | null; prevBf: number | null; prev: Measure | null };
  onClose: () => void;
}) {
  const { m, bf, prevBf, prev } = result;
  const [shownBf, setShownBf] = useState(0);
  const len = (cm: number) => (imperial ? `${round(cmToIn(cm), 1)} in` : `${round(cm, 1)} cm`);
  const sites = ALL_SITES.filter((s) => m[s] !== undefined);
  const deltas = sites.map((s) => ({ s, d: prev?.[s] !== undefined ? m[s]! - prev[s]! : null }));
  const totalDown = deltas.reduce((n, x) => n + (x.d !== null && x.d < 0 ? -x.d : 0), 0);
  const band = bf !== null ? bodyFatBands(sex).find((b) => bf < b.max) : null;

  useEffect(() => {
    const t = window.setTimeout(() => setShownBf(bf ?? 0), 120);
    const better = (prevBf !== null && bf !== null && bf < prevBf - 0.3) || totalDown >= 2;
    const c = better ? window.setTimeout(() => confetti({ x: 0.5, y: 0.25 }, 110), 700) : 0;
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(c);
    };
  }, []);

  const labels: Label[] = sites.map((s) => {
    const d = deltas.find((x) => x.s === s)!.d;
    return {
      site: s as Site,
      text: `${SITES[s].short} ${len(m[s]!)}`,
      sub:
        d === null
          ? 'first reading'
          : Math.abs(d) < 0.25
            ? 'same as last'
            : `${d < 0 ? '−' : '+'}${len(Math.abs(d))}`,
      tone: d === null || Math.abs(d) < 0.25 ? 'flat' : d < 0 ? 'down' : 'up',
    };
  });

  return (
    <section
      class="surface measure-result overflow-hidden"
      role="status"
      aria-labelledby="result-h"
    >
      <div class="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div class="grid content-center gap-3 p-5 sm:p-7">
          <p class="eyebrow mb-0">Today’s measurements are saved</p>
          {bf !== null ? (
            <>
              <h2 id="result-h" class="font-display text-6xl leading-none tracking-tight">
                <CountUp value={shownBf} format={(v) => `${v.toFixed(1)}%`} />
              </h2>
              <p class="text-muted text-lg">
                body fat{band ? `, ${band.label.toLowerCase()}` : ''} ·{' '}
                {formatWeight((weightKg * bf) / 100, imperial ? 'imperial' : 'metric', 1)} fat,{' '}
                {formatWeight(weightKg * (1 - bf / 100), imperial ? 'imperial' : 'metric', 1)} lean
              </p>
              <p class="mt-1">
                {prevBf === null
                  ? 'Your starting point. Measure again in four weeks, at the same time of day.'
                  : bf < prevBf - 0.05
                    ? `Down ${(prevBf - bf).toFixed(1)} points since last time. That is fat coming off, not water.`
                    : bf > prevBf + 0.05
                      ? `Up ${(bf - prevBf).toFixed(1)} points. A single reading wobbles; the next one will show the direction.`
                      : 'Holding steady since last time.'}
              </p>
            </>
          ) : (
            <h2 id="result-h" class="font-display text-4xl tracking-tight">
              Measurements saved
            </h2>
          )}
          {totalDown >= 1 && (
            <p class="chip justify-self-start">
              <Icon name="spark" size={14} /> {len(totalDown)} off across your sites since last time
            </p>
          )}
          <button type="button" class="btn btn-secondary mt-2 justify-self-start" onClick={onClose}>
            Done
          </button>
        </div>
        <div class="measure-result-stage">
          <BodyFigure sex={sex} labels={labels} class="h-full w-full" />
        </div>
      </div>
    </section>
  );
}
