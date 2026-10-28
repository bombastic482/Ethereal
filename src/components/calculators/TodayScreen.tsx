import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ACTIVITIES, exerciseKcal } from '@/lib/calc/exercise';
import {
  MEALS,
  mealForTime,
  scale,
  suggestFoods,
  sum,
  summariseDay,
  type FoodEntry,
  type Meal,
  type Nutrients,
} from '@/lib/calc/nutrition';
import { currentStreak, shift } from '@/lib/calc/streaks';
import { formatNumber, round } from '@/lib/calc/units';

const OZ = 28.3495;
/** "170 g" or "170 g (6 oz)" depending on the unit system. */
const fmtGrams = (g: number, imperial: boolean) =>
  imperial ? `${g} g (${round(g / OZ, 1)} oz)` : `${g} g`;
const oz = (g: number) => round(g / OZ, 1);
import {
  addExercise,
  addFood,
  copyMeal,
  deleteSavedMeal,
  diaryStore,
  logSavedMeal,
  prefsStore,
  removeExercise,
  removeFood,
  saveCustomFood,
  saveMealFromEntries,
  setWater,
  toggleFavourite,
  updateFood,
  type CustomFood,
  type SavedMeal,
} from '@/lib/food-store';
import { allFoods, foodById, loadFoods, searchFoods, type Food } from '@/lib/foods';
import { lookupBarcode, searchProducts, type OffProduct } from '@/lib/off';
import { buildPlanSummary, planStore, todayIso } from '@/lib/plan';
import { useProfile } from '@/lib/profile';
import { confetti, haptic, onSwipe } from '@/lib/fx';
import { withBase } from '@/lib/url';
import { Bar } from '../ui/Bar';
import { BarcodeScanner } from '../ui/BarcodeScanner';
import { Callout } from '../ui/Callout';
import { CountUp } from '../ui/CountUp';
import { Icon } from '../ui/Icon';
import { NumberField } from '../ui/NumberField';
import { Ring } from '../ui/Ring';
import { Segmented } from '../ui/Segmented';
import { SelectField } from '../ui/SelectField';

type Tab = 'search' | 'scan' | 'quick' | 'custom' | 'meals';

interface Candidate {
  name: string;
  brand?: string;
  per100g: Nutrients;
  servings: Array<{ label: string; grams: number }>;
  source: FoodEntry['source'];
  foodId?: string;
  barcode?: string;
}

const fromFood = (f: Food): Candidate => ({
  name: f.name,
  per100g: f.per100g,
  servings: [...f.servings, { label: '100 g', grams: 100 }],
  source: 'local',
  foodId: f.id,
});
const fromOff = (p: OffProduct): Candidate => ({
  name: p.name,
  ...(p.brand ? { brand: p.brand } : {}),
  per100g: p.per100g,
  servings: [
    ...(p.servingGrams
      ? [{ label: p.servingLabel ?? `${p.servingGrams} g`, grams: p.servingGrams }]
      : []),
    { label: '100 g', grams: 100 },
  ],
  source: 'off',
  barcode: p.barcode,
});
const fromCustom = (c: CustomFood): Candidate => ({
  name: c.name,
  ...(c.brand ? { brand: c.brand } : {}),
  per100g: c.per100g,
  servings: [
    { label: c.servingLabel, grams: c.servingGrams },
    { label: '100 g', grams: 100 },
  ],
  source: 'custom',
  foodId: c.id,
});

const fmtDay = (iso: string, today: string) => {
  if (iso === today)
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  if (iso === shift(today, -1)) return 'Yesterday';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
};

