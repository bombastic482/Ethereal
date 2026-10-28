import { useMemo, useState } from 'preact/hooks';
import { calculateBodyFatNavy } from '@/lib/calc/body-fat';
import { cmToIn, formatWeight, inToCm } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { Gauge } from '../ui/Gauge';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { ResultActions } from '../ui/ResultActions';
import { Stat } from '../ui/Stat';
import { withBase } from '@/lib/url';

const BAND_COLORS = [
  'oklch(75% 0.12 240)',
  'var(--color-brand-400)',
  'var(--color-brand-500)',
  'oklch(80% 0.15 85)',
  'oklch(68% 0.18 40)',
];

export default function BodyFatCalculator() {
  const [profile, update] = useProfile();
  const [neckCm, setNeck] = useState(36);
  const [waistCm, setWaist] = useState(84);
  const [hipCm, setHip] = useState(98);
  const imperial = profile.units === 'imperial';

  const result = useMemo(() => {
    try {
      const r = calculateBodyFatNavy({
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        neckCm,
        waistCm,
        hipCm,
      });
      return { ok: true as const, data: r };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [profile.sex, profile.heightCm, profile.weightKg, neckCm, waistCm, hipCm]);

  const measure = (
    id: string,
    label: string,
    value: number,
    set: (v: number) => void,
    hint: string,
  ) =>
    imperial ? (
      <NumberField
        id={id}
        label={label}
        value={cmToIn(value)}
        min={4}
        max={100}
        step={0.25}
        suffix="in"
        hint={hint}
        onChange={(v) => set(inToCm(v))}
      />
    ) : (
      <NumberField
        id={id}
        label={label}
        value={value}
        min={10}
        max={250}
        step={0.5}
        suffix="cm"
        hint={hint}
        onChange={set}
      />
    );

  const summary = result.ok
    ? `Body fat ≈ ${result.data.percent}% (${result.data.label}). Lean mass ${formatWeight(result.data.leanMassKg, profile.units)}, fat mass ${formatWeight(result.data.fatMassKg, profile.units)}. US Navy method. — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <ProfileFields
            profile={profile}
            update={update}
            show={['units', 'sex', 'height', 'weight']}
            idPrefix="bf"
          />
          {measure(
            'bf-neck',
            'Neck',
            neckCm,
            setNeck,
            'Just below the larynx, tape sloping slightly down at the front.',
          )}
          {measure(
            'bf-waist',
            'Waist',
            waistCm,
            setWaist,
            profile.sex === 'male'
              ? 'At the navel, relaxed, after a normal exhale.'
              : 'At the narrowest point, relaxed.',
          )}
          {profile.sex === 'female' &&
            measure('bf-hip', 'Hips', hipCm, setHip, 'At the widest point of the buttocks.')}
        </div>
      }
      results={
        result.ok ? (
          <div class="grid gap-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <Stat
                label="Body fat"
                value={`${result.data.percent}%`}
                size="lg"
                tone="brand"
                sub={result.data.label}
              />
              <button
                type="button"
                class="btn btn-secondary text-sm"
                onClick={() => update({ bodyFatPercent: result.data.percent })}
              >
                Save to my profile
              </button>
            </div>
            <Gauge
              value={result.data.percent}
              min={profile.sex === 'male' ? 2 : 8}
              max={profile.sex === 'male' ? 40 : 48}
              bands={result.data.bands.map((b, i) => ({
                max: b.max,
                label: b.label
                  .replace('Essential fat', 'Essential')
                  .replace('Above average', 'High'),
                color: BAND_COLORS[i]!,
              }))}
              format={(v) => `${v.toFixed(1)}%`}
            />
            <div class="grid grid-cols-2 gap-4">
              <Stat
                label="Lean mass"
                value={formatWeight(result.data.leanMassKg, profile.units)}
                sub="Muscle, bone, organs, water"
              />
              <Stat
                label="Fat mass"
                value={formatWeight(result.data.fatMassKg, profile.units)}
                sub="What a deficit should target"
              />
            </div>
            <Callout>
              The Navy method is accurate to about ±3–4% versus a DEXA scan. Measure at the same
              time of day, unflexed, and track the trend rather than any single reading. Saving this
              to your profile unlocks the Katch-McArdle formula in the{' '}
              <a class="underline" href={withBase('/tools/calories/')}>
                calorie calculator
              </a>
              .
            </Callout>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">{result.error}</Callout>
        )
      }
    />
  );
}
