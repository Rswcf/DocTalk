"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GitCompare } from "lucide-react";
import DocumentDiffPanel from "../../components/Diff/DocumentDiffPanel";
import MarketingShell from "../../components/marketing/MarketingShell";
import EdPageHero from "../../components/marketing/EdPageHero";
import EdSection from "../../components/marketing/EdSection";
import { useLocale } from "../../i18n";
import { useUserPlanProfile } from "../../lib/useUserPlanProfile";

export default function DocumentDiffPage() {
  const router = useRouter();
  const { status } = useSession();
  const { t, tOr } = useLocale();
  const { userPlan } = useUserPlanProfile();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/document-diff");
    }
  }, [router, status]);

  return (
    <MarketingShell
      breadcrumb={[
        { label: tOr("diff.breadcrumbHome", "Home"), href: "/" },
        { label: tOr("diff.pageTitle", "Document diff") },
      ]}
    >
      <EdPageHero
        icon={GitCompare}
        eyebrow={tOr("diff.kicker", "Semantic document diff")}
        title={tOr("diff.title", "Compare two versions with cited changes")}
        lede={tOr("diff.subtitle", "DocTalk identifies added, removed, and modified meaning with old/new citations so reviewers can verify both sides.")}
      />

      <EdSection>
        {status !== "authenticated" ? (
          <p className="ed-caption">{t("common.loading")}</p>
        ) : (
          <DocumentDiffPanel userPlan={userPlan} surface="editorial" />
        )}
      </EdSection>
    </MarketingShell>
  );
}
