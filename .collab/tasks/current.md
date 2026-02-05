# Current Tasks: Auth + Credits + Billing — Phase 4 & 5

ISSUED_BY: CC
DATE: 2026-02-05
PLAN_REF: .collab/plans/003-auth-credits-billing-v3.md (APPROVED)
PHASES 1-3: COMPLETED

---

## Overview

Phase 4: Stripe billing integration
Phase 5: Frontend credits display and paywall

---

## Task 4.1: Create Billing API

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Create Stripe billing endpoints.

    **File:** `backend/app/api/billing.py`

    ```python
    from __future__ import annotations
    import uuid
    from typing import Literal
    from fastapi import APIRouter, Depends, HTTPException, Request
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    import stripe
    from app.core.config import settings
    from app.core.deps import get_db_session, require_auth
    from app.models.tables import User, CreditLedger
    from app.services.credit_service import credit_credits

    router = APIRouter(prefix="/api/billing", tags=["billing"])

    stripe.api_key = settings.STRIPE_SECRET_KEY


    @router.get("/products")
    async def list_products():
        return {
            "products": [
                {"id": "starter", "credits": settings.CREDITS_STARTER, "price_usd": 5},
                {"id": "pro", "credits": settings.CREDITS_PRO, "price_usd": 15},
                {"id": "enterprise", "credits": settings.CREDITS_ENTERPRISE, "price_usd": 50},
            ]
        }


    @router.post("/checkout")
    async def create_checkout(
        pack_id: Literal["starter", "pro", "enterprise"],
        user: User = Depends(require_auth),
    ):
        if not settings.STRIPE_SECRET_KEY:
            raise HTTPException(503, "Stripe not configured")

        price_map = {
            "starter": (settings.STRIPE_PRICE_STARTER, settings.CREDITS_STARTER),
            "pro": (settings.STRIPE_PRICE_PRO, settings.CREDITS_PRO),
            "enterprise": (settings.STRIPE_PRICE_ENTERPRISE, settings.CREDITS_ENTERPRISE),
        }
        price_id, credits = price_map[pack_id]

        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/billing?success=1",
            cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=1",
            client_reference_id=str(user.id),
            metadata={"credits": str(credits), "pack_id": pack_id},
        )
        return {"checkout_url": session.url}


    @router.post("/webhook")
    async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db_session)):
        payload = await request.body()
        sig = request.headers.get("stripe-signature")

        if not settings.STRIPE_WEBHOOK_SECRET:
            raise HTTPException(503, "Webhook not configured")

        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(400, "Invalid payload")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(400, "Invalid signature")

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = uuid.UUID(session["client_reference_id"])
            credits = int(session["metadata"]["credits"])
            payment_intent = session.get("payment_intent")

            # Idempotency check
            existing = await db.scalar(
                select(CreditLedger).where(
                    CreditLedger.ref_type == "stripe_payment",
                    CreditLedger.ref_id == payment_intent,
                )
            )

            if not existing:
                await credit_credits(
                    db, user_id, credits,
                    reason="purchase",
                    ref_type="stripe_payment",
                    ref_id=payment_intent,
                )
                await db.commit()

        return {"received": True}
    ```

    Register in main.py.

- ACCEPTANCE:
    - `/api/billing/products` returns product list
    - `/api/billing/checkout` creates Stripe session
    - `/api/billing/webhook` handles checkout.session.completed
- FILES:
    - `backend/app/api/billing.py` (NEW)
    - `backend/app/main.py` (MODIFY)

---

## Task 4.2: Add Stripe Config

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Add Stripe configuration to settings.

    **Modify:** `backend/app/core/config.py`

    Add to Settings class:
    ```python
    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_STARTER: str = "price_starter"
    STRIPE_PRICE_PRO: str = "price_pro"
    STRIPE_PRICE_ENTERPRISE: str = "price_enterprise"

    # Credit amounts
    CREDITS_STARTER: int = 50000
    CREDITS_PRO: int = 200000
    CREDITS_ENTERPRISE: int = 1000000
    SIGNUP_BONUS_CREDITS: int = 10000
    ```

- ACCEPTANCE:
    - Settings include all Stripe config
- FILES:
    - `backend/app/core/config.py` (MODIFY)

---

## Task 5.1: Create CreditsDisplay Component

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Create component to show credits balance in header.

    **File:** `frontend/src/components/CreditsDisplay.tsx`

    ```typescript
    "use client";

    import { useEffect, useState } from "react";
    import { useSession } from "next-auth/react";
    import { useLocale } from "../i18n";

    export function CreditsDisplay() {
      const { data: session, status } = useSession();
      const [credits, setCredits] = useState<number | null>(null);
      const { t } = useLocale();

      useEffect(() => {
        if (status !== "authenticated") return;

        async function fetchCredits() {
          try {
            const res = await fetch("/api/proxy/api/credits/balance");
            if (res.ok) {
              const data = await res.json();
              setCredits(data.balance);
            }
          } catch (e) {
            console.error("Failed to fetch credits", e);
          }
        }

        fetchCredits();
      }, [status]);

      if (status !== "authenticated" || credits === null) {
        return null;
      }

      return (
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">{credits.toLocaleString()}</span>
          <span>{t("credits.credits")}</span>
        </div>
      );
    }
    ```

