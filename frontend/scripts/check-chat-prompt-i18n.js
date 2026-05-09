const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const localeFiles = ['en', 'zh', 'ja', 'ko', 'es', 'de', 'fr', 'pt', 'it', 'ar', 'hi'];
const requiredKeys = [
  'chat.suggestedExtractTables',
  'chat.suggestedCompareVersions',
  'demo.limitPanel.title',
  'demo.limitPanel.body',
  'demo.limitPanel.cta',
  'landing.proof.citations',
  'landing.proof.private',
  'landing.proof.locales',
];

const failures = [];

for (const locale of localeFiles) {
  const filePath = path.join(localesDir, `${locale}.json`);
  const messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const key of requiredKeys) {
    if (typeof messages[key] !== 'string' || messages[key].trim() === '') {
      failures.push(`${locale}.json missing non-empty ${key}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Chat prompt i18n check failed:\n${failures.join('\n')}`);
}

console.log('critical i18n checks passed');
