import { beforeEach, describe, expect, it, vi } from 'vitest';

function installWindow() {
  const bag = new Map<string, string>();
  const ls = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, v),
    removeItem: (k: string) => void bag.delete(k),
  };
  const w = { localStorage: ls, addEventListener() {}, removeEventListener() {} };
  (globalThis as unknown as { window: unknown }).window = w;
  (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
  return ls;
}

describe('backup', () => {
  beforeEach(() => {
    installWindow();
    vi.resetModules();
  });

  it('carries every local store and restores it elsewhere', async () => {
    const src = await import('../backup');
    const fs = await import('../food-store');
    const log = await import('../log');
    const refl = await import('../reflections');

    log.upsertEntry({ date: '2026-10-01', weightKg: 82.4 });
    fs.addFood({
      date: '2026-10-01',
      meal: 'breakfast',
      name: 'Oats',
      grams: 40,
      per100g: { kcal: 379, protein: 13, carbs: 67, fat: 7, fibre: 10 },
      source: 'local',
    });
    fs.setSteps('2026-10-01', 9000);
    fs.prefsStore.patch({ waterGoalGlasses: 10 });
    refl.reflectionStore.set({
      notes: {
        '2026-10-05': { wentWell: 'walks', change: 'earlier dinner', savedOn: '2026-10-05' },
      },
    });

    const backup = src.createBackup();
    expect(backup.diary?.food).toHaveLength(1);
    expect(backup.diary?.steps?.['2026-10-01']).toBe(9000);
    expect(backup.prefs?.waterGoalGlasses).toBe(10);
    expect(backup.reflections?.notes['2026-10-05']?.change).toBe('earlier dinner');

    // Round-trip through JSON into a clean device.
    const json = JSON.parse(JSON.stringify(backup)) as unknown;
    installWindow();
    vi.resetModules();
    const dst = await import('../backup');
    const fs2 = await import('../food-store');
    const log2 = await import('../log');
    const refl2 = await import('../reflections');
    expect(dst.restoreBackup(json)).toBe(true);
    expect(log2.logStore.get().entries[0]?.weightKg).toBe(82.4);
    expect(fs2.diaryStore.get().food[0]?.name).toBe('Oats');
    expect(fs2.diaryStore.get().steps?.['2026-10-01']).toBe(9000);
    expect(fs2.prefsStore.get().waterGoalGlasses).toBe(10);
    expect(refl2.reflectionStore.get().notes['2026-10-05']?.wentWell).toBe('walks');
  });

  it('rejects foreign payloads and tolerates old backups without a diary', async () => {
    const b = await import('../backup');
    expect(b.restoreBackup({ app: 'other', version: 1 })).toBe(false);
    expect(b.restoreBackup(null)).toBe(false);
    expect(
      b.restoreBackup({
        app: 'ethereal',
        version: 1,
        profile: {},
        plan: {},
        log: { entries: [{ date: '2026-01-01', weightKg: 90 }, { date: 'bad' }] },
      }),
    ).toBe(true);
    const log = await import('../log');
    expect(log.logStore.get().entries).toHaveLength(1);
  });
});
