# Plan: Auth + Credits + Billing Feature

STATUS: IN_REVIEW
AUTHOR: CC
DATE: 2026-02-05
VERSION: v0.2
CHANGES: Addressed CX review - JWT sessions, atomic credits, full adapter spec, CORS/cookie config

---

## Executive Summary

Implement user authentication, a credits-based usage system, and Stripe billing for DocTalk. This transforms the app from anonymous usage to a freemium model with metered AI consumption.

---

## Architecture Decision: Option C with JWT Sessions

### Final Architecture

Based on CX feedback, we adopt **Option C (Hybrid)** with these specifics:

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Auth UI/OAuth** | Auth.js v5 (Next.js) | OAuth flows, login page, session cookies |
| **Session Strategy** | **JWT** (not DB sessions) | Stateless tokens, shared secret |
| **User/Credits DB** | SQLAlchemy + PostgreSQL | All user data, credits, billing |
| **Token Validation** | FastAPI middleware | Verify JWT using shared `AUTH_SECRET` |

### Why JWT Sessions (per CX recommendation)

1. **No cross-service cookie issues** — Frontend sends `Authorization: Bearer <jwt>` to FastAPI
2. **No DB lookup for every request** — JWT is self-contained, verified via shared secret
3. **Simpler adapter** — No session CRUD needed, only user/account/verification_token
4. **No hashing complexity** — JWT signed, not hashed tokens in DB

### Shared Secret Strategy

```
AUTH_SECRET (32+ bytes, base64)
├── Next.js: Used by Auth.js to sign/verify JWTs
└── FastAPI: Used by python-jose to verify incoming JWTs
```

Both services read `AUTH_SECRET` from environment variables.

---

## Data Model Design (Revised)

### New Tables

```python
# Users table (with credits_balance for atomic debiting)
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))

    # Credits (denormalized for atomic operations)
    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())


# Auth.js Account table (OAuth providers)
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # "oauth" | "email" | "credentials"
    provider: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # "google" | "apple" | "email"
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


# Verification tokens (for magic link email auth)
class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier: Mapped[str] = mapped_column(sa.String(255), primary_key=True)  # email
    token: Mapped[str] = mapped_column(sa.String(255), primary_key=True)  # hashed token
    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)


# Credit Ledger (append-only audit trail)
class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    delta: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(sa.Integer, nullable=False)  # Snapshot for audit
    reason: Mapped[str] = mapped_column(sa.String(50), nullable=False)  # signup_bonus, purchase, usage
    ref_type: Mapped[Optional[str]] = mapped_column(sa.String(50))  # stripe_payment, message, etc.
    ref_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_credit_ledger_user_created", "user_id", "created_at"),
        sa.Index("idx_credit_ledger_ref", "ref_type", "ref_id"),  # For idempotency lookups
    )


# Usage Records (detailed AI consumption tracking)
class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="SET NULL"))
    model: Mapped[str] = mapped_column(sa.String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    cost_credits: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))

    __table_args__ = (
        sa.Index("idx_usage_records_user_created", "user_id", "created_at"),
    )
```

### Existing Table Modifications

```python
# Document — add user_id FK with index
class Document(Base):
    # ... existing fields ...
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,  # Nullable for guest uploads
        index=True,
    )
```

### No Session Table Needed

With JWT strategy, Auth.js doesn't need `auth_sessions` table. Sessions are encoded in the JWT itself.

---

## Auth.js Adapter API Specification

### Overview

Auth.js custom adapter calls FastAPI internal endpoints. Protected by `X-Adapter-Secret` header.

### Endpoints

