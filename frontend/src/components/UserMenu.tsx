"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale } from "../i18n";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const { t } = useLocale();
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

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    const itemCount = itemRefs.current.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusIndex((prev) => (prev + 1) % itemCount);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case "Home":
        e.preventDefault();
        setFocusIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusIndex(itemCount - 1);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }

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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userImage} alt="" className="w-8 h-8 object-cover" />
        ) : (
          <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg z-50 animate-fade-in motion-reduce:animate-none overflow-hidden"
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
