const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function loadErrorCopyModule() {
  const filename = path.resolve(__dirname, '../src/lib/errorCopy.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const errorCopyModule = new Module(filename, module);
  errorCopyModule.filename = filename;
  errorCopyModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = errorCopyModule.require.bind(errorCopyModule);
  errorCopyModule.require = (request) => {
    if (request === './billingLinks') {
      return {
        billingHref: ({ plan, source, reason }) => `/billing?plan=${plan}&source=${source}&reason=${reason}`,
      };
    }
    return realRequire(request);
  };
  errorCopyModule._compile(compiled, filename);
  return errorCopyModule.exports;
}

const t = () => '';
const tOr = (_key, fallback, params = {}) => Object.entries(params).reduce(
  (copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)),
  fallback,
);

for (const [currentPlan, expectedTarget] of [
  ['free', 'plus'],
  ['plus', 'pro'],
  ['pro', undefined],
]) {
  test(`local upload precheck maps ${currentPlan} to ${expectedTarget || 'no upgrade'}`, () => {
    const { fileTooLargeCopy } = loadErrorCopyModule();
    const copy = fileTooLargeCopy({ plan: currentPlan, max_mb: 200 }, tOr);

    assert.equal(copy.cta?.plan, expectedTarget);
    if (expectedTarget) {
      assert.match(copy.cta.href, new RegExp(`plan=${expectedTarget}`));
    } else {
      assert.equal(copy.cta, undefined);
      assert.match(copy.body, /compress|split/i);
    }
  });

  test(`backend FILE_TOO_LARGE maps ${currentPlan} to ${expectedTarget || 'no upgrade'}`, () => {
    const { errorCopy } = loadErrorCopyModule();
    const copy = errorCopy(
      { code: 'FILE_TOO_LARGE', detail: { plan: currentPlan, max_mb: 200 } },
      t,
      tOr,
    );

    assert.equal(copy.cta?.plan, expectedTarget);
  });
}

test('top-tier collection caps also suppress downgrade CTAs', () => {
  const { errorCopy } = loadErrorCopyModule();
  for (const code of ['COLLECTION_LIMIT_REACHED', 'COLLECTION_DOC_LIMIT_REACHED']) {
    const copy = errorCopy({ code, detail: { plan: 'pro', limit: 999 } }, t, tOr);
    assert.equal(copy.cta, undefined);
    assert.doesNotMatch(copy.body, /upgrade/i);
  }
});