| Method | Path | Auth.js Method | Request | Response |
|--------|------|----------------|---------|----------|
| `POST` | `/api/internal/auth/users` | `createUser` | `{ email, name?, image?, emailVerified? }` | `User` |
| `GET` | `/api/internal/auth/users/{id}` | `getUser` | - | `User \| null` |
| `GET` | `/api/internal/auth/users/by-email/{email}` | `getUserByEmail` | - | `User \| null` |
| `GET` | `/api/internal/auth/users/by-account/{provider}/{providerAccountId}` | `getUserByAccount` | - | `User \| null` |
| `PUT` | `/api/internal/auth/users/{id}` | `updateUser` | `Partial<User>` | `User` |
| `DELETE` | `/api/internal/auth/users/{id}` | `deleteUser` | - | `void` |
| `POST` | `/api/internal/auth/accounts` | `linkAccount` | `Account` | `Account` |
| `DELETE` | `/api/internal/auth/accounts/{provider}/{providerAccountId}` | `unlinkAccount` | - | `void` |
| `POST` | `/api/internal/auth/verification-tokens` | `createVerificationToken` | `{ identifier, token, expires }` | `VerificationToken` |
| `POST` | `/api/internal/auth/verification-tokens/use` | `useVerificationToken` | `{ identifier, token }` | `VerificationToken \| null` |

### Security

```python
# backend/app/core/deps.py
async def verify_adapter_secret(x_adapter_secret: str = Header(...)):
    if x_adapter_secret != settings.ADAPTER_SECRET:
        raise HTTPException(401, "Invalid adapter secret")
```

### Signup Bonus Grant (in `createUser`)

```python
@router.post("/internal/auth/users")
async def create_user(data: CreateUserRequest, db: AsyncSession = Depends(get_db)):
    user = User(
        email=data.email,
        name=data.name,
        image=data.image,
        email_verified=data.email_verified,
        credits_balance=SIGNUP_BONUS_CREDITS,  # 10000
        signup_bonus_granted_at=datetime.utcnow(),
    )
    db.add(user)
    await db.flush()

    # Record in ledger
    ledger = CreditLedger(
        user_id=user.id,
        delta=SIGNUP_BONUS_CREDITS,
        balance_after=SIGNUP_BONUS_CREDITS,
        reason="signup_bonus",
    )
    db.add(ledger)
    await db.commit()
    return user
```

---

## JWT Validation in FastAPI

### Middleware

```python
# backend/app/core/deps.py
from jose import jwt, JWTError

async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract user from JWT if present. Returns None for guests."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(
            token,
            settings.AUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return await db.get(User, uuid.UUID(user_id))
    except JWTError:
        return None


async def require_auth(user: Optional[User] = Depends(get_current_user_optional)) -> User:
    """Require authenticated user, raise 401 if not."""
    if not user:
        raise HTTPException(401, "Authentication required")
    return user
```

### Frontend Token Passing

```typescript
// frontend/src/lib/api.ts
import { getSession } from "next-auth/react";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const session = await getSession();
  const headers = new Headers(options.headers);

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  return fetch(url, { ...options, headers });
}
```

---

## Atomic Credit Debiting (Revised)

### The Problem

Pre-checking `balance >= cost` then inserting ledger is not atomic. Concurrent requests can overdraw.

### Solution: Dual-Write with Optimistic Locking

```python
# backend/app/services/credit_service.py

async def debit_credits(
    db: AsyncSession,
    user_id: uuid.UUID,
    cost: int,
    reason: str,
    ref_type: str,
    ref_id: str,
) -> bool:
    """
    Atomically debit credits. Returns True if successful, False if insufficient.
    """
    # Atomic UPDATE with balance check
    result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .where(User.credits_balance >= cost)
        .values(credits_balance=User.credits_balance - cost)
        .returning(User.credits_balance)
    )
    row = result.fetchone()

    if row is None:
        # Insufficient balance or user not found
        return False

    new_balance = row[0]

    # Record in ledger for audit
    ledger = CreditLedger(
        user_id=user_id,
        delta=-cost,
        balance_after=new_balance,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(ledger)
    # Commit handled by caller's transaction
    return True


async def credit_credits(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    reason: str,
    ref_type: Optional[str] = None,
    ref_id: Optional[str] = None,
) -> int:
    """Add credits. Returns new balance."""
    result = await db.execute(
        sa.update(User)
        .where(User.id == user_id)
        .values(credits_balance=User.credits_balance + amount)
        .returning(User.credits_balance)
    )
    new_balance = result.scalar_one()

    ledger = CreditLedger(
        user_id=user_id,
        delta=amount,
        balance_after=new_balance,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
    )
    db.add(ledger)
    return new_balance
```

