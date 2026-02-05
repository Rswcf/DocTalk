# Plan: Auth + Credits + Billing Feature

STATUS: DRAFT
AUTHOR: CC
DATE: 2026-02-05
VERSION: v0.1

---

## Executive Summary

Implement user authentication, a credits-based usage system, and Stripe billing for DocTalk. This transforms the app from anonymous usage to a freemium model with metered AI consumption.

---

## ⚠️ CRITICAL: Architecture Decision Required

### The Problem

User's checklist specifies:
- **Auth**: Auth.js / NextAuth (Next.js native)
- **ORM**: Prisma or Drizzle (JavaScript ORMs)

But DocTalk's existing architecture is:
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Frontend**: Next.js 14 (App Router), all "use client", no SSR

### Options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | Auth.js in Next.js + Prisma adapter; FastAPI remains stateless, receives `user_id` in requests | Industry standard for Next.js; Good DX; Handles OAuth complexity | Two ORMs (Prisma + SQLAlchemy); Auth tables separate from business tables; Complex deployment |
| **B** | Auth entirely in FastAPI (authlib/python-jose); Next.js just calls API | Single source of truth; One ORM; Simpler architecture | More manual OAuth implementation; Less ecosystem support |
| **C** | Hybrid: Auth.js for session, but store users in PostgreSQL via SQLAlchemy (no Prisma) | Best of both; Single DB truth; Simpler than A | Requires custom Auth.js adapter; Less documented |

### CC Recommendation: Option C (Hybrid)

- Use Auth.js for OAuth flows (Google, Apple) and session management
- Write a **custom Auth.js adapter** that calls FastAPI endpoints for user CRUD
- All user/credit/billing tables live in PostgreSQL managed by SQLAlchemy/Alembic
- No Prisma; single ORM; single migration system
- FastAPI validates JWT/session tokens from Auth.js

**CX: Please review this decision and provide feedback before we proceed.**

---

## Data Model Design

### New Tables (SQLAlchemy, Alembic-managed)

```python
# Users table
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
    image: Mapped[Optional[str]] = mapped_column(sa.String(500))  # Avatar URL
    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())

# Auth.js required tables
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # oauth, email, etc.
    provider: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # google, apple, email
    provider_account_id: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(sa.Text)
    access_token: Mapped[Optional[str]] = mapped_column(sa.Text)
    expires_at: Mapped[Optional[int]] = mapped_column(sa.BigInteger)
    token_type: Mapped[Optional[str]] = mapped_column(sa.String(50))
    scope: Mapped[Optional[str]] = mapped_column(sa.String(500))
    id_token: Mapped[Optional[str]] = mapped_column(sa.Text)

    __table_args__ = (
        sa.UniqueConstraint("provider", "provider_account_id", name="uq_accounts_provider_account"),
    )

class Session(Base):
    __tablename__ = "auth_sessions"  # Avoid conflict with chat sessions

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    session_token: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)

class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
    token: Mapped[str] = mapped_column(sa.String(255), primary_key=True)
    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)

# Credits Ledger (immutable, append-only)
class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delta: Mapped[int] = mapped_column(sa.Integer, nullable=False)  # Positive = credit, Negative = debit
    reason: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # signup_bonus, purchase, usage
    ref_type: Mapped[Optional[str]] = mapped_column(sa.String(50))  # stripe_payment, message, etc.
    ref_id: Mapped[Optional[str]] = mapped_column(sa.String(255))  # External reference ID
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_credit_ledger_user", "user_id"),
    )

# Usage Records (detailed AI usage tracking)
class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"))
    model: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    cost_credits: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_usage_records_user", "user_id", "created_at"),
    )
```

### Existing Table Modifications

```python
# Document — add user_id FK
class Document(Base):
    # ... existing fields ...
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),  # SET NULL to preserve docs if user deleted
        nullable=True  # Nullable for guest uploads
    )
```

---

## Credit Pricing Model

### Token-to-Credit Conversion

| Model Tier | Input (credits/1K tokens) | Output (credits/1K tokens) |
|------------|---------------------------|----------------------------|
| Small (Sonnet, GPT-5.2) | 3 | 15 |
| Large (Opus, GPT-5.2-pro) | 15 | 75 |
| Budget (DeepSeek, Qwen) | 1 | 5 |
| Embedding | 0.1 | N/A |

### Default Grants

| Event | Credits |
|-------|---------|
| Signup bonus | 10,000 |
| Free tier daily | 0 (only signup bonus) |

