import { useMemo, useState } from 'preact/hooks';
import { calculateHydration, type Climate } from '@/lib/calc/hydration';
import { formatNumber, round } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { ResultActions } from '../ui/ResultActions';
import { Segmented } from '../ui/Segmented';
import { Stat } from '../ui/Stat';

const ML_PER_FLOZ = 29.5735;

export default function WaterCalculator() {
  const [profile, update] = useProfile();
  const [exercise, setExercise] = useState(30);
  const [climate, setClimate] = useState<Climate>('temperate');
  const [preg, setPreg] = useState(false);
  const imperial = profile.units === 'imperial';

  const result = useMemo(() => {
    try {
      return calculateHydration({
        weightKg: profile.weightKg,
        exerciseMinutes: exercise,
        climate,
        pregnantOrBreastfeeding: preg,
      });
    } catch {
      return null;
    }
  }, [profile.weightKg, exercise, climate, preg]);

  const vol = (ml: number) =>
    imperial ? `${formatNumber(ml / ML_PER_FLOZ)} fl oz` : `${round(ml / 1000, 2)} L`;
  const summary = result
    ? `Daily water target ≈ ${vol(result.totalMl)} (${result.glasses} glasses). Range ${vol(result.rangeMl.min)}–${vol(result.rangeMl.max)}. — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <ProfileFields
            profile={profile}
            update={update}
            show={['units', 'weight']}
            idPrefix="wat"
          />
          <RangeField
            id="wat-ex"
            label="Exercise per day"
            value={exercise}
            min={0}
            max={180}
            step={5}
            onChange={setExercise}
            format={(v) => `${v} min`}
            hint="Moderate-to-vigorous activity where you sweat."
          />
          <Segmented
            name="wat-climate"
            label="Climate"
            options={[
              { value: 'cold', label: 'Cold' },
              { value: 'temperate', label: 'Temperate' },
              { value: 'hot', label: 'Hot / humid' },
            ]}
            value={climate}
            onChange={setClimate}
          />
          {profile.sex === 'female' && (
            <label class="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                class="accent-brand-600 h-4 w-4"
                checked={preg}
                onChange={(e) => setPreg((e.target as HTMLInputElement).checked)}
              />
              <span class="text-muted">Pregnant or breastfeeding</span>
            </label>
          )}
        </div>
      }
      results={
        result ? (
          <div class="grid gap-6">
            <Stat
              label="Daily water target"
              value={vol(result.totalMl)}
              size="lg"
              tone="brand"
              sub={`About ${result.glasses} glasses of 250 ml (8 fl oz)`}
            />
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Baseline" value={vol(result.baselineMl)} sub="35 ml per kg" />
              <Stat label="Exercise" value={`+${vol(result.exerciseMl)}`} sub="12 ml per minute" />
              <Stat label="Climate" value={`+${vol(result.climateMl)}`} sub="Heat allowance" />
              <Stat
                label="Range"
                value={`${vol(result.rangeMl.min)} – ${vol(result.rangeMl.max)}`}
                sub="±10%"
              />
            </div>
            {result.notes.map((n) => (
              <Callout key={n} tone="warn">
                {n}
              </Callout>
            ))}
            <Callout>
              Around 20% of your fluid comes from food, and tea, coffee and milk all count.
              Pale-yellow urine and rarely feeling thirsty means you are hydrated, whatever the
              number says. Water also helps with appetite: a glass before meals modestly reduces
              intake in trials.
            </Callout>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">Enter a valid weight.</Callout>
        )
      }
    />
  );
}
