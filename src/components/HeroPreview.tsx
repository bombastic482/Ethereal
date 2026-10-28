import { useEffect, useState } from 'preact/hooks';
import { Ring } from './ui/Ring';
import { Bar } from './ui/Bar';

/** Animated product preview for the home page: a phone frame cycling through the Today ring. */
export default function HeroPreview() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setT(0.72);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const s = ((now - start) / 9000) % 1;
      setT(0.25 + 0.55 * (0.5 - 0.5 * Math.cos(s * Math.PI * 2)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const target = 1840;
  const eaten = Math.round(target * t);
  const left = target - eaten;
  return (
    <div class="relative mx-auto w-[300px] max-w-full" aria-hidden="true">
      <div class="border-ink-800 bg-ink-950 relative rounded-[2.4rem] border-[6px] p-3 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        <div class="bg-page rounded-[1.9rem] p-4">
          <div class="text-subtle mb-3 flex items-center justify-between text-[10px] font-semibold tracking-wide uppercase">
            <span>Today</span>
            <span class="text-brand-700 dark:text-brand-300">● 12-day streak</span>
          </div>
          <div class="surface grid place-items-center p-3">
            <Ring value={t} size={150} stroke={13}>
              <div>
                <p class="tabular text-3xl font-bold tracking-tight">{left.toLocaleString()}</p>
                <p class="text-subtle text-[10px] font-semibold tracking-wide uppercase">
                  kcal left
                </p>
              </div>
            </Ring>
            <div class="mt-3 grid w-full gap-2">
              <Bar label="Protein" value={Math.round(152 * t * 1.05)} target={152} />
              <Bar
                label="Carbs"
                value={Math.round(170 * t)}
                target={170}
                color="var(--color-accent-500)"
              />
              <Bar
                label="Fat"
                value={Math.round(61 * t * 0.9)}
                target={61}
                color="oklch(80% 0.15 85)"
              />
            </div>
          </div>
          <div class="mt-3 grid gap-2">
            {[
              ['Breakfast', 'Greek yogurt, berries, oats', 412],
              ['Lunch', 'Chicken wrap, salad', 586],
              ['Dinner', 'Salmon, rice, broccoli', t > 0.6 ? 640 : null],
            ].map(([m, d, k]) => (
              <div
                key={m as string}
                class="surface flex items-center justify-between px-3 py-2 text-xs"
              >
                <span>
                  <span class="block font-semibold">{m}</span>
                  <span class="text-subtle">{k ? d : 'Add food'}</span>
                </span>
                <span class="tabular font-semibold">{k ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div class="bg-brand-400/30 dark:bg-brand-500/20 absolute -inset-8 -z-10 rounded-full blur-3xl" />
    </div>
  );
}
