"use client";

import React from "react";
import { User, CreditCard, BarChart3, Settings, Bell, type LucideIcon } from "lucide-react";
import { useLocale } from "../../i18n";

interface Props {
  activeTab: string;
  onChange: (tab: string) => void;
}

const TABS: Array<{ key: string; labelKey: string; fallback: string; icon: LucideIcon }> = [
  { key: "profile", labelKey: "profile.tabs.profile", fallback: "Profile", icon: User },
  { key: "credits", labelKey: "profile.tabs.credits", fallback: "Credits", icon: CreditCard },
  { key: "usage", labelKey: "profile.tabs.usage", fallback: "Usage", icon: BarChart3 },
  { key: "account", labelKey: "profile.tabs.account", fallback: "Account", icon: Settings },
  { key: "notifications", labelKey: "profile.tabs.notifications", fallback: "Notifications", icon: Bell },
];

export default function ProfileTabs({ activeTab, onChange }: Props) {
  const { tOr } = useLocale();

  return (
    <>
      {/* Mobile: horizontal tabs */}
      <div className="flex gap-2 overflow-x-auto md:hidden" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={
                `shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ` +
                (isActive
                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
                  : `bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700`)
              }
            >
              {tOr(tab.labelKey, tab.fallback)}
            </button>
          );
        })}
      </div>

      {/* Desktop (md+): vertical sidebar */}
      <nav
        className="hidden md:flex md:flex-col md:gap-1 md:sticky md:top-24"
        role="tablist"
        aria-orientation="vertical"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-left focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 transition-colors ` +
                (isActive
                  ? `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900`
                  : `text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800`)
              }
            >
              <Icon aria-hidden size={16} className="shrink-0" />
              <span>{tOr(tab.labelKey, tab.fallback)}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
