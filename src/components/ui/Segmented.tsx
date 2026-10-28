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
  return (
    <fieldset class={cls}>
      {label && <legend class="label">{label}</legend>}
      <div
        class={`bg-muted grid gap-1 rounded-2xl p-1 ${columns ? '' : 'auto-cols-fr grid-flow-col'}`}
        style={grid}
        role="radiogroup"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <label
              key={o.value}
              class={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-medium transition select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-[var(--bg-muted)] ${
                active ? 'bg-elevated text-fg shadow-soft' : 'text-muted hover:text-fg'
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
