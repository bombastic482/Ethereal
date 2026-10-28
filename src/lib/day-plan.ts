/**
 * Plans a whole day from the starter recipes: one breakfast, lunch, dinner and snack whose
 * totals land on the calorie target with at least the protein target. Exhaustive over the
 * (small) recipe space, so the result is the true optimum for the scoring below.
 */
import type { CoreNutrients, Diet } from './calc/nutrition';
import { sum } from './calc/nutrition';
import {
  resolveRecipe,
  suitsDiet,
  type Recipe,
  type RecipeMeal,
  type ResolvedRecipe,
} from './recipes';

export const SLOTS: RecipeMeal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface DayPlanInput {
  kcal: number;
  protein: number;
  diet: Diet;
  /** Only recipes at or under this many minutes (per recipe). */
  maxMinutes?: number;
  /** Slots the user has locked to a recipe id; the planner fills the rest around them. */
  locked?: Partial<Record<RecipeMeal, string>>;
  /** Recipe ids to leave out (the user said "another"). */
  exclude?: string[];
  /** Slots to leave empty, e.g. no snack. */
  skip?: RecipeMeal[];
}

export interface DayPlan {
  slots: Partial<Record<RecipeMeal, ResolvedRecipe>>;
  totals: CoreNutrients;
  /** Signed kcal difference from the target (negative = under). */
  kcalDelta: number;
  proteinMet: boolean;
}

/** Lower is better: miss the calorie target by 1 kcal costs 1; each gram of missing protein costs 12. */
function score(t: CoreNutrients, input: DayPlanInput): number {
  const over = t.kcal - input.kcal;
  const kcalCost = over > 0 ? over * 1.6 : -over; // going over is worse than coming in a little under
  const proteinGap = Math.max(0, input.protein - t.protein);
  return kcalCost + proteinGap * 12;
}

export function planDay(recipes: Recipe[], input: DayPlanInput): DayPlan | null {
  const skip = new Set(input.skip ?? []);
  const excluded = new Set(input.exclude ?? []);
  const pools: Partial<Record<RecipeMeal, ResolvedRecipe[]>> = {};
  for (const slot of SLOTS) {
    if (skip.has(slot)) continue;
    const lockedId = input.locked?.[slot];
    let pool = recipes
      .filter((r) => r.meal === slot && (lockedId ? r.id === lockedId : true))
      .filter((r) => lockedId || (suitsDiet(r.diet, input.diet) && !excluded.has(r.id)))
      .filter((r) => lockedId || input.maxMinutes === undefined || r.minutes <= input.maxMinutes)
      .map(resolveRecipe)
      .filter((r): r is ResolvedRecipe => r !== null);
    if (pool.length === 0 && lockedId) {
      // A locked id that no longer exists: plan the slot freely.
      pool = recipes
        .filter((r) => r.meal === slot && suitsDiet(r.diet, input.diet))
        .map(resolveRecipe)
        .filter((r): r is ResolvedRecipe => r !== null);
    }
    if (pool.length === 0) return null;
    pools[slot] = pool;
  }
  const active = SLOTS.filter((s) => pools[s]);
  if (active.length === 0) return null;

  // Depth-first over slots; prune when calories already exceed target by a wide margin.
  let best: { pick: ResolvedRecipe[]; s: number } | null = null;
  const pick: ResolvedRecipe[] = [];
  const walk = (i: number, kcalSoFar: number) => {
    if (kcalSoFar > input.kcal * 1.35) return;
    if (i === active.length) {
      const t = sum(pick.map((r) => r.totals));
      const s = score(t, input);
      if (!best || s < best.s) best = { pick: [...pick], s };
      return;
    }
    for (const r of pools[active[i]!]!) {
      pick.push(r);
      walk(i + 1, kcalSoFar + r.totals.kcal);
      pick.pop();
    }
  };
  walk(0, 0);
  if (!best) return null;
  const chosen = (best as { pick: ResolvedRecipe[] }).pick;
  const slots: DayPlan['slots'] = {};
  active.forEach((slot, i) => {
    slots[slot] = chosen[i]!;
  });
  const totals = sum(chosen.map((r) => r.totals));
  return {
    slots,
    totals,
    kcalDelta: Math.round(totals.kcal - input.kcal),
    proteinMet: totals.protein >= input.protein - 2,
  };
}

