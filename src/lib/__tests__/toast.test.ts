import { describe, expect, it, vi } from 'vitest';
import { dismissToast, subscribeToast, toast, undoToast, type Toast } from '../toast';

describe('toast', () => {
  it('shows one message at a time and runs its undo once', () => {
    const seen: Array<Toast | null> = [];
    const stop = subscribeToast((t) => seen.push(t));
    const undo = vi.fn();
    toast('Removed Rice.', { undo });
    expect(seen.at(-1)).toMatchObject({ text: 'Removed Rice.', ms: 6000 });
    toast('Saved.');
    expect(seen.at(-1)).toMatchObject({ text: 'Saved.', ms: 3500 });
    expect(undoToast()).toBe(false); // the message showing has no undo
    toast('Removed Soup.', { undo });
    expect(undoToast()).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toBeNull();
    expect(undoToast()).toBe(false);
    stop();
  });
  it('only dismisses the message it was asked about', () => {
    let now: Toast | null = null;
    const stop = subscribeToast((t) => (now = t));
    toast('First');
    const first = (now as Toast | null)!.id;
    toast('Second');
    dismissToast(first);
    expect((now as Toast | null)?.text).toBe('Second');
    dismissToast();
    expect(now).toBeNull();
    stop();
  });
});
