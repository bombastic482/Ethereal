import { useEffect, useMemo, useState } from 'preact/hooks';
import { estimateExpenditure } from '@/lib/calc/expenditure';
import { buildInsights } from '@/lib/calc/insights';
import { adherencePercent, summariseDay } from '@/lib/calc/nutrition';
import {
  allWeightMilestones,
  currentStreak,
  longestStreak,
  shift,
  weightMilestones,
} from '@/lib/calc/streaks';
import { assessProgress, daysBetween, trendSeries } from '@/lib/calc/trend';
import { diaryStore, prefsStore } from '@/lib/food-store';
import { humaniseWeeks } from '@/lib/calc/timeline';
import { formatNumber, formatWeight, kgToLb, lbToKg, round } from '@/lib/calc/units';
import { logStore, upsertEntry } from '@/lib/log';
import { buildPlanSummary, planProfile, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { confetti, haptic } from '@/lib/fx';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Hydrated, Placeholder } from '../ui/Hydrated';
import { Icon, type IconName } from '../ui/Icon';
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

function PlanDashboardInner() {
  const [profile] = useProfile();
  const [plan, patchPlan] = planStore.use();
  const [log] = logStore.use();
  const [diary] = diaryStore.use();
  const [prefs] = prefsStore.use();
  const today = todayIso();
  // An accepted adjustment runs for two weeks before the check is offered again,
  // otherwise the same slope would stack another cut every day.
  const recentlyAdjusted =
    plan.lastAdjustedOn !== null && daysBetween(plan.lastAdjustedOn, today) < 14;
  const imperial = profile.units === 'imperial';
  const [quick, setQuick] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const trend = useMemo(() => trendSeries(log.entries), [log.entries]);
  const latestTrend = trend[trend.length - 1]?.trendKg ?? profile.weightKg;
  const todayEntry = log.entries.find((e) => e.date === today);

  const summary = useMemo(() => {
    if (!plan.active) return null;
    try {
      return buildPlanSummary(planProfile(profile, log.entries), plan);
    } catch {
      return null;
    }
  }, [profile, plan, log.entries]);

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
  const expenditure = useMemo(() => {
    if (!summary) return null;
    const byDay = new Map<string, number>();
    for (const e of diary.food) {
      const f = e.grams / 100;
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.per100g.kcal * f);
    }
    const intake = [...byDay.entries()].map(([date, kcal]) => ({ date, kcal: Math.round(kcal) }));
    return estimateExpenditure(intake, log.entries, summary.tdee);
  }, [summary, diary.food, log.entries]);
  const insights = useMemo(() => {
    if (!summary) return [];
    const days = Array.from({ length: 14 }, (_, i) => shift(today, -i));
    return buildInsights(
      diary.food,
      diary.exercise,
      {
        kcal: summary.target,
        protein: summary.macros.grams.protein,
        carbs: summary.macros.grams.carbs,
        fat: summary.macros.grams.fat,
        fibre: summary.macros.grams.fibre,
      },
      days,
    );
  }, [summary, diary.food, diary.exercise, today]);
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
        <h2 class="font-display mt-5 text-3xl tracking-tight">You don't have a plan yet</h2>
        <p class="text-muted mt-2">
          Your stats, your goal, your numbers. Takes about a minute and lives only on this device.
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

  // Default weigh-in value: today's entry, else the last real weigh-in, else the profile. Never
  // the smoothed trend: logging the trend would feed the smoother its own output and flatten it.
  const lastRaw =
    todayEntry?.weightKg ?? log.entries[log.entries.length - 1]?.weightKg ?? profile.weightKg;
  const quickSave = () => {
    const kg = imperial ? lbToKg(quick ?? kgToLb(lastRaw)) : (quick ?? lastRaw);
    upsertEntry({ date: today, weightKg: round(kg, 2) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  // Goal reached when the smoothed trend has crossed the goal weight (loss or gain).
  const goalReached =
    plan.goal !== 'maintain' &&
    trend.length >= 7 &&
    (plan.goal === 'lose' ? latestTrend <= plan.goalWeightKg : latestTrend >= plan.goalWeightKg);
  const switchToMaintenance = () => {
    const now = round(latestTrend, 1);
    patchPlan({
      goal: 'maintain',
      goalWeightKg: now,
      startWeightKg: now,
      startedOn: today,
      calorieOverride: null,
      lastAdjustedOn: null,
    });
    confetti({ x: 0.5, y: 0.3 }, 180);
    haptic([15, 40, 15]);
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
  const trendChart = chartPoints.length > 1 && (
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
  );

  // The way from start to goal, with every milestone on it. Marks that would crowd each other or
  // the ends are left off the line; they still count.
  const marks =
    plan.goal === 'maintain'
      ? []
      : allWeightMilestones(plan.startWeightKg, latestTrend, plan.goalWeightKg, imperial);
  const lineMarks: typeof marks = [];
  for (const m of marks) {
    const prev = lineMarks[lineMarks.length - 1];
    if (m.at < 0.97 && (!prev || m.at - prev.at >= 0.05)) lineMarks.push(m);
  }
  const nextMark = marks.find((m) => !m.reached) ?? null;

  // The one thing to change next. A calorie change the trend asks for comes first, then the
  // pattern most worth fixing, and if nothing needs fixing, saying so is the advice.
  const promoted = insights.find((i) => i.tone === 'warn') ?? null;
  const focusWeighIn = () => {
    const el = document.getElementById('quick-weight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.focus({ preventScroll: true });
  };
  type Move = {
    key: string;
    icon: IconName;
    title: string;
    detail: string;
    action?: preact.ComponentChildren;
  };
  let move: Move | null = null;
  if (goalReached) move = null;
  else if (report?.recommendedCalories && !recentlyAdjusted) {
    const less = report.recommendedCalories < (summary?.target ?? 0);
    move = {
      key: 'retarget',
      icon: 'target',
      title: `${less ? 'Eat a little less' : 'Eat a little more'}: ${formatNumber(report.recommendedCalories)} kcal a day`,
      detail:
        'This comes from what your trend actually did, not a formula. It runs for two weeks, then Ethereal checks again.',
      action: (
        <button type="button" class="btn btn-primary" onClick={applyRecommendation}>
          Set target to {formatNumber(report.recommendedCalories)} kcal
        </button>
      ),
    };
  } else if (report?.status === 'insufficient-data') {
    move = {
      key: 'weigh',
      icon: 'scale',
      title: todayEntry ? 'Weighed in. Same again tomorrow.' : 'Weigh in this morning',
      detail:
        'Water moves the scale a kilo or two from day to day. After two weeks of weigh-ins the trend is steady enough to act on, and this card tells you what to change.',
      action: !todayEntry && (
        <button type="button" class="btn btn-secondary" onClick={focusWeighIn}>
          <Icon name="scale" size={16} /> Log today's weight
        </button>
      ),
    };
  } else if (promoted) {
    move = {
      key: promoted.key,
      icon: 'spark',
      title: promoted.move?.title ?? promoted.title,
      detail: promoted.move?.detail ?? promoted.detail,
      action: promoted.link && (
        <a class="next-move-link" href={withBase(promoted.link.href)}>
          {promoted.link.label} <Icon name="arrow" size={15} />
        </a>
      ),
    };
  } else if (report?.status === 'on-track') {
    move = {
      key: 'steady',
      icon: 'check',
      title: 'Change nothing',
      detail:
        'Your trend matches the plan. The best next move is the one you are already making: eat to your target, weigh in, repeat.',
    };
  } else if (report) {
    move = {
      key: 'check',
      icon: 'target',
      title: report.headline,
      detail: 'The two-week check below says why, and what to do about it.',
    };
  }
  const patterns =
    move && promoted && move.key === promoted.key
      ? insights.filter((i) => i !== promoted)
      : insights;

  const journey =
    plan.goal !== 'maintain' ? (
      <section class="surface journey p-5 sm:p-6" aria-label="Your journey">
        <div
          class="journey-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to goal"
          aria-valuetext={`${pct}% of the way, trend ${w(latestTrend)}`}
        >
          <span class="journey-fill" style={{ width: `${pct}%` }} />
          {lineMarks.map((m) => (
            <span
              key={m.key}
              class={`journey-mark ${m.reached ? 'is-reached' : ''}`}
              style={{ left: `${m.at * 100}%` }}
              title={`${m.label}, ${w(m.kg)}`}
            />
          ))}
          <span class="journey-you" style={{ left: `${pct}%` }} />
          <span
            class="journey-you-label tabular"
            style={{ left: `${Math.min(86, Math.max(14, pct))}%` }}
            aria-hidden="true"
          >
            {w(latestTrend)}
          </span>
        </div>
        <div class="journey-ends">
          <span>
            <span class="journey-k">Start</span>
            {w(plan.startWeightKg)}
          </span>
          <span class="journey-pct tabular">{pct}% there</span>
          <span class="text-right">
            <span class="journey-k">Goal</span>
            {w(plan.goalWeightKg)}
          </span>
        </div>
        {goalDate && weeksLeft !== null && (
          <p class="text-muted mt-4 text-sm leading-relaxed">
            {report?.status === 'insufficient-data'
              ? 'At your planned pace'
              : 'At your current trend'}{' '}
            you reach {w(plan.goalWeightKg)} in about{' '}
            <strong class="text-fg">{humaniseWeeks(weeksLeft)}</strong> (
            {goalDate.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            ).
          </p>
        )}
        {nextMark && nextMark.key !== 'goal' && !goalReached && (
          <p class="journey-next">
            <Icon name="target" size={14} />
            <span>
              Next: <strong>{nextMark.label}</strong> at {w(nextMark.kg)},{' '}
              {w(Math.abs(latestTrend - nextMark.kg))} away
            </span>
          </p>
        )}
      </section>
    ) : null;

  const chartCard = trendChart && (
    <section class="surface p-5 sm:p-6" aria-label="Trend chart">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 class="text-lg font-bold tracking-tight">Trend since you started</h3>
        <p class="text-subtle text-xs">Dots are weigh-ins, the line is the trend</p>
      </div>
      <div class="mt-3">{trendChart}</div>
    </section>
  );

  const nextMove = move && (
    <section class="surface next-move" aria-label="Your next move" key={move.key}>
      <span class="next-move-icon" aria-hidden="true">
        <Icon name={move.icon} size={22} />
      </span>
      <div class="min-w-0">
        <p class="next-move-eyebrow">Your next move</p>
        <h3 class="next-move-title">{move.title}</h3>
        <p class="text-muted mt-1.5 text-sm leading-relaxed">{move.detail}</p>
        {move.action && <div class="mt-4">{move.action}</div>}
      </div>
    </section>
  );

  const weighIn = (
    <section class="surface grid content-start gap-4 p-5 sm:p-6" aria-label="Today's weigh-in">
      <h3 class="text-lg font-bold tracking-tight">Today's weigh-in</h3>
      {todayEntry ? (
        <Callout tone="success">
          Logged {w(todayEntry.weightKg)} today. Trend weight:{' '}
          <strong class="whitespace-nowrap">{w(latestTrend)}</strong>.
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
          value={quick ?? (imperial ? kgToLb(lastRaw) : lastRaw)}
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
  );

  const macroTotal = summary
    ? summary.macros.kcal.protein + summary.macros.kcal.carbs + summary.macros.kcal.fat
    : 0;
  const macroRows = summary
    ? ([
        [
          'Protein',
          summary.macros.grams.protein,
          summary.macros.kcal.protein,
          'var(--color-brand-500)',
        ],
        ['Carbs', summary.macros.grams.carbs, summary.macros.kcal.carbs, 'var(--color-accent-500)'],
        ['Fat', summary.macros.grams.fat, summary.macros.kcal.fat, 'oklch(80% 0.15 85)'],
      ] as const)
    : [];

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
          <h2 class="font-display mt-3 text-4xl tracking-tight">
            {plan.goal === 'maintain'
              ? 'Holding steady'
              : goalReached
                ? `${w(Math.abs(lost))} ${plan.goal === 'lose' ? 'down' : 'up'}. Goal reached.`
                : Math.abs(lost) < 0.05
                  ? `${w(Math.abs(plan.goal === 'lose' ? latestTrend - plan.goalWeightKg : plan.goalWeightKg - latestTrend))} to go`
                  : `${w(Math.abs(lost))} ${plan.goal === 'lose' ? 'down' : 'up'}, ${w(Math.abs(plan.goal === 'lose' ? latestTrend - plan.goalWeightKg : plan.goalWeightKg - latestTrend))} to go`}
          </h2>
        </div>
        <div class="flex gap-2">
          <a href={withBase('/review/')} class="btn btn-secondary text-sm">
            <Icon name="calendar" size={16} /> Weekly review
          </a>
          <a href={withBase('/start/')} class="btn btn-secondary text-sm">
            Edit plan
          </a>
        </div>
      </div>

      {goalReached && (
        <section
          class="border-brand-300 dark:border-brand-500/40 surface grid gap-4 border p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
          aria-label="Goal reached"
        >
          <div>
            <p class="text-brand-700 dark:text-brand-300 text-xs font-semibold">Goal reached</p>
            <h2 class="font-display mt-1 text-3xl tracking-tight">
              Your trend is at {w(plan.goalWeightKg)}. Time to keep it.
            </h2>
            <p class="text-muted mt-2 text-sm leading-relaxed">
              The hardest part is next: most people regain within two years, and the ones who do not
              keep weighing in and eat close to maintenance. Switch the plan and Ethereal will set
              your intake to maintenance, keep the two-week check running in both directions, and
              tell you if the trend drifts.
            </p>
          </div>
          <div class="grid gap-2">
            <button type="button" class="btn btn-primary" onClick={switchToMaintenance}>
              Switch to maintenance
            </button>
            <a
              class="btn btn-ghost border-line border text-sm"
              href={withBase('/guides/maintenance-after-weight-loss/')}
            >
              Read the maintenance guide
            </a>
          </div>
        </section>
      )}

      <div class="progress-top">
        {journey && <div class="progress-a">{journey}</div>}
        {nextMove && <div class="progress-b">{nextMove}</div>}
        {chartCard && <div class="progress-a">{chartCard}</div>}
        <div class="progress-b">{weighIn}</div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
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
                  sub="within ±10%"
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
          {summary && macroTotal > 0 && (
            <div>
              <div
                class="macro-split"
                role="img"
                aria-label={macroRows.map(([l, g]) => `${l} ${g} g`).join(', ')}
              >
                {macroRows.map(([l, , kcal, color]) => (
                  <span key={l} style={{ flexGrow: kcal, background: color }} />
                ))}
              </div>
              <ul class="macro-legend">
                {macroRows.map(([l, g, kcal, color]) => (
                  <li key={l}>
                    <span class="macro-dot" style={{ background: color }} aria-hidden="true" />
                    <span class="text-muted">{l}</span>
                    <strong class="tabular">{g} g</strong>
                    <span class="text-subtle tabular">
                      {Math.round((100 * kcal) / macroTotal)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p class="text-subtle text-xs">
            Fibre ≈ {summary?.macros.grams.fibre} g · Water ≈ {round((latestTrend * 35) / 1000, 1)}{' '}
            L.{' '}
            <a class="underline" href={withBase('/tools/macros/')}>
              Fine-tune macros
            </a>
          </p>
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
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
              <div class="mt-4 grid grid-cols-2 gap-4">
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
                    report.impliedDeficitKcal === null
                      ? '—'
                      : formatNumber(report.impliedDeficitKcal)
                  }
                  unit="kcal"
                />
                <Stat
                  label="Weigh-ins"
                  value={log.entries.length}
                  sub={
                    report.daysSinceLastEntry
                      ? `${report.daysSinceLastEntry} day(s) since last`
                      : 'Up to date'
                  }
                />
              </div>
            )}
            {report.recommendedCalories && recentlyAdjusted && plan.lastAdjustedOn && (
              <p class="text-subtle mt-4 text-xs">
                Adjusted {daysBetween(plan.lastAdjustedOn, today)} day(s) ago. The next change is
                offered after two weeks on the new target, so one slope is not acted on twice.
              </p>
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

        <section class="surface p-5 sm:p-6" aria-label="Real expenditure">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-bold tracking-tight">Your real expenditure</h3>
            {expenditure && (
              <span class="chip shrink-0 whitespace-nowrap">
                {expenditure.confidence[0]!.toUpperCase() + expenditure.confidence.slice(1)}{' '}
                confidence
              </span>
            )}
          </div>
          <p class="text-subtle mt-1 text-xs">
            Estimated from what you logged and what the scale did, not a formula.
          </p>

          {expenditure ? (
            <div class="mt-4 grid gap-4">
              <div class="flex flex-wrap items-end gap-6">
                <Stat
                  label="Measured"
                  value={formatNumber(expenditure.tdee)}
                  unit="kcal"
                  size="lg"
                  tone="brand"
                  sub={`Range ${formatNumber(expenditure.low)}–${formatNumber(expenditure.high)}`}
                />
                <Stat
                  label="Formula"
                  value={formatNumber(summary?.tdee ?? 0)}
                  unit="kcal"
                  sub={
                    expenditure.vsFormula === null
                      ? ''
                      : `measured ${expenditure.vsFormula > 0 ? '+' : ''}${formatNumber(expenditure.vsFormula)}`
                  }
                />
              </div>
              <p class="text-muted text-sm leading-relaxed">{expenditure.note}</p>
              <p class="text-subtle text-xs">
                {expenditure.days} logged days · average intake{' '}
                {formatNumber(expenditure.avgIntake)} kcal · trend{' '}
                {expenditure.trendChangeKg > 0 ? '+' : ''}
                {expenditure.trendChangeKg} kg
              </p>
            </div>
          ) : (
            <p class="text-muted mt-3 text-sm">
              Needs about two weeks of food logs and weigh-ins. Then Ethereal tells you what your
              body actually burns, which is the number every other app has to guess.
            </p>
          )}
        </section>
      </div>

      {(patterns.length > 0 || insights.length === 0) && (
        <section class="surface p-5 sm:p-6" aria-label="Insights">
          <h3 class="text-lg font-bold tracking-tight">
            {move && promoted && move.key === promoted.key ? 'Other patterns' : 'Patterns'}
          </h3>
          {patterns.length > 0 ? (
            <ul class="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2">
              {patterns.map((i) => (
                <li key={i.key} class="flex gap-3">
                  <span
                    class={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i.tone === 'good' ? 'bg-brand-500' : i.tone === 'warn' ? 'bg-accent-500' : 'bg-ink-400'}`}
                    aria-hidden="true"
                  />
                  <span>
                    <span class="block text-sm font-semibold">{i.title}</span>
                    <span class="text-muted block text-sm leading-relaxed">{i.detail}</span>
                    {i.link && (
                      <a
                        class="text-brand-700 dark:text-brand-300 mt-1 inline-block text-sm font-semibold"
                        href={withBase(i.link.href)}
                      >
                        {i.link.label} →
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-muted mt-3 text-sm">
              After five logged days, this card points out the patterns worth acting on: weekend
              drift, your low-protein meal, fibre, snack share.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default function PlanDashboard() {
  return (
    <ErrorBoundary area="your plan">
      <Hydrated fallback={<Placeholder height="34rem" />}>
        <PlanDashboardInner />
      </Hydrated>
    </ErrorBoundary>
  );
}
