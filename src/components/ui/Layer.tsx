import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Renders overlay content on <body> and manages focus like a real modal: focus moves into the
 * layer on open (an [autofocus] element first), Tab cycles inside it, and focus returns to the
 * element that opened it when it closes. Page regions carry a view-transition-name, which makes
 * them stacking contexts, so a fixed overlay inside one would paint under the header whatever
 * its z-index; portalling out of the region sidesteps that for every modal.
 */
export function Layer({ children }: { children: ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = box.current;
    if (!root) return;
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = root.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0];
    // Defer so the opening click does not immediately land on the new element.
    const t = window.setTimeout(() => first?.focus({ preventScroll: true }), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const a = list[0]!;
      const z = list[list.length - 1]!;
      if (e.shiftKey && (document.activeElement === a || !root.contains(document.activeElement))) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      root.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(<div ref={box}>{children}</div>, document.body);
}
