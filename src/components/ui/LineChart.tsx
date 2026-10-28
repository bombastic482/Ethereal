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
  ariaLabel: string;
}

/** Dependency-free responsive SVG line chart with a filled area and goal line. */
export function LineChart({
  points,
  dots = [],
  goal,
  xLabel = String,
  yLabel = String,
  ariaLabel,
}: Props) {
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-label={ariaLabel}>
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
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="var(--fg-subtle)" opacity="0.55" />
      ))}
      <path
        d={d}
        fill="none"
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
      />
    </svg>
  );
}
