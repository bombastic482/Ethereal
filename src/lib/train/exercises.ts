/**
 * The exercise library. Home first: every movement here works in a bedroom, with a bed, a chair,
 * a doorframe or a treadmill at most, and each one links to an easier and a harder version so a
 * workout can meet you where you are today.
 *
 * Each entry carries its demo: the key poses of one repetition for the side-view figure in
 * figure.ts. Poses are built with small geometry helpers (a plank is a straight line from ankle
 * to shoulder, a squat keeps the feet planted), so the movements stay physically consistent.
 */
import { BONES, FLOOR, type Key, type Limb, type Point, type Pose } from './figure.ts';

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'heart';

export type Pattern =
  'push' | 'pull' | 'squat' | 'lunge' | 'hinge' | 'core' | 'cardio' | 'mobility';

/** What a movement needs beyond floor space. */
export type Equipment =
  'none' | 'towel' | 'bed' | 'chair' | 'door' | 'wall' | 'table' | 'treadmill';

export type SceneProp =
  | { kind: 'mat'; x: number; w: number }
  | { kind: 'bed'; x: number; w: number; h: number }
  | { kind: 'chair'; x: number; w: number; h: number; face?: 'left' | 'right'; back?: boolean }
  | { kind: 'table'; x: number; w: number; h: number }
  | { kind: 'door'; x: number }
  | { kind: 'wall'; x: number }
  | { kind: 'step'; x: number; w: number; h: number }
  | { kind: 'treadmill'; x: number; w: number };

export interface Exercise {
  id: string;
  name: string;
  /** One line on what it does for you. */
  summary: string;
  pattern: Pattern;
  /** Main muscles first. */
  muscles: Muscle[];
  equipment: Equipment[];
  /** 1 (anyone can do it today) to 5 (takes months of training). */
  level: 1 | 2 | 3 | 4 | 5;
  unit: 'reps' | 'seconds';
  /** Done one side at a time; targets are per side. */
  perSide?: boolean;
  /** Energy cost in METs, used to estimate calories. */
  met: number;
  /** How to do it, in the order you think about it. */
  cues: string[];
  mistakes: string[];
  easier?: string;
  harder?: string;
  keys: Key[];
  /** Index of the key that shows the working position. */
  peak?: number;
  props?: SceneProp[];
  /** Draws a towel from the hands to the feet. */
  towel?: boolean;
}

/* ------------------------------------------------------------------ geometry helpers */

const LEG = BONES.thigh + BONES.shin;
const TRUNK = BONES.torso - BONES.shoulderDrop;
const ANKLE = FLOOR - 4; // ankle height when the foot is flat
const deg = (r: number) => (r * 180) / Math.PI;
const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (x: number, y: number): Point => [r1(x), r1(y)];

/** Limb by angles (both from straight down, positive forward). */
const ang = (a: number, b = a): Limb => ({ a, b });
/** Limb reaching a point; bend picks the fold direction of the elbow or knee. */
const reach = (x: number, y: number, bend: 1 | -1): Limb => ({ to: pt(x, y), bend });

/**
 * A straight body line from a pivot (ankles, or knees when kneeling) up to the shoulders at
 * height `shoulderY`, heading towards +x. Returns the hip, shoulder and torso angle, plus the
 * limb angle of the legs pointing back to the pivot.
 */
function bodyLine(pivot: Point, shoulderY: number, lower = LEG) {
  const len = lower + TRUNK;
  const dy = pivot[1] - shoulderY;
  const dx = Math.sqrt(Math.max(0, len * len - dy * dy));
  const ux = dx / len;
  const uy = -dy / len;
  return {
    hip: pt(pivot[0] + ux * lower, pivot[1] + uy * lower),
    shoulder: pt(pivot[0] + ux * len, pivot[1] + uy * len),
    torso: r1(deg(Math.atan2(ux, -uy))),
    /** Limb angle from the hip back down to the pivot. */
    back: r1(deg(Math.atan2(-ux, -uy))),
  };
}

/** Standing upright with feet at x. */
const STAND_HIP = ANKLE - LEG;
function stand(x: number, over: Partial<Pose> = {}): Pose {
  return {
    hip: pt(x, STAND_HIP),
    torso: 0,
    armN: ang(6, 12),
    armF: ang(-4, 4),
    legN: reach(x + 1, ANKLE, 1),
    legF: reach(x - 2, ANKLE, 1),
    ...over,
  };
}

const k = (pose: Pose, ms: number, hold?: number): Key =>
  hold ? { pose, ms, hold } : { pose, ms };

/* ------------------------------------------------------------------ push */

function pushUp(): Key[] {
  const ankle = pt(64, 113);
  const top = bodyLine(ankle, 84);
  const low = bodyLine(ankle, 103);
  const hand = pt(top.shoulder[0], 116);
  const pose = (b: typeof top): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] + 2, hand[1], 1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1] + 0.5, 1),
    footN: 22,
    footF: 22,
  });
  return [k(pose(top), 900, 250), k(pose(low), 1100, 150)];
}

function kneePushUp(): Key[] {
  const knee = pt(92, 115);
  const top = bodyLine(knee, 84, BONES.thigh);
  const low = bodyLine(knee, 103, BONES.thigh);
  const hand = pt(top.shoulder[0], 116);
  const pose = (b: typeof top): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] + 2, hand[1], 1),
    legN: ang(b.back, -112),
    legF: ang(b.back, -116),
    footN: -150,
    footF: -150,
  });
  return [k(pose(top), 900, 250), k(pose(low), 1100, 150)];
}

function inclinePushUp(): Key[] {
  const ankle = pt(70, 113);
  const top = bodyLine(ankle, 54);
  const low = bodyLine(ankle, 74);
  const hand = pt(152, 89);
  const pose = (b: typeof top): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] + 2, hand[1], 1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1] + 0.5, 1),
    footN: 30,
    footF: 30,
  });
  return [k(pose(top), 900, 250), k(pose(low), 1100, 150)];
}

function wallPushUp(): Key[] {
  const ankle = pt(96, ANKLE);
  const top = bodyLine(ankle, 50);
  const low = bodyLine(ankle, 62);
  const hand = pt(172, 55);
  const pose = (b: typeof top): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0], hand[1] + 2, 1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1], 1),
    footN: 70,
    footF: 70,
  });
  return [k(pose(top), 900, 250), k(pose(low), 1100, 150)];
}

function declinePushUp(): Key[] {
  const ankle = pt(52, 88);
  const top = bodyLine(ankle, 84);
  const low = bodyLine(ankle, 102);
  const hand = pt(top.shoulder[0], 116);
  const pose = (b: typeof top): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] + 2, hand[1], 1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1], 1),
    footN: 10,
    footF: 10,
  });
  return [k(pose(top), 900, 250), k(pose(low), 1100, 150)];
}

