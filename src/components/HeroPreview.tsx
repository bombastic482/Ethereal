import { useEffect, useState } from 'preact/hooks';
import { DEFAULT_EVENTS, moonPhase } from '@/lib/sky';
import { SkyScene } from './today/SkyScene';
import { Icon, type IconName } from './ui/Icon';

/**
 * The home page's phone: a small Today under the same living sky as the app, at the visitor's
 * own time of day, with a day that has already started (two things done, one next, one later).
 * It is decoration, so it is hidden from assistive tech; the page around it says the same.
 */

type Item = { title: string; icon: IconName; at: number; done?: boolean; note?: string };

/** A believable slice of the day around a minute: two done, the next one, then one later. */
function sliceOfDay(now: number): Item[] {
  const at = (d: number) => Math.round((now + d) / 5) * 5;
  if (now >= 300 && now < 660)
    return [
      { title: 'Wake up, water first', icon: 'sun', at: at(-110), done: true },
      { title: 'Breakfast', icon: 'utensils', at: at(-50), done: true, note: '32 g protein' },
      { title: 'Morning walk', icon: 'walk', at: at(25), note: '15 min' },
      { title: 'Lunch', icon: 'utensils', at: at(200) },
    ];
  if (now >= 660 && now < 1020)
    return [
      { title: 'Lunch', icon: 'utensils', at: at(-120), done: true, note: '41 g protein' },
      { title: 'Home workout', icon: 'dumbbell', at: at(-45), done: true, note: '24 min' },
      { title: 'Afternoon walk', icon: 'walk', at: at(25), note: '20 min' },
      { title: 'Dinner', icon: 'utensils', at: at(170) },
    ];
  if (now >= 1020 && now < 1320)
    return [
      { title: 'Home workout', icon: 'dumbbell', at: at(-130), done: true, note: '24 min' },
      { title: 'Dinner', icon: 'utensils', at: at(-50), done: true, note: '38 g protein' },
      { title: 'Wind down', icon: 'leaf', at: at(25), note: 'Screens off' },
      { title: 'Lights out', icon: 'bed', at: at(110) },
    ];
  return [
    { title: 'Dinner', icon: 'utensils', at: at(-150), done: true },
    { title: 'Wind down', icon: 'leaf', at: at(-40), done: true },
    { title: 'Lights out', icon: 'bed', at: at(20), note: 'Rest well' },
    { title: 'Wake up', icon: 'sun', at: at(420) },
  ];
}

const clock = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return new Date(2000, 0, 1, Math.floor(x / 60), x % 60).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const greeting = (m: number) =>
  m < 300 ? 'Still up' : m < 720 ? 'Good morning' : m < 1020 ? 'Good afternoon' : 'Good evening';

export default function HeroPreview() {
  // Rendered at a golden evening on the server; the visitor's real time takes over on load.
  const [now, setNow] = useState(17 * 60 + 25);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const items = sliceOfDay(now);
  const next = items.find((i) => !i.done)!;

  return (
    <div class="hero-phone" aria-hidden="true">
      <div class="hero-phone-frame">
        <div class="hero-phone-screen">
          <SkyScene now={now} events={DEFAULT_EVENTS} moon={moonPhase(new Date())} class="sky-mini">
            <p class="sky-eyebrow">Today</p>
            <p class="sky-title">{greeting(now)}</p>
          </SkyScene>
          <div class="grid gap-2.5 px-3.5 pb-4">
            <div class="hero-phone-next">
              <span class="hero-phone-icon">
                <Icon name={next.icon} size={18} />
              </span>
              <span class="min-w-0 flex-1">
                <span class="text-brand-700 dark:text-brand-300 block text-[10px] font-bold">
                  Next · in {next.at - now} min
                </span>
                <span class="block truncate text-[15px] font-bold tracking-tight">
                  {next.title}
                </span>
                {next.note && <span class="text-subtle block text-[11px]">{next.note}</span>}
              </span>
              <span class="hero-phone-go">
                <Icon name="check" size={14} />
              </span>
            </div>
            <ol class="grid gap-1">
              {items.map((i) => (
                <li key={i.title} class={`hero-phone-row ${i.done ? 'is-done' : ''}`}>
                  <span class="hero-phone-tick">{i.done && <Icon name="check" size={11} />}</span>
                  <span class="min-w-0 flex-1 truncate">{i.title}</span>
                  <span class="tabular text-subtle">{clock(i.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      <div class="hero-phone-glow" />
    </div>
  );
}
