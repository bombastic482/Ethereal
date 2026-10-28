import { useMemo, useState } from 'preact/hooks';
import { calculateCalorieTarget, type BmrFormula, type Goal } from '@/lib/calc/energy';
import { formatNumber, kgToLb, round } from '@/lib/calc/units';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { ResultActions } from '../ui/ResultActions';
import { Segmented } from '../ui/Segmented';
import { Stat } from '../ui/Stat';
import { withBase } from '@/lib/url';

const GOALS = [
  { value: 'lose', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Build muscle' },
] as const satisfies ReadonlyArray<{ value: Goal; label: string }>;

const FORMULAS = [
  { value: 'mifflin', label: 'Mifflin-St Jeor', hint: 'Recommended' },
  { value: 'harris', label: 'Harris-Benedict', hint: 'Classic' },
  { value: 'katch', label: 'Katch-McArdle', hint: 'Needs body fat' },
] as const satisfies ReadonlyArray<{ value: BmrFormula; label: string; hint: string }>;

export default function CalorieCalculator() {
  const [profile, update] = useProfile();
  const [goal, setGoal] = useState<Goal>('lose');
  const [rate, setRate] = useState(0.5);
  const [formula, setFormula] = useState<BmrFormula>('mifflin');
  const imperial = profile.units === 'imperial';

  const result = useMemo(() => {
    try {
      const p =
        formula === 'katch'
          ? { ...profile, bodyFatPercent: profile.bodyFatPercent ?? 25 }
          : profile;
      return {
        ok: true as const,
        data: calculateCalorieTarget({
          profile: p,
          activity: profile.activity,
          goal,
          rateKgPerWeek: rate,
          formula,
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [profile, goal, rate, formula]);

  const rateLabel = (v: number) => (imperial ? `${round(kgToLb(v), 1)} lb/week` : `${v} kg/week`);
  const pctBody = round((rate / profile.weightKg) * 100, 2);

  const summary = result.ok
    ? `Maintenance (TDEE): ${result.data.tdee} kcal/day. Target to ${goal === 'lose' ? 'lose' : goal === 'gain' ? 'gain' : 'maintain'}${goal !== 'maintain' ? ` ${rateLabel(rate)}` : ''}: ${result.data.target} kcal/day. BMR ${result.data.bmr} kcal (${formula}). — ethereal`
    : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <ProfileFields profile={profile} update={update} idPrefix="cal" />
          <Segmented name="cal-goal" label="Goal" options={GOALS} value={goal} onChange={setGoal} />
          {goal !== 'maintain' && (
            <RangeField
              id="cal-rate"
              label={goal === 'lose' ? 'Rate of loss' : 'Rate of gain'}
              value={rate}
              min={0.1}
              max={goal === 'lose' ? 1.25 : 0.5}
              step={0.05}
              onChange={setRate}
              format={rateLabel}
              hint={`≈ ${pctBody}% of body weight per week. 0.5–1% is the sweet spot for keeping muscle.`}
            />
          )}
          <Segmented
            name="cal-formula"
            label="BMR formula"
            options={FORMULAS}
            value={formula}
            onChange={setFormula}
            columns={3}
          />
          {formula === 'katch' && (
            <NumberField
              id="cal-bf"
              label="Body fat"
              value={profile.bodyFatPercent ?? 25}
              min={3}
              max={70}
              suffix="%"
              onChange={(bodyFatPercent) => update({ bodyFatPercent })}
              hint="Don't know it? Use the body-fat calculator first."
            />
          )}
        </div>
      }
      results={
        result.ok ? (
          <div class="grid gap-6">
            <Stat
              label={goal === 'maintain' ? 'Maintenance calories' : 'Your daily target'}
              value={formatNumber(result.data.target)}
              unit="kcal"
              size="lg"
              tone="brand"
              sub={
                goal === 'maintain'
                  ? 'Eat this to hold your current weight'
                  : `${goal === 'lose' ? 'Deficit' : 'Surplus'} of ${formatNumber(Math.abs(result.data.dailyDelta))} kcal/day (${Math.abs(result.data.deficitPercent)}% of maintenance)`
              }
            />
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat
                label="BMR"
                value={formatNumber(result.data.bmr)}
                unit="kcal"
                sub="Burned at complete rest"
              />
              <Stat
                label="TDEE"
                value={formatNumber(result.data.tdee)}
                unit="kcal"
                sub="Maintenance with activity"
              />
              {goal !== 'maintain' && (
                <Stat
                  label="Expected rate"
                  value={rateLabel(result.data.achievableRateKgPerWeek).split(' ')[0]!}
                  unit={imperial ? 'lb/wk' : 'kg/wk'}
                  sub="After safety limits"
                />
              )}
            </div>
            <WeekTable tdee={result.data.tdee} sex={profile.sex} imperial={imperial} />
            {result.data.warnings.map((w) => (
              <Callout key={w} tone="warn">
                {w}
              </Callout>
            ))}
            <Callout>
              Every formula is an estimate with roughly ±10% error. Eat at this target for 2–3
              weeks, compare your weekly average weight, then adjust by 100–150 kcal. See the{' '}
              <a class="underline" href={withBase('/tools/timeline/')}>
                timeline tool
              </a>{' '}
              for your goal date.
            </Callout>
            <div class="flex flex-wrap items-center gap-3">
              <ResultActions summary={summary} onReset={resetProfile} />
              <a href={withBase('/start/')} class="btn btn-primary text-sm">
                Turn this into a plan →
              </a>
            </div>
          </div>
        ) : (
          <Callout tone="warn">{result.error}</Callout>
        )
      }
    />
  );
}

function WeekTable({
  tdee,
  sex,
  imperial,
}: {
  tdee: number;
  sex: 'male' | 'female';
  imperial: boolean;
}) {
  const floor = sex === 'male' ? 1500 : 1200;
  const rows = [0.25, 0.5, 0.75, 1].map((kg) => {
    const deficit = round((kg * 7700) / 7);
    const target = Math.max(floor, tdee - deficit);
    const capped = tdee - target < deficit;
    return { kg, deficit, target, capped };
  });
  return (
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <caption class="text-subtle mb-2 text-left text-xs font-semibold tracking-wide uppercase">
          Quick reference
        </caption>
        <thead>
          <tr class="text-subtle text-left text-xs">
            <th class="pb-2 font-semibold">Weekly loss</th>
            <th class="pb-2 font-semibold">Daily deficit</th>
            <th class="pb-2 font-semibold">Eat per day</th>
          </tr>
        </thead>
        <tbody class="tabular">
          {rows.map((r) => (
            <tr key={r.kg} class="border-line border-t">
              <td class="py-2">{imperial ? `${round(kgToLb(r.kg), 1)} lb` : `${r.kg} kg`}</td>
              <td class="py-2">{r.deficit} kcal</td>
              <td class="py-2 font-semibold">
                {formatNumber(r.target)} kcal
                {r.capped && <span class="text-subtle ml-1 text-xs font-normal">(floor)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
