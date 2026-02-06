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
    <div className="flex gap-2 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={
              `shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ` +
              (isActive
                ? `bg-blue-600 text-white`
                : `bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700`)
            }
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

