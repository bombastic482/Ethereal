/**
 * Export / import / share. Everything is plain JSON; the share link packs it into the URL hash
 * so a plan can be moved between devices with no server involved.
 */
import type { WeighIn } from './calc/trend';
import { diaryStore, prefsStore, type Diary, type DiaryPrefs } from './food-store';
import { logStore, type WeightLog } from './log';
import { DEFAULT_PLAN, planStore, type Plan } from './plan';
import { DEFAULT_PROFILE, updateProfile, type Profile } from './profile';

export interface Backup {
  app: 'ethereal';
  version: 1;
  exportedAt: string;
  profile: Profile;
  plan: Plan;
  log: WeightLog;
  diary?: Diary;
  prefs?: DiaryPrefs;
}

const PROFILE_KEY = 'ethereal:profile:v1';

function readProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function createBackup(): Backup {
  return {
    app: 'ethereal',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: readProfile(),
    plan: planStore.get(),
    log: logStore.get(),
  };
}

export function validateBackup(raw: unknown): Backup | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<Backup>;
  if (b.app !== 'ethereal' || b.version !== 1) return null;
  if (!b.profile || typeof b.profile !== 'object') return null;
  const entries = Array.isArray(b.log?.entries)
    ? (b.log.entries as WeighIn[]).filter(
        (e) => typeof e?.date === 'string' && Number.isFinite(e.weightKg),
      )
    : [];
  return {
    app: 'ethereal',
    version: 1,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : new Date().toISOString(),
    profile: { ...DEFAULT_PROFILE, ...b.profile },
    plan: { ...DEFAULT_PLAN, ...(b.plan ?? {}) },
    log: { entries },
    ...(b.diary && typeof b.diary === 'object' ? { diary: b.diary } : {}),
    ...(b.prefs && typeof b.prefs === 'object' ? { prefs: b.prefs } : {}),
  };
}

/** Restores a backup. Returns false if the payload is not a valid Ethereal backup. */
export function restoreBackup(raw: unknown): boolean {
  const b = validateBackup(raw);
  if (!b) return false;
  updateProfile(b.profile);
  planStore.set(b.plan);
  logStore.set(b.log);
  if (b.diary) diaryStore.set({ ...diaryStore.get(), ...b.diary });
  if (b.prefs) prefsStore.set({ ...prefsStore.get(), ...b.prefs });
  return true;
}

export function logToCsv(log: WeightLog): string {
  const rows = [
    ['date', 'weight_kg', 'waist_cm', 'note'],
    ...log.entries.map((e) => [
      e.date,
      String(e.weightKg),
      e.waistCm !== undefined ? String(e.waistCm) : '',
      (e.note ?? '').replace(/"/g, '""'),
    ]),
  ];
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c}"` : c)).join(',')).join('\n');
}

const b64url = {
  encode: (s: string) =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  decode: (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};

/** Builds a share URL carrying the profile and plan (never the weigh-in log; it can be large and personal). */
export function buildShareLink(baseHref: string): string {
  const payload = { profile: readProfile(), plan: planStore.get() };
  return `${baseHref}#import=${b64url.encode(JSON.stringify(payload))}`;
}

/** Reads a share payload from the current URL hash, if present. */
export function readShareLink(
  hash = typeof location !== 'undefined' ? location.hash : '',
): { profile: Profile; plan: Plan } | null {
  const m = /#import=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const parsed = JSON.parse(b64url.decode(m[1]!)) as {
      profile?: Partial<Profile>;
      plan?: Partial<Plan>;
    };
    if (!parsed.profile || !parsed.plan) return null;
    return {
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      plan: { ...DEFAULT_PLAN, ...parsed.plan },
    };
  } catch {
    return null;
  }
}

export function clearAllData(): void {
  planStore.reset();
  logStore.reset();
  diaryStore.reset();
  prefsStore.reset();
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