function pikePushUp(): Key[] {
  const ankle = pt(72, 113);
  const hand = pt(128, 116);
  const pose = (hip: Point, torso: number): Pose => ({
    hip,
    torso,
    head: -10,
    armN: reach(hand[0], hand[1], -1),
    armF: reach(hand[0] + 2, hand[1], -1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1], 1),
    footN: 30,
    footF: 30,
  });
  return [k(pose(pt(98, 70), 128), 900, 250), k(pose(pt(100, 73), 150), 1100, 150)];
}

function chairDip(): Key[] {
  const hand = pt(70, 92);
  const ankle = pt(140, ANKLE);
  const pose = (hipY: number): Pose => ({
    hip: pt(78, hipY),
    torso: -4,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] - 2, hand[1], 1),
    legN: reach(ankle[0], ankle[1], -1),
    legF: reach(ankle[0] - 2, ankle[1], -1),
  });
  return [k(pose(84), 900, 250), k(pose(106), 1100, 150)];
}

/* ------------------------------------------------------------------ pull */

function doorframeRow(): Key[] {
  const ankle = pt(142, ANKLE);
  const hand = pt(147, 52);
  const lean = (theta: number): Pose => {
    const t = (theta * Math.PI) / 180;
    return {
      hip: pt(ankle[0] - LEG * Math.sin(t), ankle[1] - LEG * Math.cos(t)),
      torso: -theta,
      armN: reach(hand[0], hand[1], 1),
      armF: reach(hand[0], hand[1] + 3, 1),
      legN: reach(ankle[0], ankle[1], 1),
      legF: reach(ankle[0] - 2, ankle[1], 1),
      footN: 75,
      footF: 75,
    };
  };
  return [k(lean(21), 1100, 150), k(lean(8), 900, 300)];
}

function tableRow(): Key[] {
  const heel = pt(48, 114);
  const hand = pt(127, 86);
  const pose = (shoulderY: number): Pose => {
    const b = bodyLine(heel, shoulderY);
    return {
      hip: b.hip,
      torso: b.torso,
      armN: reach(hand[0], hand[1], -1),
      armF: reach(hand[0] + 2, hand[1], -1),
      legN: reach(heel[0], heel[1], 1),
      legF: reach(heel[0] - 1, heel[1], 1),
      footN: 170,
      footF: 170,
    };
  };
  return [k(pose(115), 1100, 150), k(pose(96), 900, 300)];
}

function superman(): Key[] {
  const pose = (lift: number): Pose => ({
    hip: pt(100, 112),
    torso: 90 - lift,
    head: -lift * 0.6,
    armN: ang(90 + lift * 1.1, 90 + lift * 1.2),
    armF: ang(88 + lift * 1.1, 88 + lift * 1.2),
    legN: ang(-90 - lift * 0.9, -90 - lift),
    legF: ang(-92 - lift * 0.9, -92 - lift),
    footN: -100,
    footF: -100,
  });
  return [k(pose(0), 900, 200), k(pose(18), 900, 900)];
}

function proneYRaise(): Key[] {
  const pose = (lift: number): Pose => ({
    hip: pt(100, 112),
    torso: 90 - lift * 0.35,
    head: -lift * 0.3,
    armN: ang(84 + lift, 84 + lift),
    armF: ang(82 + lift, 82 + lift),
    legN: ang(-92, -92),
    legF: ang(-93, -93),
    footN: -100,
    footF: -100,
  });
  return [k(pose(0), 900, 200), k(pose(26), 900, 600)];
}

function towelRow(): Key[] {
  const pose = (pull: number): Pose => ({
    hip: pt(88, 112),
    torso: -12 - pull * 6,
    head: 6,
    armN: pull ? reach(96, 100, 1) : reach(124, 104, 1),
    armF: pull ? reach(95, 101, 1) : reach(123, 105, 1),
    legN: ang(88, 88),
    legF: ang(87, 87),
    footN: 175,
    footF: 175,
  });
  return [k(pose(0), 1000, 150), k(pose(1), 900, 700)];
}

function towelCurl(): Key[] {
  const x = 112;
  const up = (b: number) => stand(x, { armN: ang(4, b), armF: ang(0, b - 4) });
  return [k(up(6), 1000, 150), k(up(140), 900, 700)];
}

/* ------------------------------------------------------------------ squat and lunge */

function squat(): Key[] {
  const x = 112;
  const low: Pose = {
    hip: pt(92, 94),
    torso: 38,
    armN: ang(92, 92),
    armF: ang(88, 88),
    legN: reach(x + 1, ANKLE, 1),
    legF: reach(x - 2, ANKLE, 1),
  };
  return [k(stand(x, { armN: ang(80, 84), armF: ang(76, 80) }), 1000, 200), k(low, 1200, 150)];
}

function chairSquat(): Key[] {
  const x = 112;
  const low: Pose = {
    hip: pt(90, 92),
    torso: 34,
    armN: ang(88, 88),
    armF: ang(84, 84),
    legN: reach(x + 1, ANKLE, 1),
    legF: reach(x - 2, ANKLE, 1),
  };
  return [k(stand(x, { armN: ang(80, 84), armF: ang(76, 80) }), 1200, 200), k(low, 1300, 300)];
}

function splitSquat(): Key[] {
  const front = pt(130, ANKLE);
  const back = pt(78, 111);
  const pose = (hipY: number): Pose => ({
    hip: pt(102, hipY),
    torso: 4,
    armN: ang(8, 16),
    armF: ang(-6, 2),
    legN: reach(front[0], front[1], 1),
    legF: reach(back[0], back[1], 1),
    footF: 20,
  });
  return [k(pose(72), 1000, 200), k(pose(91), 1200, 150)];
}

function bulgarianSplitSquat(): Key[] {
  const front = pt(126, ANKLE);
  const back = pt(70, 87);
  const pose = (hipY: number, x: number): Pose => ({
    hip: pt(x, hipY),
    torso: 12,
    armN: ang(8, 16),
    armF: ang(-6, 2),
    legN: reach(front[0], front[1], 1),
    legF: reach(back[0], back[1], -1),
    footF: -110,
  });
  return [k(pose(71, 100), 1000, 200), k(pose(90, 97), 1300, 150)];
}

function reverseLunge(): Key[] {
  const front = pt(120, ANKLE);
  const lunge: Pose = {
    hip: pt(96, 91),
    torso: 6,
    armN: ang(10, 20),
    armF: ang(-8, 0),
    legN: reach(front[0], front[1], 1),
    legF: reach(70, 111, 1),
    footF: 20,
  };
  return [k(stand(118), 1000, 250), k(lunge, 1100, 150)];
}

