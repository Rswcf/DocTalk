"use client";

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';

const CONSENT_KEY = 'doctalk_analytics_consent';
const GA_MEASUREMENT_ID = 'G-4JYFBL77WL';

export function AnalyticsWrapper() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const check = () => {
      setConsented(localStorage.getItem(CONSENT_KEY) === 'accepted');
    };
    check();
    window.addEventListener('doctalk:consent-changed', check);
    return () => window.removeEventListener('doctalk:consent-changed', check);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:true});`}
      </Script>
      <Analytics />
    </>
  );
}
