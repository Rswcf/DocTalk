// Guest "use your own document" → sign-in → automatic upload
// (plan .collab/plans/2026-11-22-guest-trial-flow-pangram.md, P0).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./_load-ts.cjs');

const src = path.resolve(__dirname, '../src');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const pending = require(path.join(src, 'lib/pendingUpload.ts'));
const formats = require(path.join(src, 'lib/uploadFormats.ts'));

// Minimal in-memory IndexedDB: enough of open / transaction / get / put /
// delete for lib/pendingUpload.ts, with callbacks fired asynchronously like
// the real thing. `refuse` makes open() fail (private windows, quota).
function fakeIndexedDB({ refuse = false } = {}) {
  const stores = new Map();
  const later = (fn) => setTimeout(fn, 0);
  const request = (fn) => {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    later(() => {
      try {
        req.result = fn();
        req.onsuccess?.();
      } catch (err) {
        req.error = err;
        req.onerror?.();
      }
    });
    return req;
  };
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name) => stores.set(name, new Map()),
    close() {},
    transaction(name) {
      const data = stores.get(name);
      let pendingOps = 0;
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      const track = (fn) => {
        pendingOps += 1;
        return request(() => {
          const result = fn();
          pendingOps -= 1;
          // Like IndexedDB: the transaction completes once no request is left,
          // after the success callbacks (which may queue more requests) ran.
          later(() => later(() => { if (pendingOps === 0 && tx.oncomplete) { const done = tx.oncomplete; tx.oncomplete = null; done(); } }));
          return result;
        });
      };
      tx.objectStore = () => ({
        get: (key) => track(() => data.get(key)),
        put: (value, key) => track(() => data.set(key, value)),
        delete: (key) => track(() => data.delete(key)),
      });
      return tx;
    },
  };
  return {
    stores,
    open() {
      const req = { result: db, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      later(() => {
        if (refuse) {
          req.error = new Error('refused');
          req.onerror?.();
          return;
        }
        if (!stores.size) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

test('upload formats match the backend list', () => {
  assert.ok(formats.isSupportedUploadFile({ name: 'Report.PDF', type: '' }));
  assert.ok(formats.isSupportedUploadFile({ name: 'notes', type: 'text/markdown' }));
  assert.ok(!formats.isSupportedUploadFile({ name: 'photo.png', type: 'image/png' }));
  assert.ok(!formats.isSupportedUploadFile({ name: 'archive', type: '' }));
  for (const ext of ['.pdf', '.docx', '.pptx', '.xlsx', '.txt', '.md']) {
    assert.ok(formats.UPLOAD_ACCEPT.split(',').includes(ext), `${ext} missing from accept`);
  }
});

test('a pending file is fresh for 30 minutes only', () => {
  const now = 10_000_000;
  assert.ok(pending.isPendingUploadFresh(now - 1000, now));
  assert.ok(!pending.isPendingUploadFresh(now - pending.PENDING_UPLOAD_TTL_MS, now));
  assert.ok(!pending.isPendingUploadFresh(now + 5000, now), 'a timestamp from the future is not trusted');
  assert.ok(!pending.isPendingUploadFresh(Number.NaN, now));
});

test('save then take returns the file once, then nothing', async () => {
  const idb = fakeIndexedDB();
  const file = new File(['%PDF-1.7 hello'], 'brief.pdf', { type: 'application/pdf' });
  assert.equal(await pending.savePendingUpload(file, 1000, idb), true);
  const taken = await pending.takePendingUpload(2000, idb);
  assert.ok(taken instanceof File);
  assert.equal(taken.name, 'brief.pdf');
  assert.equal(taken.type, 'application/pdf');
  assert.equal(await taken.text(), '%PDF-1.7 hello');
  assert.equal(await pending.takePendingUpload(3000, idb), null, 'second take must find nothing');
});

test('an expired file is deleted, not returned', async () => {
  const idb = fakeIndexedDB();
  const file = new File(['x'], 'old.txt', { type: 'text/plain' });
  await pending.savePendingUpload(file, 0, idb);
  assert.equal(await pending.takePendingUpload(pending.PENDING_UPLOAD_TTL_MS + 1, idb), null);
  assert.equal(idb.stores.get('uploads').size, 0);
});

test('a new pick replaces the old one', async () => {
  const idb = fakeIndexedDB();
  await pending.savePendingUpload(new File(['a'], 'a.txt'), 1, idb);
  await pending.savePendingUpload(new File(['b'], 'b.txt'), 2, idb);
  assert.equal((await pending.takePendingUpload(3, idb)).name, 'b.txt');
});

test('a browser without IndexedDB degrades to a plain failure', async () => {
  const file = new File(['x'], 'x.txt');
  assert.equal(await pending.savePendingUpload(file, 1, null), false);
  assert.equal(await pending.takePendingUpload(1, null), null);
  const refusing = fakeIndexedDB({ refuse: true });
  assert.equal(await pending.savePendingUpload(file, 1, refusing), false);
  assert.equal(await pending.takePendingUpload(1, refusing), null);
});

test('the guest entry hands the file to sign-in and the dashboard takes it back', () => {
  const entry = read('components/marketing/GuestUploadEntry.tsx');
  assert.match(entry, /savePendingUpload\(file\)/);
  assert.match(entry, /RESUME_UPLOAD_CALLBACK = '\/\?resumeUpload=1'/);
  assert.match(entry, /pendingFileName: file\.name/);
  // Each marketing view keeps exactly one filled action (.claude/rules/frontend.md).
  assert.doesNotMatch(entry, /className="ed-cta"/);
  assert.doesNotMatch(entry, /className=["'{][^\n]*dt-editorial/, 'kit components never open the editorial root');

  const dashboard = read('components/dashboard/DashboardPageClient.tsx');
  assert.match(dashboard, /takePendingUpload\(\)/);
  assert.match(dashboard, /onFiles\(file, 'pending_upload_resume'\)/);
  assert.match(dashboard, /if \(!new URLSearchParams\(window.location.search\).has\('resumeUpload'\)\) return;/, 'resume only on the return from the guest sign-in');

  assert.match(read('components/landing/HeroSection.tsx'), /<GuestUploadEntry variant="link" location="hero" \/>/);
  assert.match(read('app/demo/DemoPageClient.tsx'), /<GuestUploadEntry variant="dropzone" location="demo_dropzone" \/>/);
});

test('every sign-in wall tells the modal where it was opened', () => {
  const files = [
    'components/Chat/ChatPanel.tsx',
    'components/Quotes/QuoteFinderPanel.tsx',
    'app/d/[documentId]/DocumentReaderPageClient.tsx',
    'components/marketing/GuestUploadEntry.tsx',
  ];
  for (const rel of files) {
    const code = read(rel);
    const calls = code.match(/openAuthModal\([^)]*\)/g) || [];
    assert.ok(calls.length > 0, `${rel}: no openAuthModal call found`);
    for (const call of calls) assert.match(call, /\blocation\b/, `${rel}: ${call} has no location`);
  }
  const modal = read('components/AuthModal.tsx');
  assert.match(modal, /location: peekAuthModalLocation\(\)/);
});

test('guest upload copy exists in all 11 locales', () => {
  const LOCALES = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
  const keys = [
    'auth.pendingUpload.title', 'auth.pendingUpload.body',
    'guestUpload.cta', 'guestUpload.title', 'guestUpload.body', 'guestUpload.choose',
    'guestUpload.dropHint', 'guestUpload.unsupported', 'guestUpload.tooLarge', 'guestUpload.notKept',
    'demo.freeNoSignup',
  ];
  for (const locale of LOCALES) {
    const messages = JSON.parse(read(`i18n/locales/${locale}.json`));
    for (const key of keys) {
      assert.ok(typeof messages[key] === 'string' && messages[key].trim(), `${key} missing in ${locale}.json`);
    }
    assert.match(messages['guestUpload.tooLarge'], /\{max\}/, `${locale}: tooLarge must keep {max}`);
  }
});
