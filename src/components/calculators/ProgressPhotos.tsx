import { useEffect, useRef, useState } from 'preact/hooks';
import { formatWeight } from '@/lib/calc/units';
import { haptic } from '@/lib/fx';
import { logStore } from '@/lib/log';
import { todayIso } from '@/lib/plan';
import {
  compressImage,
  deletePhoto,
  listPhotos,
  photosSupported,
  putPhoto,
  type ProgressPhoto,
} from '@/lib/photos';
import { useProfile } from '@/lib/profile';
import { Callout } from '../ui/Callout';
import { Icon } from '../ui/Icon';

/** Progress photos with a before/after compare slider. Photos never leave the device. */
export default function ProgressPhotos() {
  const [profile] = useProfile();
  const [log] = logStore.use();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [split, setSplit] = useState(50);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listPhotos()
      .then(setPhotos)
      .catch(() => setError('Photos are unavailable in this browser mode.'));
  useEffect(() => {
    if (photosSupported()) refresh();
  }, []);
  useEffect(() => {
    if (photos.length >= 2) {
      setA((v) => v ?? photos[0]!.id);
      setB((v) => v ?? photos[photos.length - 1]!.id);
    }
  }, [photos]);

  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await compressImage(file);
      const today = todayIso();
      const w = log.entries.find((e) => e.date === today)?.weightKg;
      await putPhoto({
        id: `${Date.now()}`,
        date: today,
        dataUrl,
        ...(w !== undefined ? { weightKg: w } : {}),
      });
      haptic();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  if (!photosSupported()) return null;
  const pa = photos.find((p) => p.id === a);
  const pb = photos.find((p) => p.id === b);
  const fmt = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });

  return (
    <section class="surface p-5 sm:p-6" aria-label="Progress photos">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-bold tracking-tight">Progress photos</h3>
          <p class="text-subtle text-xs">
            Same light, same pose, same time of day. Stored only on this device.
          </p>
        </div>
        <label class={`btn btn-secondary cursor-pointer text-sm ${busy ? 'opacity-60' : ''}`}>
          <Icon name="spark" size={16} /> {busy ? 'Saving…' : 'Add photo'}
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            class="sr-only"
            onChange={(e) => add((e.target as HTMLInputElement).files?.[0])}
            disabled={busy}
          />
        </label>
      </div>
      {error && <p class="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      {pa && pb && pa.id !== pb.id && (
        <div class="mt-5">
          <div
            class="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl select-none sm:mx-auto"
            style={{ touchAction: 'pan-y' }}
          >
            <img
              src={pb.dataUrl}
              alt={`After, ${fmt(pb.date)}`}
              class="absolute inset-0 h-full w-full object-cover"
            />
            <img
              src={pa.dataUrl}
              alt={`Before, ${fmt(pa.date)}`}
              class="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
            <div
              class="absolute inset-y-0 w-0.5 bg-white/90 shadow"
              style={{ left: `${split}%` }}
            />
            <span class="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
              {fmt(pa.date)}
              {pa.weightKg ? ` · ${formatWeight(pa.weightKg, profile.units)}` : ''}
            </span>
            <span class="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
              {fmt(pb.date)}
              {pb.weightKg ? ` · ${formatWeight(pb.weightKg, profile.units)}` : ''}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onInput={(e) => setSplit(Number((e.target as HTMLInputElement).value))}
              class="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              aria-label="Compare before and after"
            />
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <label>
              <span class="label">Before</span>
              <select
                class="field"
                value={a ?? ''}
                onChange={(e) => setA((e.target as HTMLSelectElement).value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.date)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span class="label">After</span>
              <select
                class="field"
                value={b ?? ''}
                onChange={(e) => setB((e.target as HTMLSelectElement).value)}
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fmt(p.date)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {photos.length > 0 ? (
        <ul class="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {photos.map((p) => (
            <li key={p.id} class="group relative aspect-[3/4] overflow-hidden rounded-xl">
              <img
                src={p.dataUrl}
                alt={`Progress photo ${fmt(p.date)}`}
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[10px] font-semibold text-white">
                {fmt(p.date)}
              </span>
              <button
                type="button"
                class="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                onClick={() => deletePhoto(p.id).then(refresh)}
                aria-label={`Delete photo from ${fmt(p.date)}`}
              >
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Callout class="mt-4">
          The scale lies week to week; photos a month apart don't. Take the first one today, even if
          you don't feel ready.
        </Callout>
      )}
    </section>
  );
}
