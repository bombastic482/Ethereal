interface Slice {
  label: string;
  value: number;
  color: string;
}
interface Props {
  slices: Slice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

/** Accessible SVG donut chart (no library). */
export function DonutChart({ slices, centerLabel, centerValue, size = 200 }: Props) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={slices
          .map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`)
          .join(', ')}
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" stroke-width="12" />
        {slices.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              stroke-width="12"
              stroke-dasharray={`${len} ${c - len}`}
              stroke-dashoffset={-offset}
              transform="rotate(-90 50 50)"
              style="transition: stroke-dasharray .5s ease, stroke-dashoffset .5s ease"
            />
          );
          offset += len;
          return el;
        })}
        {centerValue && (
          <text
            x="50"
            y="49"
            text-anchor="middle"
            font-size="13"
            font-weight="700"
            fill="var(--fg)"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="50"
            y="60"
            text-anchor="middle"
            font-size="6.5"
            font-weight="600"
            fill="var(--fg-subtle)"
            letter-spacing="0.5"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <figcaption class="grid w-full gap-2 text-sm">
        {slices.map((s) => (
          <div key={s.label} class="flex items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span class="text-muted">{s.label}</span>
            <span class="tabular ml-auto font-semibold">
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}
