"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../../components/Header";
import { useLocale } from "../../i18n";
import ProfileTabs from "../../components/Profile/ProfileTabs";
import ProfileInfoSection from "../../components/Profile/ProfileInfoSection";
import CreditsSection from "../../components/Profile/CreditsSection";
import UsageStatsSection from "../../components/Profile/UsageStatsSection";
import AccountActionsSection from "../../components/Profile/AccountActionsSection";
import { usePageTitle } from "../../lib/usePageTitle";
import { useUserProfile } from "../../lib/useUserProfile";

function ProfileContent() {
  usePageTitle("Profile");

  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();

  const initialTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab || "profile";
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const { profile, loading, error } = useUserProfile();

  // Keep activeTab in sync with URL
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/profile");
    }
  }, [status, router]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Update URL without full navigation
    router.replace(`/profile?tab=${encodeURIComponent(tab)}`);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--page-background)]">
        <div className="animate-pulse">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page-background)]">
      <Header />
      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">{t("profile.title")}</h1>

        <div className="mb-6">
          <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12" role="status">
            <div className="animate-spin motion-reduce:animate-none h-6 w-6 border-2 border-zinc-300 border-t-transparent rounded-full" />
            <span className="ml-3 text-zinc-600 dark:text-zinc-400">{t("common.loading")}</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {t("error.somethingWrong")}
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-6">
            {activeTab === "profile" && (
              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
                <ProfileInfoSection profile={profile} />
              </section>
            )}

            {activeTab === "credits" && (
              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
                <CreditsSection profile={profile} />
              </section>
            )}

            {activeTab === "usage" && (
              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
                <UsageStatsSection profile={profile} />
              </section>
            )}

            {activeTab === "account" && (
              <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 bg-white dark:bg-zinc-900">
                <AccountActionsSection email={profile.email} />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProfilePageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--page-background)]">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
