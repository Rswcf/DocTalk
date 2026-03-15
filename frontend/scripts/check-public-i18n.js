const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const localesDir = path.join(projectRoot, 'src', 'i18n', 'locales');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertLocaleCoverage() {
  const enPath = path.join(localesDir, 'en.json');
  const en = readJson(enPath);
  const enKeys = Object.keys(en);
  const localeFiles = fs.readdirSync(localesDir).filter((file) => file.endsWith('.json') && file !== 'en.json');

  const missing = [];

  for (const file of localeFiles) {
    const data = readJson(path.join(localesDir, file));
    const missingKeys = enKeys.filter((key) => !(key in data));
    const emptyKeys = enKeys.filter((key) => typeof data[key] !== 'string' || data[key].trim() === '');
    if (missingKeys.length > 0) {
      missing.push(`${file}: missing ${missingKeys.length} keys`);
    }
    if (emptyKeys.length > 0) {
      missing.push(`${file}: empty ${emptyKeys.length} keys`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Locale coverage check failed:\n${missing.join('\n')}`);
  }
}

function assertNoKnownRegressionPatterns() {
  const fileChecks = [
    {
      file: path.join(projectRoot, 'src', 'app', 'HomePageClient.tsx'),
      banned: [
        'Explore by workflow',
        'Start with the page that matches your question',
        'All features',
        'All use cases',
        'Compare tools',
        'Browse alternatives',
      ],
    },
    {
      file: path.join(projectRoot, 'src', 'components', 'PublicHeader.tsx'),
      banned: ['Sign in to DocTalk'],
    },
    {
      file: path.join(projectRoot, 'src', 'components', 'Footer.tsx'),
      banned: [
        'AI document chat for PDFs, spreadsheets, contracts, and research reports.',
        'Comparison Guides',
        'Multi-Format Support',
      ],
    },
    {
      file: path.join(projectRoot, 'src', 'app', 'blog', 'BlogIndexClient.tsx'),
      banned: ["toLocaleDateString('en-US'", 'readingTime'],
    },
    {
      file: path.join(projectRoot, 'src', 'app', 'blog', 'category', '[category]', 'CategoryClient.tsx'),
      banned: ["toLocaleDateString('en-US'", 'readingTime', 'Continue from this topic', 'Browse All Posts'],
    },
    {
      file: path.join(projectRoot, 'src', 'app', 'blog', '[slug]', 'BlogPostClient.tsx'),
      banned: [
        'Back to Blog',
        'On this page',
        'Table of Contents',
        'Related Articles',
        'About DocTalk',
        'Try Free Demo',
        'Explore DocTalk Features',
        'Try DocTalk Free — No Signup Required',
        'Launch Demo',
      ],
    },
    {
      file: path.join(projectRoot, 'src', 'components', 'seo', 'ArticleMeta.tsx'),
      banned: ["toLocaleDateString('en-US'", '>Published<', '>Updated<'],
    },
  ];

  const failures = [];

  for (const check of fileChecks) {
    const contents = fs.readFileSync(check.file, 'utf8');
    for (const pattern of check.banned) {
      if (contents.includes(pattern)) {
        failures.push(`${path.relative(projectRoot, check.file)} contains banned pattern: ${pattern}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Regression pattern check failed:\n${failures.join('\n')}`);
  }
}

function main() {
  assertLocaleCoverage();
  assertNoKnownRegressionPatterns();
  console.log('public i18n checks passed');
}

main();
