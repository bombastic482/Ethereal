import { useEffect, useMemo, useState } from 'preact/hooks';
import { bodyFatBands } from '@/lib/calc/body-fat';
import { daysBetween } from '@/lib/calc/trend';
import { cmToIn, formatWeight, round } from '@/lib/calc/units';
import {
  bodyStore,
  composition,
  navyFor,
  saveMeasure,
  targetPresets,
  targetWeight,
  waistToHeight,
  weightOn,
  type Measure,
  type Site,
} from '@/lib/body';
import { haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import { planProfile, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { BodyFigure } from './BodyFigure';
import { BodyMap } from './BodyMap';
import { MeasureFlow } from './MeasureFlow';
import { MeasureResult } from './MeasureResult';
import { SITES } from './sites';
import { Gauge } from '../ui/Gauge';
import { Icon } from '../ui/Icon';
import { LineChart } from '../ui/LineChart';
import { Segmented } from '../ui/Segmented';

const BAND_COLORS = [
  'oklch(75% 0.12 240)',
  'var(--color-brand-400)',
  'var(--color-brand-500)',
  'oklch(80% 0.15 85)',
  'oklch(68% 0.18 40)',
];

function BodyHubInner() {
  const [profile] = useProfile();
  const [log] = logStore.use();
  const [plan] = planStore.use();
  const [body, patchBody] = bodyStore.use();
  const [measuring, setMeasuring] = useState(false);
  const [result, setResult] = useState<{
    prev: Measure | null;
    m: Measure;
    bf: number | null;
    prevBf: number | null;
  } | null>(null);
  const [source, setSource] = useState<'tape' | 'scale'>('tape');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const imperial = profile.units === 'imperial';
  const who = { sex: profile.sex, heightCm: profile.heightCm };
  const points = useMemo(
    () => composition(body.measures, log.entries, who, profile.weightKg),
    [body.measures, log.entries, profile.sex, profile.heightCm, profile.weightKg],
  );
  const tape = points.filter((p) => p.source === 'tape');
  const scale = points.filter((p) => p.source === 'scale');
  const latest = (source === 'tape' ? tape : scale).at(-1) ?? tape.at(-1) ?? scale.at(-1) ?? null;
  const shown = source === 'tape' ? (tape.length ? tape : scale) : scale.length ? scale : tape;
  const first = shown[0];
  const lastMeasure = body.measures.at(-1) ?? null;
  const waist =
    lastMeasure?.waistCm ?? [...log.entries].reverse().find((e) => e.waistCm)?.waistCm ?? null;
  const currentKg = planProfile(profile, log.entries).weightKg;
  const leanKg = latest
    ? currentKg * (1 - latest.bodyFat / 100)
    : profile.bodyFatPercent
      ? currentKg * (1 - profile.bodyFatPercent / 100)
      : null;
  const bands = bodyFatBands(profile.sex);
  const presets = targetPresets(profile.sex);
  const target = body.targetBodyFat;
  const goalKg = leanKg && target ? targetWeight(leanKg, target) : null;
  const toLose = goalKg !== null ? round(currentKg - goalKg, 1) : null;
  const weeks =
    toLose !== null && toLose > 0 && plan.rateKgPerWeek > 0
      ? Math.ceil(toLose / plan.rateKgPerWeek)
      : null;
  const w = (kg: number) => formatWeight(kg, profile.units, 1);
  const len = (cm: number) => (imperial ? `${round(cmToIn(cm), 1)} in` : `${round(cm, 1)} cm`);

  if (!ready) return <div class="surface h-[40rem] animate-pulse" aria-hidden="true" />;

  if (measuring) {
    return (
      <MeasureFlow
        sex={profile.sex}
        imperial={imperial}
        heightCm={profile.heightCm}
        weightKg={weightOn(log.entries, todayIso()) ?? profile.weightKg}
        last={lastMeasure}
        lastBf={tape.at(-1)?.bodyFat ?? null}
        onCancel={() => setMeasuring(false)}
        onDone={(m) => {
          const weight = weightOn(log.entries, m.date) ?? profile.weightKg;
          const bf = navyFor(m, who, weight);
          const prevTape = tape.at(-1)?.bodyFat ?? null;
          saveMeasure(m);
          setMeasuring(false);
          setResult({ m, bf, prevBf: prevTape, prev: lastMeasure });
          haptic([15, 40, 15]);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  const chartPts = shown.length >= 2 ? shown : [];
  const origin = chartPts[0]?.date ?? '';

  return (
    <div class="grid grid-cols-[minmax(0,1fr)] gap-6">
      {result && (
        <MeasureResult
          sex={profile.sex}
          imperial={imperial}
          weightKg={weightOn(log.entries, result.m.date) ?? profile.weightKg}
          result={result}
          onClose={() => setResult(null)}
        />
      )}

      <section
        class="surface grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr]"
        aria-labelledby="comp-h"
      >
        <div>
          <h2 id="comp-h" class="text-lg font-bold tracking-tight">
            What your weight is made of
          </h2>
          {latest ? (
            <>
              <p class="text-muted mt-1 text-sm">
                From your {latest.source === 'tape' ? 'tape measurements' : 'smart scale'} on{' '}
                {new Date(`${latest.date}T12:00:00`).toLocaleDateString('en', {
                  day: 'numeric',
                  month: 'short',
                })}
                .
              </p>
              <div class="mt-5">
                <Gauge
                  value={latest.bodyFat}
                  min={profile.sex === 'male' ? 4 : 10}
                  max={profile.sex === 'male' ? 40 : 48}
                  bands={bands.map((b, i) => ({
                    max: b.max,
                    label: b.label
                      .replace('Essential fat', 'Essential')
                      .replace('Above average', 'High'),
                    color: BAND_COLORS[i]!,
                  }))}
                  format={(v) => `${v.toFixed(1)}%`}
                />
              </div>
              <dl class="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Fat', w(currentKg * (latest.bodyFat / 100))],
                  ['Lean', w(currentKg * (1 - latest.bodyFat / 100))],
                  ['Waist', waist ? len(waist) : '—'],
                ].map(([k, v]) => (
                  <div key={k} class="surface-muted rounded-2xl p-3">
                    <dt class="text-subtle text-[11px] font-semibold">{k}</dt>
                    <dd class="font-display tabular mt-1 text-xl">{v}</dd>
                  </div>
                ))}
              </dl>
              {first && latest && first.date !== latest.date && latest.source === first.source && (
                <p class="text-muted mt-4 text-sm">
                  Since{' '}
                  {new Date(`${first.date}T12:00:00`).toLocaleDateString('en', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  :{' '}
                  <strong class="text-fg">
                    {w(Math.abs(first.fatKg - latest.fatKg))}{' '}
                    {latest.fatKg <= first.fatKg ? 'less' : 'more'} fat
                  </strong>
                  {', '}
                  {w(Math.abs(latest.leanKg - first.leanKg))}{' '}
                  {latest.leanKg >= first.leanKg ? 'more' : 'less'} lean mass.
                </p>
              )}
            </>
          ) : (
            <p class="text-muted mt-2">
              Two minutes with a tape measure gives you a body-fat estimate, and shows fat coming
              off even in weeks the scale sits still.
            </p>
          )}
          {waist && profile.heightCm > 0 && (
            <p class="text-muted mt-3 text-sm">
              Waist to height:{' '}
              <strong class="text-fg">{waistToHeight(waist, profile.heightCm).toFixed(2)}</strong>.{' '}
              {waistToHeight(waist, profile.heightCm) < 0.5
                ? 'Under 0.5, the healthy side of the line.'
                : `Under 0.5 lowers health risk: a waist of ${len(profile.heightCm * 0.5)} for your height.`}
            </p>
          )}
        </div>
        <div class="grid content-start gap-3">
          <div class="measure-cta-stage hidden sm:block" aria-hidden="true">
            <BodyFigure
              sex={profile.sex}
              site={profile.sex === 'male' ? 'waistCm' : 'waistNarrowCm'}
              zoom
              class="h-full w-full"
            />
          </div>
          <button
            type="button"
            class="btn btn-primary h-12"
            onClick={() => {
              setResult(null);
              setMeasuring(true);
            }}
          >
            <Icon name="ruler" size={18} /> {body.measures.length ? 'Measure again' : 'Measure now'}
          </button>
          <p class="text-subtle text-center text-xs">
            {lastMeasure
              ? `Last measured ${daysBetween(lastMeasure.date, todayIso())} days ago. Every four weeks is plenty.`
              : 'A guided walk-through, one site at a time.'}
          </p>
        </div>
      </section>

      <BodyMap
        sex={profile.sex}
        imperial={imperial}
        measures={body.measures}
        entries={log.entries}
      />

      {leanKg !== null && (
        <section class="surface grid gap-4 p-5 sm:p-6" aria-labelledby="target-h">
          <div>
            <h2 id="target-h" class="text-lg font-bold tracking-tight">
              Your physique target
            </h2>
            <p class="text-muted mt-1 text-sm">
              Pick a body-fat target. Ethereal works out the weight you would be at it, keeping the
              lean mass you have today.
            </p>
          </div>
          <Segmented
            name="bf-target"
            value={String(presets.find((p) => p.value === target)?.value ?? '') as string}
            onChange={(v) => patchBody({ targetBodyFat: Number(v) })}
            options={presets.map((p) => ({
              value: String(p.value),
              label: `${p.label} · ${p.value}%`,
              hint: p.hint,
            }))}
          />
          {goalKg !== null && toLose !== null && (
            <div class="surface-muted grid gap-1 rounded-2xl p-4">
              <p class="font-display text-2xl tracking-tight">
                {toLose > 0
                  ? `About ${w(goalKg)}: ${w(toLose)} to go`
                  : `You are there: ${target}% or under`}
              </p>
              <p class="text-muted text-sm">
                {weeks
                  ? `Around ${weeks} weeks at your plan’s pace of ${w(plan.rateKgPerWeek)} a week. Keep protein high and keep training, and most of what you lose will be fat.`
                  : 'Keep protein high and keep training, and most of what you lose will be fat.'}
              </p>
            </div>
          )}
        </section>
      )}

      {points.length > 0 && (
        <section class="surface p-5 sm:p-6" aria-labelledby="bf-trend-h">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 id="bf-trend-h" class="text-lg font-bold tracking-tight">
              Body fat over time
            </h2>
            {tape.length > 0 && scale.length > 0 && (
              <Segmented
                name="bf-source"
                value={source}
                onChange={setSource}
                options={[
                  { value: 'tape', label: 'Tape' },
                  { value: 'scale', label: 'Scale' },
                ]}
              />
            )}
          </div>
          {chartPts.length >= 2 ? (
            <div class="mt-4">
              <LineChart
                ariaLabel="Body fat percentage over time"
                points={chartPts.map((p) => ({ x: daysBetween(origin, p.date), y: p.bodyFat }))}
                goal={target ?? undefined}
                xLabel={(x) => (x === 0 ? 'start' : `+${x}d`)}
                yLabel={(y) => `${round(y, 1)}%`}
                pointLabel={(p) =>
                  `${new Date(Date.parse(`${origin}T12:00:00`) + p.x * 864e5).toLocaleDateString('en', { day: 'numeric', month: 'short' })} · ${round(p.y, 1)}%`
                }
              />
            </div>
          ) : (
            <p class="text-muted mt-2 text-sm">One more reading and the line appears.</p>
          )}
        </section>
      )}

      {body.measures.length > 0 && (
        <details class="surface p-5 sm:p-6">
          <summary id="tape-hist-h" class="cursor-pointer text-lg font-bold tracking-tight">
            Every tape reading
          </summary>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[34rem] text-sm">
              <thead>
                <tr class="text-subtle text-left text-xs">
                  <th class="py-2 font-semibold">Date</th>
                  {(
                    [
                      'neckCm',
                      'waistCm',
                      'waistNarrowCm',
                      'hipsCm',
                      'chestCm',
                      'armCm',
                      'thighCm',
                    ] as Site[]
                  ).map((s) => (
                    <th key={s} class="py-2 text-right font-semibold">
                      {SITES[s].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...body.measures].reverse().map((m) => (
                  <tr key={m.date} class="border-t border-[var(--border)]">
                    <td class="py-2">
                      {new Date(`${m.date}T12:00:00`).toLocaleDateString('en', {
                        day: 'numeric',
                        month: 'short',
                        year: '2-digit',
                      })}
                    </td>
                    {(
                      [
                        'neckCm',
                        'waistCm',
                        'waistNarrowCm',
                        'hipsCm',
                        'chestCm',
                        'armCm',
                        'thighCm',
                      ] as Site[]
                    ).map((s) => (
                      <td key={s} class="tabular py-2 text-right">
                        {m[s] ? (imperial ? round(cmToIn(m[s]!), 1) : m[s]) : '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="text-subtle mt-2 text-xs">In {imperial ? 'inches' : 'centimetres'}.</p>
        </details>
      )}

      <p class="text-subtle text-sm">
        Smart scale? Add its body fat, muscle and water readings with a weigh-in on{' '}
        <a class="underline" href={withBase('/track/')}>
          Weight &amp; photos
        </a>
        . The Navy tape method is typically within 3 to 4 points of a DEXA scan; what matters most
        is measuring the same way each time.
      </p>
    </div>
  );
}

export default function BodyHub() {
  return (
    <ErrorBoundary area="body composition">
      <BodyHubInner />
    </ErrorBoundary>
  );
}
