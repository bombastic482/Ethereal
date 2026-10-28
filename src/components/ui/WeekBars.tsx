interface Day {
  label: string;
  value: number;
  target: number;
}
interface Props {
  days: Day[];
  ariaLabel: string;
}

/** Seven bars against a target line; colour reflects distance from target. */
export function WeekBars({ days, ariaLabel }: Props) {
  const max = Math.max(...days.map((d) => Math.max(d.value, d.target)), 1) * 1.1;
  return (
    <div
      class="grid grid-cols-7 items-end gap-2"
      role="img"
      aria-label={ariaLabel}
      style={{ height: 120 }}
    >
      {days.map((d, i) => {
        const h = (d.value / max) * 100;
        const t = (d.target / max) * 100;
        const diff = d.target ? Math.abs(d.value - d.target) / d.target : 0;
        const color =
          d.value === 0
            ? 'var(--border)'
            : diff <= 0.1
              ? 'var(--color-brand-500)'
              : d.value > d.target
                ? 'oklch(68% 0.18 40)'
                : 'var(--color-accent-500)';
        return (
          <div key={i} class="relative flex h-full flex-col justify-end">
            <div
              class="absolute inset-x-0 border-t border-dashed"
              style={{ bottom: `${t}%`, borderColor: 'var(--border-strong)' }}
            />
            <div
              class="w-full rounded-t-md transition-[height] duration-700"
              style={{ height: `${h}%`, background: color, minHeight: d.value ? 4 : 2 }}
              title={`${d.label}: ${Math.round(d.value)} kcal`}
            />
            <span class="text-subtle mt-1 text-center text-[10px] font-semibold">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
