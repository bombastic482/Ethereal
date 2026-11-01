/**
 * The sky over your day: its colours, where the sun and moon sit and how dark it is, all from
 * the minute of the day and that day's sun events. Pure functions, so the scene that draws it
 * stays a thin view and the maths is tested on its own.
 */

/** Minutes since midnight for the moments that shape the sky. */
export interface SunEvents {
  /** First light (Fajr when known). */
  dawn: number;
  sunrise: number;
  noon: number;
  sunset: number;
  /** Last light (Isha when known). */
  dusk: number;
}

/** A plausible day when no location is set: the sky still moves, just not to the minute. */
export const DEFAULT_EVENTS: SunEvents = {
  dawn: 5 * 60,
  sunrise: 6 * 60 + 15,
  noon: 12 * 60,
  sunset: 17 * 60 + 45,
  dusk: 19 * 60,
};

/** Sun events from prayer times (as minutes), keeping them in order whatever the latitude. */
export function eventsFrom(t: {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  maghrib: number;
  isha: number;
}): SunEvents {
  const sunrise = t.sunrise;
  const sunset = Math.max(t.maghrib, sunrise + 60);
  const noon = Math.min(Math.max(t.dhuhr, sunrise + 30), sunset - 30);
  return {
    dawn: Math.min(t.fajr, sunrise - 15),
    sunrise,
    noon,
    sunset,
    dusk: Math.min(Math.max(t.isha, sunset + 15), 1439),
  };
}

/** A colour as OKLCH lightness (0–1), chroma and hue, so blends stay even and luminous. */
type Lch = [number, number, number];

const NIGHT: [Lch, Lch] = [
  [0.24, 0.06, 272],
  [0.34, 0.07, 288],
];

/**
 * Colour stops through the day, as [minute, top of the sky, horizon]. Ethereal's own palette:
 * lavender first light, a peach sunrise, an airy blue that pales to pearl, honey in the
 * afternoon, rose at sunset and a deep indigo night rather than black. The tops stay dark
 * enough for white text.
 */
function stops(e: SunEvents): Array<[number, Lch, Lch]> {
  const afternoon = (e.noon + e.sunset) / 2;
  const raw: Array<[number, Lch, Lch]> = [
    [0, ...NIGHT],
    [e.dawn - 40, ...NIGHT],
    [e.dawn, [0.33, 0.08, 288], [0.6, 0.09, 330]],
    [e.sunrise - 10, [0.48, 0.09, 268], [0.8, 0.09, 45]],
    [e.sunrise + 30, [0.57, 0.1, 250], [0.88, 0.07, 70]],
    [e.sunrise + 100, [0.6, 0.11, 243], [0.93, 0.03, 220]],
    [e.noon, [0.59, 0.12, 242], [0.94, 0.028, 215]],
    [afternoon, [0.58, 0.11, 246], [0.91, 0.05, 85]],
    [e.sunset - 45, [0.53, 0.1, 262], [0.84, 0.1, 68]],
    [e.sunset, [0.42, 0.1, 292], [0.7, 0.12, 30]],
    [e.sunset + 35, [0.31, 0.08, 286], [0.5, 0.1, 335]],
    [e.dusk + 20, ...NIGHT],
    [1440, ...NIGHT],
  ];
  // Short days and polar edge cases can cross stops over; keep them in time order.
  let last = -Infinity;
  return raw.map(([m, a, b]) => {
    last = Math.max(last, Math.min(1440, m));
    return [last, a, b];
  });
}

const blend = (a: Lch, b: Lch, t: number): Lch => {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] + dh * t + 360) % 360];
};
const css = ([l, c, h]: Lch) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;

/** The sky's two colours at a minute of the day, as CSS oklch() strings. */
export function skyColors(minute: number, e: SunEvents): { top: string; horizon: string } {
  const m = ((minute % 1440) + 1440) % 1440;
  const s = stops(e);
  for (let i = 0; i < s.length - 1; i++) {
    const [m0, a0, b0] = s[i]!;
    const [m1, a1, b1] = s[i + 1]!;
    if (m >= m0 && m <= m1) {
      const t = m1 > m0 ? (m - m0) / (m1 - m0) : 0;
      return { top: css(blend(a0, a1, t)), horizon: css(blend(b0, b1, t)) };
    }
  }
  return { top: css(NIGHT[0]), horizon: css(NIGHT[1]) };
}

/** How night it is: 0 in daylight, 1 once it is properly dark, easing through twilight. */
export function nightness(minute: number, e: SunEvents): number {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m >= e.sunrise && m <= e.sunset) return 0;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (m > e.sunset) return ease(Math.min(1, (m - e.sunset) / Math.max(20, e.dusk - e.sunset)));
  return ease(Math.min(1, (e.sunrise - m) / Math.max(20, e.sunrise - e.dawn)));
}

/**
 * Where a body sits on its arc, from 0 (rising) to 1 (setting), or null when it is down. The
 * sun's arc runs sunrise to sunset; the moon's runs sunset to the next sunrise.
 */
export function arcProgress(minute: number, e: SunEvents, body: 'sun' | 'moon'): number | null {
  const m = ((minute % 1440) + 1440) % 1440;
  if (body === 'sun') {
    return m >= e.sunrise && m <= e.sunset ? (m - e.sunrise) / (e.sunset - e.sunrise) : null;
  }
  const night = 1440 - e.sunset + e.sunrise;
  if (m > e.sunset) return (m - e.sunset) / night;
  if (m < e.sunrise) return (m + 1440 - e.sunset) / night;
  return null;
}

/** The moon's phase for a date, 0 new, 0.5 full, from a known new moon. */
export function moonPhase(date: Date): number {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNew) / 864e5;
  return (((days / synodic) % 1) + 1) % 1;
}
