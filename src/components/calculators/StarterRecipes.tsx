import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Diet, Meal } from '@/lib/calc/nutrition';
import { haptic } from '@/lib/fx';
import {
  RECIPE_MEALS,
  allRecipes,
  filterRecipes,
  loadRecipes,
  logRecipe,
  saveRecipeAsMeal,
  type RecipeMeal,
  type ResolvedRecipe,
} from '@/lib/recipes';
import { withBase } from '@/lib/url';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

interface Props {
  date: string;
  /** Slot the recipe is logged into. */
  slot: Meal;
  diet: Diet;
  remainingKcal: number;
  /** Recipe id to open and highlight on mount (deep link from the recipes page). */
  focusId?: string;
  onLogged: (count: number) => void;
}

const PORTIONS = [
  { value: '0.5', label: 'Half' },
  { value: '1', label: 'Single' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: 'Double' },
] as const;

const DIET_LABEL: Record<ResolvedRecipe['diet'], string> = {
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  pescatarian: 'Pescatarian',
  omnivore: '',
};

/** Sixty-plus high-protein recipes built from database foods; log one in a tap or save it as your own meal. */
export function StarterRecipes({ date, slot, diet, remainingKcal, focusId, onLogged }: Props) {
  const [ready, setReady] = useState(allRecipes().length > 0);
  const [meal, setMeal] = useState<RecipeMeal | 'all'>(focusId ? 'all' : slot);
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState(false);
  const [open, setOpen] = useState<string | null>(focusId ?? null);
  const [portion, setPortion] = useState(1);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadRecipes().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!focusId || !ready) return;
    // Scroll only the sheet's own scroll area: scrollIntoView would also shift the
    // overflow-hidden panel around it and leave the tabs misaligned.
    const el = document.getElementById(`recipe-${focusId}`);
    const box = el?.closest<HTMLElement>('[data-scroll]');
    if (el && box) box.scrollTop = el.offsetTop - box.offsetTop - 8;
    else el?.scrollIntoView({ block: 'center' });
  }, [focusId, ready]);

  const list = useMemo(() => {
    if (!ready) return [];
    const base = filterRecipes(allRecipes(), {
      meal,
      diet,
      q,
      remainingKcal,
      ...(quick ? { maxMinutes: 15 } : {}),
    });
    // A deep-linked recipe is shown even when the diet or time filter would hide it: the
    // visitor chose it on the recipes page and should not land on an empty list.
    if (focusId && !base.some((r) => r.id === focusId)) {
      const pinned = filterRecipes(allRecipes(), { q: '' }).find((r) => r.id === focusId);
      if (pinned) return [pinned, ...base];
    }
    return base;
  }, [ready, meal, diet, q, quick, remainingKcal, focusId]);

  return (
    <section
      class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      aria-labelledby="starter-recipes-h"
    >
      <div class="flex items-baseline justify-between gap-3">
        <h3 id="starter-recipes-h" class="text-fg text-base font-bold tracking-tight">
          Starter recipes
        </h3>
        <p class="text-subtle text-xs">
          {ready ? `${list.length} ${diet === 'omnivore' ? '' : diet + ' '}recipes` : 'Loading…'}
        </p>
      </div>
      <p class="text-subtle -mt-1 text-xs">
        Want the whole day done for you?{' '}
        <a
          class="text-brand-700 dark:text-brand-300 font-semibold"
          href={withBase('/plan/#dayplan-h')}
        >
          Plan a day that hits your numbers →
        </a>
      </p>
      <Segmented name="recipe-meal" options={RECIPE_MEALS} value={meal} onChange={setMeal} />
      <div class="flex gap-2">
        <input
          type="search"
          class="field min-w-0 flex-1"
          placeholder="Find a recipe…"
          aria-label="Find a recipe"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          class={`btn h-11 shrink-0 px-3 text-sm ${quick ? 'btn-primary' : 'btn-ghost border-line border'}`}
          aria-pressed={quick}
          aria-label="Ready in 15 minutes or less"
          onClick={() => setQuick((v) => !v)}
        >
          <Icon name="bolt" size={14} /> 15 min
        </button>
      </div>
      <Segmented
        name="recipe-portion"
        label="Portion"
        options={PORTIONS}
        value={String(portion)}
        onChange={(v) => setPortion(Number(v))}
      />
      {ready && list.length === 0 && (
        <p class="text-muted py-4 text-center text-sm">
          Nothing matches. Try another meal, clear the search, or switch off the 15-minute filter.
        </p>
      )}
      <ul class="grid grid-cols-[minmax(0,1fr)] gap-2">
        {list.map((r) => {
          const kcal = Math.round(r.totals.kcal * portion);
          const fits = kcal <= remainingKcal;
          const isOpen = open === r.id;
          const dietLabel = DIET_LABEL[r.diet];
          return (
            <li
              key={r.id}
              id={`recipe-${r.id}`}
              class={`border-line min-w-0 rounded-xl border text-sm transition-colors ${isOpen ? 'bg-muted/40' : ''}`}
            >
              <div class="flex items-center gap-3 p-3">
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`recipe-body-${r.id}`}
                  onClick={() => setOpen(isOpen ? null : r.id)}
                >
                  <p class="truncate font-semibold">{r.name}</p>
                  <p class="text-subtle truncate text-xs">
                    {r.minutes} min · {kcal} kcal · P {Math.round(r.totals.protein * portion)} g
                    {dietLabel ? ` · ${dietLabel}` : ''}
                    {fits && remainingKcal > 0 ? (
                      <span class="text-brand-600 dark:text-brand-300 font-semibold"> · fits</span>
                    ) : null}
                  </p>
                </button>
                <button
                  type="button"
                  class="btn btn-primary h-9 px-3 text-sm"
                  onClick={() => {
                    haptic();
                    const n = logRecipe(r, date, slot, portion, nowMinutes());
                    onLogged(n);
                  }}
                  aria-label={`Log ${r.name}`}
                >
                  Log
                </button>
              </div>
              {isOpen && (
                <div id={`recipe-body-${r.id}`} class="grid gap-3 px-3 pb-3">
                  <ul class="text-muted grid gap-1 text-xs">
                    {r.foods.map(({ food, grams }) => (
                      <li key={food.id} class="flex justify-between gap-3">
                        <span class="truncate">{food.name}</span>
                        <span class="tabular shrink-0">{Math.round(grams * portion)} g</span>
                      </li>
                    ))}
                  </ul>
                  <p class="text-fg text-sm leading-relaxed">{r.method}</p>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-subtle text-xs">
                      C {Math.round(r.totals.carbs * portion)} g · F{' '}
                      {Math.round(r.totals.fat * portion)} g · Fibre{' '}
                      {Math.round(r.totals.fibre * portion)} g
                    </span>
                    <button
                      type="button"
                      class="btn btn-ghost border-line ml-auto h-8 border px-3 text-xs"
                      onClick={() => {
                        saveRecipeAsMeal(r);
                        setSaved(r.id);
                      }}
                    >
                      {saved === r.id ? (
                        <>
                          <Icon name="check" size={14} /> Saved to your meals
                        </>
                      ) : (
                        <>
                          <Icon name="copy" size={14} /> Save as my meal
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