function wallSit(): Key[] {
  const pose = (dy: number): Pose => ({
    hip: pt(72, 92 + dy),
    torso: 0,
    armN: ang(10, 14),
    armF: ang(4, 8),
    legN: reach(97, ANKLE, 1),
    legF: reach(95, ANKLE, 1),
  });
  return [k(pose(0), 1600, 400), k(pose(0.8), 1600, 400)];
}

function calfRaise(): Key[] {
  const x = 112;
  const up = stand(x, {
    hip: pt(x, STAND_HIP - 9),
    legN: reach(x + 1, ANKLE - 9, 1),
    legF: reach(x - 2, ANKLE - 9, 1),
    footN: 30,
    footF: 30,
  });
  return [k(stand(x), 800, 150), k(up, 700, 400)];
}

/* ------------------------------------------------------------------ hinge */

function gluteBridge(single = false): Key[] {
  const ankle = pt(74, ANKLE);
  const shoulder = pt(130, 113);
  const pose = (lift: number): Pose => {
    const hip = pt(100 + lift * 0.25, 113 - lift);
    const dx = shoulder[0] - hip[0];
    const dy = shoulder[1] - hip[1];
    const torso = r1(deg(Math.atan2(dx, -dy)));
    const straight = r1(torso - 180);
    return {
      hip,
      torso,
      head: 90 - torso,
      armN: ang(-90, -90),
      armF: ang(-92, -92),
      legN: single ? ang(straight - 8, straight - 8) : reach(ankle[0], ankle[1], 1),
      legF: reach(ankle[0] - 2, ankle[1], 1),
      footN: single ? straight - 90 : 90,
    };
  };
  return [k(pose(0), 1000, 150), k(pose(19), 900, 700)];
}

function hipThrust(): Key[] {
  const ankle = pt(132, ANKLE);
  const shoulder = pt(62, 92);
  const pose = (lift: number): Pose => {
    const hip = pt(92 + lift * 0.1, 106 - lift);
    const dx = shoulder[0] - hip[0];
    const dy = shoulder[1] - hip[1];
    const torso = r1(deg(Math.atan2(dx, -dy)));
    return {
      hip,
      torso,
      head: -torso - 70,
      armN: ang(-100, -100),
      armF: ang(-102, -102),
      legN: reach(ankle[0], ankle[1], -1),
      legF: reach(ankle[0] - 2, ankle[1], -1),
    };
  };
  return [k(pose(0), 1000, 150), k(pose(15), 900, 600)];
}

function singleLegRdl(): Key[] {
  const x = 110;
  const top = stand(x, { legF: ang(-14, -22), footF: 60 });
  const low: Pose = {
    hip: pt(104, 70),
    torso: 82,
    head: -4,
    armN: ang(6, 6),
    armF: ang(2, 2),
    legN: reach(x, ANKLE, 1),
    legF: ang(-96, -96),
    footF: -10,
  };
  return [k(top, 1100, 200), k(low, 1300, 300)];
}

function goodMorning(): Key[] {
  const x = 112;
  // Arms folded across the chest; they turn with the torso.
  const arms = (t: number) => ({ armN: ang(18 + t, 122 + t), armF: ang(14 + t, 118 + t) });
  const low: Pose = {
    hip: pt(104, 72),
    torso: 74,
    head: -6,
    ...arms(74),
    legN: reach(x + 1, ANKLE, 1),
    legF: reach(x - 2, ANKLE, 1),
  };
  return [k(stand(x, arms(0)), 1100, 200), k(low, 1200, 200)];
}

/* ------------------------------------------------------------------ core */

function plank(knees = false): Key[] {
  const pivot = knees ? pt(92, 115) : pt(58, 113);
  const pose = (dy: number): Pose => {
    const b = bodyLine(pivot, 96 + dy, knees ? BONES.thigh : LEG);
    return {
      hip: b.hip,
      torso: b.torso,
      armN: ang(0, 90),
      armF: ang(-2, 88),
      legN: knees ? ang(b.back, -112) : reach(pivot[0], pivot[1], 1),
      legF: knees ? ang(b.back, -116) : reach(pivot[0] - 1, pivot[1] + 0.5, 1),
      footN: knees ? -150 : 22,
      footF: knees ? -150 : 22,
    };
  };
  return [k(pose(0), 1800, 300), k(pose(0.9), 1800, 300)];
}

function deadBug(): Key[] {
  const pose = (ext: number): Pose => ({
    hip: pt(100, 112),
    torso: 90,
    armN: ang(180 - ext * 70, 180 - ext * 70),
    armF: ang(180, 180),
    legN: ang(-180 + ext * 0, -90 - ext * 0),
    legF: ang(-180 + ext * 85, -90 + ext * 0),
    footN: -60,
    footF: -60 + ext * 30,
  });
  return [k(pose(0), 1000, 200), k(pose(1), 1300, 300)];
}

function birdDog(): Key[] {
  const hand = pt(128, 117);
  const pose = (ext: number): Pose => ({
    hip: pt(96, 90),
    torso: 84,
    head: -6,
    armN: ext ? ang(92, 92) : ang(-2, 0),
    armF: reach(hand[0] - 2, hand[1], -1),
    legN: ang(0, -90),
    legF: ext ? ang(-94, -94) : ang(2, -90),
    footN: -95,
    footF: -95,
  });
  return [k(pose(0), 1000, 200), k(pose(1), 1100, 700)];
}

function mountainClimber(): Key[] {
  const ankle = pt(64, 113);
  const b = bodyLine(ankle, 86);
  const hand = pt(b.shoulder[0], 116);
  // The driving knee comes up under the chest, foot just off the floor below the hips.
  const tuck = reach(b.hip[0] + 6, 109, -1);
  const pose = (near: boolean): Pose => ({
    hip: b.hip,
    torso: b.torso,
    armN: reach(hand[0], hand[1], 1),
    armF: reach(hand[0] + 2, hand[1], 1),
    legN: near ? tuck : reach(ankle[0], ankle[1], 1),
    legF: near ? reach(ankle[0] - 1, ankle[1], 1) : tuck,
    footN: near ? 60 : 22,
    footF: near ? 22 : 60,
  });
  return [k(pose(true), 380, 40), k(pose(false), 380, 40)];
}

function hollowHold(): Key[] {
  const pose = (dy: number): Pose => ({
    hip: pt(100, 112),
    torso: 74 + dy,
    head: 10,
    armN: ang(116, 116),
    armF: ang(114, 114),
    legN: ang(-106 - dy, -106 - dy),
    legF: ang(-104 - dy, -104 - dy),
    footN: -120,
    footF: -120,
  });
  return [k(pose(0), 1600, 400), k(pose(1.5), 1600, 400)];
}

