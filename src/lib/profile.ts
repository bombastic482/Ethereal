/**
 * A tiny shared "profile" store. Every calculator reads and writes the same
 * localStorage record, so a visitor only ever types their stats once.
 * Nothing leaves the browser.
 */
import { useEffect, useState } from 'preact/hooks';
import type { ActivityLevel } from './calc/energy';
import type { Sex, UnitSystem } from './calc/units';

export interface Profile {
  units: UnitSystem;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goalWeightKg?: number;
  bodyFatPercent?: number;
}

export const DEFAULT_PROFILE: Profile = {
  units: 'metric',
  sex: 'female',
  age: 35,
  heightCm: 168,
  weightKg: 78,
  activity: 'light',
};

const KEY = 'ethereal:profile:v1';
const EVENT = 'ethereal:profile';

function read(): Profile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function write(p: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* storage unavailable (private mode, quota); state still works in memory */
  }
}

let cache: Profile | null = null;
const listeners = new Set<(p: Profile) => void>();

function current(): Profile {
  if (!cache) cache = read();
  return cache;
}

export function updateProfile(patch: Partial<Profile>): Profile {
  const next = { ...current(), ...patch };
  cache = next;
  write(next);
  listeners.forEach((l) => l(next));
  return next;
}

/** Hook: returns the live profile and a patch function. Hydration-safe (defaults on the server). */
export function useProfile(): [Profile, (patch: Partial<Profile>) => void] {
  const [state, setState] = useState<Profile>(DEFAULT_PROFILE);
  useEffect(() => {
    setState(current());
    const l = (p: Profile) => setState(p);
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = read();
        setState(cache);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return [state, updateProfile];
}

export function resetProfile(): void {
  cache = DEFAULT_PROFILE;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(DEFAULT_PROFILE));
}
