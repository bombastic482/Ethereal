interface Props {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  class?: string;
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = String,
  hint,
  class: cls,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div class={cls}>
      <div class="flex items-baseline justify-between">
        <label class="label" for={id}>
          {label}
        </label>
        <output class="tabular text-sm font-semibold" for={id}>
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        class="range"
        style={{ '--pct': `${pct}%` } as Record<string, string>}
      />
      {hint && <p class="text-subtle mt-1 text-xs">{hint}</p>}
      <style>{`
        .range{appearance:none;width:100%;height:1.5rem;background:transparent;cursor:pointer}
        .range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(90deg,var(--color-brand-500) var(--pct),var(--border-strong) var(--pct))}
        .range::-moz-range-track{height:6px;border-radius:999px;background:var(--border-strong)}
        .range::-moz-range-progress{height:6px;border-radius:999px;background:var(--color-brand-500)}
        .range::-webkit-slider-thumb{appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:50%;background:var(--bg-elevated);border:2px solid var(--color-brand-500);box-shadow:0 2px 8px -2px oklch(0% 0 0/.3)}
        .range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:var(--bg-elevated);border:2px solid var(--color-brand-500)}
      `}</style>
    </div>
  );
}
