import { useEffect, useMemo, useState } from 'preact/hooks';
import { shift } from '@/lib/calc/streaks';
import { planDay, shoppingListText, SLOTS, type DayPlan } from '@/lib/day-plan';
import { prefsStore } from '@/lib/food-store';
import { haptic } from '@/lib/fx';
import { buildPlanSummary, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import {
  allRecipes,
  loadRecipes,
  logRecipe,
  saveRecipeAsMeal,
  type RecipeMeal,
} from '@/lib/recipes';
import { withBase } from '@/lib/url';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

const LABEL: Record<RecipeMeal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/**
 * "Plan a day that hits your numbers": four recipes whose totals land on today's calorie target
 * with the protein covered. Re-roll one slot, lock what you like, log the whole day, copy the
 * shopping list.
 */
function DayPlannerInner() {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  const [prefs] = prefsStore.use();
  const [ready, setReady] = useState(allRecipes().length > 0);
  const [quick, setQuick] = useState(false);
  const [noSnack, setNoSnack] = useState(false);
  const [locks, setLocks] = useState<Set<RecipeMeal>>(new Set());
  const [excluded, setExcluded] = useState<string[]>([]);
  const [day, setDay] = useState<DayPlan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [days, setDays] = useState(1);

  const summary = useMemo(() => {
    try {
      return buildPlanSummary(profile, plan.active ? plan : { ...plan, active: true });
    } catch {
      return null;
    }
  }, [profile, plan]);
  const targetKcal = summary?.target ?? 2000;
  const targetProtein = summary?.macros.grams.protein ?? 120;

  useEffect(() => {
    let live = true;
    loadRecipes().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  const compute = (opts: {
    locked?: Partial<Record<RecipeMeal, string>>;
    exclude?: string[];
    quick?: boolean;
    noSnack?: boolean;
  }) =>
    planDay(allRecipes(), {
      kcal: targetKcal,
      protein: targetProtein,
      diet: prefs.diet,
      ...((opts.quick ?? quick) ? { maxMinutes: 15 } : {}),
      ...((opts.noSnack ?? noSnack) ? { skip: ['snack' as const] } : {}),
      ...(opts.locked ? { locked: opts.locked } : {}),
      exclude: opts.exclude ?? excluded,
    });

  const lockedIds = (from: DayPlan | null, only?: Set<RecipeMeal>) => {
    const out: Partial<Record<RecipeMeal, string>> = {};
    if (!from) return out;
    for (const s of SLOTS) {
      const r = from.slots[s];
      if (r && (only ?? locks).has(s)) out[s] = r.id;
    }
    return out;
  };

  // First plan, and re-plan when targets or diet change (keeping user locks).
  useEffect(() => {
    if (!ready) return;
    setDay(compute({ locked: lockedIds(day) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, targetKcal, targetProtein, prefs.diet]);

  const reroll = (slot: RecipeMeal) => {
    if (!day) return;
    const current = day.slots[slot];
    const ex = current ? [...excluded, current.id] : excluded;
    const hold = lockedIds(day, new Set(SLOTS.filter((s) => s !== slot)));
    const next = compute({ locked: hold, exclude: ex });
    if (!next || (current && next.slots[slot]?.id === current.id)) {
      setStatus(`No other ${LABEL[slot].toLowerCase()} fits; try unlocking a slot.`);
      return;
    }
    setExcluded(ex);
    setDay(next);
    setStatus(null);
    haptic();
  };
  const shuffle = () => {
    if (!day) return;
    const ex = SLOTS.filter((s) => !locks.has(s))
      .map((s) => day.slots[s]?.id)
      .filter((id): id is string => !!id);
    const next = compute({ locked: lockedIds(day), exclude: [...excluded, ...ex] }) ?? day;
    setExcluded([...excluded, ...ex]);
    setDay(next);
    setStatus(null);
  };
  const toggleOption = (key: 'quick' | 'noSnack', value: boolean) => {
    if (key === 'quick') setQuick(value);
    else setNoSnack(value);
    setExcluded([]);
    setDay(compute({ locked: lockedIds(day), [key]: value }));
  };
  const toggleLock = (slot: RecipeMeal) => {
    const next = new Set(locks);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    setLocks(next);
  };
  const logAll = (date: string) => {
    if (!day) return;
    let n = 0;
    const m = new Date();
    for (const s of SLOTS) {
      const r = day.slots[s];
      if (r) n += logRecipe(r, date, s, 1, m.getHours() * 60 + m.getMinutes());
    }
    haptic([15, 40, 15]);
    setStatus(
      `Logged ${n} items to ${date === todayIso() ? 'today' : 'tomorrow'}. Open Today to adjust portions.`,
    );
  };
  const saveAll = () => {
    if (!day) return;
    for (const s of SLOTS) {
      const r = day.slots[s];
      if (r) saveRecipeAsMeal(r);
    }
    setStatus('Saved every recipe to your meals (Today → Add → Meals).');
  };
  const copyList = async () => {
    if (!day) return;
    const text = shoppingListText(day, days);
    const label = `Shopping list for ${days} day${days === 1 ? '' : 's'}`;
    // Phones get the share sheet (Notes, Messages, a shopping app); desktops get the clipboard.
    if (typeof navigator.share === 'function' && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title: label, text });
        setStatus(`${label} shared.`);
        return;
      } catch {
        /* cancelled or unsupported payload: fall through to the clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied.`);
    } catch {
      setStatus(text);
    }
  };

  if (!ready) {
    return (
      <section class="surface p-5 sm:p-6" aria-label="Plan a day">
        <p class="text-muted text-sm">Loading recipes…</p>
      </section>
    );
  }
  if (!day) {
    return (
      <section class="surface p-5 sm:p-6" aria-label="Plan a day">
        <h2 class="text-lg font-bold tracking-tight">Plan a day</h2>
        <p class="text-muted mt-2 text-sm">
          No combination of recipes fits these targets. Try allowing a snack or longer recipes.
        </p>
      </section>
    );
  }
  const kcal = Math.round(day.totals.kcal);
  const protein = Math.round(day.totals.protein);
  return (
    <section class="surface grid gap-5 p-5 sm:p-6" aria-labelledby="dayplan-h">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dayplan-h" class="text-lg font-bold tracking-tight">
            Plan a day that hits your numbers
          </h2>
          <p class="text-muted mt-1 text-sm">
            Four recipes from the starter set, chosen so the day lands on{' '}
            <span class="tabular font-semibold">{targetKcal.toLocaleString('en-US')}</span> kcal
            with at least <span class="tabular font-semibold">{targetProtein}</span> g protein. Swap
            any slot, lock what you like, then log the lot.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-ghost border-line h-9 border px-3 text-xs"
          onClick={shuffle}
        >
          <Icon name="reset" size={14} /> Shuffle
        </button>
      </header>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class={`btn h-9 px-3 text-xs ${quick ? 'btn-primary' : 'btn-ghost border-line border'}`}
          aria-pressed={quick}
          onClick={() => toggleOption('quick', !quick)}
        >
          <Icon name="bolt" size={14} /> 15-minute meals
        </button>
        <button
          type="button"
          class={`btn h-9 px-3 text-xs ${noSnack ? 'btn-primary' : 'btn-ghost border-line border'}`}
          aria-pressed={noSnack}
          onClick={() => toggleOption('noSnack', !noSnack)}
        >
          No snack
        </button>
      </div>

      <ul class="grid gap-3 sm:grid-cols-2">
        {SLOTS.filter((s) => day.slots[s]).map((slot) => {
          const r = day.slots[slot]!;
          const locked = locks.has(slot);
          return (
            <li key={slot} class="border-line flex flex-col gap-2 rounded-2xl border p-4">
              <div class="flex items-center justify-between gap-2">
                <span class="text-subtle text-xs font-semibold tracking-wide uppercase">
                  {LABEL[slot]}
                </span>
                <span class="text-subtle tabular text-xs">{r.minutes} min</span>
              </div>
              <a
                class="font-semibold tracking-tight hover:underline"
                href={withBase(`/recipes/#${r.id}`)}
              >
                {r.name}
              </a>
              <p class="text-muted text-xs">
                <span class="tabular">{Math.round(r.totals.kcal)}</span> kcal · P{' '}
                <span class="tabular">{Math.round(r.totals.protein)}</span> g · C{' '}
                <span class="tabular">{Math.round(r.totals.carbs)}</span> g · F{' '}
                <span class="tabular">{Math.round(r.totals.fat)}</span> g
              </p>
              <div class="mt-auto flex gap-2 pt-1">
                <button
                  type="button"
                  class={`btn h-8 px-3 text-xs ${locked ? 'btn-primary' : 'btn-ghost border-line border'}`}
                  aria-pressed={locked}
                  aria-label={`${locked ? 'Unlock' : 'Lock'} ${LABEL[slot].toLowerCase()}`}
                  onClick={() => toggleLock(slot)}
                >
                  <Icon name="lock" size={13} /> {locked ? 'Locked' : 'Lock'}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost border-line h-8 border px-3 text-xs"
                  aria-label={`Another ${LABEL[slot].toLowerCase()}`}
                  disabled={locked}
                  onClick={() => reroll(slot)}
                >
                  <Icon name="reset" size={13} /> Another
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        class="bg-muted flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
        role="status"
        aria-live="polite"
      >
        <span>
          <span class="tabular font-semibold">{kcal.toLocaleString('en-US')}</span> kcal
          <span class="text-subtle">
            {' '}
            ({day.kcalDelta > 0 ? '+' : ''}
            {day.kcalDelta} vs target)
          </span>
        </span>
        <span>
          <span class="tabular font-semibold">{protein}</span> g protein
          <span class={day.proteinMet ? 'text-brand-700 dark:text-brand-300' : 'text-subtle'}>
            {' '}
            {day.proteinMet ? '· target met' : `· ${targetProtein - protein} g short`}
          </span>
        </span>
        <span class="text-subtle">
          C {Math.round(day.totals.carbs)} g · F {Math.round(day.totals.fat)} g · Fibre{' '}
          {Math.round(day.totals.fibre)} g
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn btn-primary h-10 px-4 text-sm"
          onClick={() => logAll(todayIso())}
        >
          Log the day to Today
        </button>
        <button
          type="button"
          class="btn btn-secondary h-10 px-4 text-sm"
          onClick={() => logAll(shift(todayIso(), 1))}
        >
          Log for tomorrow
        </button>
        <button
          type="button"
          class="btn btn-ghost border-line h-10 border px-3 text-sm"
          onClick={saveAll}
        >
          <Icon name="copy" size={14} /> Save as my meals
        </button>
      </div>

      <div class="border-line flex flex-wrap items-end gap-3 border-t pt-4">
        <Segmented
          name="shop-days"
          label="Shopping list"
          options={[
            { value: '1', label: '1 day' },
            { value: '3', label: '3 days' },
            { value: '7', label: '7 days' },
          ]}
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          class="min-w-[16rem]"
        />
        <button type="button" class="btn btn-secondary h-10 px-4 text-sm" onClick={copyList}>
          <Icon name="copy" size={14} /> Copy shopping list
        </button>
      </div>
      {status && (
        <p class="text-brand-700 dark:text-brand-300 text-sm whitespace-pre-line" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

export default function DayPlanner() {
  return (
    <ErrorBoundary area="Day planner">
      <DayPlannerInner />
    </ErrorBoundary>
  );
}
