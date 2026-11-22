// A visitor who picks their own document before signing in keeps it through
// sign-in: the file waits in this browser's IndexedDB, the auth modal opens,
// and the dashboard uploads it once the visitor is back signed in (plan
// .collab/plans/2026-11-22-guest-trial-flow-pangram.md, P0-2).
//
// Rules:
// - The file never leaves the browser before sign-in. Upload stays
//   `require_auth`; this only removes the step where the visitor had to find
//   the file again after signing in.
// - One file at a time; a new pick replaces the old one.
// - Taking the file reads and deletes it in ONE readwrite transaction, so two
//   tabs (or a re-render) can never upload it twice.
// - A file older than PENDING_UPLOAD_TTL_MS is dropped, not uploaded: a
//   visitor who signs in a day later did not ask for that upload now.
// - Closing the sign-in dialog keeps the file: with an email link the visitor
//   closes it at "check your inbox" and comes back from the email. The TTL
//   and the one-shot take are what bound it.
// - IndexedDB can be missing or refuse (private windows, storage pressure):
//   every call resolves to a plain failure value and the caller falls back to
//   the ordinary sign-in.

export const PENDING_UPLOAD_TTL_MS = 30 * 60 * 1000;
/** New accounts are Free; mirrors backend FREE_MAX_FILE_SIZE_MB. */
export const GUEST_UPLOAD_MAX_MB = 50;

const DB_NAME = 'doctalk-pending-upload';
const STORE = 'uploads';
const KEY = 'pending';

type StoredPendingUpload = {
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
};

export function isPendingUploadFresh(savedAt: number, now: number): boolean {
  return Number.isFinite(savedAt) && savedAt <= now && now - savedAt < PENDING_UPLOAD_TTL_MS;
}

function defaultFactory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('pending upload store blocked'));
  });
}

function finish(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('pending upload transaction aborted'));
  });
}

/** Store the file for after sign-in. Resolves false when the browser refuses. */
export async function savePendingUpload(
  file: File,
  now: number = Date.now(),
  factory: IDBFactory | null = defaultFactory(),
): Promise<boolean> {
  if (!factory) return false;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb(factory);
    const tx = db.transaction(STORE, 'readwrite');
    const value: StoredPendingUpload = { blob: file, name: file.name, type: file.type, savedAt: now };
    tx.objectStore(STORE).put(value, KEY);
    await finish(tx);
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Read and delete the stored file in one transaction. Resolves the file when
 * it is still fresh, else null (an expired file is deleted all the same).
 */
export async function takePendingUpload(
  now: number = Date.now(),
  factory: IDBFactory | null = defaultFactory(),
): Promise<File | null> {
  if (!factory) return null;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb(factory);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const stored = await new Promise<StoredPendingUpload | undefined>((resolve, reject) => {
      const request = store.get(KEY);
      request.onsuccess = () => {
        const value = request.result as StoredPendingUpload | undefined;
        if (value !== undefined) store.delete(KEY);
        resolve(value);
      };
      request.onerror = () => reject(request.error);
    });
    await finish(tx);
    if (!stored || !(stored.blob instanceof Blob) || !isPendingUploadFresh(stored.savedAt, now)) return null;
    return new File([stored.blob], stored.name, { type: stored.type });
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
