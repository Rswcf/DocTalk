"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "../i18n";

export function CreditsDisplay() {
  const { data: session, status } = useSession();
  const [credits, setCredits] = useState<number | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchCredits() {
      try {
        const res = await fetch("/api/proxy/api/credits/balance");
        if (res.ok) {
          const data = await res.json();
          setCredits(data.balance);
        }
      } catch (e) {
        console.error("Failed to fetch credits", e);
      }
    }

    fetchCredits();
  }, [status]);

  if (status !== "authenticated" || credits === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-medium">{credits.toLocaleString()}</span>
      <span>{t("credits.credits")}</span>
    </div>
  );
}

