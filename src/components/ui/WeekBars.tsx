import { formatNumber } from '@/lib/calc/units';

interface Day {
  label: string;
  value: number;
  target: number;
}
interface Props {
  days: Day[];
  ariaLabel: string;
  /** Index of the day still in progress, drawn lighter so a half-eaten day is not read as short. */
  current?: number;
}

/**
 * Seven soft bars against the day's target. On target is the brand colour, over is a muted
 * amber rather than an alarm, under is a lighter brand, and the day still going is lighter
 * again. Each bar sits in a faint track, so a day with nothing logged still has its place.
 */
export function WeekBars({ days, ariaLabel, current }: Props) {
  const max = Math.max(...days.map((d) => Math.max(d.value, d.target)), 1) * 1.12;
  const sameTarget = days.every((d) => d.target === days[0]?.target);
  const tone = (d: Day, i: number) => {
    if (d.value === 0) return '';
    if (i === current) return 'is-current';
    const diff = d.target ? (d.value - d.target) / d.target : 0;
    return Math.abs(diff) <= 0.1 ? 'is-on' : diff > 0 ? 'is-over' : 'is-under';
  };
  const spoken = days
    .map(
      (d, i) =>
        `${d.label} ${d.value ? formatNumber(Math.round(d.value)) : 'nothing'}${i === current ? ' so far' : ''}`,
    )
    .join(', ');
  return (
    <div class="week-bars" role="img" aria-label={`${ariaLabel}. ${spoken}.`}>
      {sameTarget && days[0] && days[0].target > 0 && (
        <span
          class="week-bars-target"
          style={{ bottom: `calc(1.25rem + (100% - 2.5rem) * ${days[0].target / max})` }}
          aria-hidden="true"
        />
      )}
      {days.map((d, i) => (
        <div key={i} class={`week-bar ${tone(d, i)}`}>
          <span class="week-bar-value tabular">
            {d.value ? formatNumber(Math.round(d.value)) : ''}
          </span>
          <span class="week-bar-track">
            {!sameTarget && d.target > 0 && (
              <span class="week-bar-target" style={{ bottom: `${(d.target / max) * 100}%` }} />
            )}
            <span
              class="week-bar-fill"
              style={{ height: d.value ? `max(6px, ${(d.value / max) * 100}%)` : '0' }}
            />
          </span>
          <span class={`week-bar-label ${i === current ? 'text-fg' : ''}`}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}
