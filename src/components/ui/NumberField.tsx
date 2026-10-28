import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  id: string;
  label: string;
  /** null means "not set": the field shows `placeholder` and commits nothing until typed in. */
  value: number | null;
  onChange: (v: number) => void;
  /** Called when the user clears a field that allows null. */
  onClear?: () => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places shown when the value is synced from outside. */
  dp?: number;
  suffix?: string;
  hint?: string;
  inputMode?: 'numeric' | 'decimal';
  class?: string;
}

/**
 * Number input that keeps its own text while typing (so "1." and "" are allowed)
 * and commits a validated, clamped number upward on every valid keystroke.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  onClear,
  placeholder,
  min,
  max,
  step = 1,
  dp = 1,
  suffix,
  hint,
  inputMode = 'decimal',
  class: cls,
}: Props) {
  const show = (v: number | null) => (v === null ? '' : String(fmt(v, dp)));
  const [text, setText] = useState(() => show(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  // Sync from props only when the field is not being edited (e.g. after a unit toggle).
  useEffect(() => {
    if (!focused.current) {
      setText(show(value));
      setInvalid(false);
    }
  }, [value, dp]);

  const commit = (raw: string) => {
    setText(raw);
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' && onClear) {
      setInvalid(false);
      onClear();
      return;
    }
    if (raw.trim() === '' || !Number.isFinite(n)) {
      setInvalid(true);
      return;
    }
    const outOfRange = (min !== undefined && n < min) || (max !== undefined && n > max);
    setInvalid(outOfRange);
    if (!outOfRange) onChange(n);
  };

  const blur = () => {
    focused.current = false;
    const n = Number(text.replace(',', '.'));
    if (!Number.isFinite(n) || text.trim() === '') {
      setText(onClear ? '' : show(value));
      setInvalid(false);
      return;
    }
    let clamped = n;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    if (clamped !== n) onChange(clamped);
    setText(String(fmt(clamped, dp)));
    setInvalid(false);
  };

  return (
    <div class={cls}>
      <label class="label" for={id}>
        {label}
      </label>
      <div class="relative">
        <input
          id={id}
          class="field pr-12"
          type="number"
          inputMode={inputMode}
          value={text}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={() => (focused.current = true)}
          onInput={(e) => commit((e.target as HTMLInputElement).value)}
          onBlur={blur}
        />
        {suffix && (
          <span class="text-subtle pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} class="text-subtle mt-1 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

function fmt(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((v + Number.EPSILON) * f) / f;
}
