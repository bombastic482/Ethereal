import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic, reducedMotion } from '@/lib/fx';
import { addRecharge } from '@/lib/mind';
import { todayIso } from '@/lib/plan';
import { Icon } from '../ui/Icon';
import { Layer } from '../ui/Layer';

type Phase = { label: string; ms: number; scale: number };

const PATTERNS: Record<string, { name: string; hint: string; phases: Phase[] }> = {
  calm: {
    name: 'Calm',
    hint: 'In for 4, out for 6. Slows the heart and settles the mind.',
    phases: [
      { label: 'Breathe in', ms: 4000, scale: 1 },
      { label: 'Breathe out', ms: 6000, scale: 0.55 },
    ],
  },
  box: {
    name: 'Box',
    hint: 'In, hold, out, hold, four seconds each. Steadying before something hard.',
    phases: [
      { label: 'Breathe in', ms: 4000, scale: 1 },
      { label: 'Hold', ms: 4000, scale: 1 },
      { label: 'Breathe out', ms: 4000, scale: 0.55 },
      { label: 'Hold', ms: 4000, scale: 0.55 },
    ],
  },
  sleep: {
    name: 'Sleep',
    hint: 'In for 4, hold for 7, out for 8. A long exhale for winding down.',
    phases: [
      { label: 'Breathe in', ms: 4000, scale: 1 },
      { label: 'Hold', ms: 7000, scale: 1 },
      { label: 'Breathe out', ms: 8000, scale: 0.55 },
    ],
  },
};

/** A guided breathing session: a circle that grows and shrinks with your breath. */
export default function Breathe({
  onClose,
  initial = 'calm',
}: {
  onClose: () => void;
  initial?: keyof typeof PATTERNS;
}) {
  const [pattern, setPattern] = useState<keyof typeof PATTERNS>(initial);
  const [minutes, setMinutes] = useState(2);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const endAt = useRef(0);
  const still = reducedMotion();
  const p = PATTERNS[pattern]!;
  const current = p.phases[phase % p.phases.length]!;

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, []);

  // Move through the phases; each change carries a soft haptic so eyes can stay closed.
  useEffect(() => {
    if (!running) return;
    if (Date.now() >= endAt.current) {
      setRunning(false);
      setDone(true);
      addRecharge(todayIso());
      haptic([30, 80, 30]);
      return;
    }
    haptic(current.label === 'Hold' ? 6 : 14);
    const t = window.setTimeout(() => setPhase((n) => n + 1), current.ms);
    return () => window.clearTimeout(t);
  }, [running, phase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () => setLeft(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))),
      250,
    );
    return () => window.clearInterval(id);
  }, [running]);

  const start = () => {
    endAt.current = Date.now() + minutes * 60_000;
    setLeft(minutes * 60);
    setPhase(0);
    setDone(false);
    setRunning(true);
  };

  return (
    <Layer>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Breathe"
        class="breathe fixed inset-0 z-[70] flex flex-col"
      >
        <div class="flex items-center justify-between p-3">
          <span class="text-sm font-semibold text-white/80">
            {running
              ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
              : 'Recharge'}
          </span>
          <button
            type="button"
            class="btn h-10 w-10 rounded-full p-0 text-white hover:bg-white/10"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="grid flex-1 place-items-center px-6">
          <div class="breathe-stage" aria-hidden="true">
            <span
              class="breathe-orb"
              style={{
                transform: `scale(${running && !still ? current.scale : 0.7})`,
                transitionDuration: `${running ? current.ms : 600}ms`,
              }}
            />
            <span class="breathe-ring" />
          </div>
          <p class="breathe-label" aria-live="polite">
            {done ? 'Well done.' : running ? current.label : p.name}
          </p>
        </div>
        <div class="mx-auto grid w-full max-w-md gap-3 p-5">
          {!running ? (
            <>
              <p class="text-center text-sm text-white/75">
                {done ? 'Notice how you feel now. Carry it into the next hour.' : p.hint}
              </p>
              <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pattern">
                {Object.entries(PATTERNS).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={pattern === k}
                    class={`h-11 rounded-xl text-sm font-semibold ${pattern === k ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                    onClick={() => setPattern(k as keyof typeof PATTERNS)}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Length">
                {[1, 2, 5].map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={minutes === m}
                    class={`h-11 rounded-xl text-sm font-semibold ${minutes === m ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
                    onClick={() => setMinutes(m)}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <button
                type="button"
                class="btn h-14 bg-white text-base text-black"
                autofocus
                onClick={start}
              >
                <Icon name="play" size={18} /> {done ? 'Again' : 'Begin'}
              </button>
            </>
          ) : (
            <button
              type="button"
              class="btn h-14 bg-white/10 text-base text-white"
              onClick={() => setRunning(false)}
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </Layer>
  );
}
