/**
 * Progress photos, stored in IndexedDB on the device only. Images are downscaled and
 * re-encoded as JPEG before saving so a year of photos stays small.
 */
export interface ProgressPhoto {
  id: string;
  date: string;
  /** JPEG data URL. */
  dataUrl: string;
  note?: string;
  weightKg?: number;
}

const DB = 'ethereal-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('date', 'date');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export const listPhotos = (): Promise<ProgressPhoto[]> =>
  tx<ProgressPhoto[]>('readonly', (s) => s.getAll()).then((all) =>
    all.sort((a, b) => a.date.localeCompare(b.date)),
  );
export const putPhoto = (p: ProgressPhoto): Promise<unknown> => tx('readwrite', (s) => s.put(p));
export const deletePhoto = (id: string): Promise<unknown> => tx('readwrite', (s) => s.delete(id));

/** Downscale to max 1280 px on the long edge and encode as JPEG q0.82. */
export function compressImage(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

export const photosSupported = (): boolean => typeof indexedDB !== 'undefined';

/** Deletes the whole photo database; resolves even if the browser refuses or blocks it. */
export const clearPhotos = (): Promise<void> =>
  new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
