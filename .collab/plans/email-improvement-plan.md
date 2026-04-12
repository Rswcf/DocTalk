# Magic Link Email Improvement Plan

**Date:** 2026-02-14
**Status:** Proposed
**Priority:** HIGH — directly impacts user conversion and first impression

---

## Current State (Problems)

### What Users See Today

**Subject:** `Sign in to www.doctalk.site`
**From:** `DocTalk <noreply@doctalk.site>`

The email body is Auth.js's **100% default template** — no customization at all:
- Generic blue button (`#346df1`) that doesn't match DocTalk's zinc monochrome brand
- No logo, no brand identity
- Text: "Sign in to **www.doctalk.site**" + "If you did not request this email you can safely ignore it."
- No footer, no company info, no privacy/terms links
- Same email for sign-up (new user) and sign-in (existing user)
- English-only (despite 11 UI locales)
- `noreply@` sender address reduces trust

### Why It's Landing in Spam

1. **`noreply@` sender** — some ISPs flag as bulk/impersonal mail
2. **Possibly missing DMARC record** — need to verify DNS setup
3. **No Reply-To header** — users who try to reply get bounce → mark as spam instead
4. **Bare-minimum plain text** — just URL + host, no explanation
5. **No List-Unsubscribe header** — signals irresponsible sending to ISPs

### Code Location

The entire email setup is **2 lines** in `frontend/src/lib/auth.ts:32-38`:

```typescript
Resend({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM || "DocTalk <noreply@doctalk.site>",
})
```

No `sendVerificationRequest`, no template, no custom subject — all Auth.js defaults.

---

## Improvement Plan

### Phase 1: Custom Email Template + Deliverability Fixes (P0)

**Effort:** ~4 hours | **Impact:** HIGH — fixes spam issues + professional appearance

#### 1.1 Custom `sendVerificationRequest` in `auth.ts`

Replace the bare Resend provider with a fully custom implementation:

```typescript
Resend({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM || "DocTalk <auth@doctalk.site>",
  async sendVerificationRequest({ identifier: email, url, provider }) {
    const { host } = new URL(url);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: provider.from,
        to: email,
        subject: "Your DocTalk sign-in link",
        html: buildHtmlEmail({ url, host }),
        text: buildTextEmail({ url, host }),
        headers: {
          "X-Entity-Ref-ID": crypto.randomUUID(),
          "Reply-To": "support@doctalk.site",
        },
      }),
    });
    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  },
})
```

#### 1.2 Branded HTML Email Template

Design a professional email matching DocTalk's zinc monochrome brand:

**Structure:**
```
┌─────────────────────────────────┐
│         [DocTalk Logo]          │  ← SVG/text logo, zinc-900
│                                 │
│   Sign in to DocTalk            │  ← H1, zinc-900, 24px
│                                 │
│   Click the button below to     │  ← Body text, zinc-500, 16px
│   sign in to your account.      │
│   This link expires in 24       │
│   hours.                        │
│                                 │
│   ┌───────────────────────┐     │
│   │   Sign in to DocTalk  │     │  ← CTA button, bg zinc-900
│   └───────────────────────┘     │     text white, rounded-md
│                                 │
│   If you didn't request this,   │  ← Disclaimer, zinc-400, 14px
│   you can safely ignore it.     │
│                                 │
├─────────────────────────────────┤
│   DocTalk · AI Document Q&A     │  ← Footer, zinc-400, 12px
│   Privacy · Terms · Contact     │     with links
│   doctalk.site                  │
└─────────────────────────────────┘
```

