import type { ComponentChildren } from 'preact';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  sub?: ComponentChildren;
  tone?: 'brand' | 'default' | 'accent';
  size?: 'lg' | 'md';
  class?: string;
}

export function Stat({
  label,
  value,
  unit,
  sub,
  tone = 'default',
  size = 'md',
  class: cls,
}: Props) {
  const color =
    tone === 'brand'
      ? 'text-brand-600 dark:text-brand-300'
      : tone === 'accent'
        ? 'text-accent-600 dark:text-accent-400'
        : 'text-fg';
  return (
    <div class={`flex flex-col ${cls ?? ''}`}>
      <span class="text-subtle text-xs font-semibold tracking-wide uppercase">{label}</span>
      <span
        class={`font-display tabular mt-1 leading-none tracking-tight ${size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-3xl'} ${color}`}
      >
        {value}
        {unit && <span class="text-muted ml-1 text-base font-medium">{unit}</span>}
      </span>
      {sub && <span class="text-muted mt-1.5 text-sm">{sub}</span>}
    </div>
  );
}
