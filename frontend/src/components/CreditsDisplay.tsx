"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "../i18n";

// Global event emitter for credits refresh
const CREDITS_REFRESH_EVENT = 'doctalk:credits-refresh';

export function triggerCreditsRefresh() {
  window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT));
}

export function CreditsDisplay() {
  const { status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const { t } = useLocale();

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/api/credits/balance");
      if (res.ok) {
        const data = await res.json();
        setCredits(data.balance);
      }
    } catch (e) {
      console.error("Failed to fetch credits", e);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchCredits();

    // Periodic refresh every 60s
    const interval = setInterval(fetchCredits, 60_000);

    // Listen for manual refresh events (after chat, purchase, etc.)
    window.addEventListener(CREDITS_REFRESH_EVENT, fetchCredits);

    return () => {
      clearInterval(interval);
      window.removeEventListener(CREDITS_REFRESH_EVENT, fetchCredits);
    };
  }, [status, fetchCredits]);

  if (status !== "authenticated" || credits === null) return null;

  return (
    <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-medium">{credits.toLocaleString()}</span>
      <span>{t("credits.credits")}</span>
    </div>
  );
}
