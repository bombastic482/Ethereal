import { useEffect, useRef } from 'preact/hooks';
import {
  FLOOR,
  loopLength,
  poseAt,
  solve,
  type Joints,
  type Key,
  type Point,
} from '@/lib/train/figure';
import type { Muscle, SceneProp } from '@/lib/train/exercises';

/**
 * An animated exercise demo: a side-view figure looping through the exercise's key poses, with
 * the working muscles lit in the brand colour and the props it needs (bed, chair, doorframe…).
 *
 * The SVG is built once and its attributes are updated every frame, so a page full of demos
 * stays smooth. Demos only run while on screen. With Reduce Motion on, the figure holds the
 * working position and shows the starting position as a faint ghost instead.
 */

const W = 220;
const H = 140;

type Seg =
  | 'thighF'
  | 'shinF'
  | 'footF'
  | 'upperF'
  | 'foreF'
  | 'torso'
  | 'neck'
  | 'thighN'
  | 'shinN'
  | 'footN'
  | 'upperN'
  | 'foreN';

const WIDTH: Record<Seg, number> = {
  thighF: 8.5,
  shinF: 7,
  footF: 5,
  upperF: 7,
  foreF: 6,
  torso: 13,
  neck: 6,
  thighN: 9,
  shinN: 7.5,
  footN: 5.5,
  upperN: 7.5,
  foreN: 6.5,
};

function ends(j: Joints, s: Seg): [Point, Point] {
  switch (s) {
    case 'thighF':
      return [j.hip, j.leg.f[0]];
    case 'shinF':
      return [j.leg.f[0], j.leg.f[1]];
    case 'footF':
      return [j.leg.f[1], j.toe.f];
    case 'upperF':
      return [j.shoulder, j.arm.f[0]];
    case 'foreF':
      return [j.arm.f[0], j.arm.f[1]];
    case 'torso':
      return [j.hip, j.shoulder];
    case 'neck':
      return [j.shoulder, j.neck];
    case 'thighN':
      return [j.hip, j.leg.n[0]];
    case 'shinN':
      return [j.leg.n[0], j.leg.n[1]];
    case 'footN':
      return [j.leg.n[1], j.toe.n];
    case 'upperN':
      return [j.shoulder, j.arm.n[0]];
    case 'foreN':
      return [j.arm.n[0], j.arm.n[1]];
  }
}

const FAR: Seg[] = ['thighF', 'shinF', 'footF', 'upperF', 'foreF'];
const BODY: Seg[] = ['torso', 'neck'];
const NEAR: Seg[] = ['thighN', 'shinN', 'footN', 'upperN', 'foreN'];

/** Which segments light up for each muscle group, and over which part of the segment. */
const GLOW: Record<Muscle, Array<[Seg, number, number]>> = {
  chest: [['torso', 0.55, 0.92]],
  back: [['torso', 0.45, 0.92]],
  shoulders: [
    ['upperN', 0, 0.35],
    ['upperF', 0, 0.35],
  ],
  triceps: [
    ['upperN', 0.3, 1],
    ['upperF', 0.3, 1],
  ],
  biceps: [
    ['upperN', 0.25, 1],
    ['upperF', 0.25, 1],
  ],
  core: [['torso', 0.12, 0.55]],
  glutes: [
    ['torso', 0, 0.16],
    ['thighN', 0, 0.3],
    ['thighF', 0, 0.3],
  ],
  quads: [
    ['thighN', 0.12, 0.95],
    ['thighF', 0.12, 0.95],
  ],
  hamstrings: [
    ['thighN', 0.25, 0.95],
    ['thighF', 0.25, 0.95],
  ],
  calves: [
    ['shinN', 0.05, 0.6],
    ['shinF', 0.05, 0.6],
  ],
  heart: [['torso', 0.6, 0.8]],
};

const at = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

const f2 = (n: number) => n.toFixed(2);
const lineAttrs = (a: Point, b: Point) => ({
  x1: f2(a[0]),
  y1: f2(a[1]),
  x2: f2(b[0]),
  y2: f2(b[1]),
});

/** The time into the loop at which the figure sits exactly on key `peak`. */
function peakTime(keys: readonly Key[], peak: number): number {
  const cycle = loopLength(keys);
  const t =
    keys.slice(0, peak + 1).reduce((s, k) => s + k.ms, 0) +
    keys.slice(0, peak).reduce((s, k) => s + (k.hold ?? 0), 0);
  return Math.min(t, Math.max(0, cycle - 1));
}

function shadowOf(j: Joints) {
  const xs = [j.hip[0], j.leg.n[1][0], j.leg.f[1][0], j.arm.n[1][0]];
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return { cx: f2((lo + hi) / 2), rx: f2(Math.max(14, (hi - lo) / 2 + 8)) };
}

