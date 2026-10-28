/**
 * Tiny persistent store factory on top of localStorage with a subscribe/hook API.
 * All user data (profile, plan, weigh-ins) lives in the browser only.
 */
import { useEffect, useState } from 'preact/hooks';

export interface Store<T> {
  key: string;
  get: () => T;
  set: (next: T) => void;
  patch: (partial: Partial<T>) => T;
  reset: () => void;
  subscribe: (fn: (v: T) => void) => () => void;
  use: () => [T, (partial: Partial<T>) => void];
}

export function createStore<T extends object>(
  key: string,
  defaults: T,
  migrate?: (raw: unknown) => T | null,
): Store<T> {
  let cache: T | null = null;
  const listeners = new Set<(v: T) => void>();

  const read = (): T => {
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrate ? migrate(parsed) : (parsed as T);
      return migrated ? { ...defaults, ...migrated } : defaults;
    } catch {
      return defaults;
    }
  };
  const write = (v: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* private mode or quota: in-memory only */
    }
  };
  const get = () => (cache ??= read());
  const set = (next: T) => {
    cache = next;
    write(next);
    listeners.forEach((l) => l(next));
  };
  const patch = (partial: Partial<T>) => {
    const next = { ...get(), ...partial };
    set(next);
    return next;
  };
  const reset = () => {
    cache = defaults;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l(defaults));
  };
  const subscribe = (fn: (v: T) => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const use = (): [T, (partial: Partial<T>) => void] => {
    const [state, setState] = useState<T>(defaults);
    useEffect(() => {
      setState(get());
      const off = subscribe(setState);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          cache = read();
          setState(cache);
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        off();
        window.removeEventListener('storage', onStorage);
      };
    }, []);
    return [state, patch];
  };
  return { key, get, set, patch, reset, subscribe, use };
}
