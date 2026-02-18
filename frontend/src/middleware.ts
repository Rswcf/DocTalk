import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh', 'es', 'ja', 'de', 'fr', 'ko', 'pt', 'it', 'ar', 'hi'];
const DEFAULT_LOCALE = 'en';

function parseAcceptLanguage(header: string): string {
  const languages = header.split(',').map(part => {
    const [lang, quality] = part.trim().split(';q=');
    return { lang: lang.trim().split('-')[0].toLowerCase(), q: quality ? parseFloat(quality) : 1 };
  }).sort((a, b) => b.q - a.q);

  for (const { lang } of languages) {
    if (SUPPORTED_LOCALES.includes(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Only set cookie if not already set
  if (!request.cookies.get('NEXT_LOCALE')) {
    const acceptLang = request.headers.get('accept-language') || '';
    const locale = parseAcceptLanguage(acceptLang);
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
