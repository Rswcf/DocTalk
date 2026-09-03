const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadBriefEmptyStateModule() {
  const filename = path.resolve(__dirname, '../src/lib/documentBriefEmptyState.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

function loadSingleFlightModule() {
  const filename = path.resolve(__dirname, '../src/lib/singleFlight.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

test('document brief empty pane renders for a summary without questions', () => {
  const { shouldRenderDocumentBriefEmptyState, truncateDocumentBriefSummary } = loadBriefEmptyStateModule();
  assert.equal(shouldRenderDocumentBriefEmptyState(0, [], 'A useful summary.', false), true);
  assert.equal(shouldRenderDocumentBriefEmptyState(1, [], 'A useful summary.', false), false);
  assert.equal(truncateDocumentBriefSummary(Array.from({ length: 61 }, () => 'word').join(' ')).split(/\s+/).length, 60);

  const chatPanel = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/ChatPanel.tsx'),
    'utf8',
  );
  assert.match(chatPanel, /\{showDocumentBriefEmptyState && \(/);
  assert.match(chatPanel, /\{briefSummary\}/);
  assert.match(chatPanel, /documentBrief\?\.status === 'ready'/);
  assert.match(chatPanel, /usableDocumentBrief\.key_points\.slice\(0, 3\)/);
  assert.doesNotMatch(chatPanel, /documentBrief\.key_points\.slice\(0, 3\)/);

  const reader = fs.readFileSync(
    path.resolve(__dirname, '../src/app/d/[documentId]/DocumentReaderPageClient.tsx'),
    'utf8',
  );
  assert.match(reader, /useDocumentBrief\(/);
  assert.match(reader, /documentBrief=\{documentBrief\}/);
  assert.doesNotMatch(reader, /DocumentBriefPanel/);
});

test('only chat-response failures expose existing regenerate as Retry', () => {
  const bubble = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/MessageBubble.tsx'),
    'utf8',
  );
  assert.match(bubble, /isAssistant && isError && message\.retryAction === 'regenerate' && onRegenerate && !isStreaming/);
  assert.match(bubble, /onClick=\{onRegenerate\}/);
  assert.match(bubble, /tOr\('chat\.retry', 'Retry'\)/);

  const stream = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useChatStream.ts'),
    'utf8',
  );
  assert.equal((stream.match(/retryAction: 'regenerate'/g) || []).length, 2);

  const chatPanel = fs.readFileSync(
    path.resolve(__dirname, '../src/components/Chat/ChatPanel.tsx'),
    'utf8',
  );
  assert.doesNotMatch(chatPanel, /retryAction:/);
});

test('the same rendered regenerate callback is single-flight before accounting', async () => {
  const { acquireSingleFlight } = loadSingleFlightModule();
  const latch = { current: false };
  let resolveRequest;
  const request = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  let regenerations = 0;
  let accountingMutations = 0;

  const renderedCallback = async () => {
    const release = acquireSingleFlight(latch, () => false);
    if (!release) return;
    try {
      regenerations += 1;
      accountingMutations += 1;
      await request;
    } finally {
      release();
    }
  };

  const first = renderedCallback();
  const second = renderedCallback();

  assert.equal(regenerations, 1);
  assert.equal(accountingMutations, 1);
  resolveRequest();
  await Promise.all([first, second]);

  const stream = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useChatStream.ts'),
    'utf8',
  );
  assert.equal((stream.match(/acquireSingleFlight\(/g) || []).length, 2);
  assert.match(stream, /useDocTalkStore\.getState\(\)\.isStreaming/);
});

test('document brief polling responses are guarded by a switch token', () => {
  const hook = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/useDocumentBrief.ts'),
    'utf8',
  );
  assert.match(hook, /requestScopeRef\.current = \{ documentId \}/);
  assert.match(hook, /if \(requestScopeRef\.current !== scope\) return null/);
  assert.match(hook, /if \(!result \|\| requestScopeRef\.current !== result\.scope\) return/);
  assert.doesNotMatch(hook, /void refresh\(\)\.catch/);
});

test('dashboard nudge uses durable 1-document and 3-message eligibility without lifetime cap', () => {
  const dashboard = fs.readFileSync(
    path.resolve(__dirname, '../src/components/dashboard/DashboardPageClient.tsx'),
    'utf8',
  );
  assert.match(dashboard, /readyDocumentCount >= 1[\s\S]*profile\?\.stats\.total_messages \|\| 0\) >= 3/);
  assert.doesNotMatch(dashboard, /DASHBOARD_NUDGE_MAX_IMPRESSIONS/);
  assert.match(dashboard, /Pro answers without the monthly cap/);
});