### Usage in Chat Service

```python
# backend/app/services/chat_service.py

async def handle_chat(session_id: str, request: ChatRequest, user: Optional[User], db: AsyncSession):
    # Pre-check (informational, not relied upon for safety)
    if user and user.credits_balance < MIN_CREDITS_FOR_CHAT:
        raise HTTPException(402, "Insufficient credits")

    # ... call OpenRouter, get response ...

    cost = calculate_cost(usage, model=request.model)

    if user:
        async with db.begin_nested():  # Savepoint
            success = await debit_credits(
                db, user.id, cost,
                reason="usage",
                ref_type="message",
                ref_id=str(message.id),
            )
            if not success:
                raise HTTPException(402, "Insufficient credits")

            # Record usage details
            usage_record = UsageRecord(...)
            db.add(usage_record)
```

---

## Guest Mode (Revised per CX)

### Signed Guest Cookie

Instead of IP/fingerprint, use a signed HTTP-only cookie:

```python
# backend/app/api/guest.py
from itsdangerous import URLSafeTimedSerializer

serializer = URLSafeTimedSerializer(settings.GUEST_SECRET)

@router.post("/api/guest/init")
async def init_guest(response: Response):
    """Issue a new guest ID cookie."""
    guest_id = str(uuid.uuid4())
    signed = serializer.dumps(guest_id)

    response.set_cookie(
        "doctalk_guest",
        signed,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=86400,  # 24 hours
    )

    # Initialize Redis counter
    await redis.hset(f"guest:{guest_id}", mapping={"uploads": 0, "messages": 0})
    await redis.expire(f"guest:{guest_id}", 86400)

    return {"guest_id": guest_id}


async def get_guest_id(request: Request) -> Optional[str]:
    """Extract and verify guest ID from cookie."""
    cookie = request.cookies.get("doctalk_guest")
    if not cookie:
        return None
    try:
        return serializer.loads(cookie, max_age=86400)
    except:
        return None
```

### Guest Limit Enforcement

```python
# backend/app/core/deps.py

async def check_guest_limits(
    request: Request,
    action: Literal["upload", "chat"],
    user: Optional[User] = Depends(get_current_user_optional),
):
    if user:
        return  # Authenticated users skip guest limits

    guest_id = await get_guest_id(request)
    if not guest_id:
        raise HTTPException(401, "Please log in or initialize as guest")

    limits = await redis.hgetall(f"guest:{guest_id}")

    if action == "upload" and int(limits.get("uploads", 0)) >= 1:
        raise HTTPException(402, "Guest upload limit reached. Please log in.")

    if action == "chat" and int(limits.get("messages", 0)) >= 3:
        raise HTTPException(402, "Guest message limit reached. Please log in.")


async def increment_guest_counter(guest_id: str, action: str):
    await redis.hincrby(f"guest:{guest_id}", action, 1)
```

---

## Stripe Integration (Revised)

### Configuration

```python
# backend/app/core/config.py

class Settings(BaseSettings):
    # ... existing ...

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_STARTER: str = "price_xxx"      # 50k credits, $5
    STRIPE_PRICE_PRO: str = "price_yyy"          # 200k credits, $15
    STRIPE_PRICE_ENTERPRISE: str = "price_zzz"   # 1M credits, $50

    # Credit amounts (config-driven, no hardcoding)
    CREDITS_STARTER: int = 50000
    CREDITS_PRO: int = 200000
    CREDITS_ENTERPRISE: int = 1000000
    SIGNUP_BONUS_CREDITS: int = 10000
```

### Endpoints (Fixed Route Mismatch)