function reverseCrunch(): Key[] {
  const pose = (curl: number): Pose => ({
    hip: pt(100, 112 - curl * 5),
    torso: 90 + curl * 6,
    armN: ang(-90, -90),
    armF: ang(-92, -92),
    legN: ang(-140 - curl * 60, -80 - curl * 70),
    legF: ang(-142 - curl * 60, -82 - curl * 70),
    footN: -90 - curl * 60,
    footF: -90 - curl * 60,
  });
  return [k(pose(0), 900, 150), k(pose(1), 900, 200)];
}

/* ------------------------------------------------------------------ cardio */

function walkCycle(speed = 1): Key[] {
  const ms = 420 / speed;
  const step = (n: number): Pose => ({
    hip: pt(110, STAND_HIP + (n % 2 ? 1.5 : 0)),
    torso: 4,
    armN: n === 0 ? ang(-22, -10) : n === 2 ? ang(22, 40) : ang(0, 12),
    armF: n === 0 ? ang(22, 40) : n === 2 ? ang(-22, -10) : ang(0, 12),
    legN: n === 0 ? ang(22, 8) : n === 1 ? ang(0, -24) : n === 2 ? ang(-20, -26) : ang(6, -14),
    legF: n === 0 ? ang(-20, -26) : n === 1 ? ang(6, -14) : n === 2 ? ang(22, 8) : ang(0, -24),
    footN: n === 2 ? 50 : 90,
    footF: n === 0 ? 50 : 90,
  });
  return [k(step(0), ms), k(step(1), ms), k(step(2), ms), k(step(3), ms)];
}

function marchInPlace(): Key[] {
  const x = 112;
  const up = (near: boolean): Pose =>
    stand(x, {
      armN: near ? ang(-30, 10) : ang(40, 80),
      armF: near ? ang(40, 80) : ang(-30, 10),
      legN: near ? ang(70, 0) : reach(x + 1, ANKLE, 1),
      legF: near ? reach(x - 2, ANKLE, 1) : ang(70, 0),
      footN: near ? 70 : 90,
      footF: near ? 90 : 70,
    });
  return [k(up(true), 450, 60), k(up(false), 450, 60)];
}

function stepBackBurpee(): Key[] {
  const x = 116;
  const squatLow: Pose = {
    hip: pt(98, 96),
    torso: 50,
    armN: reach(126, 116, -1),
    armF: reach(128, 116, -1),
    legN: reach(x, ANKLE, 1),
    legF: reach(x - 3, ANKLE, 1),
  };
  const ankle = pt(52, 113);
  const b = bodyLine(ankle, 86);
  const plankPose: Pose = {
    hip: b.hip,
    torso: b.torso,
    armN: reach(b.shoulder[0], 116, -1),
    armF: reach(b.shoulder[0] + 2, 116, -1),
    legN: reach(ankle[0], ankle[1], 1),
    legF: reach(ankle[0] - 1, ankle[1], 1),
    footN: 22,
    footF: 22,
  };
  const reachUp = stand(x, { armN: ang(170, 175), armF: ang(166, 171) });
  return [
    k(reachUp, 700, 200),
    k(squatLow, 700, 100),
    k(plankPose, 800, 300),
    k(squatLow, 800, 100),
  ];
}

/* ------------------------------------------------------------------ mobility */

function catCow(): Key[] {
  const hand = pt(130, 116);
  const knee = pt(96, 115);
  const pose = (arch: number): Pose => ({
    hip: pt(96, 88 + arch * 2),
    torso: 90 - arch * 8,
    head: arch * 22,
    armN: reach(hand[0], hand[1], -1),
    armF: reach(hand[0] - 2, hand[1], -1),
    legN: reach(knee[0], knee[1], 1),
    legF: reach(knee[0] - 2, knee[1], 1),
    footN: -95,
    footF: -95,
  });
  return [k(pose(-1), 1600, 300), k(pose(1), 1600, 300)];
}

function hipFlexorStretch(): Key[] {
  const front = pt(132, ANKLE);
  const pose = (push: number): Pose => ({
    hip: pt(100 + push * 5, 91 + push * 1.5),
    torso: -2,
    armN: ang(4, 10),
    armF: ang(-6, 0),
    legN: reach(front[0], front[1], 1),
    legF: ang(-30 - push * 8, -90),
    footF: -95,
  });
  return [k(pose(0), 1600, 300), k(pose(1), 1600, 1200)];
}

function childsPose(): Key[] {
  const pose = (dy: number): Pose => ({
    hip: pt(84, 101 + dy * 0.5),
    torso: 102 + dy * 2,
    head: -4,
    armN: ang(92, 92),
    armF: ang(90, 90),
    legN: ang(60, -92),
    legF: ang(58, -94),
    footN: -100,
    footF: -100,
  });
  return [k(pose(0), 2000, 400), k(pose(1), 2000, 400)];
}

function armCircles(): Key[] {
  const x = 112;
  const at = (a: number) => stand(x, { armN: ang(a, a), armF: ang(a + 180, a + 180) });
  return [k(at(0), 450), k(at(90), 450), k(at(180), 450), k(at(270), 450)];
}

/* ------------------------------------------------------------------ the library */

const BED_LEFT: SceneProp = { kind: 'bed', x: 12, w: 50, h: 26 };
const BED_RIGHT: SceneProp = { kind: 'bed', x: 140, w: 70, h: 26 };

