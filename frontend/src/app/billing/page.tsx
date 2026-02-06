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
      } catch (e) {
        // ignore; default CTA will show
      }
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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen dark:bg-gray-900">
      <Header />
      <main className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6 dark:text-gray-100">
          {t("billing.title")}
        </h1>

        {message && (
          <div className="mb-6 p-4 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            {message}
          </div>
        )}

        {/* Subscription Card */}
        <section className="mb-8">
          <div className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 p-[1px]">
            <div className="rounded-xl bg-white dark:bg-gray-900 p-6 border border-transparent dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold dark:text-gray-100">{t("billing.pro.title")}</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{t("billing.pro.description")}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold dark:text-gray-100">
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
                        className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
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
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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

        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
          {t("billing.extraTopups")}
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="border dark:border-gray-700 rounded-lg p-6 flex flex-col"
            >
              <h3 className="text-lg font-medium capitalize dark:text-gray-100">
                {product.id}
              </h3>
              <p className="text-3xl font-bold mt-2 dark:text-gray-100">
                ${product.price_usd}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {product.credits.toLocaleString()} {t("credits.credits")}
              </p>
              <button
                onClick={() => handlePurchase(product.id)}
                disabled={loading === product.id}
                className="mt-auto pt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
        <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
