/** Small motion and feedback helpers. All respect prefers-reduced-motion. */

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Short haptic tap on supporting devices (Android Chrome). Silent elsewhere. */
export function haptic(pattern: number | number[] = 12): void {
  try {
    if (!reducedMotion() && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/**
 * Lightweight confetti burst drawn on a temporary full-screen canvas. ~1.5 s, then removed.
 * Used sparingly: milestones and finishing a day on target.
 */
export function confetti(
  origin: { x: number; y: number } = { x: 0.5, y: 0.35 },
  count = 120,
): void {
  if (typeof document === 'undefined' || reducedMotion()) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9999',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const colors = ['#14b8a6', '#2dd4bf', '#a78bfa', '#f59e0b', '#f472b6', '#60a5fa'];
  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 9;
    return {
      x: origin.x * window.innerWidth,
      y: origin.y * window.innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 6,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      life: 1,
    };
  });
  const start = performance.now();
  const tick = (now: number) => {
    const t = (now - start) / 1500;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.life = Math.max(0, 1 - t);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 1) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}

/** Animates a number from `from` to `to` over `ms`, calling `onFrame` with the eased value. */
export function countUp(
  from: number,
  to: number,
  onFrame: (v: number) => void,
  ms = 700,
): () => void {
  if (reducedMotion() || from === to) {
    onFrame(to);
    return () => {};
  }
  const start = performance.now();
  let raf = 0;
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    onFrame(from + (to - from) * ease(p));
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Horizontal swipe detection for touch screens. Returns a cleanup function. */
export function onSwipe(
  el: HTMLElement,
  handlers: { left?: () => void; right?: () => void },
  threshold = 60,
): () => void {
  let x0 = 0;
  let y0 = 0;
  let active = false;
  const start = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    x0 = t.clientX;
    y0 = t.clientY;
    active = true;
  };
  const end = (e: TouchEvent) => {
    if (!active) return;
    active = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) handlers.left?.();
      else handlers.right?.();
    }
  };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', end, { passive: true });
  return () => {
    el.removeEventListener('touchstart', start);
    el.removeEventListener('touchend', end);
  };
}
