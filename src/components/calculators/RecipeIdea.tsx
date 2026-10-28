import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Diet } from '@/lib/calc/nutrition';
import { mealForTime } from '@/lib/calc/nutrition';
import { haptic } from '@/lib/fx';
import { allRecipes, loadRecipes, logRecipe, suggestRecipe } from '@/lib/recipes';
import { withBase } from '@/lib/url';
import { Icon } from '../ui/Icon';

interface Props {
  date: string;
  diet: Diet;
  remainingKcal: number;
  remainingProtein: number;
  /** Food ids already logged today, so an idea you have eaten is not offered again. */
  loggedIds: string[];
}

const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

/** One recipe for the coming meal that fits what is left today, with a shuffle and one-tap logging. */
export function RecipeIdea({ date, diet, remainingKcal, remainingProtein, loggedIds }: Props) {
  const [ready, setReady] = useState(allRecipes().length > 0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const slot = mealForTime(new Date().getHours());

  useEffect(() => {
    if (remainingKcal < 120) return;
    let live = true;
    loadRecipes().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [remainingKcal < 120]);

  const idea = useMemo(() => {
    if (!ready) return null;
    const logged = new Set(loggedIds);
    const eaten = allRecipes()
      .filter((r) => r.items.every((it) => logged.has(it.foodId)))
      .map((r) => r.id);
    return suggestRecipe(allRecipes(), {
      slot,
      diet,
      remainingKcal,
      remainingProtein,
      exclude: [...skipped, ...eaten],
    });
  }, [ready, slot, diet, remainingKcal, remainingProtein, skipped, loggedIds.join()]);

  if (!ready || remainingKcal < 120) return null;
  if (!idea) {
    if (skipped.length === 0) return null;
    return (
      <section class="surface-muted p-4 text-sm sm:p-5" aria-label="Recipe idea">
        <p class="text-muted">
          Nothing else fits what is left for {SLOT_LABEL[slot].toLowerCase()}.{' '}
          <button type="button" class="font-semibold underline" onClick={() => setSkipped([])}>
            Start over
          </button>
        </p>
      </section>
    );
  }
  const fitsProtein = idea.totals.protein >= Math.min(remainingProtein, 25);
  return (
    <section class="surface-muted p-4 sm:p-5" aria-label="Recipe idea">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-subtle text-xs font-semibold tracking-wide uppercase">
            {SLOT_LABEL[idea.meal]} idea that fits what is left
          </p>
          <h2 class="mt-1 text-lg font-bold tracking-tight">{idea.name}</h2>
          <p class="text-muted mt-1 text-sm">
            <span class="tabular">{Math.round(idea.totals.kcal)}</span> kcal · P{' '}
            <span class="tabular">{Math.round(idea.totals.protein)}</span> g · {idea.minutes} min
            {fitsProtein && remainingProtein > 15 ? ' · covers your protein gap' : ''}
          </p>
          <p class="text-subtle mt-2 line-clamp-2 text-xs">
            {idea.foods.map((f) => f.food.name.split(',')[0]).join(', ')}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="btn btn-ghost border-line h-9 border px-3 text-xs"
            onClick={() => setSkipped((s) => [...s, idea.id])}
            aria-label="Show another recipe idea"
          >
            <Icon name="reset" size={14} /> Another
          </button>
          <button
            type="button"
            class="btn btn-primary h-9 px-3 text-sm"
            onClick={() => {
              haptic();
              const d = new Date();
              logRecipe(idea, date, idea.meal, 1, d.getHours() * 60 + d.getMinutes());
              setDone(idea.name);
            }}
            aria-label={`Log it: ${idea.name}`}
          >
            Log it
          </button>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between gap-3 text-xs">
        <a class="text-brand-700 dark:text-brand-300 font-semibold" href={withBase('/recipes/')}>
          All {allRecipes().length} recipes →
        </a>
        {done && (
          <span class="text-brand-700 dark:text-brand-300" role="status">
            Logged {done}.
          </span>
        )}
      </div>
    </section>
  );
}
