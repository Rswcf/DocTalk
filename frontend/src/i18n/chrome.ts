/**
 * Server-resolved strings for the shared marketing chrome (header + footer +
 * language label). Lets server-rendered locale pages (`/de/...`) put TRANSLATED
 * nav/footer text in the initial HTML instead of the client `useLocale()`
 * default (English at SSR). Only ~30 short strings — passed as props, so no
 * locale JSON ships to the client.
 *
 * All keys already exist and are translated in every locale JSON (the client
 * chrome uses them), so this is plumbing, not new translation work.
 */
import { getServerT } from './server';

export interface ChromeStrings {
  navFeatures: string;
  navPricing: string;
  navTrust: string;
  signIn: string;
  language: string;
  footer: {
    product: string;
    useCases: string;
    resources: string;
    company: string;
    demo: string;
    pricing: string;
    features: string;
    noSignupDemo: string;
    citationHighlighting: string;
    performanceModes: string;
    useCasesLink: string;
    students: string;
    lawyers: string;
    finance: string;
    hrContracts: string;
    compareTools: string;
    alternatives: string;
    blog: string;
    comparisonGuides: string;
    multiFormatSupport: string;
    about: string;
    contact: string;
    trust: string;
    imprint: string;
    privacy: string;
    terms: string;
    doNotSell: string;
    tagline: string;
  };
}

export async function getChromeStrings(locale: string): Promise<ChromeStrings> {
  const { t, tOr } = await getServerT(locale);
  return {
    navFeatures: t('public.nav.features'),
    navPricing: t('footer.pricing'),
    navTrust: tOr('footer.links.trust', 'Security'),
    signIn: t('auth.signIn'),
    language: tOr('header.language', 'Language'),
    footer: {
      product: t('footer.product'),
      useCases: t('footer.useCases'),
      resources: t('footer.resources'),
      company: t('footer.company'),
      demo: t('footer.demo'),
      pricing: t('footer.pricing'),
      features: t('footer.links.features'),
      noSignupDemo: t('footer.links.noSignupDemo'),
      citationHighlighting: t('footer.links.citationHighlighting'),
      performanceModes: t('footer.links.performanceModes'),
      useCasesLink: t('footer.links.useCases'),
      students: t('footer.links.students'),
      lawyers: t('footer.links.lawyers'),
      finance: t('footer.links.finance'),
      hrContracts: t('footer.links.hrContracts'),
      compareTools: t('footer.links.compareTools'),
      alternatives: t('footer.links.alternatives'),
      blog: t('footer.links.blog'),
      comparisonGuides: t('footer.links.comparisonGuides'),
      multiFormatSupport: t('footer.links.multiFormatSupport'),
      about: t('footer.links.about'),
      contact: t('footer.contact'),
      trust: t('footer.links.trust'),
      imprint: tOr('footer.imprint', 'Imprint'),
      privacy: t('privacy.policyLink'),
      terms: t('terms.title'),
      doNotSell: t('footer.doNotSell'),
      tagline: tOr('footer.tagline', 'AI document intelligence. Cite exactly.'),
    },
  };
}
