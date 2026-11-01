import { useMemo, useState } from 'preact/hooks';
import { bodyFatBands } from '@/lib/calc/body-fat';
import { cmToIn, inToCm, round } from '@/lib/calc/units';
import { navyFor, type Measure, type Site } from '@/lib/body';
import { haptic } from '@/lib/fx';
import { todayIso } from '@/lib/plan';
import { Icon } from '../ui/Icon';
import { TapeScrubber } from '../ui/TapeScrubber';
import { BodyFigure } from './BodyFigure';
import { SITES, sitesFor } from './sites';

interface Props {
  sex: 'male' | 'female';
  imperial: boolean;
  heightCm: number;
  weightKg: number;
  last: Measure | null;
  lastBf: number | null;
  onDone: (m: Measure) => void;
  onCancel: () => void;
}

/**
 * The guided tape session. The figure glides to each site with the tape wrapped where it goes;
 * you drag a tape measure (or tap to type) to the number you read; body fat updates live as soon
 * as the sites it needs are in. Measuring twice averages the two readings, which halves the
 * typical error of a home measurement.
 */
export function MeasureFlow({
  sex,
  imperial,
  heightCm,
  weightKg,
  last,
  lastBf,
  onDone,
  onCancel,
}: Props) {
  const { required, optional } = sitesFor(sex);
  const steps = [...required, ...optional];
  const [i, setI] = useState(0);
  const [values, setValues] = useState<Partial<Record<Site, number>>>({});
  const [twice, setTwice] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  const site = steps[i]!;
  const isRequired = required.includes(site);
  const unit = imperial ? 'in' : 'cm';
  const toShow = (cm: number) => (imperial ? round(cmToIn(cm), 2) : cm);
  const toCm = (v: number) => (imperial ? round(inToCm(v), 1) : v);
  const startCm = values[site] ?? last?.[site] ?? SITES[site].start[sex];
  const [shown, setShown] = useState(toShow(startCm));

  // Moving to a site sets its starting reading in the same update, so a quick drag or key
  // press right after Next is never overwritten.
  const goTo = (j: number, vals = values) => {
    const t = steps[j]!;
    setI(j);
    setFirst(null);
    setShown(toShow(vals[t] ?? last?.[t] ?? SITES[t].start[sex]));
  };

  const current = toCm(shown);
  // Body fat with everything so far, the site being measured included.
  const live = useMemo(
    () => navyFor({ date: todayIso(), ...values, [site]: current }, { sex, heightCm }, weightKg),
    [values, site, current, sex, heightCm, weightKg],
  );
  const needed = required.filter((s) => s !== site && values[s] === undefined);
  const band = live !== null ? bodyFatBands(sex).find((b) => live < b.max) : null;

  const finish = (v: Partial<Record<Site, number>>) => onDone({ date: todayIso(), ...v });
  const next = (skip = false) => {
    if (!skip && twice && first === null) {
      setFirst(current);
      haptic(10);
      return;
    }
    const nv = { ...values };
    if (skip) delete nv[site];
    else nv[site] = first !== null ? round((first + current) / 2, 1) : current;
    setValues(nv);
    haptic(skip ? 6 : [10, 30, 10]);
    if (i + 1 < steps.length) goTo(i + 1, nv);
    else finish(nv);
  };

  return (
    <section class="surface measure overflow-hidden" aria-labelledby="measure-h">
      <div class="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div class="measure-stage">
          <BodyFigure sex={sex} site={site} zoom class="measure-figure" />
          <span class="measure-step-badge">
            {i + 1}/{steps.length}
          </span>
        </div>
        <div class="grid content-start gap-5 p-5 sm:p-7">
          <div class="flex items-center justify-between gap-3">
            <ol class="flex flex-wrap gap-1.5" aria-label="Measuring sites">
              {steps.map((s, j) => (
                <li key={s}>
                  <button
                    type="button"
                    class={`measure-dot ${j === i ? 'measure-dot-on' : ''} ${values[s] !== undefined ? 'measure-dot-done' : ''}`}
                    aria-current={j === i ? 'step' : undefined}
                    aria-label={`${SITES[s].label}${values[s] !== undefined ? `, ${toShow(values[s]!)} ${unit}` : ''}`}
                    onClick={() => goTo(j)}
                  >
                    {values[s] !== undefined ? <Icon name="check" size={12} /> : j + 1}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" class="text-muted text-sm hover:underline" onClick={onCancel}>
              Cancel
            </button>
          </div>

          <div>
            <p class="eyebrow mb-1">
              {isRequired ? 'Needed for body fat' : 'Optional, for your records'}
            </p>
            <h2 id="measure-h" class="font-display text-3xl tracking-tight">
              {SITES[site].label}
            </h2>
            <ol class="mt-3 grid gap-2">
              {SITES[site].how.map((h, n) => (
                <li key={h} class="flex gap-2.5 text-sm">
                  <span class="measure-num">{n + 1}</span>
                  <span class="text-muted pt-px">{h}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <TapeScrubber
              key={`${site}-${first !== null}`}
              id="measure-tape"
              label={first !== null ? 'Second reading' : twice ? 'First reading' : 'Your reading'}
              value={shown}
              onChange={setShown}
              min={imperial ? 6 : 15}
              max={imperial ? 80 : 200}
              step={imperial ? 0.25 : 0.5}
              unit={unit}
              pxPerUnit={imperial ? 56 : 22}
              labelEvery={imperial ? 1 : 5}
              {...(last?.[site] !== undefined
                ? { marker: toShow(last[site]!), markerLabel: 'last time' }
                : {})}
            />
            {first !== null && (
              <p class="text-muted mt-2 text-sm">
                First reading {toShow(first)} {unit}. Measure again and set the second; the average
                is saved.
                {Math.abs(first - current) > 1 &&
                  ' They differ by more than a centimetre: check the tape is level.'}
              </p>
            )}
          </div>

          <div class={`measure-live ${live !== null ? 'measure-live-on' : ''}`} aria-live="polite">
            {live !== null ? (
              <>
                <span class="text-subtle text-xs font-semibold tracking-wide uppercase">
                  Body fat with these numbers
                </span>
                <span class="flex items-baseline gap-2">
                  <span class="font-display tabular text-3xl">{live.toFixed(1)}%</span>
                  <span class="text-muted text-sm">{band?.label}</span>
                  {lastBf !== null && Math.abs(live - lastBf) >= 0.1 && (
                    <span class={`tape-delta ${live < lastBf ? 'tape-down' : 'tape-up'}`}>
                      {live < lastBf ? '−' : '+'}
                      {Math.abs(live - lastBf).toFixed(1)} vs last
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span class="text-muted text-sm">
                Body fat appears here once{' '}
                {needed.map((s) => SITES[s].short.toLowerCase()).join(' and ')}{' '}
                {needed.length === 1 ? 'is' : 'are'} in.
              </span>
            )}
          </div>

          <label class="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              class="h-5 w-5 accent-[var(--color-brand-600)]"
              checked={twice}
              onChange={(e) => {
                setTwice(e.currentTarget.checked);
                setFirst(null);
              }}
            />
            Measure each site twice and average (more accurate)
          </label>

          <div class="flex flex-wrap gap-2">
            {i > 0 && (
              <button type="button" class="btn btn-ghost h-12" onClick={() => goTo(i - 1)}>
                Back
              </button>
            )}
            <button
              type="button"
              class="btn btn-primary h-12 flex-1 px-6 text-base sm:flex-none"
              onClick={() => next()}
            >
              {twice && first === null
                ? 'Save first reading'
                : i + 1 < steps.length
                  ? 'Next'
                  : 'See my results'}
              <Icon name="arrow" size={18} />
            </button>
            <button type="button" class="btn btn-secondary h-12" onClick={() => next(true)}>
              Skip
            </button>
          </div>
          {i === 0 && (
            <p class="text-subtle text-xs">
              A soft tape on bare skin, standing relaxed. Mornings before food give the most
              repeatable numbers.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