function Prop({ p }: { p: SceneProp }) {
  switch (p.kind) {
    case 'mat':
      return <rect x={p.x} y={FLOOR - 2} width={p.w} height={3} rx={1.5} class="fig-mat" />;
    case 'bed':
      return (
        <g class="fig-prop">
          <rect x={p.x} y={FLOOR - p.h} width={p.w} height={p.h} rx={3} class="fig-prop-body" />
          <rect
            x={p.x + 1.5}
            y={FLOOR - p.h - 5}
            width={p.w - 3}
            height={7}
            rx={3.5}
            class="fig-prop-soft"
          />
        </g>
      );
    case 'chair': {
      const seat = FLOOR - p.h;
      const back = p.face === 'left' ? p.x + p.w - 3 : p.x;
      return (
        <g class="fig-prop">
          <rect x={p.x} y={seat} width={p.w} height={4} rx={2} class="fig-prop-body" />
          <rect
            x={p.x + 2}
            y={seat + 3}
            width={3}
            height={p.h - 3}
            rx={1.5}
            class="fig-prop-body"
          />
          <rect
            x={p.x + p.w - 5}
            y={seat + 3}
            width={3}
            height={p.h - 3}
            rx={1.5}
            class="fig-prop-body"
          />
          {p.back !== false && (
            <rect x={back} y={seat - 26} width={3} height={27} rx={1.5} class="fig-prop-body" />
          )}
        </g>
      );
    }
    case 'door':
      return (
        <g class="fig-prop">
          <rect x={p.x} y={14} width={6} height={FLOOR - 14} rx={1.5} class="fig-prop-body" />
          <rect x={p.x - 30} y={10} width={36} height={5} rx={1.5} class="fig-prop-body" />
        </g>
      );
    case 'wall':
      return <rect x={p.x} y={10} width={5} height={FLOOR - 10} rx={1.5} class="fig-prop-body" />;
    case 'table': {
      const top = FLOOR - p.h;
      return (
        <g class="fig-prop">
          <rect x={p.x} y={top} width={p.w} height={4} rx={1.5} class="fig-prop-body" />
          <rect x={p.x + 2} y={top + 3} width={3} height={p.h - 3} rx={1.5} class="fig-prop-body" />
          <rect
            x={p.x + p.w - 5}
            y={top + 3}
            width={3}
            height={p.h - 3}
            rx={1.5}
            class="fig-prop-body"
          />
        </g>
      );
    }
    case 'step':
      return (
        <rect x={p.x} y={FLOOR - p.h} width={p.w} height={p.h} rx={2.5} class="fig-prop-body" />
      );
    case 'treadmill':
      return (
        <g class="fig-prop">
          <rect x={p.x} y={FLOOR - 9} width={p.w} height={8} rx={4} class="fig-prop-body" />
          <rect x={p.x + 3} y={FLOOR - 11} width={p.w - 10} height={3} rx={1.5} class="fig-belt" />
          <line
            x1={p.x + p.w - 6}
            y1={FLOOR - 8}
            x2={p.x + p.w - 2}
            y2={FLOOR - 64}
            class="fig-rail"
          />
          <rect
            x={p.x + p.w - 14}
            y={FLOOR - 70}
            width={18}
            height={8}
            rx={3}
            class="fig-prop-body"
          />
        </g>
      );
  }
}

export interface FigureProps {
  keys: readonly Key[];
  props?: readonly SceneProp[];
  muscles?: readonly Muscle[];
  /** Index of the key that shows the working position, used when motion is reduced. */
  peak?: number;
  /** Plays faster or slower than the authored tempo. */
  speed?: number;
  label: string;
  class?: string;
  /** Stops the loop (for example while a workout is paused). */
  paused?: boolean;
  /** Draws a towel from the hands to the feet. */
  towel?: boolean;
}

