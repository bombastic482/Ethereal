import { describe, expect, it } from 'vitest';
import { buildPlanSummary, DEFAULT_PLAN, planProfile } from '../plan';
import { DEFAULT_PROFILE } from '../profile';

const profile = { ...DEFAULT_PROFILE, sex: 'female' as const, weightKg: 82 };
const plan = { ...DEFAULT_PLAN, active: true, goal: 'lose' as const, goalWeightKg: 68 };
const weighIns = Array.from({ length: 42 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 8, 18 + i)).toISOString().slice(0, 10),
  weightKg: 82 - i * 0.075,
}));

describe('planProfile', () => {
  it('uses the weight entered at setup until there are weigh-ins', () => {
    expect(planProfile(profile, [])).toBe(profile);
  });

  it('follows the trend weight once there are weigh-ins', () => {
    const w = planProfile(profile, weighIns).weightKg;
    expect(w).toBeLessThan(80);
    expect(w).toBeGreaterThan(weighIns.at(-1)!.weightKg);
  });

  it('gives every screen the same, lower target as the user gets lighter', () => {
    const atSetup = buildPlanSummary(profile, plan).target;
    const now = buildPlanSummary(planProfile(profile, weighIns), plan);
    expect(now.target).toBeLessThan(atSetup);
    // Same inputs, same answer: Today, the plan, the review and the header all build from this.
    expect(buildPlanSummary(planProfile(profile, weighIns), plan).target).toBe(now.target);
  });
});
