"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useLocale } from "../i18n";

export function AuthButton() {
  const { data: session, status } = useSession();
  const { t } = useLocale();

  if (status === "loading") {
    return <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {(session.user as any).image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(session.user as any).image as string}
            alt=""
            className="w-8 h-8 rounded-full"
          />
        )}
        <button
          onClick={() => signOut()}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {t("auth.signOut")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="px-3 py-1.5 text-sm bg-zinc-600 text-white rounded hover:bg-zinc-700 transition-colors"
    >
      {t("auth.signIn")}
    </button>
  );
}