export interface ShoppingLine {
  name: string;
  grams: number;
  /** Which recipes use it. */
  uses: string[];
}

/** Aggregates every ingredient across the plan's recipes, largest quantities first. */
export function shoppingList(plan: DayPlan, days = 1): ShoppingLine[] {
  const byId = new Map<string, ShoppingLine>();
  for (const r of Object.values(plan.slots)) {
    if (!r) continue;
    for (const { food, grams } of r.foods) {
      const line = byId.get(food.id) ?? { name: food.name, grams: 0, uses: [] };
      line.grams += grams * days;
      if (!line.uses.includes(r.name)) line.uses.push(r.name);
      byId.set(food.id, line);
    }
  }
  return [...byId.values()]
    .map((l) => ({ ...l, grams: Math.round(l.grams) }))
    .sort((a, b) => b.grams - a.grams);
}

export function shoppingListText(plan: DayPlan, days = 1): string {
  const head = days === 1 ? 'Shopping list for one day' : `Shopping list for ${days} days`;
  return [head, ...shoppingList(plan, days).map((l) => `- ${l.name}: ${l.grams} g`)].join('\n');
}

export interface WeekPlanInput extends Omit<DayPlanInput, 'locked' | 'exclude'> {
  days?: number;
  /** Keep the same breakfast every day (most people do). */
  repeatBreakfast?: boolean;
  /** Recipe ids to avoid for the whole week. */
  exclude?: string[];
}

/**
 * Plans several days in a row with variety: each day avoids the recipes used on earlier days
 * until the pool runs thin, then recipes may repeat. Breakfast can be pinned across the week.
 */
export function planWeek(recipes: Recipe[], input: WeekPlanInput): DayPlan[] {
  const days = input.days ?? 7;
  const out: DayPlan[] = [];
  const used = new Set<string>(input.exclude ?? []);
  let breakfast: string | undefined;
  for (let i = 0; i < days; i++) {
    const base: DayPlanInput = {
      kcal: input.kcal,
      protein: input.protein,
      diet: input.diet,
      ...(input.maxMinutes !== undefined ? { maxMinutes: input.maxMinutes } : {}),
      ...(input.skip ? { skip: input.skip } : {}),
      ...(breakfast ? { locked: { breakfast } } : {}),
    };
    // Prefer unused recipes; if that leaves nothing workable, allow repeats.
    const plan =
      planDay(recipes, { ...base, exclude: [...used] }) ??
      planDay(recipes, { ...base, exclude: input.exclude ?? [] });
    if (!plan) break;
    out.push(plan);
    for (const r of Object.values(plan.slots)) if (r) used.add(r.id);
    if (input.repeatBreakfast && !breakfast) breakfast = plan.slots.breakfast?.id;
    if (breakfast) used.delete(breakfast);
  }
  return out;
}

/** Shopping list across several planned days, merged by ingredient. */
export function shoppingListForDays(plans: DayPlan[]): ShoppingLine[] {
  const byName = new Map<string, ShoppingLine>();
  for (const p of plans) {
    for (const line of shoppingList(p, 1)) {
      const cur = byName.get(line.name) ?? { name: line.name, grams: 0, uses: [] };
      cur.grams += line.grams;
      for (const u of line.uses) if (!cur.uses.includes(u)) cur.uses.push(u);
      byName.set(line.name, cur);
    }
  }
  return [...byName.values()].sort((a, b) => b.grams - a.grams);
}

export function weekShoppingText(plans: DayPlan[]): string {
  return [
    `Shopping list for ${plans.length} day${plans.length === 1 ? '' : 's'}`,
    ...shoppingListForDays(plans).map((l) => `- ${l.name}: ${l.grams} g`),
  ].join('\n');
}
