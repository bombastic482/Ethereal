import { useMemo } from 'preact/hooks';
import { calculateIdealWeight } from '@/lib/calc/ideal-weight';
import { formatWeight } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { ProfileFields } from '../ui/ProfileFields';
import { ResultActions } from '../ui/ResultActions';
import { Stat } from '../ui/Stat';

export default function IdealWeightCalculator() {
  const [profile, update] = useProfile();
  const result = useMemo(() => {
    try {
      return calculateIdealWeight(profile.heightCm, profile.sex);
    } catch {
      return null;
    }
  }, [profile.heightCm, profile.sex]);

  const fw = (kg: number) => formatWeight(kg, profile.units, profile.units === 'metric' ? 1 : 0);
  const summary = result
    ? `Ideal weight (avg of 4 formulas): ${fw(result.average)}. Healthy BMI range: ${fw(result.bmiRange.min)}–${fw(result.bmiRange.max)}. — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <ProfileFields
          profile={profile}
          update={update}
          show={['units', 'sex', 'height', 'weight']}
          idPrefix="iw"
        />
      }
      results={
        result ? (
          <div class="grid gap-6">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <Stat
                label="Healthy weight range"
                value={`${fw(result.bmiRange.min)} – ${fw(result.bmiRange.max)}`}
                size="lg"
                tone="brand"
                sub="BMI 18.5–24.9, the range with the lowest health risk"
              />
            </div>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Devine" value={fw(result.devine)} sub="1974, drug dosing" />
              <Stat label="Robinson" value={fw(result.robinson)} sub="1983" />
              <Stat label="Miller" value={fw(result.miller)} sub="1983" />
              <Stat label="Hamwi" value={fw(result.hamwi)} sub="1964" />
            </div>
            <Stat
              label="Formula average"
              value={fw(result.average)}
              sub={`You are currently ${fw(profile.weightKg)}`}
            />
            {result.notes.map((n) => (
              <Callout key={n}>{n}</Callout>
            ))}
            <Callout tone="success">
              A better "ideal" is the weight where your{' '}
              <a class="underline" href="/tools/body-fat/">
                body fat
              </a>{' '}
              sits in the fitness range and you feel strong. Use the BMI range as the guard rails,
              not the goal.
            </Callout>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">Enter a valid height.</Callout>
        )
      }
    />
  );
}
