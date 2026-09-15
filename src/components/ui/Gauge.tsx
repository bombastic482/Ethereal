export interface GaugeBand {
  /** Upper bound of the band (in the gauge's units). */
  max: number;
  label: string;
  color: string;
}

interface Props {
  value: number;
  min: number;
  max: number;
  bands: readonly GaugeBand[];
  format?: (v: number) => string;
  /** Marker label shown above the pointer. */
  markerLabel?: string;
}

/** Horizontal banded gauge with a pointer. Purely presentational SVG-free markup. */
export function Gauge({ value, min, max, bands, format = String, markerLabel }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const pct = ((clamp(value) - min) / (max - min)) * 100;
  let prev = min;
  return (
    <div class="w-full">
      <div class="relative h-9">
        <div
          class="absolute top-0 -translate-x-1/2 text-center transition-[left] duration-500"
          style={{ left: `${pct}%` }}
        >
          <div class="chip whitespace-nowrap">{markerLabel ?? format(value)}</div>
          <div class="mx-auto h-2 w-0.5 bg-current opacity-60" />
        </div>
      </div>
      <div
        class="flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${format(value)} on a scale from ${format(min)} to ${format(max)}`}
      >
        {bands.map((b) => {
          const top = Math.min(b.max, max);
          const width = ((top - prev) / (max - min)) * 100;
          prev = top;
          return (
            <div
              key={b.label}
              style={{ width: `${width}%`, background: b.color }}
              title={b.label}
            />
          );
        })}
      </div>
      <div class="text-subtle relative mt-1.5 h-4 text-[10px] font-medium">
        {(() => {
          let p = min;
          return bands.map((b) => {
            const top = Math.min(b.max, max);
            const left = ((p - min) / (max - min)) * 100;
            const width = ((top - p) / (max - min)) * 100;
            p = top;
            return (
              <span
                key={b.label}
                class="absolute truncate text-center"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {b.label}
              </span>
            );
          });
        })()}
      </div>
    </div>
  );
}
