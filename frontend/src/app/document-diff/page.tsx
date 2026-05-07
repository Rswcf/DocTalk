"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "../../components/Header";
import DocumentDiffPanel from "../../components/Diff/DocumentDiffPanel";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { useLocale } from "../../i18n";
import { useUserPlanProfile } from "../../lib/useUserPlanProfile";

export default function DocumentDiffPage() {
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLocale();
  const { userPlan } = useUserPlanProfile();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/document-diff");
    }
  }, [router, status]);

  if (status === "loading") {
    return <LoadingScreen label={t("common.loading")} />;
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[var(--page-background)]">
      <Header variant="full" />
      <main className="min-h-0 flex-1">
        <DocumentDiffPanel userPlan={userPlan} />
      </main>
    </div>
  );
}
