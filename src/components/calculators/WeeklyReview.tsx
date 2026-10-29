import { useEffect, useMemo, useState } from 'preact/hooks';
import { estimateExpenditure } from '@/lib/calc/expenditure';
import { topFoods } from '@/lib/calc/breakdown';
import { buildInsights } from '@/lib/calc/insights';
import { adherencePercent, summariseDay } from '@/lib/calc/nutrition';
import { currentStreak, longestStreak, shift } from '@/lib/calc/streaks';
import { assessProgress, daysBetween, trendSeries } from '@/lib/calc/trend';
import { formatNumber, formatWeight, kgToLb, round } from '@/lib/calc/units';
import { diaryStore, prefsStore } from '@/lib/food-store';
import { haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import { buildPlanSummary, planProfile, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { withBase } from '@/lib/url';
import { Callout } from '../ui/Callout';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { Stat } from '../ui/Stat';
import { Heatmap } from '../ui/Heatmap';
import { WeekBars } from '../ui/WeekBars';

import { reflectionStore } from '@/lib/reflections';
import { renderWeekCard, shareCanvas } from '@/lib/share-card';

/** Sunday-night review: the week in numbers, the patterns, the decision for next week, and a two-line reflection. */
function WeeklyReviewInner() {
  const [profile] = useProfile();
  const [plan, patchPlan] = planStore.use();
  const [diary] = diaryStore.use();
  const [prefs] = prefsStore.use();
  const [log] = logStore.use();
  const [refl, patchRefl] = reflectionStore.use();
  const today = todayIso();
  const recentlyAdjusted =
    plan.lastAdjustedOn !== null && daysBetween(plan.lastAdjustedOn, today) < 14;
  const [end, setEnd] = useState(today);
  const start = shift(end, -6);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shift(start, i)), [start]);
  const imperial = profile.units === 'imperial';

  const summary = useMemo(() => {
    try {
      return buildPlanSummary(
        planProfile(profile, log.entries),
        plan.active ? plan : { ...plan, active: true },
      );
    } catch {
      return null;
    }
  }, [profile, plan, log.entries]);
  const t = summary
    ? {
        kcal: summary.target,
        protein: summary.macros.grams.protein,
        carbs: summary.macros.grams.carbs,
        fat: summary.macros.grams.fat,
        fibre: summary.macros.grams.fibre,
      }
    : null;

  const per = useMemo(
    () =>
      t
        ? days.map((d) => ({
            d,
            s: summariseDay(
              diary.food.filter((e) => e.date === d),
              diary.exercise.filter((e) => e.date === d),
              t,
              prefs.eatBack,
            ),
          }))
        : [],
    [days, diary.food, diary.exercise, t, prefs.eatBack],
  );
  const logged = per.filter((x) => x.s.eaten.kcal > 0);
  // Consistency grid: meal slots with food per day over the last 12 weeks.
  const consistency = useMemo(() => {
    const slots = new Map<string, Set<string>>();
    for (const e of diary.food) {
      const set = slots.get(e.date) ?? new Set<string>();
      set.add(e.meal);
      slots.set(e.date, set);
    }
    const values: Record<string, number> = {};
    for (const [d, set] of slots) values[d] = set.size;
    const dates = [...slots.keys()];
    return {
      values,
      daysLogged: dates.filter((d) => d > shift(today, -84) && d <= today).length,
      current: currentStreak(dates, today),
      longest: longestStreak(dates),
    };
  }, [diary.food, today]);
  const avg = (f: (x: (typeof per)[number]) => number) =>
    logged.length ? Math.round(logged.reduce((a, x) => a + f(x), 0) / logged.length) : null;
  const adherence = adherencePercent(
    per.map((x) => ({ eatenKcal: x.s.eaten.kcal, targetKcal: x.s.target.kcal })),
  );
  const best = [...logged].sort(
    (a, b) =>
      Math.abs(a.s.eaten.kcal - a.s.target.kcal) - Math.abs(b.s.eaten.kcal - b.s.target.kcal),
  )[0];

  const trend = useMemo(() => trendSeries(log.entries), [log.entries]);
  const tStart =
    [...trend].reverse().find((p) => p.date <= start) ?? trend.find((p) => p.date >= start);
  const tEnd = [...trend].reverse().find((p) => p.date <= end);
  const weekChange = tStart && tEnd ? round(tEnd.trendKg - tStart.trendKg, 2) : null;
  const weighIns = log.entries.filter((e) => days.includes(e.date)).length;
  const stepsDays = days.map((d) => diary.steps?.[d] ?? 0).filter((n) => n > 0);
  const avgSteps = stepsDays.length
    ? Math.round(stepsDays.reduce((a, b) => a + b, 0) / stepsDays.length)
    : null;

  const top = useMemo(() => topFoods(diary.food, days, 6), [diary.food, days]);
  const insights = useMemo(
    () => (t ? buildInsights(diary.food, diary.exercise, t, days) : []),
    [diary.food, diary.exercise, t, days],
  );
  const report = useMemo(() => {
    if (!summary || !plan.active) return null;
    return assessProgress(
      {
        entries: log.entries,
        plannedRateKgPerWeek: plan.goal === 'maintain' ? 0 : plan.rateKgPerWeek,
        targetCalories: summary.target,
        goalWeightKg: plan.goal === 'maintain' ? plan.startWeightKg : plan.goalWeightKg,
        startWeightKg: plan.startWeightKg,
        floorCalories: summary.floor,
      },
      end,
    );
  }, [summary, plan, log.entries, end]);
  const expenditure = useMemo(() => {
    if (!summary) return null;
    const byDay = new Map<string, number>();
    for (const e of diary.food)
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + (e.per100g.kcal * e.grams) / 100);
    return estimateExpenditure(
      [...byDay.entries()].map(([date, kcal]) => ({ date, kcal: Math.round(kcal) })),
      log.entries,
      summary.tdee,
    );
  }, [summary, diary.food, log.entries]);

  const note = refl.notes[end] ?? { wentWell: '', change: '', savedOn: '' };
  const [wentWell, setWentWell] = useState(note.wentWell);
  const [change, setChange] = useState(note.change);
  // The store hydrates after the first render and the week can change: keep the boxes in sync.
  useEffect(() => {
    setWentWell(note.wentWell);
    setChange(note.change);
  }, [end, note.wentWell, note.change]);
  const saveNote = () => {
    patchRefl({ notes: { ...refl.notes, [end]: { wentWell, change, savedOn: today } } });
    haptic();
  };

  const [copied, setCopied] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'busy' | 'done'>('idle');
  const shareWeek = async () => {
    setShareState('busy');
    try {
      await document.fonts?.ready;
      const stats: Array<[string, string]> = [
        ['Days logged', `${logged.length}/7`],
        ['Avg kcal', avg((x) => x.s.eaten.kcal)?.toLocaleString('en-US') ?? '—'],
        [
          'Trend',
          weekChange === null
            ? '—'
            : `${weekChange > 0 ? '+' : ''}${formatWeight(weekChange, profile.units, 1)}`,
        ],
      ];
      const canvas = renderWeekCard({
        title: `${fmtShort(start)} – ${fmtShort(end)}`,
        subtitle: `${adherence === null ? '' : `${adherence}% of days on target · `}My week on Ethereal`,
        days: per.map((x) => ({
          label: new Date(x.d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
          kcal: x.s.eaten.kcal,
          targetKcal: x.s.target.kcal,
        })),
        stats,
        dark: document.documentElement.dataset.theme === 'dark',
      });
      await shareCanvas(canvas, 'ethereal-week.png');
      haptic();
      setShareState('done');
      setTimeout(() => setShareState('idle'), 2500);
    } catch {
      setShareState('idle');
    }
  };
  const copySummary = async () => {
    const lines = [
      `Ethereal weekly review · ${fmtShort(start)} – ${fmtShort(end)}`,
      weekChange === null
        ? ''
        : `Trend change: ${weekChange > 0 ? '+' : ''}${imperial ? `${round(kgToLb(weekChange), 1)} lb` : `${weekChange} kg`}`,
      `Days logged: ${logged.length}/7 · Weigh-ins: ${weighIns}`,
      avg((x) => x.s.eaten.kcal) === null
        ? ''
        : `Average calories: ${avg((x) => x.s.eaten.kcal)}${t ? ` (target ${t.kcal})` : ''}`,
      avg((x) => x.s.eaten.protein) === null
        ? ''
        : `Average protein: ${avg((x) => x.s.eaten.protein)} g${t ? ` (target ${t.protein} g)` : ''}`,
      adherence === null ? '' : `Days on target: ${adherence}%`,
      report && report.status !== 'insufficient-data'
        ? `Decision: ${report.headline}. ${report.detail}`
        : '',
      ...insights.map((i) => `• ${i.title}. ${i.detail}`),
      wentWell ? `What went well: ${wentWell}` : '',
      change ? `One thing to change: ${change}` : '',
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };
  const fmtShort = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const w = (kg: number) => formatWeight(kg, profile.units, 1);

  return (
    <div class="grid gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-ghost h-10 w-10 rounded-full p-0"
            onClick={() => setEnd(shift(end, -7))}
            aria-label="Previous week"
          >
            ‹
          </button>
          <p class="font-display text-2xl">
            {fmt(start)} – {fmt(end)}
          </p>
          <button
            type="button"
            class="btn btn-ghost h-10 w-10 rounded-full p-0"
            onClick={() => setEnd(shift(end, 7))}
            disabled={end >= today}
            aria-label="Next week"
          >
            ›
          </button>
        </div>
        {/* Wraps instead of squeezing on phones: the status chip takes its own line if needed and
            no button label ever breaks mid-phrase. */}
        <div class="flex flex-wrap items-center gap-2 [&>*]:whitespace-nowrap">
          <span class="chip">
            {logged.length}/7 days logged · {weighIns} weigh-ins
          </span>
          <button type="button" class="btn btn-secondary h-9 px-3 text-sm" onClick={copySummary}>
            <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Copy summary'}
          </button>
          <span class="sr-only" role="status">
            {copied ? 'Summary copied to the clipboard' : ''}
          </span>
          <button
            type="button"
            class="btn btn-secondary h-9 px-3 text-sm"
            onClick={shareWeek}
            disabled={shareState === 'busy' || per.length === 0}
          >
            <Icon name={shareState === 'done' ? 'check' : 'spark'} size={14} />{' '}
            {shareState === 'done' ? 'Shared' : 'Share this week'}
          </button>
          <button
            type="button"
            class="btn btn-secondary h-9 px-3 text-sm"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      {logged.length === 0 && weighIns === 0 ? (
        <Callout>
          Nothing logged this week yet. Start on{' '}
          <a class="underline" href={withBase('/today/')}>
            Today
          </a>{' '}
          and come back on Sunday.
        </Callout>
      ) : (
        <>
          <section class="surface p-5 sm:p-6" aria-label="The week in numbers">
            <div class="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Stat
                label="Trend change"
                value={
                  weekChange === null
                    ? '—'
                    : `${weekChange > 0 ? '+' : ''}${imperial ? `${round(kgToLb(weekChange), 1)} lb` : `${weekChange} kg`}`
                }
                tone={weekChange !== null && weekChange < 0 ? 'brand' : 'default'}
                sub={
                  plan.active && plan.goal !== 'maintain'
                    ? `plan ${plan.goal === 'lose' ? '−' : '+'}${imperial ? `${round(kgToLb(plan.rateKgPerWeek), 1)} lb` : `${plan.rateKgPerWeek} kg`}`
                    : 'smoothed trend'
                }
              />
              <Stat
                label="Avg calories"
                value={
                  avg((x) => x.s.eaten.kcal) === null
                    ? '—'
                    : formatNumber(avg((x) => x.s.eaten.kcal)!)
                }
                sub={t ? `target ${formatNumber(t.kcal)}` : ''}
              />
              <Stat
                label="Avg protein"
                value={
                  avg((x) => x.s.eaten.protein) === null
                    ? '—'
                    : `${avg((x) => x.s.eaten.protein)} g`
                }
                sub={t ? `target ${t.protein} g` : ''}
                tone={
                  t && (avg((x) => x.s.eaten.protein) ?? 0) >= t.protein * 0.9 ? 'brand' : 'default'
                }
              />
              <Stat
                label="On target"
                value={adherence === null ? '—' : `${adherence}%`}
                sub={best ? `best day ${fmt(best.d)}` : 'days within ±10%'}
              />
            </div>
            {t && logged.length > 0 && (
              <div class="mt-6">
                <WeekBars
                  days={per.map((x) => ({
                    label: new Date(x.d + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'narrow',
                    }),
                    value: x.s.eaten.kcal,
                    target: x.s.target.kcal,
                  }))}
                  ariaLabel="Calories per day this week"
                />
              </div>
            )}
            {avgSteps !== null && (
              <p class="text-subtle mt-4 text-xs">
                Average {formatNumber(avgSteps)} steps on {stepsDays.length} logged day
                {stepsDays.length === 1 ? '' : 's'}.
              </p>
            )}
          </section>

          <div class="grid gap-6 lg:grid-cols-2">
            <section class="surface p-5 sm:p-6" aria-label="Decision for next week">
              <h3 class="text-lg font-bold tracking-tight">Next week's decision</h3>
              {report && report.status !== 'insufficient-data' ? (
                <>
                  <p class="text-muted mt-2 text-sm leading-relaxed">
                    <strong class="text-fg">{report.headline}.</strong> {report.detail}
                  </p>
                  {report.recommendedCalories && !recentlyAdjusted && (
                    <button
                      type="button"
                      class="btn btn-primary mt-4"
                      onClick={() => {
                        patchPlan({
                          calorieOverride: report.recommendedCalories,
                          lastAdjustedOn: today,
                        });
                        haptic();
                      }}
                    >
                      Set next week to {formatNumber(report.recommendedCalories)} kcal
                    </button>
                  )}
                  {!report.recommendedCalories && (
                    <p class="text-brand-700 dark:text-brand-300 mt-3 text-sm font-semibold">
                      Keep the same target.
                    </p>
                  )}
                </>
              ) : (
                <p class="text-muted mt-2 text-sm">
                  The first decision comes after two weeks of weigh-ins. Until then, the job is
                  simply to log and weigh.
                </p>
              )}
              <p class="mt-4 text-sm">
                <a
                  class="text-brand-700 dark:text-brand-300 font-semibold"
                  href={withBase('/plan/#dayplan-h')}
                >
                  Plan next week's meals around the new target →
                </a>
              </p>
              {expenditure && (
                <p class="text-subtle mt-4 text-xs">
                  Measured expenditure {formatNumber(expenditure.tdee)} kcal (
                  {expenditure.confidence} confidence) versus formula{' '}
                  {formatNumber(summary?.tdee ?? 0)}.
                </p>
              )}
            </section>
            <section class="surface p-5 sm:p-6" aria-label="Patterns this week">
              <h3 class="text-lg font-bold tracking-tight">Patterns</h3>
              {insights.length > 0 ? (
                <ul class="mt-3 grid gap-3">
                  {insights.map((i) => (
                    <li key={i.key} class="text-sm">
                      <span class="font-semibold">{i.title}.</span>{' '}
                      <span class="text-muted">{i.detail}</span>
                      {i.link && (
                        <>
                          {' '}
                          <a
                            class="text-brand-700 dark:text-brand-300 font-semibold whitespace-nowrap"
                            href={withBase(i.link.href)}
                          >
                            {i.link.label} →
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p class="text-muted mt-2 text-sm">Patterns need five or more logged days.</p>
              )}
            </section>
          </div>

          {top.length > 0 && (
            <section class="surface p-5 sm:p-6" aria-label="Where the calories went">
              <h3 class="text-lg font-bold tracking-tight">Where the calories went</h3>
              <p class="text-subtle text-xs">
                The foods that carried this week, by share of everything you logged.
              </p>
              <ol class="mt-4 grid gap-2.5">
                {top.map((f) => (
                  <li key={f.name} class="grid gap-1 text-sm">
                    <div class="flex items-baseline justify-between gap-3">
                      <span class="truncate font-semibold">{f.name}</span>
                      <span class="text-subtle tabular shrink-0 text-xs">
                        {Math.round(f.share * 100)}% · {formatNumber(f.kcal)} kcal · P {f.protein} g
                        · {f.count}×
                      </span>
                    </div>
                    <div class="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        class="bg-brand-500 h-full rounded-full"
                        style={{ width: `${Math.max(2, Math.round(f.share * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section class="surface p-5 sm:p-6" aria-label="Consistency">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 class="text-lg font-bold tracking-tight">Twelve weeks of showing up</h3>
                <p class="text-subtle text-xs">
                  One square per day; darker means more meals logged. Consistency predicts results
                  better than any single day.
                </p>
              </div>
              <dl class="flex gap-5 text-sm">
                <div>
                  <dt class="text-subtle text-xs">Days logged</dt>
                  <dd class="tabular font-semibold">{consistency.daysLogged} / 84</dd>
                </div>
                <div>
                  <dt class="text-subtle text-xs">Current streak</dt>
                  <dd class="tabular font-semibold">{consistency.current} d</dd>
                </div>
                <div>
                  <dt class="text-subtle text-xs">Longest</dt>
                  <dd class="tabular font-semibold">{consistency.longest} d</dd>
                </div>
              </dl>
            </div>
            <div class="mt-4">
              <Heatmap
                values={consistency.values}
                max={4}
                end={today}
                weeks={12}
                label="Meals logged per day over the last twelve weeks"
                describe={(d, v) =>
                  `${v} meal${v === 1 ? '' : 's'} logged on ${new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
                }
              />
            </div>
          </section>
          <section class="surface p-5 sm:p-6" aria-label="Reflection">
            <h3 class="text-lg font-bold tracking-tight">Two lines for future you</h3>
            <p class="text-subtle text-xs">
              People who write a sentence a week keep weight off at about twice the rate. Kept on
              this device like everything else.
            </p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label class="label" for="rf-well">
                  What went well
                </label>
                <textarea
                  id="rf-well"
                  class="field min-h-24"
                  value={wentWell}
                  onInput={(e) => setWentWell((e.target as HTMLTextAreaElement).value)}
                  maxLength={400}
                />
              </div>
              <div>
                <label class="label" for="rf-change">
                  One thing to change
                </label>
                <textarea
                  id="rf-change"
                  class="field min-h-24"
                  value={change}
                  onInput={(e) => setChange((e.target as HTMLTextAreaElement).value)}
                  maxLength={400}
                />
              </div>
            </div>
            <div class="mt-3 flex items-center gap-3">
              <button type="button" class="btn btn-secondary text-sm" onClick={saveNote}>
                <Icon name="check" size={16} /> Save reflection
              </button>
              {note.savedOn && <span class="text-subtle text-xs">Saved {fmt(note.savedOn)}</span>}
            </div>
          </section>
          {tEnd && tStart && (
            <p class="text-subtle text-xs">
              Trend {w(tStart.trendKg)} → {w(tEnd.trendKg)} over{' '}
              {daysBetween(tStart.date, tEnd.date)} days.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function WeeklyReview() {
  return (
    <ErrorBoundary area="the review">
      <WeeklyReviewInner />
    </ErrorBoundary>
  );
}
