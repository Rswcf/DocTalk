import type { Highlighter, BundledLanguage } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [],
      }),
    );
  }
  return highlighterPromise;
}

export async function highlightCode(code: string, lang: string): Promise<string> {
  const h = await getHighlighter();
  const requested = (lang || '').toLowerCase().trim();

  let resolvedLang = 'text';
  if (requested && requested !== 'text' && requested !== 'plain') {
    if (!loadedLanguages.has(requested)) {
      try {
        await h.loadLanguage(requested as BundledLanguage);
        loadedLanguages.add(requested);
      } catch {
        // Unknown language — fall back to plaintext
      }
    }
    if (h.getLoadedLanguages().includes(requested)) {
      resolvedLang = requested;
    }
  }

  return h.codeToHtml(code, {
    lang: resolvedLang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}
