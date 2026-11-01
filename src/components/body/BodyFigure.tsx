import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Site } from '@/lib/body';

/**
 * A calm, front-view anatomical figure for measuring. Drawn from a handful of landmark points
 * per side, smoothed into curves and mirrored, with a male and a female build. A tape can wrap
 * any measuring site: the back of the loop passes behind the body, the front crosses over it,
 * and the view glides in to the site being measured.
 */

type Pt = [number, number];
const W = 200;
const H = 420;
const CX = W / 2;

/** Catmull-Rom through the points, as cubic Béziers. */
function smooth(points: Pt[], closed = true): string {
  const p = closed
    ? [points[points.length - 1]!, ...points, points[0]!, points[1]!]
    : [points[0]!, ...points, points[points.length - 1]!];
  let d = `M${points[0]![0].toFixed(1)},${points[0]![1].toFixed(1)}`;
  const n = closed ? points.length : points.length - 1;
  for (let i = 1; i <= n; i++) {
    const p0 = p[i - 1]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return closed ? `${d} Z` : d;
}

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y] as Pt);

interface Build {
  /** Right side of the body, from the side of the neck down to the crotch, outer edge. */
  side: Pt[];
  /** Right arm, a closed loop from the shoulder round the hand and back up the inside. */
  arm: Pt[];
  sites: Record<Site, { y: number; cx: number; hw: number }>;
}

const BUILDS: Record<'male' | 'female', Build> = {
  male: {
    side: [
      [109, 58],
      [111, 72],
      [126, 79],
      [143, 87],
      [147, 101],
      [139, 121],
      [137, 148],
      [131, 176],
      [127, 198],
      [131, 216],
      [134, 236],
      [136, 268],
      [133, 300],
      [127, 326],
      [129, 352],
      [124, 390],
      [127, 408],
      [108, 410],
      [106, 392],
      [107, 352],
      [106, 326],
      [104, 290],
      [101, 256],
    ],
    arm: [
      [143, 87],
      [153, 96],
      [157, 122],
      [160, 160],
      [163, 192],
      [168, 228],
      [172, 262],
      [174, 286],
      [166, 292],
      [161, 264],
      [154, 230],
      [149, 194],
      [145, 160],
      [141, 126],
      [139, 112],
    ],
    sites: {
      neckCm: { y: 66, cx: CX, hw: 10.5 },
      chestCm: { y: 120, cx: CX, hw: 38 },
      armCm: { y: 146, cx: 151.5, hw: 8.5 },
      waistNarrowCm: { y: 184, cx: CX, hw: 29 },
      waistCm: { y: 198, cx: CX, hw: 27.5 },
      hipsCm: { y: 238, cx: CX, hw: 34 },
      thighCm: { y: 276, cx: 118.5, hw: 17.5 },
    },
  },
  female: {
    side: [
      [108, 58],
      [109, 72],
      [121, 79],
      [134, 86],
      [138, 100],
      [134, 118],
      [135, 140],
      [128, 166],
      [121, 184],
      [124, 204],
      [134, 226],
      [139, 248],
      [137, 280],
      [131, 310],
      [126, 330],
      [127, 354],
      [122, 392],
      [125, 408],
      [107, 410],
      [106, 392],
      [107, 354],
      [106, 330],
      [104, 296],
      [101, 262],
    ],
    arm: [
      [134, 86],
      [143, 95],
      [147, 120],
      [150, 158],
      [153, 190],
      [158, 226],
      [162, 258],
      [164, 282],
      [157, 288],
      [152, 260],
      [146, 228],
      [141, 192],
      [138, 160],
      [134, 126],
      [132, 110],
    ],
    sites: {
      neckCm: { y: 66, cx: CX, hw: 9 },
      chestCm: { y: 124, cx: CX, hw: 35 },
      armCm: { y: 146, cx: 143, hw: 7.5 },
      waistNarrowCm: { y: 182, cx: CX, hw: 21.5 },
      waistCm: { y: 198, cx: CX, hw: 23.5 },
      hipsCm: { y: 244, cx: CX, hw: 38.5 },
      thighCm: { y: 284, cx: 119, hw: 18.5 },
    },
  },
};

export function siteGeometry(sex: 'male' | 'female', site: Site) {
  return BUILDS[sex].sites[site];
}

/** The tape around a site: the back arc (behind the body) and the front arc (over it). */
function tapeArcs(cx: number, y: number, hw: number) {
  const ry = Math.max(2.6, hw * 0.2);
  const back = `M${cx - hw},${y} A${hw},${ry} 0 0 1 ${cx + hw},${y}`;
  const front = `M${cx - hw},${y} A${hw},${ry} 0 0 0 ${cx + hw},${y}`;
  return { back, front, ry };
}

const FULL: [number, number, number, number] = [0, 0, W, H];
const LABELLED: [number, number, number, number] = [-78, 4, W + 156, H - 4];
const LEFT_SIDE = new Set<Site>(['neckCm', 'waistNarrowCm', 'hipsCm']);

/** The view box that frames a site, or the whole body. */
function frameFor(sex: 'male' | 'female', site: Site | null): [number, number, number, number] {
  if (!site) return FULL;
  const g = BUILDS[sex].sites[site];
  const h = site === 'neckCm' ? 150 : site === 'thighCm' || site === 'armCm' ? 210 : 230;
  const w = h * (W / H) * 1.25;
  const x = Math.min(W - w, Math.max(0, g.cx - w / 2));
  const y = Math.min(H - h, Math.max(0, g.y - h * 0.48));
  return [x, y, w, h];
}