export function Figure({
  keys,
  props = [],
  muscles = [],
  peak = 1,
  speed = 1,
  label,
  class: cls,
  paused = false,
  towel = false,
}: FigureProps) {
  const svg = useRef<SVGSVGElement>(null);
  const segs = useRef<Partial<Record<Seg, SVGLineElement>>>({});
  const glows = useRef<SVGLineElement[]>([]);
  const head = useRef<SVGCircleElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const strap = useRef<SVGLineElement>(null);
  // Only the near side lights up, so a far limb never glows through the body. Body glow sits
  // under the near limbs, limb glow on top of them.
  const glowSpecs = [...new Set(muscles)]
    .flatMap((m) => GLOW[m] ?? [])
    .filter(([s]) => !FAR.includes(s));
  const bodyGlow = glowSpecs.filter(([s]) => BODY.includes(s));
  const nearGlow = glowSpecs.filter(([s]) => NEAR.includes(s));

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const set = (el: Element | null | undefined, attrs: Record<string, string>) => {
      if (el) for (const k in attrs) el.setAttribute(k, attrs[k]!);
    };
    const draw = (ms: number) => {
      const j = solve(poseAt(keys, ms));
      for (const s of [...FAR, ...BODY, ...NEAR]) set(segs.current[s], lineAttrs(...ends(j, s)));
      [...bodyGlow, ...nearGlow].forEach(([s, t0, t1], i) => {
        const [a, b] = ends(j, s);
        set(glows.current[i], lineAttrs(at(a, b, t0), at(a, b, t1)));
      });
      set(strap.current, lineAttrs(j.arm.n[1], j.toe.n));
      set(head.current, { cx: f2(j.head[0]), cy: f2(j.head[1]) });
      set(shadow.current, shadowOf(j));
    };

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cycle = loopLength(keys);
    if (still || paused || keys.length < 2) {
      draw(peakTime(keys, peak));
      return;
    }

    let raf = 0;
    let start = performance.now();
    let visible = true;
    const tick = (now: number) => {
      draw(((now - start) * speed) % cycle);
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      run();
    });
    io.observe(el);
    const onVis = () => run();
    document.addEventListener('visibilitychange', onVis);
    draw(0);
    start = performance.now();
    run();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [keys, speed, paused, peak]);

  // A faint copy of the starting position, shown only when motion is reduced.
  const ghost = solve(keys[0]!.pose);
  // The first paint (and the server render) shows the working position, so a demo is never
  // an empty frame before its script runs.
  const first = solve(poseAt(keys, peakTime(keys, peak)));
  const firstGlow = (specs: Array<[Seg, number, number]>, i: number) => {
    const [s, t0, t1] = specs[i]!;
    const [a, b] = ends(first, s);
    return lineAttrs(at(a, b, t0), at(a, b, t1));
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      class={`fig ${cls ?? ''}`}
      role="img"
      aria-label={label}
    >
      <ellipse ref={shadow} {...shadowOf(first)} cy={FLOOR + 1.5} ry={3.2} class="fig-shadow" />
      <line x1={4} y1={FLOOR} x2={W - 4} y2={FLOOR} class="fig-floor" />
      {props.map((p, i) => (
        <Prop key={i} p={p} />
      ))}
      <g class="fig-ghost" aria-hidden="true">
        {[...FAR, ...BODY, ...NEAR].map((s) => {
          const [a, b] = ends(ghost, s);
          return <line key={s} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke-width={WIDTH[s]} />;
        })}
        <circle cx={ghost.head[0]} cy={ghost.head[1]} r={7} />
      </g>
      <g class="fig-far">
        {FAR.map((s) => (
          <line
            key={s}
            {...lineAttrs(...ends(first, s))}
            ref={(e) => {
              if (e) segs.current[s] = e;
            }}
            stroke-width={WIDTH[s]}
          />
        ))}
      </g>
      <g class="fig-body">
        {BODY.map((s) => (
          <line
            key={s}
            {...lineAttrs(...ends(first, s))}
            ref={(e) => {
              if (e) segs.current[s] = e;
            }}
            stroke-width={WIDTH[s]}
          />
        ))}
        <circle ref={head} cx={f2(first.head[0])} cy={f2(first.head[1])} r={7} />
      </g>
      <g class="fig-glow" aria-hidden="true">
        {bodyGlow.map(([s], i) => (
          <line
            key={i}
            {...firstGlow(bodyGlow, i)}
            ref={(e) => {
              if (e) glows.current[i] = e;
            }}
            stroke-width={WIDTH[s] - 3}
          />
        ))}
      </g>
      {towel && <line ref={strap} {...lineAttrs(first.arm.n[1], first.toe.n)} class="fig-towel" />}
      <g class="fig-near">
        {NEAR.map((s) => (
          <line
            key={s}
            {...lineAttrs(...ends(first, s))}
            ref={(e) => {
              if (e) segs.current[s] = e;
            }}
            stroke-width={WIDTH[s]}
          />
        ))}
      </g>
      <g class="fig-glow" aria-hidden="true">
        {nearGlow.map(([s], i) => (
          <line
            key={i}
            {...firstGlow(nearGlow, i)}
            ref={(e) => {
              if (e) glows.current[bodyGlow.length + i] = e;
            }}
            stroke-width={WIDTH[s] - 2.4}
          />
        ))}
      </g>
    </svg>
  );
}
