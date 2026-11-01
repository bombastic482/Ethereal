/**
 * One small message at a time at the bottom of the screen, optionally with Undo. Anything that
 * removes something a person typed in says so here and offers it back for a few seconds, so a
 * slipped tap never costs them their data.
 */
export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
  /** How long it stays, in milliseconds. */
  ms: number;
}

type Listener = (t: Toast | null) => void;
let current: Toast | null = null;
let next = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((f) => f(current));

/** Shows a message, replacing any that is up. With `undo` it stays a little longer. */
export function toast(text: string, opts: { undo?: () => void; ms?: number } = {}): void {
  current = {
    id: ++next,
    text,
    ms: opts.ms ?? (opts.undo ? 6000 : 3500),
    ...(opts.undo ? { undo: opts.undo } : {}),
  };
  emit();
}

/** Hides the message, or only the given one if it is still the one showing. */
export function dismissToast(id?: number): void {
  if (id !== undefined && current?.id !== id) return;
  current = null;
  emit();
}

/** Runs the showing message's undo, if it has one, and hides it. Returns whether it did. */
export function undoToast(): boolean {
  const t = current;
  if (!t?.undo) return false;
  t.undo();
  dismissToast(t.id);
  return true;
}

export function subscribeToast(f: Listener): () => void {
  listeners.add(f);
  f(current);
  return () => listeners.delete(f);
}
