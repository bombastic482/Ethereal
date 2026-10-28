import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

interface DetectorLike {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => DetectorLike;
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

/**
 * Camera barcode scanner. Uses the native BarcodeDetector when the browser has one
 * (Chrome, Edge, Safari 17+) and lazily loads ZXing otherwise. Nothing is uploaded.
 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        stop = () => stream.getTracks().forEach((t) => t.stop());
        if (cancelled) return stop();
        const el = video.current!;
        el.srcObject = stream;
        await el.play();
        if (cancelled) return stop();
        let done = false;
        const finish = (code: string) => {
          if (done) return;
          done = true;
          stop();
          onDetected(code);
        };
        if (window.BarcodeDetector) {
          setEngine('native');
          const detector = new window.BarcodeDetector({ formats: FORMATS });
          const tick = async () => {
            if (done || cancelled) return;
            try {
              const codes = await detector.detect(el);
              if (codes[0]?.rawValue) return finish(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(() => setTimeout(tick, 120));
          };
          let raf = requestAnimationFrame(tick);
          stop = () => {
            cancelAnimationFrame(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          setEngine('zxing');
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (cancelled) return stop();
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(stream, el, (result) => {
            if (result) finish(result.getText());
          });
          stop = () => {
            controls.stop();
            stream.getTracks().forEach((t) => t.stop());
          };
          if (cancelled) stop();
        }
      } catch (e) {
        setError(
          (e as Error).name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow the camera for this site, or type the barcode instead.'
            : 'Could not start the camera on this device.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div class="grid gap-3">
      <div class="bg-ink-950 relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
        <video ref={video} class="h-full w-full object-cover" muted playsInline />
        <div class="pointer-events-none absolute inset-0 grid place-items-center">
          <div class="border-brand-300 h-28 w-64 max-w-[80%] rounded-xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {engine && (
          <span class="absolute right-2 bottom-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
            {engine === 'native' ? 'Native scanner' : 'ZXing scanner'}
          </span>
        )}
      </div>
      {error ? (
        <p class="text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : (
        <p class="text-subtle text-xs">
          Hold the barcode inside the frame. Works best in good light.
        </p>
      )}
      <button type="button" class="btn btn-ghost justify-self-start text-sm" onClick={onClose}>
        <Icon name="close" size={14} /> Cancel
      </button>
    </div>
  );
}
