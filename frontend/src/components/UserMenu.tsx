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
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  if (status === "loading") {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn()}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userImage} alt="" className="w-8 h-8 object-cover" />
        ) : (
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-50"
          role="menu"
        >
          <div
            className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => go("/profile")}
            role="menuitem"
          >
            {t("userMenu.profile")}
          </div>
          <div
            className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => go("/billing")}
            role="menuitem"
          >
            {t("userMenu.buyCredits")}
          </div>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <div
            className="px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            role="menuitem"
          >
            {t("userMenu.signOut")}
          </div>
        </div>
      )}
    </div>
  );
}

