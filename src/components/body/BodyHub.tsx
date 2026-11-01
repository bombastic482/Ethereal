import { useEffect, useMemo, useState } from 'preact/hooks';
import { bodyFatBands } from '@/lib/calc/body-fat';
import { daysBetween } from '@/lib/calc/trend';
import { cmToIn, formatWeight, inToCm, round } from '@/lib/calc/units';
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

interface SiteInfo {
  label: string;
  how: string;
  /** Where the tape sits on the outline: centre x, y and half-width. */
  tape: [number, number, number];
}

const SITE: Record<Site, SiteInfo> = {
  neckCm: {
    label: 'Neck',
    how: 'Just below the Adam’s apple, the tape sloping slightly down at the front. Snug, not tight. Look straight ahead and relax your shoulders.',
    tape: [60, 41, 8],
  },
  waistCm: {
    label: 'Waist at the navel',
    how: 'Level all the way round, across the navel. Breathe out normally and read it at the end of the breath. No sucking in: the honest number is the useful one.',
    tape: [60, 110, 23],
  },
  waistNarrowCm: {
    label: 'Waist at the narrowest',
    how: 'At the narrowest point of your waist, usually just above the navel. Breathe out normally and read it at the end of the breath.',
    tape: [60, 100, 21],
  },
  hipsCm: {
    label: 'Hips',
    how: 'Around the widest part of your bottom, feet together, tape level.',
    tape: [60, 130, 27],
  },
  chestCm: {
    label: 'Chest',
    how: 'Under the armpits and across the nipples, after a normal breath out.',
    tape: [60, 72, 28],
  },
  armCm: {
    label: 'Upper arm',
    how: 'Halfway between shoulder and elbow, arm hanging relaxed. Same arm every time.',
    tape: [26, 80, 7],
  },
  thighCm: {
    label: 'Thigh',
    how: 'Around the top of the thigh just below the bottom, standing with weight on both feet. Same leg every time.',
    tape: [47, 152, 11],
  },
};

/** A calm front-view outline with the tape drawn where it goes. */
function Outline({ site }: { site: Site }) {
  const [cx, cy, rx] = SITE[site].tape;
  return (
    <svg viewBox="0 0 120 240" class="tape-figure" aria-hidden="true">
      <g class="tape-body">
        <circle cx="60" cy="20" r="13" />
        <rect x="53" y="30" width="14" height="14" rx="5" />
        <path d="M32 50 Q60 40 88 50 L86 96 Q82 104 82 112 L86 138 Q60 146 34 138 L38 112 Q38 104 34 96 Z" />
        <path d="M31 51 Q24 54 22 66 L18 124 Q19 130 24 128 L30 96 L33 70 Z" />
        <path d="M89 51 Q96 54 98 66 L102 124 Q101 130 96 128 L90 96 L87 70 Z" />
        <path d="M35 134 L58 136 L56 230 Q50 234 44 230 L36 170 Z" />
        <path d="M85 134 L62 136 L64 230 Q70 234 76 230 L84 170 Z" />
      </g>
      <ellipse class="tape-line" cx={cx} cy={cy} rx={rx} ry={Math.max(2.4, rx * 0.14)} />
      <circle class="tape-dot" cx={cx + rx} cy={cy} r="2.6" />
    </svg>
  );
}

