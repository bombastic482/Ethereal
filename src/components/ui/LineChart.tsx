import { useRef, useState } from 'preact/hooks';

interface Point {
  x: number;
  y: number;
}
interface Props {
  points: Point[];
  /** Optional raw observations drawn as small dots behind the line (e.g. daily weigh-ins). */
  dots?: Point[];
  /** Optional horizontal goal line. */
  goal?: number;
  xLabel?: (x: number) => string;
  yLabel?: (y: number) => string;
  /** Readout for a scrubbed point; defaults to the axis labels. */
  pointLabel?: (p: Point) => string;
  ariaLabel: string;
}

/** Dependency-free responsive SVG line chart with a filled area and goal line. */
export function LineChart({
  points,
  dots = [],
  goal,
  xLabel = String,
  yLabel = String,
  pointLabel,
  ariaLabel,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 640;
  const H = 260;
  const pad = { l: 48, r: 16, t: 16, b: 32 };
  const xs = points.map((p) => p.x).concat(dots.map((p) => p.x));
  const dataYs = points.map((p) => p.y).concat(dots.map((p) => p.y));
  const dataSpan = Math.max(1, Math.max(...dataYs) - Math.min(...dataYs));
  // Draw the goal line only when it is within reach of the visible data, otherwise the trend flattens into a line.
  const showGoal =
    goal !== undefined &&
    goal >= Math.min(...dataYs) - dataSpan * 2.5 &&
    goal <= Math.max(...dataYs) + dataSpan * 2.5;
  const ys = showGoal ? dataYs.concat([goal]) : dataYs;
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPadding = Math.max(1, (yMax - yMin) * 0.1);
  const y0 = yMin - yPadding;
  const y1 = yMax + yPadding;
  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(' ');
  const area = `${d} L${sx(xMax).toFixed(1)},${(H - pad.b).toFixed(1)} L${sx(xMin).toFixed(1)},${(H - pad.b).toFixed(1)} Z`;
  const yTicks = 4;
  const xTicks = Math.min(6, points.length - 1);
  const last = points[points.length - 1]!;
  // Touch or hover anywhere to read the nearest point; arrows step through them.
  const pick = (clientX: number) => {
    const el = svg.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    let best = 0;
    let dist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(sx(p.x) - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;
  const readout = hp ? (pointLabel ? pointLabel(hp) : `${xLabel(hp.x)} · ${yLabel(hp.y)}`) : '';
  const tipW = Math.max(70, readout.length * 6.6 + 18);
  const tipX = hp ? Math.min(W - pad.r - tipW, Math.max(pad.l, sx(hp.x) - tipW / 2)) : 0;
  const tipY = hp ? (sy(hp.y) - 40 < pad.t ? sy(hp.y) + 14 : sy(hp.y) - 38) : 0;
  return (
    <>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        class="chart h-auto w-full"
        role="group"
        aria-label={`${ariaLabel}. Use the arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHover(null);
        }}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const step = e.key === 'ArrowLeft' ? -1 : 1;
            setHover((h) =>
              Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + step)),
            );
          } else if (e.key === 'Escape') setHover(null);
        }}
      >
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stop-color="var(--color-brand-500)" stop-opacity="0.35" />
            <stop offset="1" stop-color="var(--color-brand-500)" stop-opacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = y0 + ((y1 - y0) * i) / yTicks;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={sy(v)}
                y2={sy(v)}
                stroke="var(--border)"
                stroke-dasharray="2 4"
              />
              <text
                x={pad.l - 8}
                y={sy(v) + 4}
                text-anchor="end"
                font-size="11"
                fill="var(--fg-subtle)"
              >
                {yLabel(v)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = xMin + ((xMax - xMin) * i) / xTicks;
          return (
            <text
              key={i}
              x={sx(v)}
              y={H - 10}
              text-anchor="middle"
              font-size="11"
              fill="var(--fg-subtle)"
            >
              {xLabel(Math.round(v))}
            </text>
          );
        })}
        {showGoal && goal !== undefined && (
          <g>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={sy(goal)}
              y2={sy(goal)}
              stroke="var(--color-accent-500)"
              stroke-dasharray="6 4"
              stroke-width="1.5"
            />
            <text
              x={W - pad.r}
              y={sy(goal) - 6}
              text-anchor="end"
              font-size="11"
              font-weight="600"
              fill="var(--color-accent-500)"
            >
              Goal {yLabel(goal)}
            </text>
          </g>
        )}
        <path d={area} fill="url(#area)" />
        {dots.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r="2.5"
            fill="var(--fg-subtle)"
            opacity="0.55"
          />
        ))}
        <path
          d={d}
          fill="none"
          class="chart-line"
          pathLength={1}
          stroke="var(--color-brand-500)"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          cx={sx(last.x)}
          cy={sy(last.y)}
          r="5"
          fill="var(--bg-elevated)"
          stroke="var(--color-brand-500)"
          stroke-width="2.5"
          class="chart-end"
        />
        {hp && (
          <g class="chart-tip" pointer-events="none">
            <line
              x1={sx(hp.x)}
              x2={sx(hp.x)}
              y1={pad.t}
              y2={H - pad.b}
              stroke="var(--fg-subtle)"
              stroke-dasharray="3 3"
            />
            <circle
              cx={sx(hp.x)}
              cy={sy(hp.y)}
              r="6"
              fill="var(--color-brand-500)"
              stroke="var(--bg-elevated)"
              stroke-width="2.5"
            />
            <rect x={tipX} y={tipY} width={tipW} height="26" rx="8" fill="var(--fg)" />
            <text
              x={tipX + tipW / 2}
              y={tipY + 17}
              text-anchor="middle"
              font-size="12"
              font-weight="700"
              fill="var(--bg)"
            >
              {readout}
            </text>
          </g>
        )}
      </svg>
      <span class="sr-only" aria-live="polite">
        {readout}
      </span>
    </>
  );
}