### Credit Packs (Stripe Products)

| Pack | Credits | Price (USD) |
|------|---------|-------------|
| Starter | 50,000 | $5 |
| Pro | 200,000 | $15 |
| Enterprise | 1,000,000 | $50 |

---

## API Design

### Auth Endpoints (Next.js API Routes)

```
GET/POST  /api/auth/[...nextauth]  # Auth.js handler
GET       /api/auth/session        # Get current session
```

### User Endpoints (FastAPI)

```
GET   /api/users/me              # Current user info + credits balance
PUT   /api/users/me              # Update profile
```

### Credits Endpoints (FastAPI)

```
GET   /api/credits/balance       # { balance: number, transactions: [...] }
GET   /api/credits/history       # Paginated ledger history
```

### Billing Endpoints (FastAPI)

```
POST  /api/billing/checkout      # Create Stripe Checkout session → redirect URL
POST  /api/billing/webhook       # Stripe webhook (checkout.session.completed)
GET   /api/billing/products      # Available credit packs
```

### Protected Existing Endpoints

All existing document/chat endpoints gain optional `user_id` context:
- If authenticated: operations scoped to user
- If guest: limited operations (see Guest Mode)

---

## Authentication Flow

### OAuth (Google/Apple)

```
1. User clicks "Continue with Google" on /auth page
2. Next.js redirects to Google OAuth via Auth.js
3. Google returns with code → Auth.js exchanges for tokens
4. Auth.js calls custom adapter → FastAPI creates/updates user
5. Auth.js sets session cookie
6. Frontend stores session, shows logged-in UI
```

### Email Magic Link

```
1. User enters email on /auth page
2. Auth.js generates verification token
3. Custom adapter calls FastAPI to store token
4. Email sent via Resend/SendGrid
5. User clicks link → Auth.js verifies token
6. Session created, user logged in
```

### Session Validation (FastAPI middleware)

```python
async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("next-auth.session-token")
    if not session_token:
        return None
    # Lookup in auth_sessions table
    session = await db.scalar(
        select(Session).where(Session.session_token == session_token)
    )
    if not session or session.expires < datetime.utcnow():
        return None
    return await db.get(User, session.user_id)
```

---

## Credit Enforcement in Chat

### Pre-Chat Check

```python
async def chat_handler(session_id: str, request: ChatRequest, user: Optional[User]):
    if user:
        balance = await get_user_credits(user.id)
        if balance < MIN_CREDITS_FOR_CHAT:  # e.g., 100 credits
            raise HTTPException(status_code=402, detail="Insufficient credits")
    elif not is_guest_allowed(request):
        raise HTTPException(status_code=401, detail="Login required")

    # Proceed with chat...
```

### Post-Chat Settlement

```python
async def settle_usage(user: User, message: Message, usage: TokenUsage):
    cost = calculate_cost(usage, model=request.model)

    # Atomic transaction
    async with db.begin():
        # Insert usage record
        await db.execute(insert(UsageRecord).values(
            user_id=user.id,
            message_id=message.id,
            model=request.model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
            cost_credits=cost,
        ))
        # Insert ledger debit
        await db.execute(insert(CreditLedger).values(
            user_id=user.id,
            delta=-cost,
            reason="usage",
            ref_type="message",
            ref_id=str(message.id),
        ))
```

---

## Guest Mode

### Limits

| Limit | Value |
|-------|-------|
| PDFs uploaded | 1 |
| Chat messages | 3 |
| Storage | 24 hours |

### Enforcement

```python
# Track by fingerprint cookie or IP
GUEST_KEY = "guest_{fingerprint_or_ip}"

async def check_guest_limits(request: Request, action: str):
    key = get_guest_key(request)
    limits = await redis.hgetall(f"guest:{key}")

    if action == "upload" and int(limits.get("uploads", 0)) >= 1:
        raise HTTPException(402, "Guest upload limit reached. Please log in.")
    if action == "chat" and int(limits.get("messages", 0)) >= 3:
        raise HTTPException(402, "Guest message limit reached. Please log in.")
```

---

## Stripe Integration

### Checkout Flow

```python
@router.post("/billing/checkout")
async def create_checkout(
    pack_id: str,
    user: User = Depends(require_auth),
):
    price_map = {
        "starter": ("price_xxx", 50000),
        "pro": ("price_yyy", 200000),
        "enterprise": ("price_zzz", 1000000),
    }
    price_id, credits = price_map[pack_id]

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/billing?canceled=1",
        client_reference_id=str(user.id),
        metadata={"credits": credits},
    )
    return {"checkout_url": session.url}
```

