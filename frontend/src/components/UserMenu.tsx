"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LOCALES, useLocale } from "../i18n";
import type { Locale } from "../i18n";
import { useDropdownKeyboard } from "../lib/useDropdownKeyboard";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const { t, locale, setLocale } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setFocusIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && focusIndex >= 0 && itemRefs.current[focusIndex]) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [open, focusIndex]);

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const handleMenuKeyDown = useDropdownKeyboard(
    3,
    focusIndex,
    setFocusIndex,
    (index) => {
      if (index === 0) {
        go("/profile");
      } else if (index === 1) {
        go("/billing");
      } else if (index === 2) {
        setOpen(false);
        signOut();
      }
    },
    () => {
      setOpen(false);
      triggerRef.current?.focus();
    },
  );

  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="px-3 py-1.5 text-sm bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      >
        {t("auth.signIn")}
      </button>
    );
  }

  const userImage = (session.user as any).image as string | undefined;

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="User menu"
      >
        {userImage ? (
          <Image src={userImage} alt="" width={32} height={32} className="w-8 h-8 object-cover" />
        ) : (
          <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 animate-fade-in motion-reduce:animate-none overflow-hidden"
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          <button
            ref={(el) => { itemRefs.current[0] = el; }}
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            onClick={() => go("/profile")}
            role="menuitem"
            tabIndex={focusIndex === 0 ? 0 : -1}
          >
            {t("userMenu.profile")}
          </button>
          <button
            ref={(el) => { itemRefs.current[1] = el; }}
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            onClick={() => go("/billing")}
            role="menuitem"
            tabIndex={focusIndex === 1 ? 0 : -1}
          >
            {t("userMenu.buyCredits")}
          </button>
          <div className="sm:hidden border-t border-zinc-100 dark:border-zinc-700 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("header.theme")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2" onKeyDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  resolvedTheme === "light"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
                onClick={() => setTheme("light")}
              >
                {t("header.lightMode")}
              </button>
              <button
                type="button"
                className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  resolvedTheme === "dark"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
                onClick={() => setTheme("dark")}
              >
                {t("header.darkMode")}
              </button>
            </div>
          </div>
          <div className="sm:hidden border-t border-zinc-100 dark:border-zinc-700 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("header.language")}
            </p>
            <div className="mt-2" onKeyDown={(e) => e.stopPropagation()}>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
                aria-label={t("header.language")}
              >
                {LOCALES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <hr className="my-1 border-zinc-100 dark:border-zinc-700" />
          <button
            ref={(el) => { itemRefs.current[2] = el; }}
            type="button"
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-inset"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            role="menuitem"
            tabIndex={focusIndex === 2 ? 0 : -1}
          >
            {t("userMenu.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
