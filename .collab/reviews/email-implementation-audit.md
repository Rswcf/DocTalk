# Email Implementation Audit

**Date:** 2026-02-14
**Auditor:** code-auditor teammate
**Scope:** Complete email magic link authentication implementation in DocTalk

---

## Executive Summary

DocTalk uses Auth.js v5's default Resend provider for email magic link authentication. The implementation is **minimal and uses all defaults** — no custom email templates, no localization, no brand customization. While functional, it lacks polish and doesn't leverage best practices for user experience or deliverability.

**Key Finding:** 100% reliance on Auth.js defaults. No custom `sendVerificationRequest` handler.

---

## 1. Auth.js Configuration

**File:** `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/auth.ts`

### Provider Setup (Lines 32-41)

```typescript
if (process.env.RESEND_API_KEY) {
  providers.push(
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "DocTalk <noreply@doctalk.site>",
    })
  );
} else {
  console.warn("RESEND_API_KEY not set — email magic link provider disabled");
}
```

**Findings:**
- ✅ Graceful degradation when `RESEND_API_KEY` missing
- ✅ Default sender: `DocTalk <noreply@doctalk.site>`
- ❌ No `sendVerificationRequest` customization
- ❌ No token expiration override (uses Auth.js default: 24h)
- ❌ No theme customization (brand color, button text)

### Session Configuration (Lines 46-49)

```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

**Findings:**
- Session lasts 30 days (separate from token expiration)
- Token expires after 24 hours (Auth.js default, not explicitly set)

### Pages Configuration (Lines 66-70)

```typescript
pages: {
  signIn: "/auth",
  verifyRequest: "/auth/verify-request",
  error: "/auth/error",
}
```

---

## 2. Resend Integration

### Default Implementation

Auth.js uses the **default Resend provider** from `@auth/core/providers/resend.ts`:

```typescript
async sendVerificationRequest(params) {
  const { identifier: to, provider, url, theme } = params
  const { host } = new URL(url)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to,
      subject: `Sign in to ${host}`,  // ⚠️ Generic subject
      html: html({ url, host, theme }),
      text: text({ url, host }),
    }),
  })
}
```

**Findings:**
- ✅ Uses official Resend REST API
- ❌ **Subject line is generic:** `"Sign in to doctalk.site"` (uses `host` from URL)
- ❌ No differentiation between sign-up vs sign-in
- ❌ No Reply-To header
- ❌ No custom headers (List-Unsubscribe, etc.)

---

## 3. Email Templates

### HTML Template (Auth.js Default)

**Source:** `@auth/core/src/lib/utils/email.ts`

```html
<body style="background: #f9f9f9;">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="#346df1"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: #fff; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid #346df1; display: inline-block; font-weight: bold;">Sign
                in</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;">
        If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
```

**Findings:**
- ✅ Uses inline CSS (good for email clients)
- ✅ Responsive table layout (max-width: 600px)
- ❌ **Generic blue button** (`#346df1`) — doesn't match DocTalk brand (zinc monochrome)
- ❌ No logo or brand imagery
- ❌ Generic copy: "Sign in to doctalk.site"
- ❌ No personalization (name, context)
- ❌ No "why you received this" explanation
- ❌ No unsubscribe/settings link (not applicable for transactional, but good practice)
- ❌ No footer with company address/contact (GDPR/CAN-SPAM best practice)

### Plain Text Template (Fallback)

```text
Sign in to ${host}
${url}

```

**Findings:**
- ❌ **Bare minimum** — just URL and host
- ❌ No explanation of what this link is
- ❌ No "didn't request this?" safety message

---

## 4. Subject Lines

### Current Behavior

**Subject:** `"Sign in to doctalk.site"`

**Analysis:**
- ❌ Generic and uninformative
- ❌ Same subject for sign-up (new user) and sign-in (returning user)
- ❌ No action verb indicating what user should do
- ❌ No personalization
- ❌ Doesn't convey urgency or time-sensitivity

**Best Practice Comparison:**
- ✅ Good: `"Your DocTalk sign-in link (expires in 24h)"`
- ✅ Good: `"[DocTalk] Confirm your email address"`
- ✅ Good: `"Welcome to DocTalk — verify your email"`
- ❌ Current: `"Sign in to doctalk.site"`

