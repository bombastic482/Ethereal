interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}
interface Props<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  hint?: string;
  class?: string;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  class: cls,
}: Props<T>) {
  const active = options.find((o) => o.value === value);
  return (
    <div class={cls}>
      <label class="label" for={id}>
        {label}
      </label>
      <div class="relative">
        <select
          id={id}
          class="field appearance-none pr-10"
          value={value}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          class="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {(active?.description ?? hint) && (
        <p class="text-subtle mt-1 text-xs">{active?.description ?? hint}</p>
      )}
    </div>
  );
}
