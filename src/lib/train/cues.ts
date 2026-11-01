/**
 * Workout feedback that does not need eyes on the screen: short beeps from the Web Audio API,
 * spoken cues from the browser's own speech engine, and a screen wake lock so the phone does
 * not sleep mid-set. Everything degrades silently where a browser lacks the feature.
 */

let ctx: AudioContext | null = null;

/** Audio needs a user gesture to start on iOS; call this from the Start button. */
export function unlockAudio(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** A soft sine blip. `high` is the final "go" tone, a fifth above the countdown ticks. */
export function beep(high = false, ms = 140): void {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = high ? 1318.5 : 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

/** Speaks a short cue, replacing anything still being said. */
export function say(text: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.lang = 'en';
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function hush(): void {
  try {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/**
 * Keeps the screen on while `active` is true. The lock drops whenever the page is hidden, so it
 * is requested again on return. Returns a release function.
 */
export function holdScreen(): () => void {
  let lock: WakeLockSentinelLike | null = null;
  let done = false;
  const nav = navigator as unknown as {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
  };
  const request = async () => {
    if (done || !nav.wakeLock || document.visibilityState !== 'visible') return;
    try {
      lock = await nav.wakeLock.request('screen');
    } catch {
      lock = null;
    }
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') void request();
  };
  void request();
  document.addEventListener('visibilitychange', onVis);
  return () => {
    done = true;
    document.removeEventListener('visibilitychange', onVis);
    void lock?.release().catch(() => undefined);
    lock = null;
  };
}
