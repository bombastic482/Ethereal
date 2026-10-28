import { lateShare as lateCalorieShare, topFoods } from './breakdown';
import { MEALS, summariseDay, type ExerciseEntry, type FoodEntry } from './nutrition';
import { round } from './units';

export interface Insight {
  key: string;
  title: string;
  detail: string;
  tone: 'good' | 'neutral' | 'warn';
}

interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

const WEEKEND = new Set([0, 6]);
const dow = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

/**
 * Pattern insights from the last `days` days of diary. Each rule only fires with enough data,
 * so a new user sees nothing rather than noise.
 */
export function buildInsights(
  food: FoodEntry[],
  exercise: ExerciseEntry[],
  targets: Targets,
  dates: string[],
): Insight[] {
  const out: Insight[] = [];
  const perDay = dates
    .map((d) => ({
      date: d,
      s: summariseDay(
        food.filter((e) => e.date === d),
        exercise.filter((e) => e.date === d),
        targets,
      ),
    }))
    .filter((x) => x.s.eaten.kcal > 0);
  if (perDay.length < 5) return out;

  // 1. Weekend vs weekday calories
  const wk = perDay.filter((x) => !WEEKEND.has(dow(x.date)));
  const we = perDay.filter((x) => WEEKEND.has(dow(x.date)));
  if (wk.length >= 3 && we.length >= 2) {
    const a = wk.reduce((s, x) => s + x.s.eaten.kcal, 0) / wk.length;
    const b = we.reduce((s, x) => s + x.s.eaten.kcal, 0) / we.length;
    const diff = round(b - a);
    if (Math.abs(diff) >= 250) {
      out.push({
        key: 'weekend',
        title: diff > 0 ? `Weekends run ${diff} kcal higher` : `Weekdays run ${-diff} kcal higher`,
        detail:
          diff > 0
            ? `Two higher weekend days can erase a week's deficit. Try banking 100–150 kcal on weekdays or planning the weekend meal you care about most.`
            : `You eat more on weekdays. If weekday hunger is the issue, move more calories to breakfast and lunch.`,
        tone: diff > 0 ? 'warn' : 'neutral',
      });
    }
  }

  // 2. Protein by meal: which meal is lowest relative to its share?
  const mealProtein = MEALS.map((m) => ({
    m,
    g: perDay.reduce((s, x) => s + x.s.byMeal[m.key].protein, 0) / perDay.length,
  }));
  const lowest = [...mealProtein].filter((x) => x.m.key !== 'snack').sort((a, b) => a.g - b.g)[0];
  const total = mealProtein.reduce((s, x) => s + x.g, 0);
  if (lowest && total > 0 && lowest.g < total * 0.18) {
    out.push({
      key: 'protein-meal',
      title: `${lowest.m.label} is your low-protein meal`,
      detail: `Averaging ${round(lowest.g)} g. Adding 20–30 g there (eggs, yogurt, a scoop of whey, tofu) is the easiest way to hit your daily target.`,
      tone: 'neutral',
    });
  }

  // 3. Protein target hit rate
  const hit = perDay.filter((x) => x.s.eaten.protein >= targets.protein * 0.9).length;
  const rate = round((hit / perDay.length) * 100);
  out.push({
    key: 'protein-rate',
    title: `Protein target hit on ${rate}% of logged days`,
    detail:
      rate >= 70
        ? 'That is the single best predictor of keeping muscle while losing fat. Keep it up.'
        : 'Aim for 70%+. Protein-first meals and a planned snack make the difference.',
    tone: rate >= 70 ? 'good' : 'warn',
  });

  // 4. Fibre
  const fibre = perDay.reduce((s, x) => s + x.s.eaten.fibre, 0) / perDay.length;
  if (fibre < targets.fibre * 0.6) {
    out.push({
      key: 'fibre',
      title: `Fibre averages ${round(fibre)} g`,
      detail: `Your target is ${targets.fibre} g. Beans, oats, berries and vegetables fill you up for very few calories; most people feel a hunger difference within a week.`,
      tone: 'warn',
    });
  }

  // 5. Late calories
  const lateShare =
    perDay.reduce((s, x) => s + (x.s.eaten.kcal ? x.s.byMeal.snack.kcal / x.s.eaten.kcal : 0), 0) /
    perDay.length;
  if (lateShare > 0.25) {
    out.push({
      key: 'snacks',
      title: `Snacks are ${round(lateShare * 100)}% of your calories`,
      detail:
        'Not a problem in itself, but snacks are the easiest calories to under-count. Weigh them for a week to be sure.',
      tone: 'neutral',
    });
  }

  // 6. Late eating (only when entries carry times)
  const late = lateCalorieShare(food, dates);
  if (late !== null && late >= 0.3) {
    out.push({
      key: 'late',
      title: `${round(late * 100)}% of calories after 9 pm`,
      detail:
        'Late eating is not fattening by itself, but it is where unplanned calories land and it can cost sleep. Try moving one planned snack earlier and see whether the trend changes.',
      tone: 'neutral',
    });
  }

  // 7. Concentration: a few foods carrying most of the week
  const top = topFoods(food, dates, 3);
  const topShare = top.reduce((s, x) => s + x.share, 0);
  if (top.length === 3 && topShare >= 0.5) {
    out.push({
      key: 'concentration',
      title: `Three foods make up ${round(topShare * 100)}% of your calories`,
      detail: `${top.map((x) => x.name).join(', ')}. Weigh these three carefully; small errors on repeat foods compound across the week.`,
      tone: 'neutral',
    });
  }

  // 8. Consistency
  const sd = Math.sqrt(
    perDay.reduce((s, x) => s + (x.s.eaten.kcal - targets.kcal) ** 2, 0) / perDay.length,
  );
  if (sd < targets.kcal * 0.12) {
    out.push({
      key: 'steady',
      title: 'Remarkably consistent intake',
      detail: `Your days vary by only about ${round(sd)} kcal. Consistency beats perfection; the two-week check will be accurate for you.`,
      tone: 'good',
    });
  }
  return out.slice(0, 5);
}
