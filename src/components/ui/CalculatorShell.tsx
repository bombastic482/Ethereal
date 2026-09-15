import type { ComponentChildren } from 'preact';

interface Props {
  inputs: ComponentChildren;
  results: ComponentChildren;
  /** Optional full-width area under the two columns (charts, tables). */
  footer?: ComponentChildren;
}

/** Two-column responsive shell shared by every calculator: inputs left, live results right. */
export function CalculatorShell({ inputs, results, footer }: Props) {
  return (
    <div class="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section class="surface p-5 sm:p-6" aria-label="Your details">
        {inputs}
      </section>
      <section class="surface p-5 sm:p-6" aria-label="Results" aria-live="polite">
        {results}
      </section>
      {footer && <section class="surface p-5 sm:p-6 lg:col-span-2">{footer}</section>}
    </div>
  );
}
