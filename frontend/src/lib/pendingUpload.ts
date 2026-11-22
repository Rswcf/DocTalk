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
// - Each save gets a fresh random nonce, which travels in the sign-in callback
//   (`/?resumeUpload=<nonce>`). The dashboard hands the file over only when
//   the nonce matches, so on a shared browser nobody else can pull a previous
//   visitor's file into their account through a bookmark, history entry or
//   crafted `callbackUrl` (review 2026-11-22, major 1).
// - Taking the file reads and deletes it in ONE readwrite transaction, so two
//   tabs (or a re-render) can never upload it twice.
// - A file older than PENDING_UPLOAD_TTL_MS is never uploaded, and
//   `sweepExpiredPendingUpload` (run by the root AuthModal on every page load)
//   deletes it, so an abandoned pick does not stay at rest in the browser
//   (review major 2). Sign-out clears it outright (clearAccountStorage).
// - Closing the sign-in dialog keeps the file: with an email link the visitor
//   closes it at "check your inbox" and comes back from the email. The TTL,
//   the nonce and the one-shot take are what bound it.
// - IndexedDB can be missing or refuse (private windows, storage pressure):
//   every call resolves to a plain failure value and the caller falls back to
//   the ordinary sign-in.

export const PENDING_UPLOAD_TTL_MS = 30 * 60 * 1000;
/** New accounts are Free; mirrors backend FREE_MAX_FILE_SIZE_MB. */
export const GUEST_UPLOAD_MAX_MB = 50;
/** Query parameter of the sign-in callback; its value is the nonce. */
export const RESUME_UPLOAD_PARAM = 'resumeUpload';

const DB_NAME = 'doctalk-pending-upload';
const STORE = 'uploads';
const KEY = 'pending';
const NONCE_PATTERN = /^[a-f0-9]{32}$/;
// Set while a file may be stored, so the page-load sweep opens IndexedDB only
// for visitors who used this flow (no database is created for anyone else).
// Not `doctalk_`-prefixed: clearAccountStorage must not drop it while the file
// it points at is still there.
const MARKER = 'dt-pending-upload';

/** true/false when localStorage answers, null when it cannot be read. */
function markerPresent(): boolean | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(MARKER) !== null;
  } catch {
    return null;
  }
}

function setMarker(present: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (present) localStorage.setItem(MARKER, '1');
    else localStorage.removeItem(MARKER);
  } catch {
    // The marker is an optimisation only.
  }
}

type StoredPendingUpload = {
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
  nonce: string;
};

export function isPendingUploadFresh(savedAt: number, now: number): boolean {
  return Number.isFinite(savedAt) && savedAt <= now && now - savedAt < PENDING_UPLOAD_TTL_MS;
}

/** Same-origin callback path that brings the visitor back to take this file. */
export function resumeUploadCallback(nonce: string): string {
  return `/?${RESUME_UPLOAD_PARAM}=${encodeURIComponent(nonce)}`;
}

function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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
    request.onsuccess = () => {
      const db = request.result;
      // A later schema version opened elsewhere must not wait on us.
      db.onversionchange = () => db.close();
      resolve(db);
    };
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

/**
 * Run `decide` on the stored entry inside one readwrite transaction. It
 * returns whether to delete the entry and what to resolve with.
 */
async function withEntry<T>(
  factory: IDBFactory | null,
  fallback: T,
  decide: (value: StoredPendingUpload | undefined) => { remove: boolean; result: T },
): Promise<T> {
  if (!factory) return fallback;
  let db: IDBDatabase | null = null;
  let entryLeft = false;
  try {
    db = await openDb(factory);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const result = await new Promise<T>((resolve, reject) => {
      const request = store.get(KEY);
      request.onsuccess = () => {
        const value = request.result as StoredPendingUpload | undefined;
        const outcome = decide(value);
        // Queued inside the success callback, so the transaction stays open.
        if (outcome.remove) store.delete(KEY);
        entryLeft = value !== undefined && !outcome.remove;
        resolve(outcome.result);
      };
      request.onerror = () => reject(request.error);
    });
    await finish(tx);
    setMarker(entryLeft);
    return result;
  } catch {
    return fallback;
  } finally {
    db?.close();
  }
}

/**
 * Store the file for after sign-in. Resolves the nonce to put in the
 * callback, or null when the browser refuses.
 */
export async function savePendingUpload(
  file: File,
  now: number = Date.now(),
  factory: IDBFactory | null = defaultFactory(),
): Promise<string | null> {
  if (!factory) return null;
  let db: IDBDatabase | null = null;
  try {
    const nonce = newNonce();
    db = await openDb(factory);
    const tx = db.transaction(STORE, 'readwrite');
    const value: StoredPendingUpload = { blob: file, name: file.name, type: file.type, savedAt: now, nonce };
    tx.objectStore(STORE).put(value, KEY);
    await finish(tx);
    setMarker(true);
    return nonce;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Hand over the stored file if `nonce` matches and it is still fresh; the
 * entry is deleted in the same transaction. A wrong nonce leaves the entry
 * untouched (it belongs to whoever holds the right callback); an expired
 * entry is deleted and null returned.
 */
export function takePendingUpload(
  nonce: string,
  now: number = Date.now(),
  factory: IDBFactory | null = defaultFactory(),
): Promise<File | null> {
  if (!NONCE_PATTERN.test(nonce)) return Promise.resolve(null);
  return withEntry<File | null>(factory, null, (value) => {
    if (!value) return { remove: false, result: null };
    if (!isPendingUploadFresh(value.savedAt, now)) return { remove: true, result: null };
    if (value.nonce !== nonce || !(value.blob instanceof Blob)) return { remove: false, result: null };
    return { remove: true, result: new File([value.blob], value.name, { type: value.type }) };
  });
}

/** Delete the stored file if it has expired. Safe to call on every page load. */
export function sweepExpiredPendingUpload(
  now: number = Date.now(),
  factory: IDBFactory | null = defaultFactory(),
): Promise<void> {
  if (markerPresent() === false) return Promise.resolve();
  return withEntry<void>(factory, undefined, (value) => ({
    remove: value !== undefined && !isPendingUploadFresh(value.savedAt, now),
    result: undefined,
  }));
}

/** Delete the stored file whatever its age (sign-out). */
export function clearPendingUpload(factory: IDBFactory | null = defaultFactory()): Promise<void> {
  if (markerPresent() === false) return Promise.resolve();
  return withEntry<void>(factory, undefined, (value) => ({ remove: value !== undefined, result: undefined }));
}
