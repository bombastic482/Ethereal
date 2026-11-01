import { useEffect, useRef, useState } from 'preact/hooks';
import { DEFAULT_EVENTS, moonPhase } from '@/lib/sky';
import { exerciseById } from '@/lib/train/exercises';
import { SkyScene } from './today/SkyScene';
import { Figure } from './train/Figure';
import { Bar } from './ui/Bar';
import { Icon, type IconName } from './ui/Icon';
import { Ring } from './ui/Ring';

/**
 * The home page's phone: a live tour of three screens, each playing its own small moment while
 * it is up. Today under the sky ticks a step off; the food ring counts down as the day's meals
 * go in; the trainer counts reps beside the moving figure. It moves on by itself, pauses while
 * you hover or touch it, and the dots underneath jump straight to a screen. With reduced
 * motion it rests on Today.
 */

const SCREENS = [
  { key: 'today', label: 'Today' },
  { key: 'food', label: 'Food' },
  { key: 'train', label: 'Train' },
] as const;
type Screen = (typeof SCREENS)[number]['key'];
const SCREEN_MS = 5600;

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
const greeting = (m: number) =>
  m < 300 ? 'Still up' : m < 720 ? 'Good morning' : m < 1020 ? 'Good afternoon' : 'Good evening';
const clock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return new Date(2000, 0, 1, Math.floor(x / 60), x % 60).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

/** A believable slice of the day around a minute: two done, the next one, then one later. */
function sliceOfDay(now: number): Array<{ title: string; icon: IconName; at: number }> {
  const at = (d: number) => Math.round((now + d) / 5) * 5;
  if (now >= 300 && now < 660)
    return [
      { title: 'Wake up, water first', icon: 'sun', at: at(-110) },
      { title: 'Breakfast', icon: 'utensils', at: at(-50) },
      { title: 'Morning walk', icon: 'walk', at: at(25) },
      { title: 'Lunch', icon: 'utensils', at: at(200) },
    ];
  if (now >= 660 && now < 1020)
    return [
      { title: 'Lunch', icon: 'utensils', at: at(-120) },
      { title: 'Home workout', icon: 'dumbbell', at: at(-45) },
      { title: 'Afternoon walk', icon: 'walk', at: at(25) },
      { title: 'Dinner', icon: 'utensils', at: at(170) },
    ];
  if (now >= 1020 && now < 1320)
    return [
      { title: 'Home workout', icon: 'dumbbell', at: at(-130) },
      { title: 'Dinner', icon: 'utensils', at: at(-50) },
      { title: 'Wind down', icon: 'leaf', at: at(25) },
      { title: 'Lights out', icon: 'bed', at: at(110) },
    ];
  return [
    { title: 'Dinner', icon: 'utensils', at: at(-150) },
    { title: 'Wind down', icon: 'leaf', at: at(-40) },
    { title: 'Lights out', icon: 'bed', at: at(20) },
    { title: 'Wake up', icon: 'sun', at: at(420) },
  ];
}

function TodayScreen({ now, t }: { now: number; t: number }) {
  const items = sliceOfDay(now);
  // The third step gets ticked off part way through.
  const ticked = t > 0.48;
  const next = ticked ? items[3]! : items[2]!;
  return (
    <div class="hero-screen-today">
      <SkyScene now={now} events={DEFAULT_EVENTS} moon={moonPhase(new Date())} class="sky-mini">
        <p class="sky-eyebrow">Today</p>
        <p class="sky-title">{greeting(now)}</p>
      </SkyScene>
      <div class="grid gap-2.5 px-3.5 pb-4">
        <div class="hero-phone-next" key={next.title}>
          <span class="hero-phone-icon">
            <Icon name={next.icon} size={18} />
          </span>
          <span class="min-w-0 flex-1">
            <span class="text-brand-700 dark:text-brand-300 block text-[10px] font-bold">
              Next · {clock(next.at)}
            </span>
            <span class="block truncate text-[15px] font-bold tracking-tight">{next.title}</span>
          </span>
        </div>
        <div class="hero-track" aria-hidden="true">
          <span class="hero-track-fill" style={{ width: `${18 + 44 * ease(t * 1.6)}%` }} />
          {[10, 26, 48, 62, 84].map((x, i) => (
            <span
              key={x}
              class={`hero-track-dot ${i < 2 || (i === 2 && ticked) ? 'is-done' : ''}`}
              style={{ left: `${x}%` }}
            />
          ))}
        </div>
        <ol class="grid gap-1">
          {items.map((it, i) => {
            const done = i < 2 || (i === 2 && ticked);
            return (
              <li key={it.title} class={`hero-phone-row ${done ? 'is-done' : ''}`}>
                <span class={`hero-phone-tick ${i === 2 && ticked ? 'is-pop' : ''}`}>
                  {done && <Icon name="check" size={11} />}
                </span>
                <span class="min-w-0 flex-1 truncate">{it.title}</span>
                <span class="tabular text-subtle">{clock(it.at)}</span>
              </li>
            );
          })}
        </ol>
        <div class="hero-echo">
          <Icon name="spark" size={14} />
          <span>
            <span class="text-muted block text-[10px]">Yesterday, your good thing</span>
            “Walked with the kids after dinner”
          </span>
        </div>
      </div>
    </div>
  );
}

