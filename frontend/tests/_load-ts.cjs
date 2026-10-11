// Shared require hook for unit tests: lets `require()` load the app's .ts
// modules (and their relative .ts imports) by transpiling them to CommonJS.
// Type-only imports are erased; ESM-only packages load through Node's
// require(esm). Not a *.test.cjs file, so `node --test tests/*.test.cjs`
// never runs it on its own.
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

if (!Module._extensions['.ts']) {
  Module._extensions['.ts'] = function loadTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    module._compile(outputText, filename);
  };
}

module.exports = {};
