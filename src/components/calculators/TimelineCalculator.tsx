import { useEffect, useMemo, useState } from 'preact/hooks';
import { calculateCalorieTarget } from '@/lib/calc/energy';
import { humaniseWeeks, projectTimeline } from '@/lib/calc/timeline';
import { formatNumber, formatWeight, kgToLb, lbToKg, round } from '@/lib/calc/units';
import { planStore } from '@/lib/plan';
import { resetProfile, useProfile } from '@/lib/profile';
import { CalculatorShell } from '../ui/CalculatorShell';
import { Callout } from '../ui/Callout';
import { LineChart } from '../ui/LineChart';
import { NumberField } from '../ui/NumberField';
import { ProfileFields } from '../ui/ProfileFields';
import { RangeField } from '../ui/RangeField';
import { ResultActions } from '../ui/ResultActions';
import { Stat } from '../ui/Stat';

export default function TimelineCalculator() {
  const [profile, update] = useProfile();
  const imperial = profile.units === 'imperial';
  const [plan] = planStore.use();
  // One goal weight across the site: the plan's when a plan exists, else the tool's own.
  const goalKg =
    (plan.active ? plan.goalWeightKg : undefined) ??
    profile.goalWeightKg ??
    round(profile.weightKg * 0.9, 1);
  const [intake, setIntake] = useState<number | null>(null);
  const setGoal = (goalWeightKg: number) => {
    update({ goalWeightKg });
    if (plan.active) planStore.patch({ goalWeightKg });
  };

  const suggested = useMemo(() => {
    try {
      return calculateCalorieTarget({
        profile,
        activity: profile.activity,
        goal: goalKg < profile.weightKg ? 'lose' : 'gain',
        rateKgPerWeek: 0.5,
      }).target;
    } catch {
      return null;
    }
  }, [profile, goalKg]);

  useEffect(() => {
    if (intake === null && suggested) setIntake(suggested);
  }, [intake, suggested]);

  const daily = intake ?? suggested ?? 1800;

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        data: projectTimeline({
          profile,
          activity: profile.activity,
          goalWeightKg: goalKg,
          dailyIntake: daily,
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [profile, goalKg, daily]);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const w = (kg: number) => formatWeight(kg, profile.units, 1);
  const summary =
    result.ok && result.data.reached
      ? `From ${w(profile.weightKg)} to ${w(goalKg)} at ${daily} kcal/day: about ${humaniseWeeks(result.data.weeksToGoal!)} (${fmtDate(result.data.goalDate!)}). Average ${imperial ? `${round(kgToLb(result.data.averageRateKgPerWeek), 2)} lb` : `${result.data.averageRateKgPerWeek} kg`}/week. — ethereal`
      : '';

  return (
    <CalculatorShell
      inputs={
        <div class="grid gap-5">
          <ProfileFields profile={profile} update={update} idPrefix="tl" />
          {imperial ? (
            <NumberField
              id="tl-goal"
              label="Goal weight"
              value={kgToLb(goalKg)}
              min={55}
              max={880}
              step={0.5}
              suffix="lb"
              onChange={(lb) => setGoal(lbToKg(lb))}
            />
          ) : (
            <NumberField
              id="tl-goal"
              label="Goal weight"
              value={goalKg}
              min={25}
              max={400}
              step={0.1}
              suffix="kg"
              onChange={(goalWeightKg) => setGoal(goalWeightKg)}
            />
          )}
          <RangeField
            id="tl-intake"
            label="Daily intake"
            value={daily}
            min={1000}
            max={4500}
            step={25}
            onChange={setIntake}
            format={(v) => `${formatNumber(v)} kcal`}
            hint={
              suggested
                ? `Suggested for a steady 0.5 kg/week: ${formatNumber(suggested)} kcal.`
                : undefined
            }
          />
          {suggested && daily !== suggested && (
            <button
              type="button"
              class="btn btn-ghost justify-start text-sm"
              onClick={() => setIntake(suggested)}
            >
              Use the suggested {formatNumber(suggested)} kcal
            </button>
          )}
        </div>
      }
      results={
        result.ok ? (
          <div class="grid gap-6">
            {result.data.reached && result.data.weeksToGoal! > 0 ? (
              <>
                <Stat
                  label="You reach your goal in"
                  value={humaniseWeeks(result.data.weeksToGoal!)}
                  size="lg"
                  tone="brand"
                  sub={`Around ${fmtDate(result.data.goalDate!)}, eating ${formatNumber(daily)} kcal a day`}
                />
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat
                    label="Total change"
                    value={w(Math.abs(result.data.totalChangeKg))}
                    sub={result.data.totalChangeKg > 0 ? 'to lose' : 'to gain'}
                  />
                  <Stat
                    label="Average pace"
                    value={
                      imperial
                        ? `${round(kgToLb(Math.abs(result.data.averageRateKgPerWeek)), 2)} lb`
                        : `${Math.abs(result.data.averageRateKgPerWeek)} kg`
                    }
                    unit="/week"
                    sub={`${round((Math.abs(result.data.averageRateKgPerWeek) / profile.weightKg) * 100, 2)}% of body weight`}
                  />
                  <Stat
                    label="Maintenance now"
                    value={formatNumber(result.data.startTdee)}
                    unit="kcal"
                    sub="Today's TDEE"
                  />
                  <Stat
                    label="Maintenance at goal"
                    value={formatNumber(result.data.endTdee)}
                    unit="kcal"
                    sub={`${formatNumber(result.data.startTdee - result.data.endTdee)} kcal lower`}
                  />
                </div>
                {result.data.naiveWeeks !== null && (
                  <Callout
                    tone="success"
                    title="Why this is slower than the '3,500 calories per pound' math"
                  >
                    A constant-deficit estimate says{' '}
                    {humaniseWeeks(Math.round(result.data.naiveWeeks))}. This projection
                    recalculates your maintenance every week as you get lighter, which is what
                    actually happens. Plan for the realistic number and you won't feel cheated by
                    the scale.
                  </Callout>
                )}
              </>
            ) : result.data.reached ? (
              <Callout tone="success">
                You are already at your goal weight. Set a new goal or use the calorie calculator to
                find maintenance.
              </Callout>
            ) : null}
            {result.data.warnings.map((m) => (
              <Callout key={m} tone="warn">
                {m}
              </Callout>
            ))}
            {summary && <ResultActions summary={summary} onReset={resetProfile} />}
          </div>
        ) : (
          <Callout tone="warn">{result.error}</Callout>
        )
      }
      footer={
        result.ok && result.data.points.length > 1 ? (
          <div class="grid gap-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="text-lg font-bold tracking-tight">Projected weight, week by week</h2>
              <p class="text-subtle text-xs">
                Adaptive model · Mifflin-St Jeor · 7,700 kcal per kg
              </p>
            </div>
            <LineChart
              ariaLabel="Projected weight over time"
              points={result.data.points.map((p) => ({
                x: p.week,
                y: imperial ? kgToLb(p.weightKg) : p.weightKg,
              }))}
              goal={imperial ? kgToLb(goalKg) : goalKg}
              xLabel={(x) => (x === 0 ? 'Now' : `Wk ${x}`)}
              yLabel={(y) => `${Math.round(y)} ${imperial ? 'lb' : 'kg'}`}
            />
            <details class="text-sm">
              <summary class="text-muted cursor-pointer font-medium">Show milestone table</summary>
              <div class="mt-3 overflow-x-auto">
                <table class="tabular w-full">
                  <thead>
                    <tr class="text-subtle text-left text-xs">
                      <th class="pb-2 font-semibold">Week</th>
                      <th class="pb-2 font-semibold">Date</th>
                      <th class="pb-2 font-semibold">Weight</th>
                      <th class="pb-2 font-semibold">Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.points
                      .filter(
                        (p, i, arr) =>
                          i === 0 ||
                          i === arr.length - 1 ||
                          p.week % Math.max(1, Math.round(arr.length / 12)) === 0,
                      )
                      .map((p) => (
                        <tr key={p.week} class="border-line border-t">
                          <td class="py-1.5">{p.week}</td>
                          <td class="py-1.5">{fmtDate(p.date)}</td>
                          <td class="py-1.5 font-semibold">{w(p.weightKg)}</td>
                          <td class="py-1.5">{formatNumber(p.tdee)} kcal</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        ) : undefined
      }
    />
  );
}
