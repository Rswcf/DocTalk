const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// A client component prop is serialised into the page's RSC payload. The blog
// post page passed three full related posts to BlogPostClient, so every post's
// HTML carried the whole markdown of three other posts (2026-10-14). Only the
// fields the related-post card renders may cross to the client.

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

test('getRelatedPosts returns only slug, title and description', () => {
  const { blog, posts } = loadBlog();
  assert.ok(posts.length > 0, 'no blog posts found');
  let cards = 0;
  for (const post of posts) {
    const related = blog.getRelatedPosts(post);
    for (const card of related) {
      assert.deepEqual(Object.keys(card).sort(), ['description', 'slug', 'title'], post.slug);
      cards += 1;
    }
  }
  assert.ok(cards > 0, 'no post has related posts, the check proves nothing');
});

test('getRelatedPosts keeps the selection: same category, not itself, first 3 by date', () => {
  const { blog, posts } = loadBlog();
  for (const post of posts) {
    const expected = posts
      .filter((p) => p.category === post.category && p.slug !== post.slug)
      .slice(0, 3)
      .map((p) => ({ slug: p.slug, title: p.title, description: p.description }));
    assert.deepEqual(blog.getRelatedPosts(post), expected, post.slug);
  }
});

// Renders the real page with BlogPostClient stubbed and reads the props it
// would serialise, so any way of putting full posts back into them fails.
test('the post page hands the client only related summaries', () => {
  const { blog, posts } = loadBlog();
  function BlogPostClientStub() {
    return null;
  }
  const { default: BlogPostPage } = loadTs('../src/app/blog/[slug]/page.tsx', {
    '../../../lib/blog': blog,
    './BlogPostClient': BlogPostClientStub,
    'next/navigation': { notFound: () => { throw new Error('notFound'); } },
    '../../../lib/seo': {
      buildArticleJsonLd: () => ({}),
      buildMarketingMetadata: () => ({}),
      DEFAULT_SHARE_ALT: '',
      resolveShareImage: () => '',
    },
    // The real helpers, so the FAQ and ranked-list branches run for the posts that have them.
    '../../../lib/blogSchema': loadTs('../src/lib/blogSchema.ts', {
      './blogHeadings': loadTs('../src/lib/blogHeadings.ts'),
    }),
  });

  const findClients = (node) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(findClients);
    if (node.type === BlogPostClientStub) return [node];
    return findClients(node.props && node.props.children);
  };

  let cards = 0;
  for (const post of posts) {
    const clients = findClients(BlogPostPage({ params: { slug: post.slug } }));
    assert.equal(clients.length, 1, `${post.slug}: expected one BlogPostClient`);
    const [client] = clients;
    assert.deepEqual(Object.keys(client.props).sort(), ['post', 'relatedPosts'], post.slug);
    const { relatedPosts } = client.props;
    assert.deepEqual(relatedPosts, blog.getRelatedPosts(post), post.slug);
    for (const card of relatedPosts) {
      assert.deepEqual(Object.keys(card).sort(), ['description', 'slug', 'title'], post.slug);
      cards += 1;
    }
  }
  assert.ok(cards > 0, 'no post has related posts, the check proves nothing');
});
