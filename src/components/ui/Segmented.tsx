interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  label?: string;
  name: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
  class?: string;
}

/** Accessible radio group rendered as a pill/segmented control. */
export function Segmented<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  columns,
  class: cls,
}: Props<T>) {
  const grid = columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined;
  const n = options.length;
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  // A single-row control gets a sliding pill behind the active option; multi-row grids fall
  // back to colouring the active cell.
  const slide = !columns && n > 1;
  return (
    <fieldset class={cls}>
      {label && <legend class="label">{label}</legend>}
      <div
        class={`bg-muted relative grid gap-1 rounded-2xl p-1 ${columns ? '' : 'auto-cols-fr grid-flow-col'}`}
        style={grid}
        role="radiogroup"
      >
        {slide && (
          <span
            aria-hidden="true"
            class="bg-elevated shadow-soft pointer-events-none absolute top-1 bottom-1 rounded-xl transition-[inset-inline-start,width] duration-300 ease-[var(--ease-spring)]"
            style={{
              width: `calc((100% - 0.5rem - ${(n - 1) * 0.25}rem) / ${n})`,
              insetInlineStart: `calc(0.25rem + ${idx} * ((100% - 0.5rem - ${(n - 1) * 0.25}rem) / ${n} + 0.25rem))`,
            }}
          />
        )}
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              class={`relative z-10 flex cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-medium transition-colors duration-200 select-none active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-muted)] ${
                active
                  ? `text-fg ${slide ? '' : 'bg-elevated shadow-soft'}`
                  : 'text-muted hover:text-fg'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                class="absolute inset-0 cursor-pointer opacity-0"
              />
              <span>{o.label}</span>
              {o.hint && (
                <span class="text-subtle mt-0.5 text-[11px] leading-tight font-normal">
                  {o.hint}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