function FoodScreen({ t }: { t: number }) {
  // The day fills in: breakfast, then lunch, then dinner, and the ring counts down with it.
  const p = ease(t * 1.15);
  const target = 1840;
  const eaten = Math.round(target * 0.78 * p);
  const meals: Array<[string, string, number, number]> = [
    ['Breakfast', 'Greek yogurt, berries, oats', 412, 0.05],
    ['Lunch', 'Chicken wrap, salad', 586, 0.35],
    ['Dinner', 'Salmon, rice, broccoli', 438, 0.68],
  ];
  return (
    <div class="hero-screen-pad">
      <p class="hero-screen-eyebrow">Today's food</p>
      <div class="surface grid place-items-center p-3">
        <Ring value={eaten / target} size={150} stroke={13}>
          <div>
            <p class="tabular font-display text-4xl tracking-tight">
              {(target - eaten).toLocaleString()}
            </p>
            <p class="text-subtle text-[10px] font-semibold">kcal left</p>
          </div>
        </Ring>
        <div class="mt-3 grid w-full gap-2">
          <Bar label="Protein" value={Math.round(152 * 0.86 * p)} target={152} />
          <Bar
            label="Carbs"
            value={Math.round(170 * 0.74 * p)}
            target={170}
            color="var(--color-accent-500)"
          />
          <Bar
            label="Fat"
            value={Math.round(61 * 0.7 * p)}
            target={61}
            color="oklch(80% 0.15 85)"
          />
        </div>
      </div>
      <div class="mt-2.5 grid gap-1.5">
        {meals.map(([m, d, k, from]) => {
          const shown = t > from;
          return (
            <div
              key={m}
              class={`surface hero-meal flex items-center justify-between px-3 py-2 text-xs ${shown ? 'is-in' : ''}`}
            >
              <span>
                <span class="block font-semibold">{m}</span>
                <span class="text-subtle">{shown ? d : 'Add food'}</span>
              </span>
              <span class="tabular font-semibold">{shown ? k : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const squat = exerciseById('squat')!;

function TrainScreen({ t, playing }: { t: number; playing: boolean }) {
  const reps = Math.min(12, Math.floor(ease(t * 1.1) * 12.99));
  const frac = reps / 15;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div class="hero-screen-pad hero-screen-col">
      <p class="hero-screen-eyebrow">Exercise 2 of 4 · Set 2 of 3</p>
      <div class="hero-train-stage">
        <Figure
          keys={squat.keys}
          muscles={squat.muscles}
          align="bottom"
          paused={!playing}
          label="Bodyweight squat"
          class="h-full w-full"
        />
      </div>
      <p class="mt-3 text-[15px] font-bold tracking-tight">Bodyweight squat</p>
      <p class="text-subtle text-[11px]">Target 8–15 · Last time 11</p>
      <div class="hero-reps">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} class="hero-reps-track" />
          <circle
            cx="50"
            cy="50"
            r={r}
            class="hero-reps-fill"
            stroke-dasharray={c}
            stroke-dashoffset={c * (1 - frac)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span class="tabular" key={reps}>
          {reps}
        </span>
      </div>
      <p class={`hero-best ${reps >= 12 ? 'is-in' : ''}`}>
        <Icon name="spark" size={12} /> New best, up from 11
      </p>
      <span class="hero-done">
        <Icon name="check" size={14} /> Done, {reps} reps
      </span>
    </div>
  );
}

export default function HeroPreview() {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const [now, setNow] = useState(17 * 60 + 25);
  const [hold, setHold] = useState(false);
  const [still, setStill] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    const d = new Date();
    setNow(d.getHours() * 60 + d.getMinutes());
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      setT(1);
    }
  }, []);

  // One clock for the tour: progress through the current screen, then the next one.
  useEffect(() => {
    if (still || hold) return;
    let raf = 0;
    started.current = performance.now() - t * SCREEN_MS;
    let last = -1;
    const loop = (ts: number) => {
      const e = (ts - started.current) / SCREEN_MS;
      if (e >= 1) {
        setI((x) => (x + 1) % SCREENS.length);
        setT(0);
        return;
      }
      if (Math.abs(e - last) > 0.006) {
        last = e;
        setT(e);
      }
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        started.current = performance.now() - t * SCREEN_MS;
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [i, still, hold]);

  const screen: Screen = SCREENS[i]!.key;
  const go = (n: number) => {
    setI(n);
    setT(still ? 1 : 0);
  };

  return (
    <div
      class="hero-phone"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
    >
      <div class="hero-phone-frame" aria-hidden="true">
        <div class="hero-phone-screen">
          {SCREENS.map((s, n) => (
            <div key={s.key} class={`hero-screen ${n === i ? 'is-on' : ''}`}>
              {s.key === 'today' && <TodayScreen now={now} t={screen === 'today' ? t : 0} />}
              {s.key === 'food' && <FoodScreen t={screen === 'food' ? t : 0} />}
              {s.key === 'train' && (
                <TrainScreen t={screen === 'train' ? t : 0} playing={screen === 'train'} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div class="hero-pager" role="group" aria-label="Preview screens">
        {SCREENS.map((s, n) => (
          <button
            key={s.key}
            type="button"
            class={`hero-pager-dot ${n === i ? 'is-on' : ''}`}
            aria-pressed={n === i}
            aria-label={`Show ${s.label}`}
            onClick={() => go(n)}
          >
            {n === i && !still && <span style={{ transform: `scaleX(${t})` }} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div class="hero-phone-glow" aria-hidden="true" />
    </div>
  );
}
