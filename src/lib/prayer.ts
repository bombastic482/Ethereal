/**
 * Prayer times from the sun's position, computed on the device: no service, no location sent
 * anywhere. The astronomy follows the widely used PrayTimes method (solar declination and the
 * equation of time from the US Naval Observatory's low-precision formulae, good to about a
 * minute), with the calculation conventions of the major authorities.
 *
 * Times are returned as Date objects, so they display in the device's own time zone.
 */

export type PrayerMethod =
  | 'mwl'
  | 'isna'
  | 'egypt'
  | 'makkah'
  | 'karachi'
  | 'gulf'
  | 'kuwait'
  | 'qatar'
  | 'dubai'
  | 'turkey'
  | 'singapore';

interface MethodSpec {
  label: string;
  fajr: number;
  /** Isha as a twilight angle, or as minutes after maghrib. */
  isha: { angle: number } | { minutes: number };
}

export const METHODS: Record<PrayerMethod, MethodSpec> = {
  mwl: { label: 'Muslim World League', fajr: 18, isha: { angle: 17 } },
  isna: { label: 'ISNA (North America)', fajr: 15, isha: { angle: 15 } },
  egypt: { label: 'Egyptian General Authority', fajr: 19.5, isha: { angle: 17.5 } },
  makkah: { label: 'Umm al-Qura, Makkah', fajr: 18.5, isha: { minutes: 90 } },
  karachi: { label: 'University of Karachi', fajr: 18, isha: { angle: 18 } },
  gulf: { label: 'Gulf region', fajr: 19.5, isha: { minutes: 90 } },
  kuwait: { label: 'Kuwait', fajr: 18, isha: { angle: 17.5 } },
  qatar: { label: 'Qatar', fajr: 18, isha: { minutes: 90 } },
  dubai: { label: 'UAE', fajr: 18.2, isha: { angle: 18.2 } },
  turkey: { label: 'Diyanet, Turkey', fajr: 18, isha: { angle: 17 } },
  singapore: { label: 'Singapore and Malaysia', fajr: 20, isha: { angle: 18 } },
};

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const tan = (d: number) => Math.tan(rad(d));
const asin = (x: number) => deg(Math.asin(x));
const acos = (x: number) => deg(Math.acos(x));
const atan2 = (y: number, x: number) => deg(Math.atan2(y, x));
const acot = (x: number) => deg(Math.atan(1 / x));
const fix = (a: number, b: number) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};

function julian(y: number, m: number, d: number): number {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/** Solar declination (degrees) and equation of time (hours) for a Julian date. */
export function sunPosition(jd: number): { decl: number; eqt: number } {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  const eqt = q / 15 - fix(RA, 24);
  return { decl: asin(sin(e) * sin(L)), eqt };
}

export interface PrayerTimes {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

export interface PrayerOptions {
  method: PrayerMethod;
  asr?: 'standard' | 'hanafi';
  /** Minutes Isha moves later in Ramadan for methods that set it by minutes (Umm al-Qura). */
  ramadan?: boolean;
}

/**
 * Prayer times for a calendar date (`YYYY-MM-DD`) at a latitude and longitude. Near the poles,
 * where the sun may not reach the twilight angles, Fajr and Isha fall back to the
 * angle-based portion of the night.
 */
export function prayerTimes(
  date: string,
  lat: number,
  lon: number,
  { method, asr = 'standard', ramadan = false }: PrayerOptions,
): PrayerTimes {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const jd = julian(y, m, d) - lon / (15 * 24);
  const spec = METHODS[method];

  const midDay = (t: number) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, before: boolean) => {
    const { decl } = sunPosition(jd + t);
    const noon = midDay(t);
    const T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (before ? -T : T);
  };
  const asrTime = (factor: number, t: number) => {
    const { decl } = sunPosition(jd + t);
    return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t, false);
  };

  // Two passes: the first from rough guesses, the second from the first pass's answers.
  let h = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let pass = 0; pass < 2; pass++) {
    const t = (x: number) => x / 24;
    h = {
      fajr: angleTime(spec.fajr, t(h.fajr), true),
      sunrise: angleTime(0.833, t(h.sunrise), true),
      dhuhr: midDay(t(h.dhuhr)),
      asr: asrTime(asr === 'hanafi' ? 2 : 1, t(h.asr)),
      maghrib: angleTime(0.833, t(h.maghrib), false),
      isha: 'angle' in spec.isha ? angleTime(spec.isha.angle, t(h.isha), false) : h.isha,
    };
  }
  if ('minutes' in spec.isha) h.isha = h.maghrib + (spec.isha.minutes + (ramadan ? 30 : 0)) / 60;

  // High latitudes: cap the twilight at a portion of the night proportional to the angle.
  const night = fix(h.sunrise - h.maghrib, 24);
  const fajrCap = (spec.fajr / 60) * night;
  if (!Number.isFinite(h.fajr) || fix(h.sunrise - h.fajr, 24) > fajrCap)
    h.fajr = h.sunrise - fajrCap;
  if ('angle' in spec.isha) {
    const ishaCap = (spec.isha.angle / 60) * night;
    if (!Number.isFinite(h.isha) || fix(h.isha - h.maghrib, 24) > ishaCap)
      h.isha = h.maghrib + ishaCap;
  }

  const base = Date.UTC(y, m - 1, d);
  const at = (hours: number) => new Date(base + (hours - lon / 15) * 3600_000);
  return {
    fajr: at(h.fajr),
    sunrise: at(h.sunrise),
    dhuhr: at(h.dhuhr),
    asr: at(h.asr),
    maghrib: at(h.maghrib),
    isha: at(h.isha),
  };
}