**Key design decisions:**
- **CTA button:** `bg-zinc-900` (#18181b) text white — matches DocTalk brand, NOT Auth.js blue
- **Font stack:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Max width:** 600px (email standard)
- **Layout:** Table-based (NOT flex/grid — email client compatibility)
- **All CSS inline** (email clients strip `<style>` tags)
- **Footer:** Company name, privacy/terms links, contact — CAN-SPAM/GDPR compliance

#### 1.3 Improved Plain Text Fallback

```text
Sign in to DocTalk
==================

Click the link below to sign in to your account:
{url}

This link expires in 24 hours.

If you didn't request this email, you can safely ignore it.

---
DocTalk - AI-powered document Q&A
https://www.doctalk.site
Privacy: https://www.doctalk.site/privacy
Terms: https://www.doctalk.site/terms
```

#### 1.4 Sender Address Change

```
Before: DocTalk <noreply@doctalk.site>
After:  DocTalk <auth@doctalk.site>
Header: Reply-To: support@doctalk.site
```

**Required:**
- Add `auth@doctalk.site` as verified sender in Resend dashboard
- Or verify subdomain `auth.doctalk.site` for isolated reputation
- Set up forwarding for `support@doctalk.site` to monitored inbox

#### 1.5 DNS Authentication Verification

**Check/add these DNS records for `doctalk.site`:**

| Record | Type | Name | Value |
|--------|------|------|-------|
| SPF | TXT | @ | `v=spf1 include:_spf.resend.com ~all` |
| DKIM | TXT | resend._domainkey | (Resend-provided public key) |
| DMARC | TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@doctalk.site` |

**Action:** Log into Resend dashboard → Domains → verify all records green.

---

### Phase 2: Sign-Up vs Sign-In Differentiation (P1)

**Effort:** ~2 hours | **Impact:** MEDIUM — better UX for new vs returning users

#### 2.1 Detect New vs Existing User

In `sendVerificationRequest`, check if user exists by calling the backend adapter:

```typescript
async sendVerificationRequest({ identifier: email, url, provider }) {
  // Auth.js creates user AFTER verification, so we can check if user exists
  // to determine sign-up vs sign-in
  const isNewUser = !(await userExistsInDB(email));

  const subject = isNewUser
    ? "Welcome to DocTalk — verify your email"
    : "Your DocTalk sign-in link";

  const heading = isNewUser
    ? "Welcome to DocTalk!"
    : "Sign in to DocTalk";

  const bodyText = isNewUser
    ? "Click the button below to verify your email and create your account. You'll get 1,000 free credits to start."
    : "Click the button below to sign in to your account. This link expires in 24 hours.";

  // ... send email with these customized strings
}
```

**Implementation approach:** Make a lightweight API call to backend to check if email exists in `users` table. The adapter already has this endpoint pattern.

#### 2.2 Differentiated Subject Lines

| Scenario | Subject |
|----------|---------|
| New user sign-up | `Welcome to DocTalk — verify your email` |
| Existing user sign-in | `Your DocTalk sign-in link` |

---

### Phase 3: Email i18n (P1)

**Effort:** ~4 hours | **Impact:** HIGH for international users

#### 3.1 Pass Locale Through Sign-In Flow

Currently `AuthFormContent.tsx` calls:
```typescript
signIn("resend", { email, callbackUrl })
```

Need to also pass the user's current locale:
```typescript
signIn("resend", { email, callbackUrl, locale: currentLocale })
```

**Note:** Auth.js doesn't natively support extra params in `sendVerificationRequest`. Two approaches:
1. **URL approach:** Encode locale in callbackUrl: `callbackUrl: /${locale}/dashboard`
2. **Cookie approach:** Read `NEXT_LOCALE` cookie in `sendVerificationRequest`
3. **Query approach:** Append `?locale=zh` to the magic link URL

**Recommended:** Option 2 (cookie) — cleanest, no URL modification needed.

#### 3.2 Localized Email Strings

Create email-specific i18n strings (separate from UI i18n since emails are server-side):

```typescript
// frontend/src/lib/emailStrings.ts
const emailStrings: Record<string, EmailStrings> = {
  en: {
    signInSubject: "Your DocTalk sign-in link",
    welcomeSubject: "Welcome to DocTalk — verify your email",
    signInHeading: "Sign in to DocTalk",
    welcomeHeading: "Welcome to DocTalk!",
    signInBody: "Click the button below to sign in to your account. This link expires in 24 hours.",
    welcomeBody: "Click the button below to verify your email and create your account.",
    buttonText: "Sign in to DocTalk",
    welcomeButtonText: "Verify your email",
    disclaimer: "If you didn't request this email, you can safely ignore it.",
    footer: "DocTalk - AI-powered document Q&A",
    expires: "This link expires in 24 hours.",
  },
  zh: {
    signInSubject: "DocTalk 登录链接",
    welcomeSubject: "欢迎加入 DocTalk — 请验证邮箱",
    signInHeading: "登录 DocTalk",
    welcomeHeading: "欢迎加入 DocTalk!",
    signInBody: "点击下方按钮登录您的账户。此链接 24 小时内有效。",
    welcomeBody: "点击下方按钮验证邮箱并创建账户。",
    buttonText: "登录 DocTalk",
    welcomeButtonText: "验证邮箱",
    disclaimer: "如果您没有请求此邮件，请忽略。",
    footer: "DocTalk — AI 文档问答助手",
    expires: "此链接 24 小时内有效。",
  },
  ja: {
    signInSubject: "DocTalk サインインリンク",
    welcomeSubject: "DocTalk へようこそ — メールアドレスを確認してください",
    // ... (all 11 locales)
  },
  // es, de, fr, ko, pt, it, ar, hi
};
```

---

### Phase 4: Corner Cases & Hardening (P2)

**Effort:** ~3 hours | **Impact:** MEDIUM — prevents edge case failures

#### 4.1 Resend Rate Limiting

**Current:** No rate limiting on "Resend email" button.

**Fix in `AuthFormContent.tsx`:**
```typescript
const [cooldown, setCooldown] = useState(0);
const [resendCount, setResendCount] = useState(0);

const handleResend = async () => {
  if (cooldown > 0 || resendCount >= 3) return;

  await signIn("resend", { email, callbackUrl });
  setResendCount(prev => prev + 1);
  setCooldown(60); // 60-second cooldown

  const timer = setInterval(() => {
    setCooldown(prev => {
      if (prev <= 1) { clearInterval(timer); return 0; }
      return prev - 1;
    });
  }, 1000);
};
```

**UI:** Show countdown timer on button: "Resend email (45s)" → "Resend email" → "Maximum resends reached"

#### 4.2 Token Expiration in Email

**Current:** Email doesn't mention 24-hour expiration.
**Fix:** Add "This link expires in 24 hours." prominently in email body.

#### 4.3 Expired Token Cleanup

**Current:** Expired verification tokens stay in DB until use attempt.
**Fix:** Add periodic cleanup (Celery beat task or cron):

```python
# backend/app/workers/cleanup_tasks.py
@celery_app.task
async def cleanup_expired_verification_tokens():
    """Delete verification tokens older than 48 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    async with get_db_session() as db:
        await db.execute(
            delete(VerificationToken).where(VerificationToken.expires < cutoff)
        )
        await db.commit()
```

#### 4.4 Verify-Request Page Enhancement

**Current:** Generic "Check your email" page with back-to-sign-in link.
**Improve:**
- Show the email address where the link was sent (masked: `y***e@gmail.com`)
- Add "Check your spam folder" hint
- Add "Didn't receive it? Check your spam folder first, then resend." guidance
- Add countdown for resend cooldown

#### 4.5 Error Recovery

**Expired link flow:**
1. User clicks expired magic link
2. Redirected to `/auth/error?error=Verification`
3. **Current:** Shows error + "try again" link
4. **Improve:** Auto-populate email field when redirecting back to sign-in, so user doesn't have to re-enter

---

### Phase 5: Monitoring & Optimization (P3)

**Effort:** ~2 hours | **Impact:** LOW-MEDIUM — ongoing deliverability

#### 5.1 Resend Webhook for Bounce Handling

```typescript
// frontend/src/app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const event = await req.json();

  switch (event.type) {
    case "email.bounced":
      // Log bounce, optionally flag email in backend
      console.error(`Email bounced: ${event.data.to}`);
      break;
    case "email.complained":
      // User marked as spam — critical signal
      console.error(`Spam complaint: ${event.data.to}`);
      break;
  }

  return new Response("OK");
}
```

#### 5.2 DMARC Policy Progression

| Week | Policy | Notes |
|------|--------|-------|
| 0 | `p=none` | Monitor only |
| 2 | `p=quarantine; pct=10` | Quarantine 10% of failures |
| 4 | `p=quarantine; pct=100` | Quarantine all failures |
| 8 | `p=reject` (optional) | Reject all failures |

#### 5.3 Google Postmaster Tools

Register `doctalk.site` in Google Postmaster Tools to monitor:
- Domain reputation
- Spam rate
- Authentication success rate
- Delivery errors

---

## Implementation Priority

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| Phase 1: Custom template + deliverability | ~4h | HIGH | P0 — Do first |
| Phase 2: Sign-up vs sign-in differentiation | ~2h | MEDIUM | P1 — Same sprint |
| Phase 3: Email i18n (11 locales) | ~4h | HIGH (intl) | P1 — Same sprint |
| Phase 4: Corner cases & hardening | ~3h | MEDIUM | P2 — Next sprint |
| Phase 5: Monitoring & optimization | ~2h | LOW-MED | P3 — Ongoing |

**Total estimated effort:** ~15 hours across all phases.
**Recommended first deploy:** Phase 1 + 2 together (~6 hours).

---

## Files to Modify

### Phase 1
| File | Changes |
|------|---------|
| `frontend/src/lib/auth.ts` | Add custom `sendVerificationRequest` with branded template |
| `frontend/src/lib/emailTemplate.ts` | **NEW** — HTML/text email template functions |
| DNS (Resend dashboard) | Verify SPF/DKIM, add DMARC record |
| Resend dashboard | Change sender to `auth@doctalk.site`, verify domain |

### Phase 2
| File | Changes |
|------|---------|
| `frontend/src/lib/auth.ts` | Add user-exists check for subject differentiation |
| `frontend/src/lib/emailTemplate.ts` | Add welcome vs sign-in variants |

### Phase 3
| File | Changes |
|------|---------|
| `frontend/src/lib/emailStrings.ts` | **NEW** — email i18n strings (11 locales) |
| `frontend/src/lib/auth.ts` | Read locale from cookie/request |
| `frontend/src/components/AuthFormContent.tsx` | Pass locale to signIn call |

### Phase 4
| File | Changes |
|------|---------|
| `frontend/src/components/AuthFormContent.tsx` | Add resend cooldown + rate limit |
| `frontend/src/app/auth/verify-request/page.tsx` | Enhanced UX guidance |
| `backend/app/workers/cleanup_tasks.py` | **NEW** — expired token cleanup |

---

## Spam Avoidance Checklist

- [ ] Change sender from `noreply@` to `auth@doctalk.site`
- [ ] Add `Reply-To: support@doctalk.site` header
- [ ] Add `X-Entity-Ref-ID` header (unique per email)
- [ ] Verify SPF record includes `_spf.resend.com`
- [ ] Verify DKIM record from Resend
- [ ] Add DMARC record (`p=none` to start)
- [ ] Use XHTML transitional DOCTYPE
- [ ] All CSS inline (no external stylesheets)
- [ ] Include proper plain text multipart/alternative
- [ ] No spam trigger words (avoid "urgent", "act now", "free", "verify now")
- [ ] Subject line: clear and specific, not generic
- [ ] Image-to-text ratio < 40% images
- [ ] All links use HTTPS and match sender domain
- [ ] Footer includes company info and privacy/terms links
- [ ] Test with Gmail, Outlook, Yahoo before deploying
- [ ] Monitor Resend deliverability insights after deploy

---

## Reference: Industry Examples

**Linear:** Clean monochrome, minimal text, one CTA button, company footer
**Vercel:** Black button on white, simple "Verify" heading, expires in 24h warning
**Notion:** Branded header, personalized greeting, clear CTA, security notice
**Stripe:** Logo at top, clear heading, branded button color, detailed footer
**GitHub:** Simple text-heavy email, code-style verification, dark button

**Common patterns across all:**
1. Logo/brand mark at top
2. Clear heading (not "Sign in to domain.com")
3. Brief explanation of what the link does
4. Single prominent CTA button matching brand colors
5. Expiration warning
6. Security disclaimer
7. Company footer with links

---

## Research Sources

- Code audit: `.collab/reviews/email-implementation-audit.md`
- Deliverability research: `.collab/plans/email-deliverability-research.md`
- Resend docs: https://resend.com/blog/top-10-email-deliverability-tips
- Auth.js email customization: https://authjs.dev/getting-started/providers/resend
- Spam trigger words: https://snov.io/blog/550-spam-trigger-words-to-avoid/
