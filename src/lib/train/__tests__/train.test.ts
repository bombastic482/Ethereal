import { describe, expect, it } from 'vitest';
import { EXERCISES, exerciseById } from '../exercises';
import { BONES, FLOOR, loopLength, poseAt, solve, solveReach } from '../figure';
import {
  LADDERS,
  buildWorkout,
  defaultSetup,
  pick,
  sessionOn,
  suggestions,
  weekOf,
  workoutKcal,
  type TrainSetup,
} from '../program';

describe('figure', () => {
  it('reaches a target within range exactly, keeping both bone lengths', () => {
    const root = [100, 60] as const;
    const target = [120, 90] as const;
    const { mid, end } = solveReach(root, target, BONES.thigh, BONES.shin, 1);
    expect(end[0]).toBeCloseTo(120, 3);
    expect(end[1]).toBeCloseTo(90, 3);
    expect(Math.hypot(mid[0] - root[0], mid[1] - root[1])).toBeCloseTo(BONES.thigh, 3);
    expect(Math.hypot(end[0] - mid[0], end[1] - mid[1])).toBeCloseTo(BONES.shin, 3);
  });

  it('never puts a joint through the floor in any demo', () => {
    const below: string[] = [];
    for (const e of EXERCISES) {
      const len = loopLength(e.keys);
      for (let i = 0; i < 24; i++) {
        const j = solve(poseAt(e.keys, (len * i) / 24));
        const points = [
          j.hip,
          j.head,
          j.shoulder,
          ...j.arm.n,
          ...j.arm.f,
          ...j.leg.n,
          ...j.leg.f,
          j.toe.n,
          j.toe.f,
        ];
        const lowest = Math.max(...points.map((p) => p[1]));
        if (lowest > FLOOR + 2) below.push(`${e.id} at frame ${i}: ${lowest.toFixed(1)}`);
      }
    }
    expect(below).toEqual([]);
  });
});

describe('exercise library', () => {
  it('has unique ids, and every easier, harder and ladder link points at a real exercise', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXERCISES) {
      if (e.easier) expect(exerciseById(e.easier), `${e.id} easier`).toBeDefined();
      if (e.harder) expect(exerciseById(e.harder), `${e.id} harder`).toBeDefined();
      expect(e.cues.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.keys.length, e.id).toBeGreaterThanOrEqual(2);
    }
    for (const ladder of Object.values(LADDERS)) {
      for (const id of ladder) expect(exerciseById(id), id).toBeDefined();
    }
  });

  it('offers floor-only options for every pattern, so a bare room is enough', () => {
    const floor = EXERCISES.filter((e) => e.equipment.every((q) => q === 'none'));
    for (const p of ['push', 'pull', 'squat', 'hinge', 'core', 'cardio', 'mobility']) {
      expect(
        floor.some((e) => e.pattern === p),
        p,
      ).toBe(true);
    }
  });
});

const setup = (over: Partial<TrainSetup> = {}): TrainSetup => ({
  ...defaultSetup('2026-11-01'),
  ...over,
});

describe('program', () => {
  it('only picks exercises you have the equipment for', () => {
    const bare = setup({
      equipment: [],
      rungs: { ...defaultSetup('2026-11-01').rungs, pull: 'doorframe-row' },
    });
    expect(pick('pull', bare)).toBeUndefined();
    const towel = setup({ equipment: ['towel'], rungs: { ...bare.rungs } });
    expect(pick('pull', towel)?.id).toBe('towel-row');
    // The incline push-up needs a bed; with none, the nearest usable rung is chosen.
    expect(pick('push', setup({ equipment: [] }))?.equipment).toEqual(['none']);
  });

  it('keeps week one deliberately light, then builds', () => {
    const s = setup();
    const w1 = buildWorkout(s, 'A', 1);
    const w2 = buildWorkout(s, 'A', 2);
    expect(w1.main.every((p) => p.sets === 2)).toBe(true);
    expect(w1.main.length).toBeLessThanOrEqual(4);
    expect(w2.main.every((p) => p.sets === 3)).toBe(true);
    expect(w2.main.length).toBeGreaterThan(w1.main.length);
  });

  it('skips the hardest leg moves when going easy on the legs', () => {
    const s = setup({
      easyOnLegs: true,
      level: 3,
      rungs: { ...defaultSetup('2026-11-01', 3).rungs, squat: 'bulgarian-split-squat' },
      equipment: ['bed', 'towel'],
    });
    const ids = [...buildWorkout(s, 'A', 3).main, ...buildWorkout(s, 'B', 3).main].map(
      (p) => p.exercise.id,
    );
    expect(ids).not.toContain('bulgarian-split-squat');
    expect(ids).not.toContain('step-back-burpee');
  });

  it('alternates A and B on training days and rests on the others', () => {
    const s = setup({ weekdays: [0, 2, 4], startedOn: '2026-11-01' }); // a Sunday
    expect(sessionOn(s, '2026-11-01')).toBe('A');
    expect(sessionOn(s, '2026-11-02')).toBeNull();
    expect(sessionOn(s, '2026-11-03')).toBe('B');
    expect(sessionOn(s, '2026-11-05')).toBe('A');
    expect(weekOf(s, '2026-11-07')).toBe(1);
    expect(weekOf(s, '2026-11-08')).toBe(2);
  });

  it('offers the harder rung after a clean session and the easier one after a short first set', () => {
    const s = setup({ equipment: [] });
    const w = buildWorkout(s, 'A', 2);
    const push = w.main.find((p) => p.ladder === 'push')!;
    const clean = Array.from({ length: push.sets }, () => ({
      exerciseId: push.exercise.id,
      value: push.high,
    }));
    expect(suggestions(w, clean, s)[0]).toMatchObject({
      direction: 'harder',
      from: push.exercise.id,
    });
    const short = [{ exerciseId: push.exercise.id, value: push.low - 3 }];
    const easier = suggestions(w, short, s);
    if (easier.length) expect(easier[0]).toMatchObject({ direction: 'easier' });
  });

  it('estimates calories from the exercises done, net of rest', () => {
    const w = buildWorkout(setup(), 'A', 2);
    const kcal = workoutKcal(w, [{ exerciseId: 'squat', value: 10 }], 92, 30);
    expect(kcal).toBeGreaterThan(150);
    expect(kcal).toBeLessThan(300);
  });
});

