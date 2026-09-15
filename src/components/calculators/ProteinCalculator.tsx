import { useMemo, useState } from 'preact/hooks';
import { calculateProtein, type ProteinGoal, type TrainingLevel } from '@/lib/calc/protein';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { ResultActions } from '../ui/ResultActions';
import { Segmented } from '../ui/Segmented';
import { Stat } from '../ui/Stat';

const FOODS: Array<[string, string, number]> = [
  ['Chicken breast', '100 g cooked', 31],
  ['Greek yogurt (0%)', '170 g pot', 17],
  ['Eggs', '2 large', 13],
  ['Whey protein', '1 scoop (30 g)', 24],
  ['Lentils', '1 cup cooked', 18],
  ['Tofu (firm)', '150 g', 20],
  ['Tuna', '1 can (drained)', 25],
  ['Cottage cheese', '1 cup', 25],
];

export default function ProteinCalculator() {
  const [profile, update] = useProfile();
  const [goal, setGoal] = useState<ProteinGoal>('lose');
  const [training, setTraining] = useState<TrainingLevel>('regular');
  const [meals, setMeals] = useState(4);
  const [useBf, setUseBf] = useState(false);

  const result = useMemo(() => {
    try {
      return calculateProtein({
        weightKg: profile.weightKg,
        goal,
        training,
        age: profile.age,
        mealsPerDay: meals,
        ...(useBf && profile.bodyFatPercent !== undefined
          ? { bodyFatPercent: profile.bodyFatPercent }
          : {}),
      });
    } catch {
      return null;
    }
  }, [profile.weightKg, profile.age, profile.bodyFatPercent, goal, training, meals, useBf]);

  const summary = result
    ? `Protein target: ${result.target} g/day (range ${result.low}–${result.high} g), ≈ ${result.perMeal} g per meal over ${result.mealsPerDay} meals. — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <ProfileFields
            profile={profile}
            update={update}
            show={['units', 'weight', 'age']}
            idPrefix="pro"
          />
          <Segmented
            name="pro-goal"
            label="Goal"
            options={[
              { value: 'lose', label: 'Lose fat' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Build muscle' },
            ]}
            value={goal}
            onChange={setGoal}
          />
          <Segmented
            name="pro-train"
            label="Resistance training"
            columns={2}
            options={[
              { value: 'none', label: 'None', hint: 'No lifting' },
              { value: 'light', label: 'Light', hint: '1–2× a week' },
              { value: 'regular', label: 'Regular', hint: '3–4× a week' },
              { value: 'heavy', label: 'Heavy', hint: '5+ or athlete' },
            ]}
            value={training}
            onChange={setTraining}
          />
          <RangeField
            id="pro-meals"
            label="Meals per day"
            value={meals}
            min={2}
            max={6}
            onChange={setMeals}
          />
          <label class="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              class="accent-brand-600 h-4 w-4"
              checked={useBf}
              onChange={(e) => setUseBf((e.target as HTMLInputElement).checked)}
            />
            <span class="text-muted">Adjust for body fat (recommended above 30%)</span>
          </label>
          {useBf && (
            <NumberField
              id="pro-bf"
              label="Body fat"
              value={profile.bodyFatPercent ?? 30}
              min={3}
              max={70}
              suffix="%"
              onChange={(bodyFatPercent) => update({ bodyFatPercent })}
            />
          )}
        </div>
      }
      results={
        result ? (
          <div class="grid gap-6">
            <Stat
              label="Daily protein target"
              value={result.target}
              unit="g"
              size="lg"
              tone="brand"
              sub={`${result.gPerKg.target} g per kg${result.usedLeanAdjustment ? ' of lean-adjusted mass' : ''}`}
            />
            <div class="grid grid-cols-3 gap-4">
              <Stat label="Minimum" value={result.low} unit="g" sub={`${result.gPerKg.low} g/kg`} />
              <Stat
                label="Upper end"
                value={result.high}
                unit="g"
                sub={`${result.gPerKg.high} g/kg`}
              />
              <Stat
                label="Per meal"
                value={result.perMeal}
                unit="g"
                sub={`× ${result.mealsPerDay} meals`}
              />
            </div>
            <Callout tone="success" title="Why this number">
              {result.rationale}
            </Callout>
            <div>
              <p class="text-subtle mb-2 text-xs font-semibold tracking-wide uppercase">
                What {result.perMeal} g looks like
              </p>
              <ul class="grid gap-1.5 text-sm sm:grid-cols-2">
                {FOODS.map(([name, serving, g]) => (
                  <li
                    key={name}
                    class="border-line flex items-baseline justify-between gap-2 border-b py-1.5"
                  >
                    <span>
                      {name} <span class="text-subtle">· {serving}</span>
                    </span>
                    <span class="tabular font-semibold">{g} g</span>
                  </li>
                ))}
              </ul>
            </div>
            <ResultActions summary={summary} onReset={resetProfile} />
          </div>
        ) : (
          <Callout tone="warn">Enter a valid weight.</Callout>
        )
      }
    />
  );
}
