import type { ComponentChildren } from 'preact';
import { Icon } from './Icon';

interface Props {
  tone?: 'info' | 'warn' | 'success';
  title?: string;
  children: ComponentChildren;
  class?: string;
}

export function Callout({ tone = 'info', title, children, class: cls }: Props) {
  const styles =
    tone === 'warn'
      ? 'border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100'
      : tone === 'success'
        ? 'border-brand-300/60 bg-brand-50 text-brand-950 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100'
        : 'border-line bg-muted text-fg';
  return (
    <div
      class={`flex gap-3 rounded-2xl border p-4 text-sm ${styles} ${cls ?? ''}`}
      role={tone === 'warn' ? 'alert' : undefined}
    >
      <Icon
        name={tone === 'warn' ? 'warn' : tone === 'success' ? 'check' : 'info'}
        class="mt-0.5 shrink-0"
        size={18}
      />
      <div class="min-w-0">
        {title && <p class="mb-0.5 font-semibold">{title}</p>}
        <div class="space-y-1 leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
