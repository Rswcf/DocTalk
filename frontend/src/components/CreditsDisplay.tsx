"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "../i18n";
import { useDocTalkStore } from "../store";

// Global event emitter for credits refresh
const CREDITS_REFRESH_EVENT = 'doctalk:credits-refresh';

export function triggerCreditsRefresh() {
  window.dispatchEvent(new Event(CREDITS_REFRESH_EVENT));
}

export function CreditsDisplay() {
  const { status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { t } = useLocale();
  const setUserPlan = useDocTalkStore((s) => s.setUserPlan);

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

  // Fetch user plan once on auth
  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/proxy/api/users/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.plan) setUserPlan(data.plan);
        }
      } catch (e) {
        console.error('Failed to load credits:', e);
      }
    })();
  }, [status, setUserPlan]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchCredits();

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Periodic refresh every 60s
    pollingIntervalRef.current = setInterval(fetchCredits, 60_000);

    // Listen for manual refresh events (after chat, purchase, etc.)
    window.addEventListener(CREDITS_REFRESH_EVENT, fetchCredits);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      window.removeEventListener(CREDITS_REFRESH_EVENT, fetchCredits);
    };
  }, [status, fetchCredits]);

  if (status !== "authenticated") return null;
  if (credits === null) return <div className="w-16 h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />;

  return (
    <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-medium">{credits.toLocaleString()}</span>
      <span>{t("credits.credits")}</span>
    </div>
  );
}
