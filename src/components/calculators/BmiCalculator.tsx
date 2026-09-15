import { useMemo } from 'preact/hooks';
import { BMI_BANDS, calculateBmi } from '@/lib/calc/bmi';
import { formatWeight } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { Gauge } from '../ui/Gauge';
import { ProfileFields } from '../ui/ProfileFields';
import { ResultActions } from '../ui/ResultActions';
import { Stat } from '../ui/Stat';

const COLORS: Record<string, string> = {
  underweight: 'oklch(75% 0.12 240)',
  healthy: 'var(--color-brand-500)',
  overweight: 'oklch(80% 0.15 85)',
  'obese-1': 'oklch(72% 0.17 50)',
  'obese-2': 'oklch(64% 0.2 30)',
  'obese-3': 'oklch(55% 0.2 20)',
};

export default function BmiCalculator() {
  const [profile, update] = useProfile();
  const result = useMemo(() => {
    try {
      return calculateBmi(profile.weightKg, profile.heightCm);
    } catch {
      return null;
    }
  }, [profile.weightKg, profile.heightCm]);

  const bands = BMI_BANDS.map((b) => ({
    max: b.max,
    label: b.label.replace('Obesity class', 'Class').replace('Healthy weight', 'Healthy'),
    color: COLORS[b.category]!,
  }));

  const summary = result
    ? `BMI ${result.bmi} (${result.label}). Healthy range for my height: ${formatWeight(result.healthyRangeKg.min, profile.units)}–${formatWeight(result.healthyRangeKg.max, profile.units)}. — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <ProfileFields
          profile={profile}
          update={update}
          show={['units', 'height', 'weight']}
          idPrefix="bmi"
        />
      }
      results={
        result ? (
          <div class="grid gap-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <Stat label="Your BMI" value={result.bmi} size="lg" tone="brand" sub={result.label} />
              <Stat
                label="Ponderal index"
                value={result.ponderalIndex}
                unit="kg/m³"
                sub="Fairer for very tall or short people"
              />
            </div>
            <Gauge
              value={result.bmi}
              min={12}
              max={45}
              bands={bands}
              format={(v) => v.toFixed(1)}
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <Stat
                label="Healthy weight range"
                value={`${formatWeight(result.healthyRangeKg.min, profile.units, 0)} – ${formatWeight(result.healthyRangeKg.max, profile.units, 0)}`}
                sub="BMI 18.5 – 24.9 for your height"
              />
              <Stat
                label={
                  result.deltaToHealthyKg > 0
                    ? 'To reach the healthy range'
                    : result.deltaToHealthyKg < 0
                      ? 'To reach the healthy range'
                      : 'Status'
                }
                value={
                  result.deltaToHealthyKg === 0
                    ? 'In range'
                    : formatWeight(Math.abs(result.deltaToHealthyKg), profile.units)
                }
                sub={
                  result.deltaToHealthyKg > 0
                    ? 'to lose'
                    : result.deltaToHealthyKg < 0
                      ? 'to gain'
                      : 'You are inside the healthy band.'
                }
              />
            </div>
            <Callout>
              BMI is a population screening tool, not a diagnosis. It cannot tell muscle from fat,
              and healthy ranges differ by ethnicity and age. If your BMI is high but your{' '}
              <a class="underline" href="/tools/body-fat/">
                body-fat percentage
              </a>{' '}
              is low, trust the body fat.
            </Callout>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">Enter a valid height and weight to see your BMI.</Callout>
        )
      }
    />
  );
}