function TapeGuide({
  sex,
  imperial,
  last,
  onDone,
  onCancel,
}: {
  sex: 'male' | 'female';
  imperial: boolean;
  last: Measure | null;
  onDone: (m: Measure) => void;
  onCancel: () => void;
}) {
  const required: Site[] =
    sex === 'male' ? ['neckCm', 'waistCm'] : ['neckCm', 'waistNarrowCm', 'hipsCm'];
  const optional: Site[] =
    sex === 'male'
      ? ['hipsCm', 'chestCm', 'armCm', 'thighCm']
      : ['waistCm', 'chestCm', 'armCm', 'thighCm'];
  const steps = [...required, ...optional];
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Partial<Record<Site, number>>>({});
  const [text, setText] = useState('');
  const site = steps[i]!;
  const isRequired = required.includes(site);
  const unit = imperial ? 'in' : 'cm';
  const prev = last?.[site];
  const show = (cm: number) => (imperial ? round(cmToIn(cm), 1) : round(cm, 1));

  useEffect(() => {
    const v = values[site];
    setText(v !== undefined ? String(show(v)) : '');
  }, [i]);

  const parsed = Number(text.replace(',', '.'));
  const valid =
    text.trim() !== '' &&
    Number.isFinite(parsed) &&
    parsed >= (imperial ? 6 : 15) &&
    parsed <= (imperial ? 100 : 250);
  const next = (skip = false) => {
    const nv = { ...values };
    if (!skip && valid) nv[site] = round(imperial ? inToCm(parsed) : parsed, 1);
    else delete nv[site];
    setValues(nv);
    haptic(10);
    if (i + 1 < steps.length) setI(i + 1);
    else onDone({ date: todayIso(), ...nv });
  };

  return (
    <section class="surface overflow-hidden" aria-labelledby="tape-h">
      <div class="grid gap-6 p-5 sm:grid-cols-[11rem_1fr] sm:p-7">
        <div class="tape-stage">
          <Outline site={site} />
        </div>
        <div>
          <div class="flex items-center justify-between gap-3">
            <p class="eyebrow mb-0">
              {i + 1} of {steps.length} · {isRequired ? 'for body fat' : 'optional'}
            </p>
            <button type="button" class="text-muted text-sm hover:underline" onClick={onCancel}>
              Cancel
            </button>
          </div>
          <div class="mt-2 flex gap-1" aria-hidden="true">
            {steps.map((s, j) => (
              <span
                key={s}
                class={`h-1 flex-1 rounded-full ${j <= i ? 'bg-brand-500' : 'bg-muted'}`}
              />
            ))}
          </div>
          <h2 id="tape-h" class="font-display mt-4 text-3xl tracking-tight">
            {SITE[site].label}
          </h2>
          <p class="text-muted mt-2">{SITE[site].how}</p>
          <form
            class="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) next();
            }}
          >
            <div class="w-40">
              <label class="label" for="tape-value">
                {SITE[site].label} ({unit})
              </label>
              <input
                id="tape-value"
                class="field tabular text-2xl"
                inputMode="decimal"
                autoComplete="off"
                autofocus
                value={text}
                placeholder={prev ? String(show(prev)) : ''}
                onInput={(e) => setText(e.currentTarget.value)}
              />
            </div>
            <button type="submit" class="btn btn-primary h-12" disabled={!valid}>
              {i + 1 < steps.length ? 'Next' : 'See result'} <Icon name="arrow" size={16} />
            </button>
            <button type="button" class="btn btn-ghost h-12" onClick={() => next(true)}>
              {isRequired ? 'Skip' : 'Skip this one'}
            </button>
          </form>
          {prev && (
            <p class="text-subtle mt-2 text-sm">
              Last time: {show(prev)} {unit}
            </p>
          )}
          {i === 0 && (
            <p class="text-subtle mt-4 text-sm">
              Use a soft tape, on bare skin, standing relaxed. Morning before food gives the most
              repeatable numbers. Measure twice; if they differ, take the smaller.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function BodyHubInner() {
  const [profile] = useProfile();
  const [log] = logStore.use();
  const [plan] = planStore.use();
  const [body, patchBody] = bodyStore.use();
  const [measuring, setMeasuring] = useState(false);
  const [result, setResult] = useState<{
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
      <TapeGuide
        sex={profile.sex}
        imperial={imperial}
        last={lastMeasure}
        onCancel={() => setMeasuring(false)}
        onDone={(m) => {
          const weight = weightOn(log.entries, m.date) ?? profile.weightKg;
          const bf = navyFor(m, who, weight);
          const prevTape = tape.at(-1)?.bodyFat ?? null;
          saveMeasure(m);
          setMeasuring(false);
          setResult({ m, bf, prevBf: prevTape });
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
        <section class="surface now-card p-5 sm:p-6" role="status" aria-labelledby="tape-result-h">
          <p class="eyebrow">Saved today’s measurements</p>
          {result.bf !== null ? (
            <>
              <h2 id="tape-result-h" class="font-display text-4xl tracking-tight">
                About {result.bf.toFixed(1)}% body fat
              </h2>
              <p class="text-muted mt-1">
                {result.prevBf !== null
                  ? result.bf < result.prevBf
                    ? `Down ${(result.prevBf - result.bf).toFixed(1)} points since last time. That is fat, not water.`
                    : result.bf > result.prevBf
                      ? `Up ${(result.bf - result.prevBf).toFixed(1)} points. One reading is noise; the next few will tell.`
                      : 'The same as last time.'
                  : 'Your starting point. Measure again in four weeks, same time of day.'}
              </p>
            </>
          ) : (
            <h2 id="tape-result-h" class="font-display text-3xl tracking-tight">
              Measurements saved
            </h2>
          )}
          <button
            type="button"
            class="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold"
            onClick={() => setResult(null)}
          >
            Dismiss
          </button>
        </section>
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
                    <dt class="text-subtle text-[11px] font-semibold uppercase">{k}</dt>
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
          <div class="tape-stage tape-stage-sm hidden sm:grid">
            <Outline site={profile.sex === 'male' ? 'waistCm' : 'waistNarrowCm'} />
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
              />
            </div>
          ) : (
            <p class="text-muted mt-2 text-sm">One more reading and the line appears.</p>
          )}
        </section>
      )}

      {body.measures.length > 0 && (
        <section class="surface p-5 sm:p-6" aria-labelledby="tape-hist-h">
          <h2 id="tape-hist-h" class="text-lg font-bold tracking-tight">
            Tape measurements
          </h2>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[34rem] text-sm">
              <thead>
                <tr class="text-subtle text-left text-xs uppercase">
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
                      {SITE[s].label
                        .replace('Waist at the ', 'Waist, ')
                        .replace('Upper arm', 'Arm')}
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
        </section>
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
