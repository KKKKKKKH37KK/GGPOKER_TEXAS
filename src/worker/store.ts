// Local persistence of the uploaded source files (zip / txt) in this browser's IndexedDB.
// Raw files are stored instead of parsed hands: they are ~10x smaller, and a reload re-parses them,
// so statistic definitions can change without any schema migration. Nothing leaves the device.

const DB_NAME = 'hh-stats-viewer';
const STORE = 'files';

export interface StoredFile {
  /** name + size: identifies a re-upload of the same export */
  key: string;
  name: string;
  data: ArrayBuffer;
  addedAt: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export const fileKey = (name: string, data: ArrayBuffer) => `${name}:${data.byteLength}`;

export async function putFiles(files: StoredFile[]): Promise<void> {
  await tx('readwrite', (s) => {
    for (const f of files) s.put(f);
  });
}

export async function getAllFiles(): Promise<StoredFile[]> {
  return ((await tx<StoredFile[]>('readonly', (s) => s.getAll())) ?? []) as StoredFile[];
}

export async function clearFiles(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
