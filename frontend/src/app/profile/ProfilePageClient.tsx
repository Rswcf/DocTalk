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
import { Bell, Coins, FileText, MessageSquare, ShieldCheck } from "lucide-react";

function ProfileContent() {
  const { status } = useSession();
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

  const planLabel = profile
    ? profile.plan === "pro"
      ? t("profile.plan.pro")
      : profile.plan === "plus"
        ? t("profile.plan.plus")
        : t("profile.plan.free")
    : "";

  const overviewStats = profile
    ? [
        {
          icon: Coins,
          label: tOr("profile.overview.credits", "Credits available"),
          value: profile.credits_balance.toLocaleString(),
        },
        {
          icon: FileText,
          label: tOr("profile.overview.documents", "Documents"),
          value: profile.stats.total_documents.toLocaleString(),
        },
        {
          icon: MessageSquare,
          label: tOr("profile.overview.messages", "Messages"),
          value: profile.stats.total_messages.toLocaleString(),
        },
      ]
    : [];

  if (status === "loading") {
    return <LoadingScreen label={t("common.loading")} />;
  }

  return (
    <div className="dt-stitch-theme min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <section className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-0 lg:grid-cols-[1fr_440px]">
            <div className="p-6 sm:p-8">
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {tOr("profile.eyebrow", "Account workspace")}
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t("profile.title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
                {tOr(
                  "profile.subtitle",
                  "Manage identity, credits, billing access, usage history, and privacy controls from one place."
                )}
              </p>
              {profile && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  <ShieldCheck aria-hidden="true" size={15} className="text-accent" />
                  <span>{profile.email}</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{planLabel}</span>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950 lg:border-l lg:border-t-0">
              {profile ? (
                <div className="grid h-full grid-cols-3 gap-3">
                  {overviewStats.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <Icon aria-hidden="true" size={16} className="mb-2 text-accent" />
                      <div className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {value}
                      </div>
                      <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8">
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
                  <section
                    role="tabpanel"
                    id="profile-panel-profile"
                    aria-labelledby="profile-tab-profile"
                    tabIndex={0}
                    className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <ProfileInfoSection profile={profile} />
                  </section>
                )}

                {activeTab === "credits" && (
                  <section
                    role="tabpanel"
                    id="profile-panel-credits"
                    aria-labelledby="profile-tab-credits"
                    tabIndex={0}
                    className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <CreditsSection profile={profile} />
                  </section>
                )}

                {activeTab === "usage" && (
                  <section
                    role="tabpanel"
                    id="profile-panel-usage"
                    aria-labelledby="profile-tab-usage"
                    tabIndex={0}
                    className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <UsageStatsSection profile={profile} />
                  </section>
                )}

                {activeTab === "account" && (
                  <section
                    role="tabpanel"
                    id="profile-panel-account"
                    aria-labelledby="profile-tab-account"
                    tabIndex={0}
                    className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <AccountActionsSection email={profile.email} />
                  </section>
                )}

                {activeTab === "notifications" && (
                  <section
                    role="tabpanel"
                    id="profile-panel-notifications"
                    aria-labelledby="profile-tab-notifications"
                    tabIndex={0}
                    className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
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
