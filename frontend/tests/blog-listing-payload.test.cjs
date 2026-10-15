const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const { isValidElement } = require('react');
const ts = require('typescript');

// A client component prop is serialised into the page's RSC payload. The /blog
// index and the category pages passed full posts to their client components,
// so /blog carried the whole markdown of every post (352,256 bytes locally,
// 2026-10-14). Only the fields the listing cards render may cross to the client.

const INDEX_FIELDS = ['category', 'date', 'description', 'readingMinutes', 'slug', 'title'];
const CATEGORY_FIELDS = ['date', 'description', 'readingMinutes', 'slug', 'title'];

function loadTs(relPath, stubs = {}) {
  const filename = path.resolve(__dirname, relPath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = mod.require.bind(mod);
  mod.require = (request) => (request in stubs ? stubs[request] : realRequire(request));
  mod._compile(compiled, filename);
  return mod.exports;
}

const FRONTEND = path.resolve(__dirname, '..');

function loadBlog() {
  // lib/blog.ts fixes its content directory from the working directory at load.
  const cwd = process.cwd();
  process.chdir(FRONTEND);
  try {
    const blog = loadTs('../src/lib/blog.ts');
    return { blog, posts: blog.getAllPosts() };
  } finally {
    process.chdir(cwd);
  }
}

const SEO_STUB = { buildMarketingMetadata: () => ({}) };

function pick(post, fields) {
  return Object.fromEntries(fields.map((field) => [field, post[field]]));
}

// Walks every prop, not only children, and every array, Set or Map, so a client
// element placed anywhere in the returned tree (a Suspense fallback, say) is
// found, once per place it occurs. `path` only stops cycles.
function findElements(node, type, path = new Set()) {
  if (!node || typeof node !== 'object' || path.has(node)) return [];
  path.add(node);
  const element = isValidElement(node);
  let values;
  if (element) values = Object.values(node.props || {});
  else if (typeof node[Symbol.iterator] === 'function') values = Array.from(node);
  else values = Object.values(node);
  const own = element && node.type === type ? [node] : [];
  const found = own.concat(values.flatMap((value) => findElements(value, type, path)));
  path.delete(node);
  return found;
}

// Renders the real page with its client component stubbed and reads the props
// every instance of that client would serialise. Full posts handed to some other
// client component (a context provider, say) are outside what this test sees.
test('the blog index hands the client only post summaries', () => {
  const { blog, posts } = loadBlog();
  assert.ok(posts.length > 0, 'no blog posts found');
  function BlogIndexClientStub() {
    return null;
  }
  const { default: BlogPage } = loadTs('../src/app/blog/page.tsx', {
    '../../lib/blog': blog,
    './BlogIndexClient': BlogIndexClientStub,
    '../../lib/seo': SEO_STUB,
  });

  const clients = findElements(BlogPage(), BlogIndexClientStub);
  assert.equal(clients.length, 1, 'expected one BlogIndexClient');
  const [client] = clients;
  assert.deepEqual(Object.keys(client.props).sort(), ['posts']);
  // Same posts in the same order as before the change, reduced to the card fields.
  assert.deepEqual(client.props.posts, posts.map((post) => pick(post, INDEX_FIELDS)));
  for (const summary of client.props.posts) {
    assert.deepEqual(Object.keys(summary).sort(), INDEX_FIELDS, summary.slug);
  }
});

test('each category page hands the client only post summaries', () => {
  const { blog, posts } = loadBlog();
  function CategoryClientStub() {
    return null;
  }
  const notFound = () => {
    throw new Error('notFound');
  };
  const { default: CategoryPage } = loadTs('../src/app/blog/category/[category]/page.tsx', {
    '../../../../lib/blog': blog,
    './CategoryClient': CategoryClientStub,
    'next/navigation': { notFound },
    '../../../../lib/seo': SEO_STUB,
  });

  let summaries = 0;
  for (const category of blog.KNOWN_BLOG_CATEGORIES) {
    const clients = findElements(CategoryPage({ params: { category } }), CategoryClientStub);
    assert.equal(clients.length, 1, `${category}: expected one CategoryClient`);
    const [client] = clients;
    assert.deepEqual(
      Object.keys(client.props).sort(),
      ['category', 'description', 'label', 'posts'],
      category,
    );
    const expected = posts
      .filter((post) => post.category === category)
      .map((post) => pick(post, CATEGORY_FIELDS));
    assert.deepEqual(client.props.posts, expected, category);
    for (const summary of client.props.posts) {
      assert.deepEqual(Object.keys(summary).sort(), CATEGORY_FIELDS, `${category}: ${summary.slug}`);
      summaries += 1;
    }
  }
  assert.ok(summaries > 0, 'no category has posts, the check proves nothing');
  assert.throws(() => CategoryPage({ params: { category: 'no-such-category' } }), /notFound/);
});