- ACCEPTANCE:
    - Shows credits balance when authenticated
    - Hidden when not authenticated
- FILES:
    - `frontend/src/components/CreditsDisplay.tsx` (NEW)

---

## Task 5.2: Create PaywallModal Component

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Create modal shown when user runs out of credits.

    **File:** `frontend/src/components/PaywallModal.tsx`

    ```typescript
    "use client";

    import { useLocale } from "../i18n";

    interface PaywallModalProps {
      isOpen: boolean;
      onClose: () => void;
    }

    export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
      const { t } = useLocale();

      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">
              {t("credits.insufficientCredits")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t("credits.purchasePrompt")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = "/billing"}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {t("credits.buyCredits")}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      );
    }
    ```

- ACCEPTANCE:
    - Modal appears when isOpen is true
    - Buy credits button links to /billing
- FILES:
    - `frontend/src/components/PaywallModal.tsx` (NEW)

---

## Task 5.3: Create Billing Page

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Create billing page to purchase credits.

    **File:** `frontend/src/app/billing/page.tsx`

    ```typescript
    "use client";

    import { useState, useEffect } from "react";
    import { useSession } from "next-auth/react";
    import { useRouter, useSearchParams } from "next/navigation";
    import { useLocale } from "../../i18n";
    import Header from "../../components/Header";

    interface Product {
      id: string;
      credits: number;
      price_usd: number;
    }

    export default function BillingPage() {
      const { data: session, status } = useSession();
      const router = useRouter();
      const searchParams = useSearchParams();
      const { t } = useLocale();
      const [products, setProducts] = useState<Product[]>([]);
      const [loading, setLoading] = useState<string | null>(null);
      const [message, setMessage] = useState<string | null>(null);

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
    ```

- ACCEPTANCE:
    - Page shows credit packs
    - Purchase button initiates Stripe checkout
- FILES:
    - `frontend/src/app/billing/page.tsx` (NEW)

---

## Task 5.4: Add Credits/Billing i18n

- PRIORITY: P1
- STATUS: TODO
- DESCRIPTION: |
    Add credits and billing translations to all locales.

    Add to each locale file:
    ```json
    {
      "credits": {
        "credits": "credits",
        "insufficientCredits": "Insufficient Credits",
        "purchasePrompt": "You've run out of credits. Purchase more to continue chatting.",
        "buyCredits": "Buy Credits"
      },
      "billing": {
        "title": "Purchase Credits",
        "purchase": "Purchase",
        "purchaseSuccess": "Purchase successful! Credits have been added to your account.",
        "purchaseCanceled": "Purchase was canceled.",
        "error": "An error occurred. Please try again."
      },
      "common": {
        "cancel": "Cancel",
        "loading": "Loading..."
      }
    }
    ```

- ACCEPTANCE:
    - All 8 locale files have credits/billing translations
- FILES:
    - `frontend/src/i18n/locales/*.json` (MODIFY all 8)

---

## Task 5.5: Update Header with CreditsDisplay

- PRIORITY: P1
- STATUS: TODO
- DESCRIPTION: |
    Add CreditsDisplay component to Header.

    **Modify:** `frontend/src/components/Header.tsx`

    Import and add CreditsDisplay next to AuthButton.

- ACCEPTANCE:
    - Header shows credits balance for authenticated users
- FILES:
    - `frontend/src/components/Header.tsx` (MODIFY)

---

## Task 5.6: Handle 402 in Chat

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Update ChatPanel to show PaywallModal when receiving 402.

    **Modify:** `frontend/src/components/Chat/ChatPanel.tsx`

    1. Import and add PaywallModal state
    2. In SSE error handling, check for 402 status
    3. Show PaywallModal when 402 received

- ACCEPTANCE:
    - PaywallModal shows when chat returns 402
- FILES:
    - `frontend/src/components/Chat/ChatPanel.tsx` (MODIFY)

---

## Task 5.7: Verify Build

- PRIORITY: P0
- STATUS: TODO
- DESCRIPTION: |
    Verify both backend and frontend build successfully.

    ```bash
    cd backend && python3 -c "from app.main import app; print('Backend OK')"
    cd frontend && npm run build
    ```

- ACCEPTANCE:
    - Backend imports without error
    - Frontend builds without error
- FILES: None (verification)

---

## Completion Checklist

- [ ] Task 4.1: Billing API created
- [ ] Task 4.2: Stripe config added
- [ ] Task 5.1: CreditsDisplay created
- [ ] Task 5.2: PaywallModal created
- [ ] Task 5.3: Billing page created
- [ ] Task 5.4: i18n translations added
- [ ] Task 5.5: Header updated
- [ ] Task 5.6: 402 handling in chat
- [ ] Task 5.7: Build verified

**When complete, the Auth + Credits + Billing MVP is done!**

---END---
