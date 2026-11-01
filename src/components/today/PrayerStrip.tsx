import { PRAYER_LABEL } from '@/lib/prayer';

const ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type Times = Record<(typeof ORDER)[number], number>;

/** Compact clock: the five prayers run in order, so AM and PM add nothing but width. */
const clock = (m: number) =>
  new Date(2000, 0, 1, Math.floor(m / 60), m % 60)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?[AP]\.?M\.?$/i, '');

const until = (mins: number) =>
  mins >= 60 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : `in ${mins}m`;

/** Today's five prayers: passed ones fade, the next one is lit and counts down. */
export function PrayerStrip({ times, now }: { times: Times; now: number }) {
  // After Isha the next prayer is tomorrow's Fajr, which is close enough to today's to show.
  const next = ORDER.find((k) => times[k] > now) ?? 'fajr';
  const tomorrow = ORDER.every((k) => times[k] <= now);
  return (
    <ol class="prayer-strip" aria-label="Prayer times today">
      {ORDER.map((k) => {
        const state = k === next ? 'next' : times[k] <= now ? 'past' : 'later';
        const when = state !== 'next' ? '' : tomorrow ? 'tomorrow' : until(times[k] - now);
        return (
          <li
            key={k}
            class={`prayer-chip prayer-${state}`}
            aria-current={state === 'next' ? 'time' : undefined}
          >
            <span class="prayer-name">{PRAYER_LABEL[k]}</span>
            <span class="prayer-time tabular">{clock(times[k])}</span>
            <span class="prayer-when">{when}</span>
          </li>
        );
      })}
    </ol>
  );
}
