import { shift } from '@/lib/calc/streaks';

interface Props {
  /** Value per ISO day; missing days are empty cells. */
  values: Record<string, number>;
  /** Highest value that maps to the strongest shade. */
  max: number;
  /** Last day shown (inclusive). */
  end: string;
  weeks?: number;
  /** Text for the cell tooltip and screen readers, e.g. (date, value) => "3 meals on 12 Oct". */
  describe: (date: string, value: number) => string;
  label: string;
}

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** GitHub-style consistency grid: one column per week, Monday at the top, newest on the right. */
export function Heatmap({ values, max, end, weeks = 12, describe, label }: Props) {
  // Align the last column so `end` sits in its weekday row; the grid starts on a Monday.
  const endDow = (new Date(`${end}T00:00:00`).getDay() + 6) % 7; // 0 = Monday
  const lastMonday = shift(end, -endDow);
  const start = shift(lastMonday, -(weeks - 1) * 7);
  const cell = 12;
  const gap = 3;
  const cols = weeks;
  const width = cols * (cell + gap) + 18;
  const height = 7 * (cell + gap) + 16;
  const cells: Array<{ x: number; y: number; date: string; v: number; future: boolean }> = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const date = shift(start, c * 7 + r);
      cells.push({
        x: 18 + c * (cell + gap),
        y: 14 + r * (cell + gap),
        date,
        v: values[date] ?? 0,
        future: date > end,
      });
    }
  }
  const months: Array<{ x: number; text: string }> = [];
  let lastMonth = '';
  for (let c = 0; c < cols; c++) {
    const d = new Date(`${shift(start, c * 7)}T00:00:00`);
    const m = d.toLocaleDateString('en-US', { month: 'short' });
    if (m !== lastMonth) {
      months.push({ x: 18 + c * (cell + gap), text: m });
      lastMonth = m;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      class="h-auto w-full max-w-xl"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {months.map((m) => (
        <text key={m.x} x={m.x} y={9} class="fill-[var(--fg-subtle)] text-[8px] font-semibold">
          {m.text}
        </text>
      ))}
      {DOW.map((d, i) =>
        i % 2 === 0 ? (
          <text
            key={i}
            x={0}
            y={14 + i * (cell + gap) + 9}
            class="fill-[var(--fg-subtle)] text-[8px] font-semibold"
          >
            {d}
          </text>
        ) : null,
      )}
      {cells.map((k) => {
        const t = k.future ? -1 : Math.min(1, k.v / Math.max(1, max));
        const fill =
          t < 0
            ? 'transparent'
            : t === 0
              ? 'var(--bg-muted)'
              : `color-mix(in oklab, var(--color-brand-500) ${Math.round(25 + t * 75)}%, var(--bg-muted))`;
        return (
          <rect
            key={k.date}
            x={k.x}
            y={k.y}
            width={cell}
            height={cell}
            rx={3}
            fill={fill}
            stroke={k.date === end ? 'var(--fg)' : 'none'}
            stroke-width={1}
          >
            <title>{k.future ? '' : describe(k.date, k.v)}</title>
          </rect>
        );
      })}
    </svg>
  );
}