export const EXERCISES: Exercise[] = [
  {
    id: 'wall-push-up',
    name: 'Wall push-up',
    summary: 'The first step to a full push-up. Chest, shoulders and arms, gentle on the wrists.',
    pattern: 'push',
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: ['wall'],
    level: 1,
    unit: 'reps',
    met: 3,
    cues: [
      'Stand an arm’s length from the wall, hands on it at shoulder height and a little wider than your shoulders.',
      'Keep your body in one straight line from head to heels.',
      'Bend your elbows to bring your chest towards the wall, then push back.',
    ],
    mistakes: ['Sticking your hips out', 'Flaring the elbows straight out to the sides'],
    harder: 'incline-push-up',
    keys: wallPushUp(),
    props: [{ kind: 'wall', x: 174 }],
  },
  {
    id: 'incline-push-up',
    name: 'Incline push-up',
    summary: 'Hands on the bed or a sturdy table: a real push-up with less of your weight.',
    pattern: 'push',
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: ['bed'],
    level: 1,
    unit: 'reps',
    met: 3.8,
    cues: [
      'Hands on the edge of the bed, a little wider than your shoulders.',
      'Walk your feet back until your body is one straight plank.',
      'Lower your chest to the edge with elbows angled back, then press away.',
    ],
    mistakes: ['Sagging hips', 'Only bending a few centimetres'],
    easier: 'wall-push-up',
    harder: 'knee-push-up',
    keys: inclinePushUp(),
    props: [BED_RIGHT],
  },
  {
    id: 'knee-push-up',
    name: 'Knee push-up',
    summary: 'A full range push-up with your knees down. Builds the strength for the real thing.',
    pattern: 'push',
    muscles: ['chest', 'triceps', 'shoulders', 'core'],
    equipment: ['none'],
    level: 2,
    unit: 'reps',
    met: 3.8,
    cues: [
      'Knees on the floor, hands under your shoulders.',
      'Make a straight line from knees to head; squeeze your glutes.',
      'Lower until your chest is a fist above the floor, then push back up.',
    ],
    mistakes: ['Hips piking up', 'Head dropping before the chest'],
    easier: 'incline-push-up',
    harder: 'push-up',
    keys: kneePushUp(),
  },
  {
    id: 'push-up',
    name: 'Push-up',
    summary: 'The classic. Chest, shoulders, triceps and a rock-solid core in one move.',
    pattern: 'push',
    muscles: ['chest', 'triceps', 'shoulders', 'core'],
    equipment: ['none'],
    level: 3,
    unit: 'reps',
    met: 3.8,
    cues: [
      'Hands under your shoulders, feet together, body straight from head to heels.',
      'Brace your stomach and squeeze your glutes as if bracing for a punch.',
      'Lower with elbows about 45° from your body until your chest nearly touches the floor.',
      'Press the floor away and finish with straight arms.',
    ],
    mistakes: ['Hips sagging or piking', 'Elbows flared out wide', 'Half reps'],
    easier: 'knee-push-up',
    harder: 'diamond-push-up',
    keys: pushUp(),
  },
  {
    id: 'diamond-push-up',
    name: 'Diamond push-up',
    summary:
      'Hands together under your chest: shifts the push-up onto the triceps and inner chest.',
    pattern: 'push',
    muscles: ['triceps', 'chest', 'shoulders'],
    equipment: ['none'],
    level: 4,
    unit: 'reps',
    met: 4,
    cues: [
      'Start in a push-up with your hands together under your chest, thumbs and index fingers making a diamond.',
      'Lower with your elbows close to your sides.',
      'Press back up. Drop to your knees when the reps slow down.',
    ],
    mistakes: ['Elbows flaring out', 'Hips sagging'],
    easier: 'push-up',
    keys: pushUp(),
  },
  {
    id: 'decline-push-up',
    name: 'Decline push-up',
    summary:
      'Feet up on the bed: more weight on your arms and more work for the upper chest and shoulders.',
    pattern: 'push',
    muscles: ['chest', 'shoulders', 'triceps', 'core'],
    equipment: ['bed'],
    level: 4,
    unit: 'reps',
    met: 4,
    cues: [
      'Feet on the edge of the bed, hands on the floor under your shoulders.',
      'Keep your body straight; don’t let your lower back sag.',
      'Lower your chest towards the floor, then press back up.',
    ],
    mistakes: ['Lower back sagging', 'Hands too far forward'],
    easier: 'push-up',
    keys: declinePushUp(),
    props: [BED_LEFT],
  },
  {
    id: 'pike-push-up',
    name: 'Pike push-up',
    summary: 'Hips high, head down: the bodyweight way to build shoulders for that wide-top look.',
    pattern: 'push',
    muscles: ['shoulders', 'triceps', 'core'],
    equipment: ['none'],
    level: 3,
    unit: 'reps',
    met: 4,
    cues: [
      'Start in a push-up, then walk your feet in and lift your hips into an upside-down V.',
      'Bend your elbows to lower the top of your head towards the floor in front of your hands.',
      'Press back up, keeping your hips high.',
    ],
    mistakes: ['Letting the hips drop into a push-up', 'Elbows flaring wide'],
    easier: 'incline-push-up',
    keys: pikePushUp(),
    peak: 1,
  },
  {
    id: 'chair-dip',
    name: 'Chair dip',
    summary: 'Hands on a sturdy chair behind you. Triceps and the front of the shoulders.',
    pattern: 'push',
    muscles: ['triceps', 'shoulders', 'chest'],
    equipment: ['chair'],
    level: 2,
    unit: 'reps',
    met: 3.5,
    cues: [
      'Sit on the edge of a sturdy chair, hands beside your hips, then slide forward off it.',
      'Bend your elbows straight back to lower your hips, until your upper arms are about level.',
      'Press back up. Bend your knees to make it easier.',
    ],
    mistakes: ['Shoulders rolling forward', 'Going so low it pinches the shoulders'],
    keys: chairDip(),
    props: [{ kind: 'chair', x: 46, w: 30, h: 26, face: 'left' }],
  },
  {
    id: 'doorframe-row',
    name: 'Doorframe row',
    summary: 'Your only real pull with zero equipment, and the move that builds back width.',
    pattern: 'pull',
    muscles: ['back', 'biceps', 'shoulders'],
    equipment: ['door'],
    level: 2,
    unit: 'reps',
    met: 3.5,
    cues: [
      'Stand in a doorway, feet close to the frame, and grip the edge with both hands at chest height.',
      'Lean back until your arms are straight, body in one line.',
      'Pull your chest to the frame by squeezing your shoulder blades together.',
      'Lower slowly. Walk your feet closer to the door to make it harder.',
    ],
    mistakes: ['Pulling with the arms only, shoulders shrugged', 'Bending at the hips'],
    easier: 'towel-row',
    harder: 'table-row',
    keys: doorframeRow(),
    props: [{ kind: 'door', x: 148 }],
  },
  {
    id: 'table-row',
    name: 'Table row',
    summary: 'Lie under a sturdy table and pull your chest up to it: a full bodyweight row.',
    pattern: 'pull',
    muscles: ['back', 'biceps', 'core'],
    equipment: ['table'],
    level: 3,
    unit: 'reps',
    met: 4,
    cues: [
      'Lie under a sturdy table and grip the edge, hands shoulder-width apart.',
      'Lift your hips so your body is straight, heels on the floor.',
      'Pull your chest up to the edge, squeeze, then lower slowly.',
      'Only use a table that cannot tip.',
    ],
    mistakes: ['Hips dropping', 'Jerking up with momentum'],
    easier: 'doorframe-row',
    keys: tableRow(),
    props: [{ kind: 'table', x: 112, w: 64, h: 36 }],
  },
  {
    id: 'towel-row',
    name: 'Towel row',
    summary:
      'Sit with a towel around your feet and pull hard: a back exercise that needs no wall, door or bar.',
    pattern: 'pull',
    muscles: ['back', 'biceps'],
    equipment: ['towel'],
    level: 1,
    unit: 'reps',
    met: 3,
    towel: true,
    cues: [
      'Sit with your legs straight and loop a towel around the soles of your feet, holding an end in each hand.',
      'Lean back a little and pull your elbows back past your ribs, squeezing your shoulder blades together.',
      'Push against the towel with your feet so the pull is hard all the way. Hold 2 seconds, then release.',
    ],
    mistakes: ['Pulling with the arms only', 'Rounding the back'],
    harder: 'doorframe-row',
    keys: towelRow(),
  },
  {
    id: 'towel-curl',
    name: 'Towel curl',
    summary: 'Stand on a towel and curl against it: biceps work with zero equipment.',
    pattern: 'pull',
    muscles: ['biceps'],
    equipment: ['towel'],
    level: 1,
    unit: 'reps',
    met: 2.8,
    towel: true,
    cues: [
      'Stand on the middle of a towel and hold an end in each hand, palms up.',
      'Curl your hands up as if lifting a weight, pushing down with your feet to make it harder.',
      'Squeeze at the top for 2 seconds, then lower slowly.',
    ],
    mistakes: ['Swinging the body', 'Elbows drifting forward'],
    keys: towelCurl(),
  },
  {
    id: 'prone-y-raise',
    name: 'Prone Y raise',
    summary:
      'Lying face down, lift your arms overhead in a Y: wakes up the upper back and posture muscles.',
    pattern: 'pull',
    muscles: ['back', 'shoulders'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    met: 2.8,
    cues: [
      'Lie face down with your arms overhead in a Y, thumbs pointing up.',
      'Squeeze your shoulder blades down and back to lift your arms a few centimetres.',
      'Pause, then lower slowly. Keep your forehead just above the floor.',
    ],
    mistakes: ['Cranking the neck up', 'Shrugging the shoulders to the ears'],
    harder: 'doorframe-row',
    keys: proneYRaise(),
  },
  {
    id: 'superman',
    name: 'Superman hold',
    summary:
      'Lift arms, chest and legs off the floor: lower back and glutes, the back of your body.',
    pattern: 'pull',
    muscles: ['back', 'glutes', 'hamstrings'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 2.8,
    cues: [
      'Lie face down with arms stretched out in front.',
      'Lift your arms, chest and legs a few centimetres at the same time.',
      'Hold, breathing steadily, and keep looking at the floor.',
    ],
    mistakes: ['Throwing the head back', 'Holding your breath'],
    keys: superman(),
  },
  {
    id: 'chair-squat',
    name: 'Chair squat',
    summary: 'Sit down to a chair and stand back up: the safest way to learn the squat.',
    pattern: 'squat',
    muscles: ['quads', 'glutes'],
    equipment: ['chair'],
    level: 1,
    unit: 'reps',
    met: 3.5,
    cues: [
      'Stand in front of a chair, feet shoulder-width apart, arms forward.',
      'Push your hips back and bend your knees to sit down lightly.',
      'Drive through your whole foot to stand back up.',
    ],
    mistakes: ['Dropping onto the chair', 'Knees caving inwards'],
    harder: 'squat',
    keys: chairSquat(),
    props: [{ kind: 'chair', x: 62, w: 32, h: 26 }],
  },
  {
    id: 'squat',
    name: 'Bodyweight squat',
    summary: 'The king of leg exercises. Thighs, glutes and the biggest calorie burn per rep.',
    pattern: 'squat',
    muscles: ['quads', 'glutes', 'core'],
    equipment: ['none'],
    level: 2,
    unit: 'reps',
    met: 5,
    cues: [
      'Feet shoulder-width apart, toes turned out a little.',
      'Sit your hips back and down, chest up, arms forward for balance.',
      'Go as low as you can with heels on the floor, ideally thighs level with the floor.',
      'Stand up by pushing the floor away.',
    ],
    mistakes: ['Heels lifting', 'Knees caving in', 'Rounding the back at the bottom'],
    easier: 'chair-squat',
    harder: 'split-squat',
    keys: squat(),
  },
  {
    id: 'split-squat',
    name: 'Split squat',
    summary: 'One leg at a time: more load on each leg without any weights.',
    pattern: 'lunge',
    muscles: ['quads', 'glutes'],
    equipment: ['none'],
    level: 2,
    unit: 'reps',
    perSide: true,
    met: 4,
    cues: [
      'Take a long step forward and stay there, back heel up.',
      'Lower straight down until your back knee nearly touches the floor.',
      'Push through the front heel to rise. Finish one side, then switch.',
    ],
    mistakes: ['Front knee caving in', 'Leaning far forward'],
    easier: 'squat',
    harder: 'bulgarian-split-squat',
    keys: splitSquat(),
  },
  {
    id: 'bulgarian-split-squat',
    name: 'Bulgarian split squat',
    summary: 'Rear foot on the bed: one of the hardest, best leg exercises there is.',
    pattern: 'lunge',
    muscles: ['quads', 'glutes'],
    equipment: ['bed'],
    level: 4,
    unit: 'reps',
    perSide: true,
    met: 5,
    cues: [
      'Stand a big step in front of the bed and rest the top of your back foot on it.',
      'Lower until your front thigh is close to level, chest tall.',
      'Drive up through your front heel. Hold a wall for balance at first.',
    ],
    mistakes: ['Front foot too close to the bed', 'Bouncing off the bottom'],
    easier: 'split-squat',
    keys: bulgarianSplitSquat(),
    props: [BED_LEFT],
  },
  {
    id: 'reverse-lunge',
    name: 'Reverse lunge',
    summary: 'Step back and lower: easier on the knees than a forward lunge, great for balance.',
    pattern: 'lunge',
    muscles: ['quads', 'glutes', 'hamstrings'],
    equipment: ['none'],
    level: 2,
    unit: 'reps',
    perSide: true,
    met: 4,
    cues: [
      'Stand tall, then take a long step back with one foot.',
      'Lower until your back knee nearly touches the floor.',
      'Push through the front heel to return to standing. Alternate legs.',
    ],
    mistakes: ['Short steps that push the front knee forward', 'Leaning over'],
    easier: 'split-squat',
    keys: reverseLunge(),
  },
  {
    id: 'wall-sit',
    name: 'Wall sit',
    summary: 'An invisible chair against the wall: burning thighs, zero impact.',
    pattern: 'squat',
    muscles: ['quads', 'glutes'],
    equipment: ['wall'],
    level: 2,
    unit: 'seconds',
    met: 3.5,
    cues: [
      'Back flat against the wall, slide down until your knees are at about 90°.',
      'Knees over your ankles, weight in your heels.',
      'Hold and breathe. Slide a little higher if it’s too much.',
    ],
    mistakes: ['Knees past the toes', 'Hands pushing on the thighs'],
    keys: wallSit(),
    props: [{ kind: 'wall', x: 60 }],
  },
  {
    id: 'calf-raise',
    name: 'Calf raise',
    summary: 'Up onto your toes and slowly down. Do them on a step for a bigger stretch.',
    pattern: 'squat',
    muscles: ['calves'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    met: 2.8,
    cues: [
      'Stand tall, a hand on the wall for balance.',
      'Rise as high onto your toes as you can.',
      'Pause, then lower slowly.',
    ],
    mistakes: ['Bouncing', 'Rolling onto the outside of the foot'],
    keys: calfRaise(),
  },
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    summary: 'Lying on your back, drive your hips up: glutes and hamstrings, easy on the back.',
    pattern: 'hinge',
    muscles: ['glutes', 'hamstrings', 'core'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    met: 3,
    cues: [
      'Lie on your back, knees bent, feet flat and close to your hips.',
      'Squeeze your glutes and lift your hips until your body is straight from shoulders to knees.',
      'Pause at the top, then lower slowly.',
    ],
    mistakes: ['Arching the lower back instead of squeezing the glutes', 'Feet too far away'],
    harder: 'single-leg-glute-bridge',
    keys: gluteBridge(),
  },
  {
    id: 'single-leg-glute-bridge',
    name: 'Single-leg glute bridge',
    summary: 'The bridge on one leg: twice the work for each side.',
    pattern: 'hinge',
    muscles: ['glutes', 'hamstrings', 'core'],
    equipment: ['none'],
    level: 3,
    unit: 'reps',
    perSide: true,
    met: 3.5,
    cues: [
      'Set up for a bridge, then straighten one leg.',
      'Drive through the planted heel to lift your hips level.',
      'Lower slowly. If your hips tilt or it cramps, switch to two legs for the rest of the set.',
    ],
    mistakes: ['Hips tilting to one side', 'Pushing through the toes'],
    easier: 'glute-bridge',
    harder: 'hip-thrust',
    keys: gluteBridge(true),
  },
  {
    id: 'hip-thrust',
    name: 'Hip thrust',
    summary: 'Upper back on the bed, hips drive up: the strongest bodyweight glute builder.',
    pattern: 'hinge',
    muscles: ['glutes', 'hamstrings'],
    equipment: ['bed'],
    level: 3,
    unit: 'reps',
    met: 3.5,
    cues: [
      'Sit with your upper back against the edge of the bed, knees bent, feet flat.',
      'Drive your hips up until your body is level from shoulders to knees.',
      'Squeeze hard at the top for a second, chin tucked, then lower.',
    ],
    mistakes: ['Arching the lower back', 'Feet too close'],
    easier: 'glute-bridge',
    keys: hipThrust(),
    props: [BED_LEFT],
  },
  {
    id: 'single-leg-rdl',
    name: 'Single-leg Romanian deadlift',
    summary: 'Hinge on one leg: hamstrings, glutes and balance.',
    pattern: 'hinge',
    muscles: ['hamstrings', 'glutes', 'core'],
    equipment: ['none'],
    level: 3,
    unit: 'reps',
    perSide: true,
    met: 3.5,
    cues: [
      'Stand on one leg with a soft knee.',
      'Hinge at the hips, reaching your other leg straight back as your chest lowers.',
      'Keep your back flat; stop when you feel the back of your thigh stretch.',
      'Return to standing. A fingertip on the wall is fine while you learn.',
    ],
    mistakes: ['Rounding the back', 'Twisting the hips open'],
    easier: 'good-morning',
    keys: singleLegRdl(),
  },
  {
    id: 'good-morning',
    name: 'Good morning',
    summary: 'Arms folded, hinge at the hips: teaches the hinge and stretches the hamstrings.',
    pattern: 'hinge',
    muscles: ['hamstrings', 'glutes', 'back'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    met: 3,
    cues: [
      'Feet hip-width apart, arms folded across your chest.',
      'Push your hips back and tip forward with a flat back, knees soft.',
      'Stop when you feel the hamstrings stretch, then stand by squeezing your glutes.',
    ],
    mistakes: ['Rounding the back', 'Bending the knees into a squat'],
    harder: 'single-leg-rdl',
    keys: goodMorning(),
  },
  {
    id: 'knee-plank',
    name: 'Knee plank',
    summary: 'A plank from the knees: the starting point for core strength.',
    pattern: 'core',
    muscles: ['core', 'shoulders'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 3,
    cues: [
      'Forearms on the floor, elbows under shoulders, knees down.',
      'Straight line from knees to head.',
      'Squeeze your stomach and breathe.',
    ],
    mistakes: ['Hips high in the air', 'Holding your breath'],
    harder: 'plank',
    keys: plank(true),
  },
  {
    id: 'plank',
    name: 'Plank',
    summary: 'Hold a straight line on your forearms: the foundation of a strong midsection.',
    pattern: 'core',
    muscles: ['core', 'shoulders', 'glutes'],
    equipment: ['none'],
    level: 2,
    unit: 'seconds',
    met: 3.5,
    cues: [
      'Forearms on the floor, elbows under shoulders, legs straight behind you.',
      'Squeeze your glutes and brace your stomach.',
      'Keep a straight line from head to heels and breathe slowly.',
    ],
    mistakes: ['Hips sagging', 'Hips piking up', 'Holding your breath'],
    easier: 'knee-plank',
    harder: 'hollow-hold',
    keys: plank(),
  },
  {
    id: 'dead-bug',
    name: 'Dead bug',
    summary:
      'On your back, extend opposite arm and leg: core control that protects the lower back.',
    pattern: 'core',
    muscles: ['core'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    perSide: true,
    met: 3,
    cues: [
      'Lie on your back, arms up to the ceiling, knees bent at 90° above your hips.',
      'Press your lower back into the floor.',
      'Slowly lower one arm and the opposite leg towards the floor, then return. Alternate.',
    ],
    mistakes: ['Lower back lifting off the floor', 'Moving fast'],
    harder: 'hollow-hold',
    keys: deadBug(),
  },
  {
    id: 'bird-dog',
    name: 'Bird dog',
    summary:
      'On hands and knees, reach one arm and the opposite leg long: balance and a stable spine.',
    pattern: 'core',
    muscles: ['core', 'glutes', 'back'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    perSide: true,
    met: 2.8,
    cues: [
      'Hands under shoulders, knees under hips, back flat.',
      'Reach one arm forward and the opposite leg back until both are level with your body.',
      'Hold for a breath, return, and switch sides.',
    ],
    mistakes: ['Twisting the hips', 'Lifting the leg too high and arching'],
    keys: birdDog(),
  },
  {
    id: 'hollow-hold',
    name: 'Hollow hold',
    summary: 'A banana shape on your back: the gymnast’s core exercise.',
    pattern: 'core',
    muscles: ['core'],
    equipment: ['none'],
    level: 3,
    unit: 'seconds',
    met: 3.5,
    cues: [
      'Lie on your back and press your lower back into the floor.',
      'Lift your shoulders, arms and straight legs a little off the floor.',
      'Hold. Bend your knees or bring your arms in to make it easier.',
    ],
    mistakes: ['Lower back lifting', 'Straining the neck'],
    easier: 'dead-bug',
    keys: hollowHold(),
  },
  {
    id: 'reverse-crunch',
    name: 'Reverse crunch',
    summary: 'Curl your knees to your chest: the lower part of the abs.',
    pattern: 'core',
    muscles: ['core'],
    equipment: ['none'],
    level: 2,
    unit: 'reps',
    met: 3,
    cues: [
      'Lie on your back, knees bent, hands by your sides.',
      'Curl your hips off the floor, bringing your knees to your chest.',
      'Lower slowly without letting your feet crash down.',
    ],
    mistakes: ['Swinging the legs', 'Pulling with the neck'],
    easier: 'dead-bug',
    keys: reverseCrunch(),
  },
  {
    id: 'mountain-climber',
    name: 'Mountain climber',
    summary: 'Drive your knees in from a push-up position: core and cardio together.',
    pattern: 'cardio',
    muscles: ['core', 'heart', 'shoulders'],
    equipment: ['none'],
    level: 3,
    unit: 'seconds',
    met: 8,
    cues: [
      'Start in a push-up position.',
      'Drive one knee towards your chest, then switch legs.',
      'Keep your hips level and your shoulders over your hands.',
    ],
    mistakes: ['Hips bouncing up and down', 'Hands drifting forward'],
    easier: 'march-in-place',
    keys: mountainClimber(),
  },
  {
    id: 'march-in-place',
    name: 'High march',
    summary:
      'March on the spot bringing your knees up: low-impact cardio that gets your heart going.',
    pattern: 'cardio',
    muscles: ['heart', 'quads', 'core'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 4,
    cues: [
      'Stand tall and drive one knee up to hip height.',
      'Swing the opposite arm.',
      'Switch legs in a steady rhythm.',
    ],
    mistakes: ['Leaning back', 'Shuffling instead of lifting the knees'],
    harder: 'mountain-climber',
    keys: marchInPlace(),
  },
  {
    id: 'step-back-burpee',
    name: 'Step-back burpee',
    summary: 'A full burpee without the jumps: easy on the knees, hard on the lungs.',
    pattern: 'cardio',
    muscles: ['heart', 'quads', 'chest', 'core'],
    equipment: ['none'],
    level: 3,
    unit: 'reps',
    met: 8,
    cues: [
      'Squat down and put your hands on the floor.',
      'Step your feet back one at a time into a plank.',
      'Step them back in, stand up and reach overhead.',
    ],
    mistakes: ['Hips sagging in the plank', 'Rounding the back when you bend down'],
    easier: 'march-in-place',
    keys: stepBackBurpee(),
    peak: 2,
  },
  {
    id: 'incline-walk',
    name: 'Incline treadmill walk',
    summary: 'Walking uphill: burns close to a jog with far less stress on your joints.',
    pattern: 'cardio',
    muscles: ['heart', 'glutes', 'calves'],
    equipment: ['treadmill'],
    level: 1,
    unit: 'seconds',
    met: 5.3,
    cues: [
      'Speed around 4 km/h, incline 4 to 8.',
      'Stand tall and don’t hold the handrails, or only lightly.',
      'You should be able to talk, but not sing.',
    ],
    mistakes: ['Hanging on the rails', 'Leaning far forward'],
    keys: walkCycle(0.85),
    props: [{ kind: 'treadmill', x: 66, w: 96 }],
  },
  {
    id: 'walk',
    name: 'Brisk walk',
    summary:
      'The most underrated fat-loss tool: every step adds up and costs nothing to recover from.',
    pattern: 'cardio',
    muscles: ['heart', 'glutes', 'calves'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 3.8,
    cues: [
      'Walk at a pace where talking takes a little effort.',
      'Swing your arms and stand tall.',
      'Indoors or out, treadmill or hallway, it all counts.',
    ],
    mistakes: ['Strolling so slowly the heart rate never rises'],
    keys: walkCycle(1),
  },
  {
    id: 'cat-cow',
    name: 'Cat-cow',
    summary: 'Round and arch your back on hands and knees: loosens the spine after sitting.',
    pattern: 'mobility',
    muscles: ['back', 'core'],
    equipment: ['none'],
    level: 1,
    unit: 'reps',
    met: 2.3,
    cues: [
      'On hands and knees, breathe in and let your stomach drop as you look up.',
      'Breathe out and round your back up, chin to chest.',
      'Move slowly with your breath.',
    ],
    mistakes: ['Rushing', 'Bending the elbows'],
    keys: catCow(),
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Kneeling hip flexor stretch',
    summary: 'Opens the front of the hips that hours of sitting tighten up.',
    pattern: 'mobility',
    muscles: ['quads', 'glutes'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    perSide: true,
    met: 2.3,
    cues: [
      'Kneel on one knee, other foot flat in front.',
      'Squeeze the glute of the kneeling leg and shift your hips forward gently.',
      'Hold and breathe, then switch sides.',
    ],
    mistakes: ['Arching the lower back', 'Leaning forward instead of shifting the hips'],
    keys: hipFlexorStretch(),
    peak: 1,
  },
  {
    id: 'childs-pose',
    name: 'Child’s pose',
    summary: 'Sit back on your heels with arms long: a calm stretch for the back and shoulders.',
    pattern: 'mobility',
    muscles: ['back', 'shoulders'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 2,
    cues: [
      'Kneel, sit back towards your heels and walk your hands forward.',
      'Let your chest sink towards the floor.',
      'Breathe slowly into your back.',
    ],
    mistakes: ['Forcing the hips down if your knees complain'],
    keys: childsPose(),
  },
  {
    id: 'arm-circles',
    name: 'Arm circles',
    summary: 'Big slow circles to warm up the shoulders before pushing and pulling.',
    pattern: 'mobility',
    muscles: ['shoulders'],
    equipment: ['none'],
    level: 1,
    unit: 'seconds',
    met: 2.5,
    cues: [
      'Stand tall with arms out.',
      'Make big, slow circles forwards, then backwards.',
      'Keep your shoulders down away from your ears.',
    ],
    mistakes: ['Shrugging', 'Tiny fast circles'],
    keys: armCircles(),
  },
];

export const exerciseById = (id: string): Exercise | undefined =>
  EXERCISES.find((e) => e.id === id);
