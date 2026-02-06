"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "../../i18n";
import Header from "../../components/Header";
import { getUserProfile, createSubscription, createPortalSession } from "../../lib/api";
import type { UserProfile } from "../../types";

interface Product {
  id: string;
  credits: number;
  price_usd: number;
}

function BillingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (searchParams.get("success")) {
      setMessage(t("billing.purchaseSuccess"));
    } else if (searchParams.get("canceled")) {
      setMessage(t("billing.purchaseCanceled"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth?callbackUrl=/billing");
    }
  }, [status, router]);

  useEffect(() => {
    async function fetchProducts() {
      const res = await fetch("/api/proxy/api/billing/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const p = await getUserProfile();
        setProfile(p);
      } catch (e) {}
    }
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const handlePurchase = async (packId: string) => {
    setLoading(packId);
    try {
      const res = await fetch(`/api/proxy/api/billing/checkout?pack_id=${packId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkout_url;
      } else {
        setMessage(t("billing.error"));
      }
    } catch (e) {
      setMessage(t("billing.error"));
    }
    setLoading(null);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />
      <main className="max-w-4xl mx-auto p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
          {t("billing.title")}
        </h1>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            {message}
          </div>
        )}

        {/* Subscription Card */}
        <section className="mb-8">
          <div className="rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 p-[1px]">
            <div className="rounded-xl bg-white dark:bg-zinc-950 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.pro.title")}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t("billing.pro.description")}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {t("billing.pro.pricePerMonth", { price: 9.99 })}
                  </div>
                  <div className="mt-3">
                    {profile?.plan === "pro" ? (
                      <button
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await createPortalSession();
                            window.location.href = res.portal_url;
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        {t("profile.plan.manage")}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            const res = await createSubscription();
                            window.location.href = res.checkout_url;
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors"
                      >
                        {t("profile.plan.upgrade")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 uppercase tracking-wide">
          {t("billing.extraTopups")}
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-6 flex flex-col shadow-sm hover:shadow-md transition-colors"
            >
              <h3 className="text-lg font-medium capitalize text-zinc-900 dark:text-zinc-100">
                {product.id}
              </h3>
              <p className="text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-100">
                ${product.price_usd}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                {product.credits.toLocaleString()} {t("credits.credits")}
              </p>
              <button
                onClick={() => handlePurchase(product.id)}
                disabled={loading === product.id}
                className="mt-auto pt-4 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors"
              >
                {loading === product.id ? t("common.loading") : t("billing.purchase")}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
          <div className="animate-pulse text-zinc-500">Loading...</div>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
