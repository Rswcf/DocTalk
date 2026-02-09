"use client";

import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';

const CONSENT_KEY = 'doctalk_analytics_consent';

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

  return <Analytics />;
}
