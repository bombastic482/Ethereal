/**
 * A jointed figure seen from the side, facing right, for exercise demos.
 *
 * Scene units: the floor is the line y = FLOOR, and a standing figure is about 100 units tall.
 * Angles are in degrees. A limb angle is measured from straight down, positive towards the
 * figure's front (+x): 0 hangs down, 90 points forward, 180 points up, -90 points back. The torso
 * angle is measured from straight up, positive leaning forward.
 *
 * A limb is posed either by its two segment angles, or by where its end should be (`to`), in
 * which case the elbow or knee is solved so the hand or foot lands exactly there. Planting hands
 * and feet that way keeps them still on the floor or the bed while the body moves.
 */

export const FLOOR = 120;

export const BONES = {
  torso: 34,
  shoulderDrop: 4,
  neck: 6,
  headR: 7,
  upperArm: 17,
  forearm: 17,
  thigh: 25,
  shin: 24,
  foot: 8,
} as const;

export type Point = readonly [number, number];

/** Segment angles: upper segment, then lower segment, both from straight down. */
export interface AngleLimb {
  a: number;
  b: number;
}
/** End position; `bend` picks which side the elbow or knee folds to (1 or -1). */
export interface ReachLimb {
  to: Point;
  bend: 1 | -1;
}
export type Limb = AngleLimb | ReachLimb;

export interface Pose {
  hip: Point;
  /** Torso lean from vertical, positive forward. */
  torso: number;
  /** Head tilt relative to the torso, positive chin-down. */
  head?: number;
  armN: Limb;
  armF: Limb;
  legN: Limb;
  legF: Limb;
  /** Foot angles from straight down; 90 is flat on the floor pointing forward. */
  footN?: number;
  footF?: number;
}

export interface Joints {
  hip: Point;
  neck: Point;
  shoulder: Point;
  head: Point;
  arm: { n: [Point, Point]; f: [Point, Point] };
  leg: { n: [Point, Point]; f: [Point, Point] };
  toe: { n: Point; f: Point };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Unit vector for a limb angle (from straight down, positive forward). */
export const down = (deg: number): Point => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const add = (p: Point, v: Point, k: number): Point => [p[0] + v[0] * k, p[1] + v[1] * k];

/** Two-bone inverse kinematics: the middle joint for a limb from `root` reaching `target`. */
export function solveReach(root: Point, target: Point, l1: number, l2: number, bend: 1 | -1) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const reach = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const toTarget = Math.atan2(dy, dx);
  const inner = Math.acos((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach));
  const a = toTarget + bend * inner;
  const mid: Point = [root[0] + Math.cos(a) * l1, root[1] + Math.sin(a) * l1];
  // When the target is out of reach, the end stops at full stretch along the same line.
  const end: Point = [
    mid[0] + ((target[0] - mid[0]) / Math.hypot(target[0] - mid[0], target[1] - mid[1])) * l2,
    mid[1] + ((target[1] - mid[1]) / Math.hypot(target[0] - mid[0], target[1] - mid[1])) * l2,
  ];
  return { mid, end };
}

function limb(root: Point, spec: Limb, l1: number, l2: number): [Point, Point] {
  if ('to' in spec) {
    const { mid, end } = solveReach(root, spec.to, l1, l2, spec.bend);
    return [mid, end];
  }
  const mid = add(root, down(spec.a), l1);
  return [mid, add(mid, down(spec.b), l2)];
}

export function solve(p: Pose): Joints {
  const up: Point = [Math.sin(rad(p.torso)), -Math.cos(rad(p.torso))];
  const neck = add(p.hip, up, BONES.torso);
  const shoulder = add(p.hip, up, BONES.torso - BONES.shoulderDrop);
  const headDir: Point = [
    Math.sin(rad(p.torso + (p.head ?? 0))),
    -Math.cos(rad(p.torso + (p.head ?? 0))),
  ];
  const head = add(neck, headDir, BONES.neck + BONES.headR - 1);
  const legN = limb(p.hip, p.legN, BONES.thigh, BONES.shin);
  const legF = limb(p.hip, p.legF, BONES.thigh, BONES.shin);
  return {
    hip: p.hip,
    neck,
    shoulder,
    head,
    arm: {
      n: limb(shoulder, p.armN, BONES.upperArm, BONES.forearm),
      f: limb(shoulder, p.armF, BONES.upperArm, BONES.forearm),
    },
    leg: { n: legN, f: legF },
    toe: {
      n: add(legN[1], down(p.footN ?? 90), BONES.foot),
      f: add(legF[1], down(p.footF ?? 90), BONES.foot),
    },
  };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPoint = (a: Point, b: Point, t: number): Point => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function mixLimb(a: Limb, b: Limb, t: number): Limb {
  if ('to' in a && 'to' in b)
    return { to: mixPoint(a.to, b.to, t), bend: t < 0.5 ? a.bend : b.bend };
  if (!('to' in a) && !('to' in b)) return { a: mix(a.a, b.a, t), b: mix(a.b, b.b, t) };
  // Mixed specs: blend the solved end points instead, so either form can follow the other.
  return t < 0.5 ? a : b;
}

/** A pose part-way from `a` to `b` (t from 0 to 1). */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: mixPoint(a.hip, b.hip, t),
    torso: mix(a.torso, b.torso, t),
    head: mix(a.head ?? 0, b.head ?? 0, t),
    armN: mixLimb(a.armN, b.armN, t),
    armF: mixLimb(a.armF, b.armF, t),
    legN: mixLimb(a.legN, b.legN, t),
    legF: mixLimb(a.legF, b.legF, t),
    footN: mix(a.footN ?? 90, b.footN ?? 90, t),
    footF: mix(a.footF ?? 90, b.footF ?? 90, t),
  };
}

/** One step of a demo loop: move to `pose` over `ms`, then hold it for `hold` ms. */
export interface Key {
  pose: Pose;
  ms: number;
  hold?: number;
}

export const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

/** Total length of one loop. */
export const loopLength = (keys: readonly Key[]) =>
  keys.reduce((sum, k) => sum + k.ms + (k.hold ?? 0), 0);

/**
 * The pose at time `ms` into a loop. Each key moves from the previous key's pose (the last
 * key's pose for the first) to its own, then holds.
 */
export function poseAt(keys: readonly Key[], ms: number): Pose {
  if (keys.length === 1) return keys[0]!.pose;
  let t = ms % loopLength(keys);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const from = keys[(i - 1 + keys.length) % keys.length]!.pose;
    if (t < key.ms) return mixPose(from, key.pose, ease(t / key.ms));
    t -= key.ms;
    if (t < (key.hold ?? 0)) return key.pose;
    t -= key.hold ?? 0;
  }
  return keys[keys.length - 1]!.pose;
}
