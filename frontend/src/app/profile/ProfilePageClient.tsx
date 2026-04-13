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
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { InlineSpinner } from "../../components/ui/InlineSpinner";
import { Bell } from "lucide-react";

function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, tOr } = useLocale();
  usePageTitle(t('profile.title'));

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
    return <LoadingScreen label={t("common.loading")} />;
  }

  return (
    <div className="min-h-screen bg-[var(--page-background)]">
      <Header />
      <main className="max-w-5xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6 dark:text-zinc-100">{t("profile.title")}</h1>

        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-8">
          <aside className="mb-6 md:mb-0">
            <ProfileTabs activeTab={activeTab} onChange={handleTabChange} />
          </aside>

          <div>
            {loading && (
              <div className="flex justify-center py-12">
                <InlineSpinner label={t("common.loading")} />
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

                {activeTab === "notifications" && (
                  <section className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-10 bg-white dark:bg-zinc-900 text-center">
                    <Bell aria-hidden size={28} className="mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
                    <h2 className="text-base font-semibold mb-1 text-zinc-900 dark:text-zinc-100">
                      {tOr("profile.notifications.title", "Notifications")}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                      {tOr(
                        "profile.notifications.empty",
                        "Email notifications and product updates are coming soon."
                      )}
                    </p>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                    >
                      {tOr("profile.notifications.notifyMe", "Email me when available")}
                    </button>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePageClient() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProfileContent />
    </Suspense>
  );
}
