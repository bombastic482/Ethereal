import { useEffect, useMemo, useState } from 'preact/hooks';
import { shift } from '@/lib/calc/streaks';
import {
  planDay,
  planWeek,
  shoppingListText,
  SLOTS,
  weekShoppingText,
  type DayPlan,
} from '@/lib/day-plan';
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
  usableRecipes,
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
  // undefined: not computed yet (render the skeleton); null: nothing fits the targets.
  const [day, setDay] = useState<DayPlan | null | undefined>(undefined);
  const [status, setStatus] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [repeatBreakfast, setRepeatBreakfast] = useState(true);
  const [week, setWeek] = useState<DayPlan[]>([]);
  const [weekSeed, setWeekSeed] = useState<string[]>([]);

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
    planDay(usableRecipes(), {
      kcal: targetKcal,
      protein: targetProtein,
      diet: prefs.diet,
      ...((opts.quick ?? quick) ? { maxMinutes: 15 } : {}),
      ...((opts.noSnack ?? noSnack) ? { skip: ['snack' as const] } : {}),
      ...(opts.locked ? { locked: opts.locked } : {}),
      exclude: opts.exclude ?? excluded,
    });

  const lockedIds = (from: DayPlan | null | undefined, only?: Set<RecipeMeal>) => {
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
  }, [ready, targetKcal, targetProtein, prefs.diet, prefs.halal]);

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
    const next = compute({ locked: lockedIds(day), exclude: [...excluded, ...ex] });
    if (!next) {
      // Nothing else fits: start the exclusions over rather than trapping every slot.
      setExcluded([]);
      setDay(compute({ locked: lockedIds(day), exclude: [] }) ?? day);
      setStatus('Shuffled from a clean slate; every unlocked recipe is eligible again.');
      return;
    }
    setExcluded([...excluded, ...ex]);
    setDay(next);
    setStatus(null);
  };
  const toggleOption = (key: 'quick' | 'noSnack', value: boolean) => {
    if (key === 'quick') setQuick(value);
    else setNoSnack(value);
    setExcluded([]);
    setDay(compute({ locked: lockedIds(day), [key]: value, exclude: [] }));
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
  const shareText = async (label: string, text: string) => {
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
  const copyList = () =>
    day &&
    shareText(`Shopping list for ${days} day${days === 1 ? '' : 's'}`, shoppingListText(day, days));

  // Week mode: seven varied days starting tomorrow (today if nothing is logged yet).
  const weekStart = todayIso();
  const weekDates = week.map((_, i) => shift(weekStart, i + 1));
  const buildWeek = (opts: {
    quick?: boolean;
    noSnack?: boolean;
    repeat?: boolean;
    exclude?: string[];
  }) =>
    planWeek(usableRecipes(), {
      kcal: targetKcal,
      protein: targetProtein,
      diet: prefs.diet,
      ...((opts.quick ?? quick) ? { maxMinutes: 15 } : {}),
      ...((opts.noSnack ?? noSnack) ? { skip: ['snack' as const] } : {}),
      repeatBreakfast: opts.repeat ?? repeatBreakfast,
      exclude: opts.exclude ?? weekSeed,
    });
  useEffect(() => {
    if (!ready || mode !== 'week') return;
    setWeek(buildWeek({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    mode,
    targetKcal,
    targetProtein,
    prefs.diet,
    prefs.halal,
    quick,
    noSnack,
    repeatBreakfast,
  ]);
  const reshuffleWeek = () => {
    // Seed the next week with this week's dinners excluded, so it looks different.
    const seed = week.map((d) => d.slots.dinner?.id).filter((x): x is string => !!x);
    const next = buildWeek({ exclude: seed });
    setWeekSeed(next.length === week.length ? seed : []);
    setWeek(next.length ? next : buildWeek({ exclude: [] }));
    setStatus(null);
    haptic();
  };
  const logDay = (plan: DayPlan, date: string) => {
    let n = 0;
    const m = new Date();
    for (const s of SLOTS) {
      const r = plan.slots[s];
      if (r) n += logRecipe(r, date, s, 1, m.getHours() * 60 + m.getMinutes());
    }
    return n;
  };
  const logWeek = () => {
    let n = 0;
    week.forEach((p, i) => {
      n += logDay(p, weekDates[i]!);
    });
    haptic([15, 40, 15]);
    setStatus(`Logged ${n} items across ${week.length} days, starting tomorrow.`);
  };
  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  if (!ready || day === undefined) {
    // Reserve roughly the planner's final height so the page does not jump when recipes land.
    return (
      <section
        class="surface grid min-h-[34rem] content-start gap-5 p-5 sm:p-6"
        aria-label="Plan a day"
        aria-busy="true"
      >
        <div>
          <h2 class="text-lg font-bold tracking-tight">Plan a day that hits your numbers</h2>
          <p class="text-muted mt-1 text-sm">
            Four recipes from the starter set, chosen so the day lands on{' '}
            <span class="tabular font-semibold">{targetKcal.toLocaleString('en-US')}</span> kcal
            with at least <span class="tabular font-semibold">{targetProtein}</span> g protein. Swap
            any slot, lock what you like, then log the lot.
          </p>
          <p class="text-subtle mt-2 text-xs" role="status">
            Loading recipes…
          </p>
        </div>
        <ul class="grid gap-3" aria-hidden="true">
          {SLOTS.map((s) => (
            <li key={s} class="surface-muted h-20 animate-pulse" />
          ))}
        </ul>
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
        <div class="flex items-center gap-2">
          <Segmented
            name="plan-mode"
            options={[
              { value: 'day', label: 'One day' },
              { value: 'week', label: 'Week' },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setStatus(null);
            }}
            class="w-44"
          />
          <button
            type="button"
            class="btn btn-ghost border-line h-9 border px-3 text-xs"
            onClick={mode === 'day' ? shuffle : reshuffleWeek}
          >
            <Icon name="reset" size={14} /> Shuffle
          </button>
        </div>
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
        {mode === 'week' && (
          <button
            type="button"
            class={`btn h-9 px-3 text-xs ${repeatBreakfast ? 'btn-primary' : 'btn-ghost border-line border'}`}
            aria-pressed={repeatBreakfast}
            onClick={() => setRepeatBreakfast((v) => !v)}
          >
            Same breakfast daily
          </button>
        )}
      </div>

      {mode === 'week' && (
        <div class="grid gap-3">
          <ol class="grid gap-2" aria-label="Planned week">
            {week.map((p, i) => (
              <li
                key={weekDates[i]}
                class="border-line grid gap-2 rounded-2xl border p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center"
              >
                <div>
                  <p class="font-semibold">{fmtDay(weekDates[i]!)}</p>
                  <p class="text-subtle tabular text-xs">
                    {Math.round(p.totals.kcal)} kcal · P {Math.round(p.totals.protein)} g
                  </p>
                </div>
                <ul class="text-muted grid gap-0.5 text-xs sm:grid-cols-2">
                  {SLOTS.filter((s) => p.slots[s]).map((s) => (
                    <li key={s} class="truncate">
                      <span class="text-subtle">{LABEL[s]}:</span> {p.slots[s]!.name}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  class="btn btn-ghost border-line h-8 border px-3 text-xs"
                  aria-label={`Log ${fmtDay(weekDates[i]!)}`}
                  onClick={() => {
                    const n = logDay(p, weekDates[i]!);
                    haptic();
                    setStatus(`Logged ${n} items for ${fmtDay(weekDates[i]!)}.`);
                  }}
                >
                  Log day
                </button>
              </li>
            ))}
          </ol>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="btn btn-primary h-10 px-4 text-sm" onClick={logWeek}>
              Log the whole week
            </button>
            <button
              type="button"
              class="btn btn-secondary h-10 px-4 text-sm"
              onClick={() =>
                shareText(`Shopping list for ${week.length} days`, weekShoppingText(week))
              }
            >
              <Icon name="copy" size={14} /> Copy week shopping list
            </button>
          </div>
          {status && (
            <p class="text-brand-700 dark:text-brand-300 text-sm whitespace-pre-line" role="status">
              {status}
            </p>
          )}
        </div>
      )}

      {mode === 'day' && (
        <>
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
                    href={withBase(`/recipes/${r.id}/`)}
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
        </>
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
