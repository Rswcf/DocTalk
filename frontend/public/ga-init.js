// GA4 init — must stay in sync with GA_MEASUREMENT_ID in
// frontend/src/components/AnalyticsWrapper.tsx. If you change one, change
// both. (Single source via env would force Next to make this page dynamic,
// losing static prerender — see .collab/plans/p3-csp-nonce-plan.md.)
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-4JYFBL77WL', { send_page_view: true });