### Webhook Handler

```python
@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = uuid.UUID(session["client_reference_id"])
        credits = int(session["metadata"]["credits"])
        payment_id = session["payment_intent"]

        # Idempotency check
        existing = await db.scalar(
            select(CreditLedger).where(CreditLedger.ref_id == payment_id)
        )
        if not existing:
            await db.execute(insert(CreditLedger).values(
                user_id=user_id,
                delta=credits,
                reason="purchase",
                ref_type="stripe_payment",
                ref_id=payment_id,
            ))

    return {"received": True}
```

---

## Frontend Changes

### New Pages

| Path | Purpose |
|------|---------|
| `/auth` | Login/signup with OAuth + Email |
| `/billing` | Credit packs + purchase buttons |

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CreditsDisplay` | Header | Show current balance |
| `PaywallModal` | Global | Prompt when credits exhausted |
| `AuthButton` | Header | Login/Logout |
| `LoginForm` | /auth | OAuth buttons + email input |

### State Changes (Zustand)

```typescript
interface AuthState {
  user: User | null;
  credits: number;
  setUser: (user: User | null) => void;
  setCredits: (credits: number) => void;
  decrementCredits: (amount: number) => void;
}
```

---

## Implementation Phases

### Phase 1: Database + Auth Foundation (Week 1)
1. Alembic migration for new tables
2. Auth.js custom adapter implementation
3. FastAPI user CRUD endpoints
4. Session validation middleware
5. /auth page UI

### Phase 2: Credits System (Week 2)
1. Credit ledger service
2. Signup bonus grant logic
3. `GET /api/credits/balance` endpoint
4. Credits display in Header
5. 402 handling + PaywallModal

### Phase 3: Usage Metering (Week 3)
1. Usage recording in chat service
2. Token-to-credit calculation
3. Pre-chat balance check
4. Usage history endpoint

### Phase 4: Billing + Stripe (Week 4)
1. Stripe account setup + products
2. Checkout endpoint
3. Webhook handler
4. /billing page UI
5. Purchase flow testing

### Phase 5: Guest Mode + Polish (Week 5)
1. Guest limit tracking (Redis)
2. Limit enforcement middleware
3. Guest → User upgrade flow
4. Rate limiting
5. End-to-end testing

---

## Questions for CX Review

1. **Architecture Decision**: Do you agree with Option C (hybrid Auth.js + SQLAlchemy)? Any concerns?

2. **Auth.js Adapter**: Have you implemented custom Auth.js adapters before? Any gotchas?

3. **Credit Calculation**: Is the token-to-credit model clear? Should we simplify to flat rate per model?

4. **Guest Mode**: Is Redis-based fingerprint tracking robust enough? Should we consider browser fingerprinting libraries?

5. **Stripe Webhook**: Should we use Stripe's idempotency keys instead of manual ref_id checking?

6. **Migration Risk**: Adding `user_id` to existing `documents` table - any concerns about existing data?

---

## Out of Scope (Per User Requirements)

- Enterprise RBAC / team management
- Subscription overage handling
- Multi-currency support
- Admin dashboard

---

## Appendix: File Structure Changes

```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py           # NEW: User CRUD for Auth.js adapter
│   │   ├── credits.py        # NEW: Credits balance/history
│   │   ├── billing.py        # NEW: Stripe checkout/webhook
│   │   └── ... (existing)
│   ├── models/
│   │   └── tables.py         # MODIFIED: Add User, CreditLedger, etc.
│   ├── services/
│   │   ├── auth_service.py   # NEW: User management
│   │   ├── credit_service.py # NEW: Balance calculation, grants
│   │   └── ... (existing)
│   └── core/
│       ├── deps.py           # MODIFIED: Add get_current_user dependency
│       └── config.py         # MODIFIED: Add Stripe settings

frontend/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   └── page.tsx      # NEW: Login page
│   │   ├── billing/
│   │   │   └── page.tsx      # NEW: Purchase page
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts  # NEW: Auth.js handler
│   ├── components/
│   │   ├── CreditsDisplay.tsx    # NEW
│   │   ├── PaywallModal.tsx      # NEW
│   │   └── LoginForm.tsx         # NEW
│   ├── lib/
│   │   ├── auth.ts               # NEW: Auth.js config
│   │   └── authAdapter.ts        # NEW: Custom FastAPI adapter
│   └── store/
│       └── index.ts              # MODIFIED: Add auth state
```

---END---