export default function TodayScreen() {
  const [profile] = useProfile();
  const [plan] = planStore.use();
  const [diary] = diaryStore.use();
  const [prefs, patchPrefs] = prefsStore.use();
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [exAdding, setExAdding] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    loadFoods().then(() => setDbReady(true));
  }, []);

  const summary = useMemo(() => {
    try {
      return buildPlanSummary(profile, plan.active ? plan : { ...plan, active: true });
    } catch {
      return null;
    }
  }, [profile, plan]);
  const targets = useMemo(
    () => ({
      kcal: summary?.target ?? 2000,
      protein: summary?.macros.grams.protein ?? 120,
      carbs: summary?.macros.grams.carbs ?? 200,
      fat: summary?.macros.grams.fat ?? 65,
      fibre: summary?.macros.grams.fibre ?? 28,
    }),
    [summary],
  );
  const dayFood = useMemo(
    () => diary.food.filter((e) => e.date === date).sort((a, b) => (a.time ?? 0) - (b.time ?? 0)),
    [diary.food, date],
  );
  const dayEx = useMemo(
    () => diary.exercise.filter((e) => e.date === date),
    [diary.exercise, date],
  );
  const day = useMemo(
    () => summariseDay(dayFood, dayEx, targets, prefs.eatBack),
    [dayFood, dayEx, targets, prefs.eatBack],
  );
  const water = diary.water[date] ?? 0;
  const streak = useMemo(
    () =>
      currentStreak(
        diary.food.map((e) => e.date),
        today,
      ),
    [diary.food, today],
  );
  const suggestions = useMemo(
    () => (date === today && dbReady ? suggestFoods(day.remaining, allFoods(), prefs.diet, 4) : []),
    [day.remaining, prefs.diet, date, today, dbReady],
  );

  const remainingTone = day.remaining.kcal < 0 ? 'warn' : 'brand';
  const yesterday = shift(date, -1);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    return onSwipe(root.current, {
      left: () => setDate((d) => (d < today ? shift(d, 1) : d)),
      right: () => setDate((d) => shift(d, -1)),
    });
  }, [today]);
  // Celebrate finishing today on target (once per day).
  const celebrated = useRef<string | null>(null);
  useEffect(() => {
    if (
      date !== today ||
      day.status !== 'on-target' ||
      dayFood.length < 3 ||
      celebrated.current === today
    )
      return;
    const key = `ethereal:celebrated:${today}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    celebrated.current = today;
    confetti({ x: 0.5, y: 0.3 }, 140);
    haptic([15, 40, 15]);
  }, [day.status, dayFood.length, date, today]);

  return (
    <div class="grid gap-6" ref={root}>
      {/* Day navigation */}
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="btn btn-ghost h-10 w-10 rounded-full p-0"
          onClick={() => setDate(shift(date, -1))}
          aria-label="Previous day"
        >
          ‹
        </button>
        <div class="text-center">
          <p class="text-lg font-bold tracking-tight">{fmtDay(date, today)}</p>
          {streak > 1 && (
            <p class="text-brand-700 dark:text-brand-300 text-xs font-semibold">
              <Icon name="flame" size={12} class="inline" /> {streak}-day logging streak
            </p>
          )}
        </div>
        <button
          type="button"
          class="btn btn-ghost h-10 w-10 rounded-full p-0"
          onClick={() => setDate(shift(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {/* Ring + macros */}
      <section
        class="surface grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6"
        aria-label="Calories and macros"
      >
        <Ring
          value={day.progress}
          size={190}
          tone={remainingTone}
          label={`${formatNumber(day.eaten.kcal)} of ${formatNumber(day.target.kcal)} kcal`}
        >
          <div>
            <p
              class={`font-display tabular text-5xl tracking-tight ${day.remaining.kcal < 0 ? 'text-rose-600 dark:text-rose-300' : ''}`}
            >
              <CountUp value={Math.abs(day.remaining.kcal)} />
            </p>
            <p class="text-subtle text-xs font-semibold tracking-wide uppercase">
              {day.remaining.kcal < 0 ? 'kcal over' : 'kcal left'}
            </p>
          </div>
        </Ring>
        <div class="grid gap-4">
          <div class="text-muted flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              <strong class="text-fg tabular">{formatNumber(day.eaten.kcal)}</strong> eaten
            </span>
            <span>
              <strong class="text-fg tabular">{formatNumber(day.burned)}</strong> burned
            </span>
            <span>
              <strong class="text-fg tabular">{formatNumber(day.target.kcal)}</strong> target
            </span>
          </div>
          <Bar
            label="Protein"
            value={day.eaten.protein}
            target={day.target.protein}
            color="var(--color-brand-500)"
          />
          <Bar
            label="Carbs"
            value={day.eaten.carbs}
            target={day.target.carbs}
            color="var(--color-accent-500)"
          />
          <Bar
            label="Fat"
            value={day.eaten.fat}
            target={day.target.fat}
            color="oklch(80% 0.15 85)"
          />
          <Bar
            label="Fibre"
            value={day.eaten.fibre}
            target={day.target.fibre}
            color="oklch(70% 0.12 140)"
          />
        </div>
      </section>

      {!plan.active && (
        <Callout>
          Targets shown are estimates from your profile.{' '}
          <a class="underline" href={withBase('/start/')}>
            Build a plan
          </a>{' '}
          to set a real goal and pace.
        </Callout>
      )}

      {/* Meals */}
      <div class="grid gap-4 lg:grid-cols-2">
        {MEALS.map((m) => {
          const items = dayFood.filter((e) => e.meal === m.key);
          const n = day.byMeal[m.key];
          const budget = Math.round(day.target.kcal * m.share);
          return (
            <section key={m.key} class="surface p-4 sm:p-5" aria-label={m.label}>
              <header class="flex items-center justify-between gap-3">
                <div>
                  <h2 class="font-bold tracking-tight">{m.label}</h2>
                  <p class="text-subtle text-xs">
                    <span class="tabular">{formatNumber(n.kcal)}</span> kcal · {n.protein} g protein
                    · guide {formatNumber(budget)} kcal
                  </p>
                </div>
                <div class="flex items-center gap-1">
                  {items.length > 0 && (
                    <button
                      type="button"
                      class="btn btn-ghost h-9 px-2 text-xs"
                      onClick={() => {
                        const name = prompt(
                          `Name this ${m.label.toLowerCase()} so you can log it again in one tap:`,
                          `${m.label} · ${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
                        );
                        if (name && saveMealFromEntries(name, items)) {
                          haptic();
                          alert(`Saved "${name}". Find it under Add → Meals.`);
                        }
                      }}
                      aria-label={`Save ${m.label.toLowerCase()} as a meal`}
                      title="Save as meal"
                    >
                      <Icon name="copy" size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    class="btn btn-primary h-9 px-3 text-sm"
                    onClick={() => setAdding(m.key)}
                  >
                    <Icon name="spark" size={14} /> Add
                  </button>
                </div>
              </header>
              {items.length > 0 ? (
                <ul class="mt-3 grid gap-1">
                  {items.map((e) => (
                    <FoodRow key={e.id} entry={e} />
                  ))}
                </ul>
              ) : (
                <div class="text-subtle mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span>Nothing logged.</span>
                  {diary.food.some((e) => e.date === yesterday && e.meal === m.key) && (
                    <button
                      type="button"
                      class="text-brand-700 dark:text-brand-300 font-semibold underline"
                      onClick={() => copyMeal(yesterday, date, m.key)}
                    >
                      Copy yesterday's {m.label.toLowerCase()}
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <section class="surface-muted p-4 sm:p-5" aria-label="Suggestions">
          <h2 class="font-bold tracking-tight">
            {day.remaining.protein > 15
              ? `You're ${Math.round(day.remaining.protein)} g short on protein. Good options:`
              : 'Fits what you have left:'}
          </h2>
          <ul class="mt-3 grid gap-2 sm:grid-cols-2">
            {suggestions.map((s) => (
              <li
                key={s.food.id}
                class="bg-elevated border-line flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
              >
                <span>
                  <span class="font-semibold">{s.food.name}</span>
                  <span class="text-subtle block text-xs">
                    {s.food.servings[0]?.label ?? `${s.grams} g`} · {s.reason}
                  </span>
                </span>
                <button
                  type="button"
                  class="btn btn-secondary h-8 px-3 text-xs"
                  onClick={() =>
                    addFood({
                      date,
                      meal: mealForTime(new Date().getHours()),
                      name: s.food.name,
                      grams: s.grams,
                      per100g: s.food.per100g,
                      source: 'local',
                      foodId: s.food.id,
                      time: minutesNow(),
                    })
                  }
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Exercise + water */}
      <div class="grid gap-4 lg:grid-cols-2">
        <section class="surface p-4 sm:p-5" aria-label="Exercise">
          <header class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-bold tracking-tight">Exercise</h2>
              <p class="text-subtle text-xs">
                <span class="tabular">{formatNumber(day.burned)}</span> kcal ·{' '}
                {prefs.eatBack ? 'added to your target' : 'not added to your target'}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary h-9 px-3 text-sm"
              onClick={() => setExAdding(true)}
            >
              <Icon name="bolt" size={14} /> Add
            </button>
          </header>
          {dayEx.length > 0 && (
            <ul class="mt-3 grid gap-1 text-sm">
              {dayEx.map((e) => (
                <li key={e.id} class="border-line flex items-center gap-3 border-t py-2">
                  <span class="flex-1">
                    {ACTIVITIES.find((a) => a.key === e.activity)?.label ?? e.activity}{' '}
                    <span class="text-subtle">· {e.minutes} min</span>
                  </span>
                  <span class="tabular font-semibold">{e.kcal} kcal</span>
                  <button
                    type="button"
                    class="btn btn-ghost h-8 px-2 text-xs"
                    onClick={() => removeExercise(e.id)}
                    aria-label="Delete exercise"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section class="surface p-4 sm:p-5" aria-label="Water">
          <header class="flex items-center justify-between gap-3">
            <div>
              <h2 class="font-bold tracking-tight">Water</h2>
              <p class="text-subtle text-xs">
                {water} of {prefs.waterGoalGlasses} glasses (250 ml)
              </p>
            </div>
            <div class="flex gap-1">
              <button
                type="button"
                class="btn btn-secondary h-9 w-9 p-0"
                onClick={() => setWater(date, water - 1)}
                aria-label="Remove a glass"
              >
                −
              </button>
              <button
                type="button"
                class="btn btn-primary h-9 w-9 p-0"
                onClick={() => {
                  haptic(8);
                  setWater(date, water + 1);
                }}
                aria-label="Add a glass"
              >
                +
              </button>
            </div>
          </header>
          <div class="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {Array.from({ length: Math.max(prefs.waterGoalGlasses, water) }, (_, i) => (
              <span
                key={i}
                class={`h-7 w-5 rounded-t-sm rounded-b-lg border ${i < water ? 'border-[oklch(62%_0.09_235)] bg-[oklch(72%_0.09_235)]' : 'border-line bg-muted'}`}
              />
            ))}
          </div>
        </section>
      </div>

      {adding && (
        <AddFoodSheet date={date} meal={adding} diet={prefs.diet} onClose={() => setAdding(null)} />
      )}
      {exAdding && (
        <AddExerciseSheet
          date={date}
          weightKg={profile.weightKg}
          onClose={() => setExAdding(false)}
        />
      )}
      <p class="text-subtle text-xs">
        Diet preference for suggestions:{' '}
        <select
          class="text-fg bg-transparent font-semibold underline"
          value={prefs.diet}
          onChange={(e) =>
            patchPrefs({ diet: (e.target as HTMLSelectElement).value as typeof prefs.diet })
          }
          aria-label="Diet preference"
        >
          <option value="omnivore">Omnivore</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
        </select>
        . More options in{' '}
        <a class="underline" href={withBase('/settings/')}>
          settings
        </a>
        .
      </p>
    </div>
  );
}

const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

function FoodRow({ entry }: { entry: FoodEntry }) {
  const [editing, setEditing] = useState(false);
  const [profile] = useProfile();
  const imperial = profile.units === 'imperial';
  const n = scale(entry.per100g, entry.grams);
  const key = entry.barcode ?? entry.foodId;
  const [diary] = diaryStore.use();
  const fav = key ? diary.favourites.includes(key) : false;
  return (
    <li class="border-line border-t py-2 text-sm">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
        >
          <span class="block truncate font-medium">
            {entry.name}
            {entry.brand && <span class="text-subtle font-normal"> · {entry.brand}</span>}
          </span>
          <span class="text-subtle block text-xs">
            {fmtGrams(entry.grams, imperial)} · P {n.protein} · C {n.carbs} · F {n.fat}
          </span>
        </button>
        <span class="tabular font-semibold">{formatNumber(n.kcal)}</span>
        {key && (
          <button
            type="button"
            class={`btn btn-ghost h-8 px-2 text-xs ${fav ? 'text-amber-500' : ''}`}
            onClick={() => toggleFavourite(key)}
            aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={fav}
          >
            ★
          </button>
        )}
        <button
          type="button"
          class="btn btn-ghost h-8 px-2 text-xs"
          onClick={() => removeFood(entry.id)}
          aria-label={`Delete ${entry.name}`}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      {editing && (
        <div class="mt-2 flex items-end gap-2">
          <NumberField
            id={`g-${entry.id}`}
            label="Portion"
            value={entry.grams}
            min={1}
            max={5000}
            step={1}
            dp={0}
            suffix="g"
            onChange={(grams) => updateFood(entry.id, { grams })}
            class="w-40"
          />
          <select
            class="field w-auto"
            value={entry.meal}
            onChange={(e) =>
              updateFood(entry.id, { meal: (e.target as HTMLSelectElement).value as Meal })
            }
            aria-label="Move to meal"
          >
            {MEALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}

function AddFoodSheet({
  date,
  meal,
  diet,
  onClose,
}: {
  date: string;
  meal: Meal;
  diet: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('search');
  const [q, setQ] = useState('');
  const [local, setLocal] = useState<Food[]>([]);
  const [remote, setRemote] = useState<OffProduct[] | null>(null);
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'error' | 'offline'>('idle');
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [diary] = diaryStore.use();
  const [barcodeText, setBarcodeText] = useState('');
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  // Local search is instant; Open Food Facts search is debounced and only for 3+ chars.
  useEffect(() => {
    setLocal(q.trim() ? searchFoods(q, 20) : []);
    setRemote(null);
    if (q.trim().length < 3) {
      setRemoteState('idle');
      return;
    }
    if (!navigator.onLine) {
      setRemoteState('offline');
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setRemoteState('loading');
      searchProducts(q, ctrl.signal)
        .then((r) => {
          setRemote(r);
          setRemoteState('idle');
        })
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setRemoteState('error');
        });
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const resolveKey = (key: string): Candidate | null => {
    const f = foodById(key);
    if (f) return fromFood(f);
    const c = diary.customFoods.find((x) => x.id === key);
    if (c) return fromCustom(c);
    const prev = diary.food.find((e) => e.barcode === key);
    if (prev)
      return {
        name: prev.name,
        ...(prev.brand ? { brand: prev.brand } : {}),
        per100g: prev.per100g,
        servings: [
          { label: `${prev.grams} g`, grams: prev.grams },
          { label: '100 g', grams: 100 },
        ],
        source: 'off',
        barcode: key,
      };
    return null;
  };
  const quickLists = useMemo(() => {
    const favs = diary.favourites.map(resolveKey).filter((c): c is Candidate => !!c);
    const recents = diary.recent
      .filter((k) => !diary.favourites.includes(k))
      .map(resolveKey)
      .filter((c): c is Candidate => !!c)
      .slice(0, 12);
    return { favs, recents };
  }, [diary.favourites, diary.recent, diary.customFoods]);

  const onBarcode = async (code: string) => {
    setScanMsg('Looking up ' + code + '…');
    try {
      const p = await lookupBarcode(code);
      if (!p) {
        setScanMsg(`No product found for ${code}. Add it as a custom food instead.`);
        return;
      }
      setPicked(fromOff(p));
      setScanMsg(null);
    } catch {
      setScanMsg('Could not reach Open Food Facts. Check your connection and try again.');
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Add food to ${meal}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div class="bg-elevated flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl">
        <header class="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 class="text-lg font-bold tracking-tight">
            Add to {MEALS.find((m) => m.key === meal)?.label.toLowerCase()}
          </h2>
          <button
            type="button"
            class="btn btn-ghost h-9 w-9 rounded-full p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        {picked ? (
          <PortionPicker
            candidate={picked}
            onBack={() => setPicked(null)}
            onAdd={(grams) => {
              addFood({
                date,
                meal,
                name: picked.name,
                ...(picked.brand ? { brand: picked.brand } : {}),
                grams,
                per100g: picked.per100g,
                source: picked.source,
                ...(picked.foodId ? { foodId: picked.foodId } : {}),
                ...(picked.barcode ? { barcode: picked.barcode } : {}),
                time: minutesNow(),
              });
              onClose();
            }}
          />
        ) : (
          <>
            <div class="px-5 pt-4">
              <Segmented
                name="add-tab"
                options={[
                  { value: 'search', label: 'Search' },
                  { value: 'scan', label: 'Scan' },
                  { value: 'meals', label: 'Meals' },
                  { value: 'quick', label: 'Quick add' },
                  { value: 'custom', label: 'My foods' },
                ]}
                value={tab}
                onChange={setTab}
              />
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              {tab === 'search' && (
                <div class="grid gap-3 pt-4">
                  <input
                    type="search"
                    class="field"
                    placeholder="Search 500+ foods and millions of products…"
                    value={q}
                    onInput={(e) => setQ((e.target as HTMLInputElement).value)}
                    autoFocus
                    aria-label="Search foods"
                  />
                  {!q && (
                    <>
                      {quickLists.favs.length > 0 && (
                        <CandidateList
                          title="Favourites"
                          items={quickLists.favs}
                          onPick={setPicked}
                        />
                      )}
                      {quickLists.recents.length > 0 && (
                        <CandidateList
                          title="Recent"
                          items={quickLists.recents}
                          onPick={setPicked}
                        />
                      )}
                      {quickLists.favs.length + quickLists.recents.length === 0 && (
                        <p class="text-subtle text-sm">
                          Try "chicken", "oats", "greek yogurt" or a brand name. Favourites and
                          recent foods will appear here.
                        </p>
                      )}
                    </>
                  )}
                  {q && (
                    <CandidateList
                      title={`Built-in foods${local.length ? ` · ${local.length}` : ''}`}
                      items={local.map(fromFood)}
                      onPick={setPicked}
                      empty="No built-in match."
                    />
                  )}
                  {q.trim().length >= 3 && (
                    <div>
                      <p class="text-subtle mb-2 text-xs font-semibold tracking-wide uppercase">
                        Open Food Facts · packaged products
                      </p>
                      {remoteState === 'loading' && <p class="text-subtle text-sm">Searching…</p>}
                      {remoteState === 'offline' && (
                        <p class="text-subtle text-sm">
                          You're offline; built-in foods still work.
                        </p>
                      )}
                      {remoteState === 'error' && (
                        <p class="text-sm text-rose-700 dark:text-rose-300">
                          Open Food Facts didn't respond. Try again in a moment.
                        </p>
                      )}
                      {remote && remote.length === 0 && (
                        <p class="text-subtle text-sm">No products found.</p>
                      )}
                      {remote && remote.length > 0 && (
                        <CandidateList items={remote.map(fromOff)} onPick={setPicked} />
                      )}
                    </div>
                  )}
                </div>
              )}
              {tab === 'scan' && (
                <div class="grid gap-4 pt-4">
                  <BarcodeScanner onDetected={onBarcode} onClose={() => setTab('search')} />
                  <div class="flex items-end gap-2">
                    <div class="flex-1">
                      <label class="label" for="bc-text">
                        Or type the barcode
                      </label>
                      <input
                        id="bc-text"
                        class="field"
                        inputMode="numeric"
                        value={barcodeText}
                        onInput={(e) => setBarcodeText((e.target as HTMLInputElement).value)}
                        placeholder="e.g. 5000159484695"
                      />
                    </div>
                    <button
                      type="button"
                      class="btn btn-secondary h-[46px]"
                      onClick={() => barcodeText && onBarcode(barcodeText.trim())}
                    >
                      Look up
                    </button>
                  </div>
                  {scanMsg && <p class="text-muted text-sm">{scanMsg}</p>}
                </div>
              )}
              {tab === 'quick' && (
                <QuickAdd
                  onAdd={(name, n) => {
                    addFood({
                      date,
                      meal,
                      name,
                      grams: 100,
                      per100g: n,
                      source: 'quick',
                      time: minutesNow(),
                    });
                    onClose();
                  }}
                />
              )}
              {tab === 'meals' && (
                <SavedMeals
                  meals={diary.meals ?? []}
                  onLog={(saved, portion) => {
                    haptic();
                    logSavedMeal(saved, date, meal, portion, minutesNow());
                    onClose();
                  }}
                />
              )}
              {tab === 'custom' && (
                <CustomFoods foods={diary.customFoods} onPick={(c) => setPicked(fromCustom(c))} />
              )}
            </div>
          </>
        )}
      </div>
      <span class="sr-only">{diet}</span>
    </div>
  );
}

function CandidateList({
  title,
  items,
  onPick,
  empty,
}: {
  title?: string;
  items: Candidate[];
  onPick: (c: Candidate) => void;
  empty?: string;
}) {
  return (
    <div>
      {title && (
        <p class="text-subtle mb-2 text-xs font-semibold tracking-wide uppercase">{title}</p>
      )}
      {items.length === 0 ? (
        <p class="text-subtle text-sm">{empty}</p>
      ) : (
        <ul class="grid gap-1">
          {items.map((c, i) => {
            const s = c.servings[0] ?? { label: '100 g', grams: 100 };
            const n = scale(c.per100g, s.grams);
            return (
              <li key={`${c.foodId ?? c.barcode ?? c.name}-${i}`}>
                <button
                  type="button"
                  class="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm"
                  onClick={() => onPick(c)}
                >
                  <span class="min-w-0">
                    <span class="block truncate font-medium">
                      {c.name}
                      {c.brand && <span class="text-subtle font-normal"> · {c.brand}</span>}
                    </span>
                    <span class="text-subtle block text-xs">
                      {s.label} · P {n.protein} · C {n.carbs} · F {n.fat}
                    </span>
                  </span>
                  <span class="tabular shrink-0 font-semibold">{n.kcal} kcal</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PortionPicker({
  candidate,
  onBack,
  onAdd,
}: {
  candidate: Candidate;
  onBack: () => void;
  onAdd: (grams: number) => void;
}) {
  const [profile] = useProfile();
  const imperial = profile.units === 'imperial';
  const first = candidate.servings[0] ?? { label: '100 g', grams: 100 };
  const [grams, setGrams] = useState(first.grams);
  const [count, setCount] = useState(1);
  const total = round(grams * count);
  const n = scale(candidate.per100g, total);
  return (
    <div class="grid gap-5 px-5 py-5">
      <button
        type="button"
        class="text-brand-700 dark:text-brand-300 justify-self-start text-sm font-semibold"
        onClick={onBack}
      >
        ‹ Back to results
      </button>
      <div>
        <h3 class="font-display text-2xl tracking-tight">{candidate.name}</h3>
        {candidate.brand && <p class="text-subtle text-sm">{candidate.brand}</p>}
      </div>
      <div class="flex flex-wrap gap-2">
        {candidate.servings.map((s) => (
          <button
            key={s.label}
            type="button"
            class={`btn h-9 px-3 text-sm ${grams === s.grams ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setGrams(s.grams)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div class="grid grid-cols-2 gap-4">
        <NumberField
          id="pp-count"
          label="How many"
          value={count}
          min={0.25}
          max={20}
          step={0.25}
          dp={2}
          onChange={setCount}
        />
        <NumberField
          id="pp-grams"
          label="Serving size"
          value={grams}
          min={1}
          max={5000}
          step={1}
          dp={0}
          suffix="g"
          onChange={setGrams}
        />
      </div>
      <div class="surface-muted grid grid-cols-4 gap-3 p-4 text-center">
        {[
          ['kcal', n.kcal],
          ['Protein', `${n.protein} g`],
          ['Carbs', `${n.carbs} g`],
          ['Fat', `${n.fat} g`],
        ].map(([l, v]) => (
          <div key={l}>
            <p class="tabular text-lg font-bold">{v}</p>
            <p class="text-subtle text-[11px] font-semibold tracking-wide uppercase">{l}</p>
          </div>
        ))}
      </div>
      <button type="button" class="btn btn-primary h-12 text-base" onClick={() => onAdd(total)}>
        <Icon name="check" size={18} /> Add {total} g{imperial ? ` (${oz(total)} oz)` : ''}
      </button>
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (name: string, n: Nutrients) => void }) {
  const [name, setName] = useState('Quick add');
  const [kcal, setKcal] = useState(300);
  const [p, setP] = useState(0);
  const [c, setC] = useState(0);
  const [f, setF] = useState(0);
  return (
    <div class="grid gap-4 pt-4">
      <p class="text-muted text-sm">
        Know the calories but not the food? Log them directly. Macros are optional.
      </p>
      <div>
        <label class="label" for="qa-name">
          Name
        </label>
        <input
          id="qa-name"
          class="field"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField
          id="qa-kcal"
          label="Calories"
          value={kcal}
          min={0}
          max={5000}
          dp={0}
          suffix="kcal"
          onChange={setKcal}
        />
        <NumberField
          id="qa-p"
          label="Protein"
          value={p}
          min={0}
          max={500}
          dp={0}
          suffix="g"
          onChange={setP}
        />
        <NumberField
          id="qa-c"
          label="Carbs"
          value={c}
          min={0}
          max={800}
          dp={0}
          suffix="g"
          onChange={setC}
        />
        <NumberField
          id="qa-f"
          label="Fat"
          value={f}
          min={0}
          max={400}
          dp={0}
          suffix="g"
          onChange={setF}
        />
      </div>
      <button
        type="button"
        class="btn btn-primary"
        onClick={() =>
          onAdd(name.trim() || 'Quick add', { kcal, protein: p, carbs: c, fat: f, fibre: 0 })
        }
      >
        Add {kcal} kcal
      </button>
    </div>
  );
}

function CustomFoods({ foods, onPick }: { foods: CustomFood[]; onPick: (c: CustomFood) => void }) {
  const [creating, setCreating] = useState(foods.length === 0);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingGrams, setServingGrams] = useState(100);
  const [kcal, setKcal] = useState(0);
  const [p, setP] = useState(0);
  const [c, setC] = useState(0);
  const [f, setF] = useState(0);
  const save = () => {
    if (!name.trim() || servingGrams <= 0) return;
    const k = 100 / servingGrams;
    const food = saveCustomFood({
      name: name.trim(),
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      servingGrams,
      servingLabel: `1 serving (${servingGrams} g)`,
      per100g: {
        kcal: round(kcal * k, 2),
        protein: round(p * k, 2),
        carbs: round(c * k, 2),
        fat: round(f * k, 2),
        fibre: 0,
      },
    });
    onPick(food);
  };
  return (
    <div class="grid gap-4 pt-4">
      {foods.length > 0 && !creating && (
        <>
          <ul class="grid gap-1">
            {foods.map((cf) => (
              <li key={cf.id}>
                <button
                  type="button"
                  class="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm"
                  onClick={() => onPick(cf)}
                >
                  <span class="font-medium">
                    {cf.name}
                    {cf.brand && <span class="text-subtle font-normal"> · {cf.brand}</span>}
                  </span>
                  <span class="tabular font-semibold">
                    {scale(cf.per100g, cf.servingGrams).kcal} kcal
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            class="btn btn-secondary justify-self-start text-sm"
            onClick={() => setCreating(true)}
          >
            + New custom food
          </button>
        </>
      )}
      {creating && (
        <div class="grid gap-3">
          <p class="text-muted text-sm">
            Enter the label values for one serving. We store it per 100 g so any portion works
            later.
          </p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="cf-name">
                Name
              </label>
              <input
                id="cf-name"
                class="field"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Mum's lasagne"
              />
            </div>
            <div>
              <label class="label" for="cf-brand">
                Brand (optional)
              </label>
              <input
                id="cf-brand"
                class="field"
                value={brand}
                onInput={(e) => setBrand((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <NumberField
              id="cf-g"
              label="Serving"
              value={servingGrams}
              min={1}
              max={5000}
              dp={0}
              suffix="g"
              onChange={setServingGrams}
            />
            <NumberField
              id="cf-kcal"
              label="Calories"
              value={kcal}
              min={0}
              max={5000}
              dp={0}
              onChange={setKcal}
            />
            <NumberField
              id="cf-p"
              label="Protein"
              value={p}
              min={0}
              max={500}
              dp={1}
              suffix="g"
              onChange={setP}
            />
            <NumberField
              id="cf-c"
              label="Carbs"
              value={c}
              min={0}
              max={800}
              dp={1}
              suffix="g"
              onChange={setC}
            />
            <NumberField
              id="cf-f"
              label="Fat"
              value={f}
              min={0}
              max={400}
              dp={1}
              suffix="g"
              onChange={setF}
            />
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-primary" onClick={save} disabled={!name.trim()}>
              Save and use
            </button>
            {foods.length > 0 && (
              <button type="button" class="btn btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddExerciseSheet({
  date,
  weightKg,
  onClose,
}: {
  date: string;
  weightKg: number;
  onClose: () => void;
}) {
  const [key, setKey] = useState('walk-brisk');
  const [minutes, setMinutes] = useState(30);
  const act = ACTIVITIES.find((a) => a.key === key)!;
  const kcal = exerciseKcal(act.met, weightKg, minutes);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Add exercise"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div class="bg-elevated w-full max-w-lg rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <header class="flex items-center justify-between">
          <h2 class="text-lg font-bold tracking-tight">Add exercise</h2>
          <button
            type="button"
            class="btn btn-ghost h-9 w-9 rounded-full p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div class="mt-4 grid gap-4">
          <SelectField
            id="ex-act"
            label="Activity"
            value={key}
            options={ACTIVITIES.map((a) => ({
              value: a.key,
              label: `${a.label} · ${a.met} MET`,
              description: a.group,
            }))}
            onChange={setKey}
          />
          <NumberField
            id="ex-min"
            label="Minutes"
            value={minutes}
            min={1}
            max={600}
            dp={0}
            suffix="min"
            onChange={setMinutes}
          />
          <p class="text-muted text-sm">
            ≈ <strong class="text-fg tabular">{kcal} kcal</strong> at your weight. Estimates from
            MET tables run high; that's why exercise isn't added to your target unless you turn it
            on in settings.
          </p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => {
              addExercise({ date, activity: key, minutes, kcal });
              onClose();
            }}
          >
            <Icon name="check" size={16} /> Log {minutes} min
          </button>
        </div>
      </div>
    </div>
  );
}

function SavedMeals({
  meals,
  onLog,
}: {
  meals: SavedMeal[];
  onLog: (meal: SavedMeal, portion: number) => void;
}) {
  const [portion, setPortion] = useState(1);
  if (meals.length === 0) {
    return (
      <div class="grid gap-3 pt-4">
        <p class="text-fg text-lg font-bold tracking-tight">No saved meals yet</p>
        <p class="text-muted text-sm">
          Log a meal once, then tap the save icon next to its Add button. The whole meal comes back
          with one tap, here.
        </p>
      </div>
    );
  }
  return (
    <div class="grid gap-4 pt-4">
      <Segmented
        name="meal-portion"
        label="Portion"
        options={[
          { value: '0.5', label: 'Half' },
          { value: '1', label: 'As saved' },
          { value: '1.5', label: '1.5×' },
          { value: '2', label: 'Double' },
        ]}
        value={String(portion)}
        onChange={(v) => setPortion(Number(v))}
      />
      <ul class="grid gap-2">
        {meals.map((saved) => {
          const n = sum(saved.items.map((it) => scale(it.per100g, it.grams * portion)));
          return (
            <li
              key={saved.id}
              class="border-line flex items-center gap-3 rounded-xl border p-3 text-sm"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{saved.name}</p>
                <p class="text-subtle truncate text-xs">
                  {saved.items.length} items · {n.kcal} kcal · P {n.protein} · C {n.carbs} · F{' '}
                  {n.fat}
                </p>
                <p class="text-subtle truncate text-xs">
                  {saved.items.map((it) => it.name).join(', ')}
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost h-8 px-2 text-xs"
                onClick={() => deleteSavedMeal(saved.id)}
                aria-label={`Delete saved meal ${saved.name}`}
              >
                <Icon name="close" size={14} />
              </button>
              <button
                type="button"
                class="btn btn-primary h-9 px-3 text-sm"
                onClick={() => onLog(saved, portion)}
              >
                Log
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