/** Sides and heights for labels so they never overlap: at least 30 units apart per side. */
function placeLabels(labels: Label[], sites: Build['sites']) {
  const out: Array<{ l: Label; ly: number; right: boolean }> = [];
  for (const right of [false, true]) {
    let prev = -Infinity;
    labels
      .filter((l) => LEFT_SIDE.has(l.site) !== right)
      .sort((a, b) => sites[a.site].y - sites[b.site].y)
      .forEach((l) => {
        const ly = Math.max(sites[l.site].y, prev + 30);
        prev = ly;
        out.push({ l, ly, right });
      });
  }
  return out;
}

export interface Label {
  site: Site;
  text: string;
  sub?: string;
  tone?: 'down' | 'up' | 'flat';
}

export function BodyFigure({
  sex,
  site = null,
  zoom = false,
  labels = [],
  onPick,
  class: cls,
}: {
  sex: 'male' | 'female';
  /** The site with an animated tape. */
  site?: Site | null;
  /** Glide in to the site. */
  zoom?: boolean;
  /** Values to pin beside sites, with leader lines (whole-body view). */
  labels?: Label[];
  onPick?: (site: Site) => void;
  class?: string;
}) {
  const b = BUILDS[sex];
  const outline = smooth([...b.side, ...mirror(b.side).reverse()]);
  const armR = smooth(b.arm);
  const armL = smooth(mirror(b.arm));
  // A unique gradient id: two figures on a page must not share one, or a hidden figure's
  // gradient blanks the visible one.
  const skin = useMemo(() => `skin-${sex}-${Math.random().toString(36).slice(2, 8)}`, [sex]);
  // Labels need room either side of the body.
  const target = zoom ? frameFor(sex, site) : labels.length ? LABELLED : FULL;
  const [box, setBox] = useState(target);
  const boxRef = useRef(box);
  const raf = useRef(0);

  // Glide the view box to the new frame.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = boxRef.current;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      boxRef.current = target;
      setBox(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 650);
      const e = 1 - (1 - k) ** 4;
      const next = from.map((v, i) => v + (target[i]! - v) * e) as typeof target;
      boxRef.current = next;
      setBox(next);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target.join(',')]);

  const g = site ? b.sites[site] : null;
  const arcs = g ? tapeArcs(g.cx, g.y, g.hw) : null;

  return (
    <svg
      viewBox={box.map((n) => n.toFixed(2)).join(' ')}
      class={`body-figure ${cls ?? ''}`}
      role="img"
      aria-label={site ? 'Where the tape goes' : 'Body measurements'}
    >
      <defs>
        <linearGradient id={skin} x1="0" x2="1">
          <stop offset="0" stop-color="var(--body-edge)" />
          <stop offset="0.5" stop-color="var(--body-mid)" />
          <stop offset="1" stop-color="var(--body-edge)" />
        </linearGradient>
      </defs>
      {arcs && <path key={`b-${site}`} d={arcs.back} class="tape-back" />}
      <g class="body-shape">
        <path d={armR} fill={`url(#${skin})`} />
        <path d={armL} fill={`url(#${skin})`} />
        <path d={outline} fill={`url(#${skin})`} />
        <ellipse cx={CX} cy={36} rx={18.5} ry={22.5} fill={`url(#${skin})`} />
        {/* Soft landmarks: collarbones, navel, knees. */}
        <path
          d={`M${CX - 24},82 Q${CX - 10},86 ${CX - 3},84 M${CX + 24},82 Q${CX + 10},86 ${CX + 3},84`}
          class="body-line"
        />
        <circle cx={CX} cy={196} r={1.6} class="body-dot" />
        <path
          d={`M${CX - 25},${sex === 'male' ? 326 : 330} q4,3 8,0 M${CX + 17},${sex === 'male' ? 326 : 330} q4,3 8,0`}
          class="body-line"
        />
      </g>
      {arcs && g && (
        <g key={`f-${site}`}>
          <path d={arcs.front} class="tape-front" pathLength={1} />
          <path d={arcs.front} class="tape-ticks" />
          <circle cx={g.cx + g.hw} cy={g.y} r={2.6} class="tape-end" />
        </g>
      )}
      {placeLabels(labels, b.sites).map(({ l, ly, right }) => {
        const s = b.sites[l.site];
        const lx = right ? W + 74 : -74;
        const tx = right ? s.cx + s.hw : s.cx - s.hw;
        const { back, front } = tapeArcs(s.cx, s.y, s.hw);
        return (
          <g
            key={l.site}
            class={`body-label ${onPick ? 'body-label-pick' : ''}`}
            onClick={() => onPick?.(l.site)}
            role={onPick ? 'button' : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-label={onPick ? `${l.text} ${l.sub ?? ''}` : undefined}
            onKeyDown={(e) => {
              if (onPick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPick(l.site);
              }
            }}
          >
            <path d={back} class="tape-back tape-back-quiet" />
            <path d={front} class="tape-front tape-front-quiet" />
            <polyline
              points={`${tx},${s.y} ${right ? tx + 8 : tx - 8},${ly} ${right ? lx - 2 : lx + 2},${ly}`}
              class="body-leader"
            />
            <text x={lx} y={ly - 3} text-anchor={right ? 'end' : 'start'} class="body-label-text">
              {l.text}
            </text>
            {l.sub && (
              <text
                x={lx}
                y={ly + 10}
                text-anchor={right ? 'end' : 'start'}
                class={`body-label-sub body-${l.tone ?? 'flat'}`}
              >
                {l.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