```python
# backend/app/api/billing.py

@router.get("/api/billing/products")
async def list_products():
    return {
        "products": [
            {"id": "starter", "credits": settings.CREDITS_STARTER, "price_usd": 5},
            {"id": "pro", "credits": settings.CREDITS_PRO, "price_usd": 15},
            {"id": "enterprise", "credits": settings.CREDITS_ENTERPRISE, "price_usd": 50},
        ]
    }


@router.post("/api/billing/checkout")
async def create_checkout(
    pack_id: Literal["starter", "pro", "enterprise"],
    user: User = Depends(require_auth),
):
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


@router.post("/api/billing/webhook")  # Fixed: was /stripe/webhook
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
        event_id = event["id"]  # Use event ID for idempotency

        # Idempotency: check both payment_intent and event_id
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

## CORS and Cookie Configuration

### Development (localhost)

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,  # Required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)
```

### Production

```python
# Cookie domain strategy: Use apex domain
# Frontend: doctalk-liard.vercel.app
# Backend: backend-production-a62e.up.railway.app
# Since different domains, we use Authorization header, not cookies for API auth

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
)
```

### Auth.js Cookie Config

```typescript
// frontend/src/lib/auth.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",  // No DB sessions
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub;
      session.accessToken = token;  // Pass JWT to client for API calls
      return session;
    },
  },
};
```

---

## API Summary (Complete)

### Public Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/[...nextauth]` | - | Auth.js handler |
| `POST` | `/api/guest/init` | - | Initialize guest session |
| `GET` | `/api/billing/products` | - | List credit packs |

### User Endpoints (Require Auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users/me` | Current user + balance |
| `PUT` | `/api/users/me` | Update profile |
| `GET` | `/api/credits/balance` | Balance + recent transactions |
| `GET` | `/api/credits/history` | Paginated ledger |
| `POST` | `/api/billing/checkout` | Create Stripe checkout |

### Internal Endpoints (Adapter Secret)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/internal/auth/users` | Create user |
| `GET` | `/api/internal/auth/users/{id}` | Get user by ID |
| `GET` | `/api/internal/auth/users/by-email/{email}` | Get user by email |
| `GET` | `/api/internal/auth/users/by-account/{provider}/{id}` | Get user by provider account |
| `PUT` | `/api/internal/auth/users/{id}` | Update user |
| `DELETE` | `/api/internal/auth/users/{id}` | Delete user |
| `POST` | `/api/internal/auth/accounts` | Link account |
| `DELETE` | `/api/internal/auth/accounts/{provider}/{id}` | Unlink account |
| `POST` | `/api/internal/auth/verification-tokens` | Create verification token |
| `POST` | `/api/internal/auth/verification-tokens/use` | Use verification token |

### Webhook Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/billing/webhook` | Stripe webhook |

---

## Environment Variables (New)

```bash
# Auth
AUTH_SECRET=                    # 32+ bytes base64, shared between Next.js and FastAPI
ADAPTER_SECRET=                 # Secret for internal adapter API calls
GUEST_SECRET=                   # Secret for signing guest cookies

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# Email (Magic Link)
EMAIL_SERVER=                   # SMTP URL or Resend API
EMAIL_FROM=noreply@doctalk.app

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_yyy
STRIPE_PRICE_ENTERPRISE=price_zzz
```

---

## Implementation Phases (Revised)

### Phase 1: Database + Internal Auth API (Week 1)
1. Alembic migration for new tables (User, Account, VerificationToken, CreditLedger, UsageRecord)
2. Migration to add `user_id` to `documents` table
3. Implement internal adapter API endpoints (`/api/internal/auth/*`)
4. Add `AUTH_SECRET` and `ADAPTER_SECRET` to config
5. Unit tests for adapter endpoints

### Phase 2: Auth.js Integration (Week 2)
1. Install Auth.js v5 in frontend
2. Implement custom adapter calling FastAPI
3. Configure Google OAuth provider
4. Configure Apple OAuth provider
5. Configure Email (Magic Link) provider
6. `/auth` page UI
7. AuthButton component in Header