/** A suggested method for a place, from rough regional boundaries. */
export function suggestMethod(lat: number, lon: number): PrayerMethod {
  if (lat > 28.5 && lat < 30.2 && lon > 46.5 && lon < 48.6) return 'kuwait';
  if (lat > 24.4 && lat < 26.3 && lon > 50.7 && lon < 51.7) return 'qatar';
  if (lat > 22.5 && lat < 26.5 && lon > 51.5 && lon < 56.5) return 'dubai';
  if (lat > 16 && lat < 32.5 && lon > 34.5 && lon < 56) return 'makkah';
  if (lat > 22 && lat < 31.7 && lon > 24.7 && lon < 36) return 'egypt';
  if (lat > 35.8 && lat < 42.2 && lon > 25.6 && lon < 44.9) return 'turkey';
  if (lat > 23 && lat < 37.5 && lon > 60.8 && lon < 77.9) return 'karachi';
  if (lat > -11 && lat < 7.5 && lon > 95 && lon < 141) return 'singapore';
  if (lon < -50 && lat > 15) return 'isna';
  return 'mwl';
}

/** A handful of cities for picking without sharing a location. */
export const CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Kuwait City', lat: 29.3759, lon: 47.9774 },
  { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
  { name: 'Jeddah', lat: 21.4858, lon: 39.1925 },
  { name: 'Makkah', lat: 21.3891, lon: 39.8579 },
  { name: 'Madinah', lat: 24.5247, lon: 39.5692 },
  { name: 'Dammam', lat: 26.4207, lon: 50.0888 },
  { name: 'Doha', lat: 25.2854, lon: 51.531 },
  { name: 'Manama', lat: 26.2285, lon: 50.586 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Abu Dhabi', lat: 24.4539, lon: 54.3773 },
  { name: 'Muscat', lat: 23.588, lon: 58.3829 },
  { name: 'Baghdad', lat: 33.3152, lon: 44.3661 },
  { name: 'Basra', lat: 30.5085, lon: 47.7804 },
  { name: 'Amman', lat: 31.9454, lon: 35.9284 },
  { name: 'Beirut', lat: 33.8938, lon: 35.5018 },
  { name: 'Damascus', lat: 33.5138, lon: 36.2765 },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
  { name: 'Lahore', lat: 31.5204, lon: 74.3587 },
  { name: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
  { name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869 },
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
  { name: 'Algiers', lat: 36.7538, lon: 3.0588 },
  { name: 'Tunis', lat: 36.8065, lon: 10.1815 },
  { name: 'Khartoum', lat: 15.5007, lon: 32.5599 },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Birmingham', lat: 52.4862, lon: -1.8904 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
];
