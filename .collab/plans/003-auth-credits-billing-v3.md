# Plan: Auth + Credits + Billing Feature

STATUS: APPROVED
AUTHOR: CC
DATE: 2026-02-05
VERSION: v0.3
CHANGES: Fixed JWT token propagation, verification token hashing, route alignment, idempotency comment

---

## Executive Summary

Implement user authentication, a credits-based usage system, and Stripe billing for DocTalk. This transforms the app from anonymous usage to a freemium model with metered AI consumption.

---

## Architecture Decision: Option C with JWT Sessions

### Final Architecture

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Auth UI/OAuth** | Auth.js v5 (Next.js) | OAuth flows, login page, session cookies |
| **Session Strategy** | **JWT** (not DB sessions) | Stateless tokens, shared secret |
| **User/Credits DB** | SQLAlchemy + PostgreSQL | All user data, credits, billing |
| **Token Validation** | FastAPI middleware | Verify JWT using shared `AUTH_SECRET` |

### JWT Configuration Parity (CRITICAL)

Both services MUST use identical JWT configuration:

```yaml
Algorithm: HS256
Secret: AUTH_SECRET (32+ bytes, base64-encoded)
Claims:
  - sub: user UUID
  - exp: expiration timestamp
  - iat: issued at timestamp
```

**Auth.js v5 default**: Uses HS256 with `AUTH_SECRET` env var.
**FastAPI**: Verifies with `python-jose` using same secret and HS256.

---

## JWT Token Propagation (Fixed per CX v0.2 Review)

### The Problem

CX correctly identified that `session.accessToken = token` passes an object, not the encoded JWT string.

### Solution: Server-Side API Proxy

Create a Next.js Route Handler that:
1. Extracts the raw JWT using `getToken({ raw: true })`
2. Forwards requests to FastAPI with proper `Authorization: Bearer <jwt>`

```typescript
// frontend/src/app/api/proxy/[...path]/route.ts
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function handler(req: NextRequest) {
  const token = await getToken({ req, raw: true });  // Returns encoded JWT string

  const path = req.nextUrl.pathname.replace("/api/proxy", "");
  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.delete("host");

  const response = await fetch(url, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
```

### Frontend API Client Update

```typescript
// frontend/src/lib/api.ts

// All authenticated API calls go through the proxy
const API_BASE = "/api/proxy";  // Next.js route handler
const DIRECT_API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// For endpoints that don't need auth (health, public info)
export async function fetchPublic(path: string, options?: RequestInit) {
  return fetch(`${DIRECT_API_BASE}${path}`, options);
}

// For endpoints that need auth (goes through proxy)
export async function fetchWithAuth(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",  // Send session cookie to proxy
  });
}

// Example usage:
export const getMyProfile = () => fetchWithAuth("/api/users/me");
export const getCreditsBalance = () => fetchWithAuth("/api/credits/balance");
export const createCheckout = (packId: string) =>
  fetchWithAuth("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack_id: packId }),
  });
```

### Why Proxy Instead of Client-Side JWT

1. **Security**: Raw JWT never exposed to browser JavaScript
2. **Simplicity**: No custom session callback encoding needed
3. **Auth.js native**: `getToken({ raw: true })` is the official way to get encoded JWT

---

## Verification Token Hashing (Fixed per CX v0.2 Review)

### Hashing Specification

Auth.js expects verification tokens to be hashed before storage. Use SHA-256 hex encoding.

```python
# backend/app/services/auth_service.py
import hashlib

def hash_token(token: str) -> str:
    """Hash a verification token using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()
```

### Adapter Endpoint Implementation

```python
# backend/app/api/auth.py

@router.post("/api/internal/auth/verification-tokens")
async def create_verification_token(
    data: CreateVerificationTokenRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_adapter_secret),
):
    """
    Store a verification token (hashed).
    Auth.js sends the raw token; we hash before storing.
    """
    hashed = hash_token(data.token)
    vt = VerificationToken(
        identifier=data.identifier,
        token=hashed,
        expires=data.expires,
    )
    # Use merge to handle upsert (same identifier+token combo)
    await db.merge(vt)
    await db.commit()
    return {"identifier": data.identifier, "token": data.token, "expires": data.expires.isoformat()}


@router.post("/api/internal/auth/verification-tokens/use")
async def use_verification_token(
    data: UseVerificationTokenRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_adapter_secret),
):
    """
    Consume a verification token. Returns the token if valid, null otherwise.
    Deletes the token after use.
    """
    hashed = hash_token(data.token)
    result = await db.execute(
        select(VerificationToken).where(
            VerificationToken.identifier == data.identifier,
            VerificationToken.token == hashed,
        )
    )
    vt = result.scalar_one_or_none()

    if not vt:
        return None

    # Check expiration
    if vt.expires < datetime.utcnow():
        await db.delete(vt)
        await db.commit()
        return None

    # Delete after use (one-time token)
    await db.delete(vt)
    await db.commit()

    return {"identifier": vt.identifier, "token": data.token, "expires": vt.expires.isoformat()}
```

---

## Internal Auth API (Route Alignment Fixed)

All internal adapter endpoints use consistent `/api/internal/auth/*` prefix:

| Method | Path | Auth.js Method |
|--------|------|----------------|
| `POST` | `/api/internal/auth/users` | `createUser` |
| `GET` | `/api/internal/auth/users/{id}` | `getUser` |
| `GET` | `/api/internal/auth/users/by-email/{email}` | `getUserByEmail` |
| `GET` | `/api/internal/auth/users/by-account/{provider}/{providerAccountId}` | `getUserByAccount` |
| `PUT` | `/api/internal/auth/users/{id}` | `updateUser` |
| `DELETE` | `/api/internal/auth/users/{id}` | `deleteUser` |
| `POST` | `/api/internal/auth/accounts` | `linkAccount` |
| `DELETE` | `/api/internal/auth/accounts/{provider}/{providerAccountId}` | `unlinkAccount` |
| `POST` | `/api/internal/auth/verification-tokens` | `createVerificationToken` |
| `POST` | `/api/internal/auth/verification-tokens/use` | `useVerificationToken` |

### Router Registration

```python
# backend/app/api/auth.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/internal/auth", tags=["auth-internal"])

@router.post("/users")
async def create_user(...): ...

@router.get("/users/{user_id}")
async def get_user(...): ...

# etc.
```

```python
# backend/app/main.py
from app.api import auth
app.include_router(auth.router)
```

---

## Stripe Webhook Idempotency (Comment Fixed)

### Implementation

Idempotency is checked via `payment_intent` only (sufficient for our use case):

```python
@router.post("/api/billing/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

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

        # Idempotency: check if this payment_intent was already processed
        # Note: payment_intent is unique per Stripe payment, so this is sufficient.
        # We don't need to also check event.id since a single payment_intent
        # can only complete once.
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

---

## Data Model (Unchanged from v0.2)

[See v0.2 for complete table definitions]

Key tables:
- `users` (with `credits_balance` for atomic debiting)
- `accounts` (OAuth providers)
- `verification_tokens` (hashed tokens)
- `credit_ledger` (append-only audit)
- `usage_records` (AI consumption)

---

## Credit System (Unchanged from v0.2)

### Atomic Debit

```python
async def debit_credits(db, user_id, cost, reason, ref_type, ref_id) -> bool:
    result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .where(User.credits_balance >= cost)
        .values(credits_balance=User.credits_balance - cost)
        .returning(User.credits_balance)
    )
    row = result.fetchone()
    if row is None:
        return False  # Insufficient balance

    # Record in ledger (caller must commit)
    ledger = CreditLedger(
        user_id=user_id,
        delta=-cost,
        balance_after=row[0],
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(ledger)
    return True
```

### Important: Transaction Handling

Callers MUST wrap debit + usage record in a single transaction:

```python
async with db.begin():
    success = await debit_credits(db, user.id, cost, ...)
    if not success:
        raise HTTPException(402)
    db.add(UsageRecord(...))
# Commit happens here
```

---

## Guest Mode (Unchanged from v0.2)

- Signed HTTP-only cookie via `itsdangerous`
- Redis counters with 24h TTL
- Limits: 1 upload, 3 messages

---

## CORS Configuration (Unchanged from v0.2)

### Development
```python
allow_origins=["http://localhost:3000"]
allow_credentials=True
```

### Production
```python
allow_origins=[settings.FRONTEND_URL]
allow_credentials=True
```

Note: With the proxy approach, cross-origin auth is handled by the Next.js proxy calling FastAPI server-to-server. The browser only talks to Next.js (same origin).

---

## Implementation Phases

### Phase 1: Database + Internal Auth API (Week 1)
1. Alembic migration for all new tables
2. Internal auth adapter endpoints with hashed verification tokens
3. AUTH_SECRET and ADAPTER_SECRET configuration
4. Unit tests for adapter endpoints

### Phase 2: Auth.js Integration (Week 2)
1. Install Auth.js v5
2. Custom adapter calling FastAPI (with hashing)
3. API proxy route handler (`/api/proxy/[...path]`)
4. OAuth providers (Google, Apple)
5. Email magic link provider
6. `/auth` page UI

### Phase 3: JWT Validation + User Scoping (Week 3)
1. JWT verification middleware in FastAPI (HS256, shared secret)
2. Update API client to use proxy
3. Protected endpoints validation
4. CreditsDisplay component

### Phase 4: Credits System (Week 4)
1. Atomic debit/credit service
2. Usage recording in chat
3. Pre-chat balance check
4. 402 + PaywallModal

### Phase 5: Billing + Stripe (Week 5)
1. Stripe products setup
2. Checkout + webhook endpoints
3. `/billing` page UI

### Phase 6: Guest Mode + Polish (Week 6)
1. Guest cookie + Redis limits
2. Rate limiting
3. Guest → User upgrade
4. E2E testing

---

## Environment Variables

```bash
# Auth (CRITICAL: Must be identical in frontend and backend)
AUTH_SECRET=<32+ bytes base64>    # Shared between Next.js and FastAPI
ADAPTER_SECRET=<random string>    # For internal adapter API auth
GUEST_SECRET=<random string>      # For signing guest cookies

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# Email
EMAIL_SERVER=smtp://...
EMAIL_FROM=noreply@doctalk.app

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_yyy
STRIPE_PRICE_ENTERPRISE=price_zzz

# Existing
OPENROUTER_API_KEY=
DATABASE_URL=
# etc.
```

---

## Acceptance Criteria

- [ ] User can log in via Google OAuth
- [ ] User can log in via Apple OAuth
- [ ] User can log in via Email magic link
- [ ] New user receives 10,000 credits exactly once
- [ ] Credits balance shows in header
- [ ] Chat deducts credits atomically (no negative balance possible)
- [ ] 402 error shows PaywallModal
- [ ] Stripe checkout creates session
- [ ] Stripe webhook credits account (idempotent)
- [ ] Guest can upload 1 PDF, send 3 messages
- [ ] Guest hitting limit sees login prompt
- [ ] Verification tokens are hashed in DB
- [ ] JWT tokens are properly passed via proxy
- [ ] No regression in existing PDF chat flow

---END---
