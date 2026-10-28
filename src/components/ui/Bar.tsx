interface Props {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: string;
}

/** Thin macro progress bar with value/target. */
export function Bar({ label, value, target, unit = 'g', color = 'var(--color-brand-500)' }: Props) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target * 1.1;
  return (
    <div>
      <div class="flex items-baseline justify-between text-xs">
        <span class="text-muted font-semibold">{label}</span>
        <span class={`tabular font-semibold ${over ? 'text-rose-600 dark:text-rose-300' : ''}`}>
          {Math.round(value)}
          <span class="text-subtle font-normal">
            {' '}
            / {Math.round(target)} {unit}
          </span>
        </span>
      </div>
      <div
        class="bg-muted mt-1 h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          class="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: over ? 'oklch(62% 0.2 25)' : color }}
        />
      </div>
    </div>
  );
}
