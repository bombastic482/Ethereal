import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  /** Smallest change, e.g. 0.1 kg or 0.5 cm. */
  step: number;
  unit: string;
  /** Pixels per whole unit on the tape. */
  pxPerUnit?: number;
  /** Units between labelled ticks. */
  labelEvery?: number;
  /** A previous value to show on the tape, e.g. last time's measurement. */
  marker?: number;
  markerLabel?: string;
  /** Decimal places in the readout. */
  dp?: number;
}

const decimals = (step: number) => (step.toString().split('.')[1] ?? '').length;

/**
 * A tape measure you drag. The tape slides under a fixed needle with momentum and snaps to the
 * nearest step; whole units tick on phones that can buzz. It is a proper slider for assistive
 * tech and keyboards (arrows, Shift for bigger steps, Page Up and Down, Home and End), and the
 * big readout can be tapped to type a number instead.
 */
export function TapeScrubber({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  pxPerUnit = 48,
  labelEvery = 1,
  marker,
  markerLabel = 'last',
  dp = decimals(step),
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pos = useRef(value);
  const drag = useRef<{ x: number; v: number; t: number; vel: number; moved: boolean } | null>(
    null,
  );
  const anim = useRef(0);
  const lastWhole = useRef(Math.floor(value));
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [shown, setShown] = useState(value);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => clamp(Math.round(v / step) * step);
  const round = (v: number) => Number(v.toFixed(dp));

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(c);
    const ink = css.getPropertyValue('--tape-ink').trim() || '#64748b';
    const strong = css.getPropertyValue('--tape-strong').trim() || '#0f172a';
    const accent = css.getPropertyValue('--tape-accent').trim() || '#10b981';
    const cx = w / 2;
    const v = pos.current;
    const half = w / 2 / pxPerUnit;
    const minorEvery = step < 1 ? (step <= 0.1 ? 0.1 : step) : step;
    const start = Math.max(min, Math.floor((v - half) / minorEvery) * minorEvery);
    const end = Math.min(max, v + half + minorEvery);
    ctx.textAlign = 'center';
    ctx.font = `600 11px ${css.fontFamily}`;
    for (let t = start; t <= end + 1e-9; t += minorEvery) {
      const tt = Math.round(t / minorEvery) * minorEvery;
      const x = cx + (tt - v) * pxPerUnit;
      const isLabel = Math.abs(tt / labelEvery - Math.round(tt / labelEvery)) < 1e-6;
      const isWhole = Math.abs(tt - Math.round(tt)) < 1e-6;
      const isHalf = Math.abs(tt * 2 - Math.round(tt * 2)) < 1e-6;
      const len = isLabel ? 26 : isWhole ? 18 : isHalf ? 12 : 7;
      // Ticks fade towards the edges so the needle stays the focus.
      const fade = Math.max(0.15, 1 - Math.abs(x - cx) / (w / 2));
      ctx.globalAlpha = fade;
      ctx.strokeStyle = isLabel ? strong : ink;
      ctx.lineWidth = isLabel ? 2 : 1.25;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, len);
      ctx.stroke();
      if (isLabel) {
        ctx.fillStyle = strong;
        ctx.fillText(String(Math.round(tt * 10) / 10), x, len + 14);
      }
    }
    if (marker !== undefined) {
      const x = cx + (marker - v) * pxPerUnit;
      if (x > -20 && x < w + 20) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, h - 9, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `600 10px ${css.fontFamily}`;
        ctx.fillText(markerLabel, x, h - 17);
      }
    }
    ctx.globalAlpha = 1;
  };

  const set = (v: number, emit = true) => {
    pos.current = clamp(v);
    const whole = Math.floor(pos.current);
    if (whole !== lastWhole.current) {
      lastWhole.current = whole;
      try {
        if (drag.current || anim.current) navigator.vibrate?.(3);
      } catch {
        /* ignore */
      }
    }
    const snapped = round(snap(pos.current));
    setShown(snapped);
    if (emit && snapped !== value) onChange(snapped);
    draw();
  };

  // Follow outside changes when the tape is at rest.
  useEffect(() => {
    if (drag.current || anim.current) return;
    pos.current = value;
    setShown(value);
    draw();
  }, [value]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (canvas.current) ro.observe(canvas.current);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const redraw = () => requestAnimationFrame(draw);
    mq.addEventListener('change', redraw);
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', redraw);
      mo.disconnect();
      cancelAnimationFrame(anim.current);
    };
  }, []);

  const settle = (from: number) => {
    const target = snap(from);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 180);
      set(from + (target - from) * (1 - (1 - k) ** 3));
      if (k < 1) anim.current = requestAnimationFrame(tick);
      else anim.current = 0;
    };
    anim.current = requestAnimationFrame(tick);
  };

  const fling = (vel: number) => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || Math.abs(vel) < 0.002) return settle(pos.current);
    let last = performance.now();
    let v = vel;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      set(pos.current + v * dt);
      v *= Math.pow(0.994, dt);
      const atEdge = pos.current <= min || pos.current >= max;
      if (Math.abs(v) > 0.0015 && !atEdge) anim.current = requestAnimationFrame(tick);
      else {
        anim.current = 0;
        settle(pos.current);
      }
    };
    anim.current = requestAnimationFrame(tick);
  };

  const onDown = (e: PointerEvent) => {
    cancelAnimationFrame(anim.current);
    anim.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, v: pos.current, t: performance.now(), vel: 0, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const next = d.v - (e.clientX - d.x) / pxPerUnit;
    const dt = Math.max(1, now - d.t);
    d.vel = 0.75 * ((next - pos.current) / dt) + 0.25 * d.vel;
    d.t = now;
    if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
    set(next);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    fling(d.vel);
  };

  const nudge = (by: number) => {
    cancelAnimationFrame(anim.current);
    anim.current = 0;
    set(snap(pos.current + by));
  };

  const commitText = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) set(snap(n));
    setTyping(false);
  };

  return (
    <div class="tape">
      <div class="flex items-baseline justify-between gap-3">
        <label class="label mb-0" for={`${id}-readout`}>
          {label}
        </label>
        {marker !== undefined && Math.abs(shown - marker) >= step / 2 && (
          <span class={`tape-delta ${shown < marker ? 'tape-down' : 'tape-up'}`}>
            {shown < marker ? '−' : '+'}
            {Math.abs(shown - marker).toFixed(dp)} {unit} vs {markerLabel}
          </span>
        )}
      </div>
      {typing ? (
        <input
          id={`${id}-readout`}
          class="tape-readout tape-input"
          inputMode="decimal"
          autoFocus
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            if (e.key === 'Escape') setTyping(false);
          }}
        />
      ) : (
        <button
          id={`${id}-readout`}
          type="button"
          class="tape-readout"
          aria-label={`${label}: ${shown.toFixed(dp)} ${unit}. Tap to type.`}
          onClick={() => {
            setText(shown.toFixed(dp));
            setTyping(true);
          }}
        >
          <span class="tabular">{shown.toFixed(dp)}</span>
          <span class="tape-unit">{unit}</span>
        </button>
      )}
      <div
        ref={wrap}
        id={id}
        class="tape-strip"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown}
        aria-valuetext={`${shown.toFixed(dp)} ${unit}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => {
          e.preventDefault();
          const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          cancelAnimationFrame(anim.current);
          anim.current = 0;
          set(pos.current + d / pxPerUnit);
          window.clearTimeout((wrap.current as unknown as { t?: number }).t);
          (wrap.current as unknown as { t?: number }).t = window.setTimeout(
            () => settle(pos.current),
            120,
          );
        }}
        onKeyDown={(e) => {
          const big = e.shiftKey ? 10 : 1;
          const keys: Record<string, () => void> = {
            ArrowRight: () => nudge(step * big),
            ArrowUp: () => nudge(step * big),
            ArrowLeft: () => nudge(-step * big),
            ArrowDown: () => nudge(-step * big),
            PageUp: () => nudge(step * 10),
            PageDown: () => nudge(-step * 10),
            Home: () => set(min),
            End: () => set(max),
          };
          const fn = keys[e.key];
          if (fn) {
            e.preventDefault();
            fn();
          }
        }}
      >
        <canvas ref={canvas} class="tape-canvas" aria-hidden="true" />
        <span class="tape-needle" aria-hidden="true" />
      </div>
    </div>
  );
}
