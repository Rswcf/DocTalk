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

function loadTs(relPath) {
  const filename = path.resolve(__dirname, relPath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  return mod.exports;
}

const FRONTEND = path.resolve(__dirname, '..');
const PAGE = path.join(FRONTEND, 'src/app/blog/[slug]/page.tsx');
const CLIENT = path.join(FRONTEND, 'src/app/blog/[slug]/BlogPostClient.tsx');

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

test('the post page passes related summaries, never full posts, to the client', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.match(page, /const related = getRelatedPosts\(post\);/);
  assert.match(page, /relatedPosts=\{related\}/);

  const client = fs.readFileSync(CLIENT, 'utf8');
  assert.match(client, /relatedPosts: RelatedPostSummary\[\];/);
  assert.match(client, /function RelatedPosts\(\{ posts \}: \{ posts: RelatedPostSummary\[\] \}\)/);
  assert.doesNotMatch(client, /relatedPosts: BlogPost\[\]/);
});
