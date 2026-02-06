"use client";

import React, { useMemo } from "react";
import type { UserProfile } from "../../types";
import { useLocale } from "../../i18n";

interface Props {
  profile: UserProfile;
}

function getInitials(name: string | null, fallbackEmail: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  return (fallbackEmail?.[0] || "?").toUpperCase();
}

export default function ProfileInfoSection({ profile }: Props) {
  const { t } = useLocale();

  const memberDays = useMemo(() => {
    const created = new Date(profile.created_at).getTime();
    const now = Date.now();
    const days = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
    return days;
  }, [profile.created_at]);

  const planLabel = profile.plan === "pro" ? t("profile.plan.pro") : t("profile.plan.free");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {profile.image ? (
          // Avatar image
          <img
            src={profile.image}
            alt={profile.name || profile.email}
            className="w-16 h-16 rounded-full object-cover border border-gray-200 dark:border-gray-700"
          />
        ) : (
          // Initials fallback
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xl font-semibold">
            {getInitials(profile.name, profile.email)}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold dark:text-gray-100 truncate">
              {profile.name || profile.email}
            </h2>
            <span
              className={
                `px-2 py-0.5 rounded text-xs font-medium ` +
                (profile.plan === "pro"
                  ? `bg-gradient-to-r from-blue-500 to-indigo-600 text-white`
                  : `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`)
              }
            >
              {planLabel}
            </span>
          </div>
          {profile.name && (
            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{profile.email}</div>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t("profile.info.memberSince", { days: memberDays })}
          </div>
        </div>
      </div>

      {profile.connected_accounts && profile.connected_accounts.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {profile.connected_accounts.map((acc, idx) => (
            <div
              key={idx}
              className="px-2 py-1 rounded-md border dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2"
              title={acc.provider}
            >
              {/* Simple provider badge; could be replaced with icon */}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-gray-200 dark:bg-gray-700 text-[10px]">
                {acc.provider?.[0]?.toUpperCase() || "?"}
              </span>
              <span>
                {t("profile.info.connectedWith", { provider: acc.provider })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

