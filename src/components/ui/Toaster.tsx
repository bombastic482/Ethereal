import { useEffect, useRef, useState } from 'preact/hooks';
import { dismissToast, subscribeToast, undoToast, type Toast } from '@/lib/toast';
import { Icon } from './Icon';

/**
 * Where toasts appear: above the tab bar on a phone, bottom centre elsewhere. It waits while you
 * hover or focus it, and Ctrl/Cmd+Z takes the Undo while one is offered.
 */
export default function Toaster() {
  const [t, setT] = useState<Toast | null>(null);
  const [held, setHeld] = useState(false);
  const timer = useRef(0);

  useEffect(() => subscribeToast(setT), []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!t || held) return;
    const id = t.id;
    timer.current = window.setTimeout(() => dismissToast(id), t.ms);
    return () => clearTimeout(timer.current);
  }, [t, held]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      // Typing fields keep their own undo.
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (undoToast()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="toaster" aria-live="polite" aria-atomic="true">
      {t && (
        <div
          key={t.id}
          class="toast"
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
          onFocusIn={() => setHeld(true)}
          onFocusOut={() => setHeld(false)}
        >
          <span class="min-w-0 flex-1">{t.text}</span>
          {t.undo && (
            <button type="button" class="toast-undo" onClick={() => undoToast()}>
              <Icon name="reset" size={14} /> Undo
            </button>
          )}
          <button
            type="button"
            class="toast-close"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          >
            <Icon name="close" size={14} />
          </button>
          {!held && (
            <span
              class="toast-time"
              style={{ animationDuration: `${t.ms}ms` }}
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
}