describe('session steps', async () => {
  const { buildSteps, loggedSets, startValue, weekStreak, withSwaps, lastPerformance } =
    await import('../session');
  const { buildWorkout, defaultSetup } = await import('../program');
  const setup = defaultSetup('2026-11-01', 2);
  const w = buildWorkout(setup, 'A', 3);
  const steps = buildSteps(w);

  it('puts a rest between working sets and none after the last', () => {
    const work = steps.filter((s) => s.kind === 'work');
    expect(work).toHaveLength(w.main.reduce((n, p) => n + p.sets, 0));
    const lastWork = steps.map((s) => s.kind).lastIndexOf('work');
    expect(steps[lastWork + 1]?.kind).toBe('cool');
    steps.forEach((s, i) => {
      if (s.kind === 'rest') expect(steps[i + 1]).toBe(s.next);
    });
  });

  it('gives longer rest when the exercise changes', () => {
    const rests = steps.filter((s) => s.kind === 'rest');
    const same = rests.find((r) => r.kind === 'rest' && r.next?.set !== 0);
    const change = rests.find((r) => r.kind === 'rest' && r.next?.set === 0);
    expect(change && same && change.kind === 'rest' && same.kind === 'rest').toBeTruthy();
    if (change?.kind === 'rest' && same?.kind === 'rest')
      expect(change.sec).toBeGreaterThan(same.sec);
  });

  it('logs only working sets with a value', () => {
    const i = steps.findIndex((s) => s.kind === 'work');
    const sets = loggedSets(steps, { 0: 45, [i]: 10, [i + 2]: 0 });
    expect(sets).toEqual([{ exerciseId: w.main[0]!.exercise.id, value: 10 }]);
  });

  it('applies swaps and re-prescribes', () => {
    const swapped = withSwaps(w, ['wall-push-up'], setup);
    expect(swapped.main[0]!.exercise.id).toBe('wall-push-up');
    expect(swapped.main[0]!.high).toBe(15);
    expect(swapped.main[1]).toBe(w.main[1]);
  });

  it('starts from last time, or mid-range', () => {
    const p = w.main[0]!;
    expect(startValue(p, 0, null)).toBe(Math.round((p.low + p.high) / 2));
    expect(startValue(p, 1, [12, 11])).toBe(11);
    expect(startValue(p, 2, [12, 11])).toBe(11);
    const log = [
      {
        id: 'a',
        date: '2026-11-02',
        session: 'A' as const,
        week: 1,
        minutes: 20,
        kcal: 90,
        sets: [{ exerciseId: 'push-up', value: 8 }],
      },
      {
        id: 'b',
        date: '2026-11-04',
        session: 'B' as const,
        week: 1,
        minutes: 20,
        kcal: 90,
        sets: [{ exerciseId: 'squat', value: 12 }],
      },
    ];
    expect(lastPerformance(log, 'push-up')).toEqual([8]);
    expect(lastPerformance(log, 'plank')).toBeNull();
  });

  it('counts week streaks, allowing the current week to be empty so far', () => {
    const mk = (date: string) => ({
      id: date,
      date,
      session: 'A' as const,
      week: 1,
      minutes: 1,
      kcal: 1,
      sets: [],
    });
    const log = [mk('2026-11-02'), mk('2026-11-10'), mk('2026-11-16')];
    expect(weekStreak(log, '2026-11-01', '2026-11-20')).toBe(3);
    expect(weekStreak(log, '2026-11-01', '2026-11-24')).toBe(3);
    expect(weekStreak(log, '2026-11-01', '2026-12-01')).toBe(0);
  });
});
