import { useEffect, useMemo, useState } from 'preact/hooks';
import { adherencePercent, summariseDay } from '@/lib/calc/nutrition';
import { currentStreak, longestStreak, shift, weightMilestones } from '@/lib/calc/streaks';
import { assessProgress, daysBetween, trendSeries } from '@/lib/calc/trend';
import { diaryStore, prefsStore } from '@/lib/food-store';
import { humaniseWeeks } from '@/lib/calc/timeline';
import { formatNumber, formatWeight, kgToLb, lbToKg, round } from '@/lib/calc/units';
import { logStore, upsertEntry } from '@/lib/log';
import { buildPlanSummary, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { confetti, haptic } from '@/lib/fx';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { DonutChart } from '../ui/DonutChart';
import { Icon } from '../ui/Icon';
import { LineChart } from '../ui/LineChart';
import { NumberField } from '../ui/NumberField';
import { Stat } from '../ui/Stat';
import { WeekBars } from '../ui/WeekBars';

const STATUS_STYLE: Record<string, string> = {
  'on-track': 'bg-brand-100 text-brand-800 dark:bg-brand-400/15 dark:text-brand-100',
  'too-slow': 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100',
  'too-fast': 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100',
  stalled: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100',
  gaining: 'bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-100',
  'insufficient-data': 'bg-muted text-muted',
};

export default function PlanDashboard() {
  const [profile] = useProfile();
  const [plan, patchPlan] = planStore.use();
  const [log] = logStore.use();
  const [diary] = diaryStore.use();
  const [prefs] = prefsStore.use();
  const today = todayIso();
  const imperial = profile.units === 'imperial';
  const [quick, setQuick] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const trend = useMemo(() => trendSeries(log.entries), [log.entries]);
  const latestTrend = trend[trend.length - 1]?.trendKg ?? profile.weightKg;
  const todayEntry = log.entries.find((e) => e.date === today);

  const summary = useMemo(() => {
    if (!plan.active) return null;
    try {
      // Project from the trend weight, not the possibly-stale profile weight.
      return buildPlanSummary({ ...profile, weightKg: latestTrend }, plan);
    } catch {
      return null;
    }
  }, [profile, plan, latestTrend]);

  const report = useMemo(
    () =>
      summary
        ? assessProgress(
            {
              entries: log.entries,
              plannedRateKgPerWeek: plan.goal === 'maintain' ? 0 : plan.rateKgPerWeek,
              targetCalories: summary.target,
              goalWeightKg: plan.goal === 'maintain' ? plan.startWeightKg : plan.goalWeightKg,
              startWeightKg: plan.startWeightKg,
              floorCalories: summary.floor,
            },
            today,
          )
        : null,
    [summary, log.entries, plan, today],
  );

  const week = useMemo(() => {
    if (!summary) return null;
    const days = Array.from({ length: 7 }, (_, i) => shift(today, -i));
    const t = {
      kcal: summary.target,
      protein: summary.macros.grams.protein,
      carbs: summary.macros.grams.carbs,
      fat: summary.macros.grams.fat,
      fibre: summary.macros.grams.fibre,
    };
    const per = days.map((d) =>
      summariseDay(
        diary.food.filter((e) => e.date === d),
        diary.exercise.filter((e) => e.date === d),
        t,
        prefs.eatBack,
      ),
    );
    const logged = per.filter((d) => d.eaten.kcal > 0);
    const avgKcal = logged.length
      ? Math.round(logged.reduce((a, d) => a + d.eaten.kcal, 0) / logged.length)
      : null;
    const avgProtein = logged.length
      ? Math.round(logged.reduce((a, d) => a + d.eaten.protein, 0) / logged.length)
      : null;
    const adherence = adherencePercent(
      per.map((d) => ({ eatenKcal: d.eaten.kcal, targetKcal: d.target.kcal })),
    );
    const weighIns = log.entries.filter((e) => days.includes(e.date)).length;
    const bars = days
      .map((d, i) => ({
        label: new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }),
        value: per[i]!.eaten.kcal,
        target: per[i]!.target.kcal,
      }))
      .reverse();
    return { loggedDays: logged.length, avgKcal, avgProtein, adherence, weighIns, target: t, bars };
  }, [summary, diary.food, diary.exercise, prefs.eatBack, log.entries, today]);
  const streak = useMemo(
    () =>
      currentStreak([...diary.food.map((e) => e.date), ...log.entries.map((e) => e.date)], today),
    [diary.food, log.entries, today],
  );
  const best = useMemo(
    () => longestStreak([...diary.food.map((e) => e.date), ...log.entries.map((e) => e.date)]),
    [diary.food, log.entries],
  );
  const milestones = useMemo(
    () =>
      plan.goal === 'maintain'
        ? []
        : weightMilestones(
            plan.startWeightKg,
            trend[trend.length - 1]?.trendKg ?? null,
            plan.goalWeightKg,
            imperial,
          ),
    [plan, trend, imperial],
  );

  useEffect(() => {
    const reached = milestones.filter((m) => m.reached).map((m) => m.key);
    if (reached.length === 0) return;
    try {
      const seen = new Set<string>(
        JSON.parse(localStorage.getItem('ethereal:milestones-seen') ?? '[]') as string[],
      );
      const fresh = reached.filter((k) => !seen.has(k));
      if (fresh.length === 0) return;
      localStorage.setItem('ethereal:milestones-seen', JSON.stringify([...seen, ...fresh]));
      confetti({ x: 0.5, y: 0.4 }, 160);
      haptic([20, 50, 20]);
    } catch {
      /* ignore */
    }
  }, [milestones]);

  if (!plan.active) {
    return (
      <div class="surface mx-auto max-w-xl p-8 text-center">
        <span class="bg-brand-100 text-brand-700 dark:bg-brand-400/15 dark:text-brand-200 mx-auto grid h-14 w-14 place-items-center rounded-2xl">
          <Icon name="target" size={28} />
        </span>
        <h2 class="mt-5 text-2xl font-bold tracking-tight">You don't have a plan yet</h2>
        <p class="text-muted mt-2">
          Three quick steps: your stats, your goal, your numbers. Takes about a minute and lives
          only on this device.
        </p>
        <a href={withBase('/start/')} class="btn btn-primary mt-6">
          Build my plan <Icon name="arrow" size={16} />
        </a>
      </div>
    );
  }

  const w = (kg: number) => formatWeight(kg, profile.units, 1);
  const dayNum = daysBetween(plan.startedOn, today) + 1;
  const lost = report?.lostKg ?? 0;
  const pct = report?.progressPercent ?? 0;
  const goalDate = summary?.timeline?.goalDate ?? null;
  const weeksLeft = summary?.timeline?.weeksToGoal ?? null;

  const quickSave = () => {
    const kg = imperial ? lbToKg(quick ?? kgToLb(latestTrend)) : (quick ?? latestTrend);
    upsertEntry({ date: today, weightKg: round(kg, 2) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const applyRecommendation = () => {
    if (!report?.recommendedCalories) return;
    patchPlan({ calorieOverride: report.recommendedCalories, lastAdjustedOn: today });
  };

  const chartPoints = trend.map((p) => ({
    x: daysBetween(plan.startedOn, p.date),
    y: imperial ? kgToLb(p.trendKg) : p.trendKg,
  }));
  const chartDots = log.entries.map((e) => ({
    x: daysBetween(plan.startedOn, e.date),
    y: imperial ? kgToLb(e.weightKg) : e.weightKg,
  }));

  return (
    <div class="grid gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="chip">
            <Icon name="calendar" size={14} /> Day {dayNum} · started{' '}
            {new Date(plan.startedOn + 'T00:00:00').toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </p>
          <h2 class="mt-3 text-3xl font-bold tracking-tight">
            {plan.goal === 'maintain'
              ? 'Holding steady'
              : `${w(Math.abs(lost))} ${plan.goal === 'lose' ? 'down' : 'up'}, ${w(Math.abs(plan.goal === 'lose' ? latestTrend - plan.goalWeightKg : plan.goalWeightKg - latestTrend))} to go`}
          </h2>
        </div>
        <a href={withBase('/start/')} class="btn btn-secondary text-sm">
          Edit plan
        </a>
      </div>

      {plan.goal !== 'maintain' && (
        <div class="surface p-5">
          <div class="text-subtle mb-2 flex justify-between text-xs font-semibold tracking-wide uppercase">
            <span>{w(plan.startWeightKg)}</span>
            <span>{pct}% there</span>
            <span>{w(plan.goalWeightKg)}</span>
          </div>
          <div
            class="bg-muted h-3 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to goal"
          >
            <div
              class="from-brand-500 to-accent-500 h-full rounded-full bg-gradient-to-r transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {goalDate && weeksLeft !== null && (
            <p class="text-muted mt-3 text-sm">
              At your current trend you reach {w(plan.goalWeightKg)} in about{' '}
              <strong class="text-fg">{humaniseWeeks(weeksLeft)}</strong> (
              {goalDate.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              ).
            </p>
          )}
        </div>
      )}

      <div class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section class="surface grid gap-5 p-5 sm:p-6" aria-label="Daily targets">
          <div class="flex items-start justify-between gap-4">
            <Stat
              label="Eat per day"
              value={formatNumber(summary?.target ?? 0)}
              unit="kcal"
              size="lg"
              tone="brand"
              sub={
                plan.calorieOverride !== null
                  ? `Adjusted on ${plan.lastAdjustedOn} from ${formatNumber(summary?.computedTarget ?? 0)} kcal`
                  : `Maintenance ≈ ${formatNumber(summary?.tdee ?? 0)} kcal`
              }
            />
            <Stat
              label="Protein"
              value={summary?.protein.target ?? 0}
              unit="g"
              sub={`≈ ${summary?.protein.perMeal ?? 0} g × ${summary?.protein.mealsPerDay ?? 4} meals`}
            />
          </div>
          {summary && (
            <DonutChart
              size={150}
              centerValue={`${summary.macros.grams.protein}g`}
              centerLabel="PROTEIN"
              slices={[
                {
                  label: `Protein · ${summary.macros.grams.protein} g`,
                  value: summary.macros.kcal.protein,
                  color: 'var(--color-brand-500)',
                },
                {
                  label: `Carbs · ${summary.macros.grams.carbs} g`,
                  value: summary.macros.kcal.carbs,
                  color: 'var(--color-accent-500)',
                },
                {
                  label: `Fat · ${summary.macros.grams.fat} g`,
                  value: summary.macros.kcal.fat,
                  color: 'oklch(80% 0.15 85)',
                },
              ]}
            />
          )}
          <p class="text-subtle text-xs">
            Fibre ≈ {summary?.macros.grams.fibre} g · Water ≈ {round((latestTrend * 35) / 1000, 1)}{' '}
            L.{' '}
            <a class="underline" href={withBase('/tools/macros/')}>
              Fine-tune macros
            </a>
          </p>
        </section>

        <section class="surface grid content-start gap-4 p-5 sm:p-6" aria-label="Today's weigh-in">
          <h3 class="text-lg font-bold tracking-tight">Today's weigh-in</h3>
          {todayEntry ? (
            <Callout tone="success">
              Logged {w(todayEntry.weightKg)} today. Trend weight: <strong>{w(latestTrend)}</strong>
              .
            </Callout>
          ) : (
            <p class="text-muted text-sm">
              Morning, after the bathroom, before food. Same scale, same spot.
            </p>
          )}
          <div class="flex items-end gap-2">
            <NumberField
              id="quick-weight"
              label={todayEntry ? 'Update today' : 'Weight'}
              value={
                quick ??
                (imperial
                  ? kgToLb(todayEntry?.weightKg ?? latestTrend)
                  : (todayEntry?.weightKg ?? latestTrend))
              }
              min={imperial ? 55 : 25}
              max={imperial ? 880 : 400}
              step={0.1}
              suffix={imperial ? 'lb' : 'kg'}
              onChange={setQuick}
              class="flex-1"
            />
            <button type="button" class="btn btn-primary h-[46px]" onClick={quickSave}>
              <Icon name={saved ? 'check' : 'scale'} size={16} /> {saved ? 'Saved' : 'Log'}
            </button>
          </div>
          <a
            href={withBase('/track/')}
            class="text-brand-600 dark:text-brand-300 text-sm font-semibold"
          >
            Open the full tracker →
          </a>
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="surface p-5 sm:p-6" aria-label="This week">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-bold tracking-tight">This week</h3>
            {streak > 0 && (
              <span class="chip">
                <Icon name="flame" size={14} /> {streak}-day streak
                {best > streak ? ` · best ${best}` : ''}
              </span>
            )}
          </div>
          {week && week.loggedDays > 0 ? (
            <>
              <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Days logged" value={`${week.loggedDays}/7`} />
                <Stat
                  label="Avg calories"
                  value={week.avgKcal === null ? '—' : formatNumber(week.avgKcal)}
                  sub={`target ${formatNumber(week.target.kcal)}`}
                />
                <Stat
                  label="Avg protein"
                  value={week.avgProtein === null ? '—' : `${week.avgProtein} g`}
                  sub={`target ${week.target.protein} g`}
                  tone={
                    week.avgProtein !== null && week.avgProtein >= week.target.protein * 0.9
                      ? 'brand'
                      : 'default'
                  }
                />
                <Stat
                  label="On target"
                  value={week.adherence === null ? '—' : `${week.adherence}%`}
                  sub="days within ±10%"
                />
              </div>
              <div class="mt-5">
                <WeekBars
                  days={week.bars}
                  ariaLabel="Calories eaten per day this week against target"
                />
              </div>
            </>
          ) : (
            <p class="text-muted mt-3 text-sm">
              No meals logged this week.{' '}
              <a class="underline" href={withBase('/today/')}>
                Log today
              </a>{' '}
              and this card becomes your weekly report.
            </p>
          )}
        </section>
        <section class="surface p-5 sm:p-6" aria-label="Milestones">
          <h3 class="text-lg font-bold tracking-tight">Milestones</h3>
          {milestones.length > 0 ? (
            <ul class="mt-4 grid gap-3">
              {milestones.map((m) => (
                <li key={m.key} class="flex items-center gap-3">
                  <span
                    class={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.reached ? 'bg-brand-600 text-white' : 'bg-muted text-subtle'}`}
                  >
                    <Icon name={m.reached ? 'check' : 'target'} size={16} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold">{m.label}</span>
                    <span class="text-subtle block text-xs">{m.detail}</span>
                    {!m.reached && (
                      <span class="bg-muted mt-1 block h-1.5 w-full overflow-hidden rounded-full">
                        <span
                          class="bg-brand-500 block h-full rounded-full"
                          style={{ width: `${Math.round(m.progress * 100)}%` }}
                        />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-muted mt-3 text-sm">Milestones appear once your trend starts moving.</p>
          )}
        </section>
      </div>

      {report && (
        <section class="surface p-5 sm:p-6" aria-label="Progress check">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-bold tracking-tight">Two-week check</h3>
            <span
              class={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[report.status]}`}
            >
              {report.headline}
            </span>
          </div>
          <p class="text-muted mt-3 text-sm leading-relaxed">{report.detail}</p>
          {report.status !== 'insufficient-data' && (
            <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Planned pace"
                value={
                  imperial
                    ? `${round(kgToLb(report.plannedRateKgPerWeek), 2)} lb`
                    : `${report.plannedRateKgPerWeek} kg`
                }
                unit="/wk"
              />
              <Stat
                label="Measured pace"
                value={
                  report.measuredRateKgPerWeek === null
                    ? '—'
                    : imperial
                      ? `${round(kgToLb(Math.abs(report.measuredRateKgPerWeek)), 2)} lb`
                      : `${Math.abs(report.measuredRateKgPerWeek)} kg`
                }
                unit="/wk"
              />
              <Stat
                label="Real deficit"
                value={
                  report.impliedDeficitKcal === null ? '—' : formatNumber(report.impliedDeficitKcal)
                }
                unit="kcal"
              />
              <Stat
                label="Days logged"
                value={log.entries.length}
                sub={
                  report.daysSinceLastEntry
                    ? `${report.daysSinceLastEntry} day(s) since last`
                    : 'Up to date'
                }
              />
            </div>
          )}
          {report.recommendedCalories && plan.lastAdjustedOn !== today && (
            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" class="btn btn-primary" onClick={applyRecommendation}>
                Set target to {formatNumber(report.recommendedCalories)} kcal
              </button>
              <span class="text-subtle text-xs">
                Applies for the next two weeks, then we re-check.
              </span>
            </div>
          )}
          {plan.calorieOverride !== null && (
            <button
              type="button"
              class="btn btn-ghost mt-3 text-sm"
              onClick={() => patchPlan({ calorieOverride: null, lastAdjustedOn: null })}
            >
              <Icon name="reset" size={14} /> Reset to the computed target
            </button>
          )}
        </section>
      )}

      {chartPoints.length > 1 && (
        <section class="surface p-5 sm:p-6" aria-label="Trend chart">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="text-lg font-bold tracking-tight">Trend since you started</h3>
            <p class="text-subtle text-xs">
              Dots are daily weigh-ins; the line is the smoothed trend
            </p>
          </div>
          <LineChart
            ariaLabel="Trend weight since the plan started"
            points={chartPoints}
            dots={chartDots}
            goal={
              plan.goal === 'maintain'
                ? undefined
                : imperial
                  ? kgToLb(plan.goalWeightKg)
                  : plan.goalWeightKg
            }
            xLabel={(x) => (x === 0 ? 'Start' : `Day ${x}`)}
            yLabel={(y) => `${round(y, 1)} ${imperial ? 'lb' : 'kg'}`}
          />
        </section>
      )}
    </div>
  );
}
