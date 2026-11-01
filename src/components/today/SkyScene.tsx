import { useEffect, useRef, useState } from 'preact/hooks';
import { arcProgress, nightness, skyColors, type SunEvents } from '@/lib/sky';

/**
 * The sky over today. Its colour follows the real minute; the sun rises on the left, arcs and
 * sets on the right, low and warm at either end; at night the moon, in tonight's phase, and the
 * stars come out. It holds no data of its own: it is atmosphere, and whatever is passed as
 * children (the greeting) floats in it. The bottom dissolves into the card below.
 */

// Fixed, seeded stars so the sky is the same on every render and every visit.
const STARS = (() => {
  let x = 11;
  const r = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 42 }, () => ({
    x: r(),
    y: r() * 0.7,
    r: 0.4 + r() * 0.9,
    delay: r() * 5,
  }));
})();

export function SkyScene({
  now,
  events,
  moon,
  children,
}: {
  /** Minutes since midnight. */
  now: number;
  events: SunEvents;
  /** Moon phase, 0 new to 0.5 full. */
  moon: number;
  children?: preact.ComponentChildren;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [[w, h], setSize] = useState([400, 208]);

  // Draw at the real size, so the sun stays round from a small phone to a wide desktop.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize([
        Math.max(280, Math.round(e!.contentRect.width)),
        Math.max(160, Math.round(e!.contentRect.height)),
      ]),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { top, horizon } = skyColors(now, events);
  const dark = nightness(now, events);
  const sun = arcProgress(now, events, 'sun');
  const night = arcProgress(now, events, 'moon');

  // Bodies cross the full width and arc to just below the greeting.
  const low = h * 0.8;
  const high = h * 0.5;
  const along = (p: number) =>
    [w * (0.08 + 0.84 * p), low - (low - high) * Math.sin(Math.PI * p)] as const;
  const sunAt = sun === null ? null : along(sun);
  const moonAt = night === null ? null : along(night);
  // A low sun glows wider and warmer.
  const lowSun = sun === null ? 0 : 1 - Math.sin(Math.PI * sun);
  // Lit fraction and which side, for the crescent's shadow.
  const lit = (1 - Math.cos(2 * Math.PI * moon)) / 2;
  const shadowDx = (moon < 0.5 ? -1 : 1) * 18 * lit;

  const hills = [
    `M0 ${h * 0.8} C${w * 0.22} ${h * 0.7} ${w * 0.42} ${h * 0.84} ${w * 0.62} ${h * 0.76} S${w * 0.9} ${h * 0.7} ${w} ${h * 0.78} V${h} H0Z`,
    `M0 ${h * 0.88} C${w * 0.18} ${h * 0.82} ${w * 0.4} ${h * 0.9} ${w * 0.66} ${h * 0.85} S${w * 0.92} ${h * 0.84} ${w} ${h * 0.88} V${h} H0Z`,
  ];

  return (
    <div
      ref={box}
      class="sky"
      style={{ '--sky-top': top, '--sky-horizon': horizon, '--sky-day': (1 - dark).toFixed(2) }}
    >
      <svg class="sky-svg" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <radialGradient id="sky-halo">
            <stop offset="0" stop-color="oklch(98% 0.04 90)" stop-opacity="0.9" />
            <stop offset="0.3" stop-color="oklch(92% 0.09 80)" stop-opacity="0.45" />
            <stop offset="1" stop-color="oklch(85% 0.12 60)" stop-opacity="0" />
          </radialGradient>
          <mask id="sky-moon">
            <circle r="9" fill="#fff" />
            <circle cx={shadowDx} r="9.4" fill="#000" />
          </mask>
        </defs>

        {dark > 0.02 && (
          <g opacity={dark.toFixed(2)}>
            {STARS.map((s, i) => (
              <circle
                key={i}
                class="sky-star"
                cx={(s.x * w).toFixed(1)}
                cy={(s.y * h * 0.8).toFixed(1)}
                r={s.r.toFixed(2)}
                style={{ animationDelay: `${s.delay.toFixed(2)}s` }}
              />
            ))}
          </g>
        )}

        {sunAt && (
          <g transform={`translate(${sunAt[0].toFixed(1)} ${sunAt[1].toFixed(1)})`}>
            <circle class="sky-glow" r={44 + lowSun * 26} fill="url(#sky-halo)" />
            <circle r="11" fill="oklch(98% 0.03 95)" />
          </g>
        )}
        {moonAt && (
          <g transform={`translate(${moonAt[0].toFixed(1)} ${moonAt[1].toFixed(1)})`}>
            <circle r="26" fill="oklch(95% 0.02 260)" opacity="0.07" />
            <circle r="9" fill="oklch(96% 0.02 90)" opacity="0.12" />
            <circle r="9" fill="oklch(96% 0.02 90)" mask="url(#sky-moon)" />
          </g>
        )}

        <path d={hills[0]} class="sky-hill sky-hill-far" />
        <path d={hills[1]} class="sky-hill sky-hill-near" />
      </svg>
      <div class="sky-content">{children}</div>
    </div>
  );
}