### Phase 3: JWT Validation + User Scoping (Week 3)
1. JWT verification middleware in FastAPI
2. `get_current_user_optional` and `require_auth` dependencies
3. Update existing endpoints to accept optional user context
4. Scope document listing to user (when authenticated)
5. CreditsDisplay component in Header

### Phase 4: Credits System (Week 4)
1. Credit service with atomic debit/credit
2. Usage recording in chat service
3. Pre-chat balance check
4. 402 handler + PaywallModal
5. `/api/credits/balance` and `/api/credits/history` endpoints
6. Token-to-credit calculation (config-driven)

### Phase 5: Billing + Stripe (Week 5)
1. Stripe account setup + products
2. `/api/billing/checkout` endpoint
3. `/api/billing/webhook` endpoint
4. `/billing` page UI
5. Purchase flow E2E testing

### Phase 6: Guest Mode + Polish (Week 6)
1. Guest cookie issuance
2. Redis-based limit tracking
3. Guest limit enforcement middleware
4. Rate limiting (Redis-based)
5. Guest → User upgrade flow (link guest docs to user)
6. Full E2E testing

---

## File Structure (Complete)

```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py           # NEW: Internal adapter endpoints
│   │   ├── users.py          # NEW: User profile endpoints
│   │   ├── credits.py        # NEW: Credits balance/history
│   │   ├── billing.py        # NEW: Stripe checkout/webhook
│   │   ├── guest.py          # NEW: Guest cookie management
│   │   └── ... (existing)
│   ├── models/
│   │   └── tables.py         # MODIFIED: Add User, Account, VerificationToken, CreditLedger, UsageRecord
│   ├── services/
│   │   ├── auth_service.py   # NEW: User CRUD
│   │   ├── credit_service.py # NEW: Atomic debit/credit, balance calculation
│   │   └── ... (existing)
│   ├── schemas/
│   │   ├── auth.py           # NEW: Auth request/response schemas
│   │   ├── credits.py        # NEW: Credit schemas
│   │   └── billing.py        # NEW: Billing schemas
│   └── core/
│       ├── deps.py           # MODIFIED: Add JWT verification, require_auth
│       └── config.py         # MODIFIED: Add auth/stripe settings

frontend/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   └── page.tsx              # NEW: Login page
│   │   ├── billing/
│   │   │   └── page.tsx              # NEW: Purchase page
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts      # NEW: Auth.js handler
│   ├── components/
│   │   ├── CreditsDisplay.tsx        # NEW
│   │   ├── PaywallModal.tsx          # NEW
│   │   ├── AuthButton.tsx            # NEW
│   │   └── LoginForm.tsx             # NEW
│   ├── lib/
│   │   ├── auth.ts                   # NEW: Auth.js config + options
│   │   └── authAdapter.ts            # NEW: Custom FastAPI adapter
│   └── store/
│       └── index.ts                  # MODIFIED: Add auth state
```

---

## Migration SQL Preview

```sql
-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    image VARCHAR(500),
    email_verified TIMESTAMPTZ,
    credits_balance INTEGER NOT NULL DEFAULT 0,
    signup_bonus_granted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);

-- Accounts table
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type VARCHAR(50),
    scope VARCHAR(500),
    id_token TEXT,
    CONSTRAINT uq_accounts_provider_account UNIQUE (provider, provider_account_id)
);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Verification tokens table
CREATE TABLE verification_tokens (
    identifier VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- Credit ledger table
CREATE TABLE credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    ref_type VARCHAR(50),
    ref_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at);
CREATE INDEX idx_credit_ledger_ref ON credit_ledger(ref_type, ref_id);

-- Usage records table
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    model VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost_credits INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_records_user_created ON usage_records(user_id, created_at);

-- Add user_id to documents
ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_user_id ON documents(user_id);
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
- [ ] Stripe webhook credits account
- [ ] Guest can upload 1 PDF
- [ ] Guest can send 3 messages
- [ ] Guest hitting limit sees login prompt
- [ ] Ledger fully reconstructs balance
- [ ] No regression in existing PDF chat flow

---END---