---

## 5. Sender Configuration

### From Address

**Configured:** `process.env.EMAIL_FROM || "DocTalk <noreply@doctalk.site>"`

**Findings:**
- ✅ Proper format: `Display Name <email@domain.com>`
- ✅ Uses `noreply@` convention (but could be friendlier)
- ❌ No Reply-To header set (users can't respond to ask for help)
- ❌ Domain `doctalk.site` — verify SPF/DKIM/DMARC are configured

### Reply-To Header

**Current:** Not set

**Recommendation:** Add `reply-to: support@doctalk.site` so users can ask for help

---

## 6. i18n Support

### Frontend i18n

**Locales:** 11 languages (en, zh, es, ja, de, fr, ko, pt, it, ar, hi)

**Email-related strings in `frontend/src/i18n/locales/en.json`:**

```json
{
  "auth.checkEmail": "Check your email",
  "auth.checkEmailSubtitle": "We sent a sign-in link to your email. Click the link to sign in.",
  "auth.emailSent": "Email sent to {email}",
  "auth.resendEmail": "Resend email",
  "auth.useDifferentEmail": "Use a different email",
  "auth.emailUnavailable": "Email sign-in is temporarily unavailable. Please try another method.",
  "auth.unexpectedError": "An unexpected error occurred. Please try again.",
  "auth.resendFailed": "Failed to resend. Please try again."
}
```

### Email Templates

**Finding:** ❌ **Emails are NOT localized**

- Frontend UI has full i18n support (11 languages)
- Email templates use hardcoded English strings from Auth.js
- No way to detect user's preferred language for email
- No custom `sendVerificationRequest` to inject locale-aware templates

**Impact:**
- Chinese user signs up → sees Chinese UI → receives English email (confusing)
- Japanese user → Japanese UI → English email
- This breaks the user experience flow

---

## 7. Edge Cases & User Flows

### Sign-Up vs Sign-In Differentiation

**Finding:** ❌ **No differentiation**

- Both new users (sign-up) and returning users (sign-in) receive identical emails
- Subject: `"Sign in to doctalk.site"` (same for both)
- Body: Generic "Sign in to doctalk.site" (same for both)

**Best Practice:**
- Sign-up: `"Welcome to DocTalk — verify your email"`
- Sign-in: `"Your DocTalk sign-in link"`

### Expired Link Handling

**Token Expiration:** 24 hours (Auth.js default)

**User Experience:**
1. User requests magic link
2. **24 hours later** (or after token used once), clicks link
3. Redirected to `/auth/error?error=Verification`
4. Error page shows: `"The sign-in link has expired or has already been used. Please request a new one."`

**Findings:**
- ✅ Error page properly localized (11 languages)
- ✅ Clear error message
- ❌ Email doesn't mention 24-hour expiration
- ❌ No "link expires in X hours" countdown in email

**Code:** `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/auth/error/page.tsx`

```typescript
const getErrorMessage = () => {
  switch (error) {
    case "Verification":
      return t("auth.errorVerification");  // Expired/used link
    case "AccessDenied":
      return t("auth.errorAccessDenied");
    case "OAuthAccountNotLinked":
      return t("auth.errorAccountNotLinked");
    default:
      return t("auth.errorDefault");
  }
};
```

### Resend Flow

**File:** `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/AuthFormContent.tsx`

**Findings:**
- ✅ User can click "Resend email" button
- ✅ Sends new token via `signIn("resend", { email: sentEmail, callbackUrl })`
- ❌ No rate limiting on resend (relies on Resend API limits)
- ❌ No visual feedback on how many times user has resent
- ❌ No "wait X seconds before resending" cooldown

---

## 8. Backend Email Handling

### Verification Token Storage

**File:** `/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/auth_service.py`

**Table:** `verification_tokens` (lines 143-150 in `tables.py`)

```python
class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier: Mapped[str] = mapped_column(sa.String(255), primary_key=True)  # email
    token: Mapped[str] = mapped_column(sa.String(255), primary_key=True)       # hashed SHA-256
    expires: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), nullable=False)
```

**Token Hashing (line 19):**

```python
def hash_token(token: str) -> str:
    """Hash a verification token using SHA-256 hex encoding."""
    return hashlib.sha256(token.encode()).hexdigest()
```

**Token Usage (lines 153-179):**

```python
async def use_verification_token(
    db: AsyncSession, identifier: str, token: str
) -> Optional[VerificationToken]:
    """Use and delete a verification token atomically.

    Uses FOR UPDATE to prevent race conditions where the same token
    is used concurrently.
    """
    hashed = hash_token(token)

    # Use FOR UPDATE to lock the row and prevent concurrent use
    result = await db.execute(
        select(VerificationToken)
        .where(VerificationToken.identifier == identifier)
        .where(VerificationToken.token == hashed)
        .with_for_update()
    )
    vt = result.scalar_one_or_none()

    if not vt:
        return None

    # Check expiration and delete in single transaction
    if vt.expires < datetime.now(timezone.utc):
        await db.delete(vt)
        await db.commit()
        return None
```

**Findings:**
- ✅ Tokens hashed with SHA-256 (secure)
- ✅ Database locking with `FOR UPDATE` prevents race conditions
- ✅ Timezone-aware datetime handling (fixed in MEMORY.md on 2026-02-11)
- ✅ Token deleted after use (one-time use only)
- ✅ Expired tokens automatically deleted on use attempt
- ❌ No background cleanup of expired tokens (they stay in DB forever until use attempt)

---

## 9. Environment Variables

### Required Variables

**Frontend `.env.local.example`:**

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
AUTH_SECRET=your-32-byte-secret-here
ADAPTER_SECRET=your-adapter-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Missing from example:** `RESEND_API_KEY` and `EMAIL_FROM`

**README.md documentation:**

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | No | Resend API key for Email Magic Link authentication |
| `EMAIL_FROM` | No | Sender email address for magic link emails (e.g. `noreply@doctalk.site`) |

**Findings:**
- ❌ `.env.local.example` doesn't include email vars (inconsistent with README)
- ✅ README documents both vars
- ✅ Both marked as optional (graceful degradation)

---

## 10. Current Production Setup

### Vercel Environment Variables

**From MEMORY.md:**
> Required Vercel env vars: AUTH_SECRET, ADAPTER_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_INTERNAL_URL, NEXT_PUBLIC_API_BASE

**Email vars:** Not listed — unclear if `RESEND_API_KEY` is configured in production

**Production URL:** `www.doctalk.site`

**Assumptions:**
- If Resend is enabled in prod, sender is `DocTalk <noreply@doctalk.site>`
- Default Auth.js email template is used (generic blue button)
- English-only emails sent to all users regardless of locale

---

## 11. Gaps & Issues Summary

### Critical Issues

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| 1 | **No i18n for emails** | Chinese/Japanese users receive English emails | HIGH |
| 2 | **Generic subject line** | Low open rates, unclear action | MEDIUM |
| 3 | **No brand customization** | Email looks generic (blue button ≠ DocTalk zinc brand) | MEDIUM |
| 4 | **No sign-up/sign-in differentiation** | Confusing UX for new vs returning users | MEDIUM |
| 5 | **No Reply-To header** | Users can't ask for help via email | LOW |

### UX Issues

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| 6 | **No expiration warning in email** | Users don't know link expires in 24h | LOW |
| 7 | **No logo in email** | Less recognizable/trustworthy | LOW |
| 8 | **No personalized greeting** | Generic "Sign in to doctalk.site" | LOW |
| 9 | **Bare minimum plain text** | Poor experience for text-only email clients | LOW |
| 10 | **No footer with contact info** | Misses GDPR/CAN-SPAM best practices | LOW |

### Deliverability Issues

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| 11 | **No custom SPF/DKIM/DMARC docs** | Unclear if properly configured for `doctalk.site` | MEDIUM |
| 12 | **No warming strategy documented** | Resend is new sender — needs gradual ramp-up | LOW |
| 13 | **No engagement tracking** | Can't measure open/click rates to optimize | LOW |

### Technical Debt

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| 14 | **No cleanup of expired tokens** | Verification tokens accumulate in DB | LOW |
| 15 | **No resend rate limiting** | Potential abuse/spam complaints | MEDIUM |
| 16 | **`.env.local.example` missing email vars** | Inconsistent with README | LOW |

---

## 12. Relevant File Paths

### Frontend

- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/auth.ts` — Auth.js config, Resend provider setup
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/authAdapter.ts` — FastAPI adapter (no email logic)
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/auth/page.tsx` — Sign-in page
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/auth/verify-request/page.tsx` — "Check your email" page
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/auth/error/page.tsx` — Error page (expired link, etc.)
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/AuthFormContent.tsx` — Email input form + resend logic
- `/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/*.json` — i18n strings (11 languages)

### Backend

- `/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/auth_service.py` — Verification token CRUD
- `/Users/mayijie/Projects/Code/010_DocTalk/backend/app/models/tables.py` — VerificationToken model

### Documentation

- `/Users/mayijie/Projects/Code/010_DocTalk/README.md` — Env var docs (lines 163-164)
- `/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md` — No email-specific docs

### External Dependencies

- `frontend/node_modules/@auth/core/src/providers/resend.ts` — Default Resend provider
- `frontend/node_modules/@auth/core/src/lib/utils/email.ts` — Default HTML/text templates

---

## 13. Recommendations

### Phase 1: Quick Wins (1-2 hours)

1. **Add custom `sendVerificationRequest`** in `auth.ts`
   - Custom subject: `"Your DocTalk sign-in link (expires in 24h)"`
   - Add Reply-To header: `support@doctalk.site`
   - Add expiration warning in body

2. **Update `.env.local.example`**
   - Add `RESEND_API_KEY` and `EMAIL_FROM`

3. **Document SPF/DKIM/DMARC setup**
   - Add to README or new `docs/EMAIL_SETUP.md`

### Phase 2: Brand Customization (3-4 hours)

4. **Create custom HTML email template**
   - Match DocTalk zinc monochrome brand (not blue)
   - Add logo/wordmark
   - Footer with company address, contact, privacy/terms links

5. **Differentiate sign-up vs sign-in**
   - Check if user exists before sending
   - Sign-up: "Welcome to DocTalk — verify your email"
   - Sign-in: "Your DocTalk sign-in link"

### Phase 3: i18n (4-6 hours)

6. **Add locale detection**
   - Pass user's locale via `signIn("resend", { email, locale })`
   - Customize subject + body based on locale
   - Use existing i18n strings where possible

7. **Translate email templates**
   - Create 11 locale-specific templates
   - Extract to separate files (not inline in code)

### Phase 4: Deliverability (2-3 hours)

8. **Verify SPF/DKIM/DMARC**
   - Check DNS records for `doctalk.site`
   - Add DMARC policy
   - Test with mail-tester.com

9. **Add engagement tracking**
   - Resend supports open/click tracking
   - Log metrics to monitor deliverability

10. **Implement warming strategy**
    - Gradual ramp-up if Resend sender is new
    - Monitor bounce rates

### Phase 5: Technical Improvements (2-3 hours)

11. **Add resend rate limiting**
    - 1 email per 60 seconds per user
    - Frontend cooldown UI

12. **Background cleanup of expired tokens**
    - Celery periodic task to delete tokens older than 24h

13. **Improve plain text template**
    - Full explanation, not just URL

---

## 14. Conclusion

The current email implementation is **functional but minimal**. It uses 100% Auth.js defaults with no customization. While this is acceptable for MVP, it creates several UX and deliverability issues:

- **UX:** Generic emails don't match brand, lack i18n, no context for new vs returning users
- **Deliverability:** Unclear if SPF/DKIM/DMARC properly configured, no warming strategy
- **Technical:** No cleanup, no rate limiting, no tracking

**Priority for improvement:** MEDIUM

The system works, but improving email quality will boost conversion rates (users completing sign-in) and reduce support requests ("I didn't get the email", "Is this spam?").

**Recommended next steps:**
1. Start with Phase 1 quick wins (custom subject, Reply-To, expiration warning)
2. Then Phase 2 brand customization (logo, zinc colors, footer)
3. Phase 3 i18n if international users are significant portion of userbase
4. Phase 4+5 as time allows

---

**Audit completed:** 2026-02-14
**Total issues identified:** 16
**Files reviewed:** 12
**LOC analyzed:** ~800
