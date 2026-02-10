"use client";

import React from "react";
import { useLocale } from "../../i18n";

interface Props {
  activeTab: string;
  onChange: (tab: string) => void;
}

const TABS: Array<{ key: string; labelKey: string }> = [
  { key: "profile", labelKey: "profile.tabs.profile" },
  { key: "credits", labelKey: "profile.tabs.credits" },
  { key: "usage", labelKey: "profile.tabs.usage" },
  { key: "account", labelKey: "profile.tabs.account" },
];

export default function ProfileTabs({ activeTab, onChange }: Props) {
  const { t } = useLocale();

  return (
    <div className="flex gap-2 overflow-x-auto" role="tablist">
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
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

