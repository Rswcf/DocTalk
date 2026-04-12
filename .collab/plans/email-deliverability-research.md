# Email Deliverability Research for DocTalk Magic Link Emails

**Research Date:** 2026-02-14
**Current Setup:** Resend (resend.com) sending from `noreply@doctalk.site`
**Issue:** Magic link emails landing in spam

---

## 1. SPF/DKIM/DMARC Setup for Custom Domains

### Overview
SPF, DKIM, and DMARC work together to prevent email spoofing and improve deliverability by authenticating the sender domain.

### What Each Protocol Does

**SPF (Sender Policy Framework):**
- Defines which IP addresses/servers can send email from your domain
- Prevents unauthorized servers from sending emails using your domain
- DNS TXT record lists authorized sending sources

**DKIM (DomainKeys Identified Mail):**
- Cryptographically signs emails to prove they haven't been tampered with
- Requires generating encryption keys and adding public key to DNS
- Email providers verify signature against DNS public key

**DMARC (Domain-based Message Authentication, Reporting & Conformance):**
- Tells receiving servers what to do with emails that fail SPF or DKIM
- Policy options: `none` (monitor), `quarantine` (spam folder), `reject` (block)
- Provides reporting on authentication failures

### Implementation Order

1. **SPF first** (easiest to set up)
2. **DKIM second** (requires key generation)
3. **DMARC last** (after 48 hours of SPF+DKIM operation)

### DMARC Policy Progression

**CRITICAL:** Always start with `p=none` to monitor before enforcing:

```
v=DMARC1; p=none; rua=mailto:dmarc@doctalk.site
```

After monitoring shows clean authentication:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@doctalk.site; pct=10
```

Final strict policy (only after extended testing):
```
v=DMARC1; p=reject; rua=mailto:dmarc@doctalk.site
```

### DNS Records for doctalk.site via Resend

When using Resend, they provide specific DNS records during domain verification. Typical structure:

**SPF Record:**
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
```

**DKIM Records (Resend provides):**
```
Type: TXT
Name: resend._domainkey
Value: [Resend-provided public key]
```

**DMARC Record:**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@doctalk.site
```

**Sources:**
- [SPF DKIM DMARC Setup Guide 2026 - SmartReach](https://smartreach.io/blog/how-to-set-up-spf-dkim-dmarc-guide/)
- [How to Set Up Your SPF, DKIM, and DMARC Records in 2026](https://www.trulyinbox.com/blog/how-to-set-up-spf-dkim-and-dmarc/)
- [DMARCLY: How to Implement DMARC/DKIM/SPF](https://dmarcly.com/blog/how-to-implement-dmarc-dkim-spf-to-stop-email-spoofing-phishing-the-definitive-guide)

---

## 2. Resend-Specific Deliverability Tips

### Domain Verification

**Adaptive Verification Interface:**
- Resend's domain verification UI adapts to your DNS provider (Google Domains, Cloudflare, etc.)
- Shows per-record verification status for easier troubleshooting
- Real-time feedback on which records are missing or misconfigured

**Automatic SPF/DKIM:**
- When you add a domain to Resend, SPF and DKIM are handled automatically
- You only need to add DNS records Resend provides
- Resend manages DKIM key rotation and signing

### Subdomain Strategy (CRITICAL)

**Use subdomain instead of root domain:**
```
Good: mail.doctalk.site
Bad:  doctalk.site
```

**Why subdomains matter:**
- Separates transactional email reputation from marketing/other email
- Issues with one subdomain don't affect others
- Allows independent warmup schedules
- Industry best practice for production apps

**Recommendation for DocTalk:**
- Transactional (magic links): `auth.doctalk.site` or `mail.doctalk.site`
- Marketing (future): `newsletter.doctalk.site`
- Main website: Continue using `www.doctalk.site`

### Link and Tracking Management

**Click Tracking:**
- Click tracking modifies URLs and can trigger spam filters
- **Disable for transactional emails** (magic links don't need tracking)
- Keep enabled only for marketing emails where analytics matter

**URL Matching:**
- Ensure URLs in email match the sending domain
- Example: If sending from `mail.doctalk.site`, links should point to `doctalk.site` or `www.doctalk.site`
- Mismatched URLs (sending from doctalk.site but linking to different-domain.com) trigger spam filters

### Domain Warmup

**For high-volume senders:**
- Start with low volume (10-20 emails/day)
- Gradually increase over 2-4 weeks
- Mailbox providers flag sudden volume spikes as suspicious

**For DocTalk (transactional magic links):**
- Warmup less critical since volume grows with user signups
- Natural growth pattern is trusted by ISPs
- Still avoid sudden mass sends (e.g., email blast to entire user base)

### Deliverability Insights Tool

Resend provides automatic deliverability checks:
- Access via email "Insights" in Resend dashboard
- Recommends specific improvements based on email content
- Checks HTML structure, authentication, content patterns

**Sources:**
- [Top 10 Email Deliverability Tips - Resend](https://resend.com/blog/top-10-email-deliverability-tips)
- [Email Authentication: A Developer's Guide - Resend](https://resend.com/blog/email-authentication-a-developers-guide)
- [New Domain Verification Experience - Resend](https://resend.com/blog/new-domain-verification-experience)
- [Deliverability Insights - Resend](https://resend.com/docs/dashboard/emails/deliverability-insights)

---

## 3. Content That Triggers Spam Filters

### Critical Categories to Avoid

**Financial Promises:**
- ❌ "Earn", "income", "investment", "credit", "instant cash", "get paid"
- ❌ "Freedom financially", "money back", "cash bonus"

**Urgency/Pressure:**
- ❌ "Act now", "urgent", "limited time", "offer expires", "last chance"
- ❌ "Now only", "don't delete", "instant", "hurry"

**Too-Good-To-Be-True:**
- ❌ "Free", "guaranteed", "risk-free", "no cost", "promise you"
- ❌ "100% satisfied", "eliminate debt"

**Security Threats:**
- ❌ "Account suspended", "verify now", "update required"
- ❌ "Click below", "security alert", "action required"

**Health/Wellness:**
- ❌ "Lose weight", "diet", "miracle", "cure", "eliminate"

### Transactional Email Best Practices

**What magic link emails should avoid:**

❌ Bad subject: "Urgent: Verify Your Account Now!"
✅ Good subject: "Sign in to DocTalk"

❌ Bad CTA: "Click Here Immediately!"
✅ Good CTA: "Sign in to your account"

❌ Bad body: "Your account requires immediate verification. Click now or account will be suspended!"
✅ Good body: "Click the button below to sign in to DocTalk. This link expires in 24 hours."

### Context Matters

**Single occurrence = usually fine**
- One "free" or "urgent" won't trigger filters
- Multiple trigger words significantly increase risk

**Clarity over persuasion:**
- Transactional emails should be straightforward
- Avoid marketing language in authentication emails
- Focus on what user needs to do (sign in) not why it's great

**Alternative phrasing:**
- Instead of "Free": Use "complimentary", "at no additional cost", or describe value
- Instead of "Urgent": Use specific timeframes like "Please sign in within 24 hours"
- Instead of "Click now": Use "Sign in to your account"

**Sources:**
- [550+ Spam Trigger Words To Avoid In 2026 - Snov.io](https://snov.io/blog/550-spam-trigger-words-to-avoid/)
- [100+ Email Spam Trigger Words to Be Cautious With in 2026 - Clearout](https://clearout.io/blog/email-spam-trigger-words/)
- [349+ Spam Words to Avoid in Emails (2026 Guide) - Mailmeteor](https://mailmeteor.com/blog/spam-words)

---

## 4. HTML Email Structure for Deliverability

### DOCTYPE and Basic Structure

**Use HTML4 transitional DOCTYPE:**
```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Sign in to DocTalk</title>
  <style type="text/css">
    /* Critical CSS only */
  </style>
</head>
<body>
  <!-- Email content -->
</body>
</html>
```

### Inline CSS (CRITICAL)

**Most email clients strip external CSS and `<style>` tags:**

❌ Bad (external stylesheet):
```html
<link rel="stylesheet" href="styles.css">
```

❌ Bad (style tag only):
```html
<style>
  .button { background: blue; }
</style>
<a class="button">Click me</a>
```

✅ Good (inline styles):
```html
<a style="background-color: #3b82f6; color: white; padding: 12px 24px;">Sign in</a>
```

**Hybrid approach (best):**
```html
<style type="text/css">
  .button { background-color: #3b82f6; } /* Fallback */
</style>
<a class="button" style="background-color: #3b82f6; color: white; padding: 12px 24px;">Sign in</a>
```

**Use CSS inliner tools:**
- [Mailmodo CSS Inliner](https://www.mailmodo.com/tools/css-inliner/)
- Many email libraries include automatic inlining

### Layout Structure

**Use tables, NOT CSS Grid/Flexbox:**

❌ Avoid modern CSS:
```html
<div style="display: grid;">...</div>
<div style="display: flex;">...</div>
```

✅ Use table layouts:
```html
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td>Content</td>
  </tr>
</table>
```

**Why:** Gmail, Outlook, and older clients don't support modern CSS layout. Tables guarantee consistent rendering.

### Plain Text Fallback (CRITICAL for Deliverability)

**Missing plain text = major red flag to spam filters**

**Use multipart/alternative MIME:**
```
Content-Type: multipart/alternative; boundary="boundary"

--boundary
Content-Type: text/plain; charset=UTF-8

Sign in to DocTalk

Click this link to sign in: https://doctalk.site/auth/callback?token=...

This link expires in 24 hours.

--boundary
Content-Type: text/html; charset=UTF-8

<html>...</html>

--boundary--
```

**Benefits:**
- Improves deliverability (signals legitimate email to ISPs)
- Ensures compatibility with all email clients
- Fallback for users with images disabled
- Required for screen reader accessibility

**How email clients use it:**
- HTML-capable clients show HTML version
- Plain-text-only clients show text version
- Spam filters see both and verify consistency

### Image-to-Text Ratio

**Keep images minimal:**
- Text-heavy emails perform better for deliverability
- Images can be blocked by default (many email clients)
- Image-only emails = instant spam flag

**Best practices:**
- Maximum 40% images, 60% text
- Include `alt` text for all images
- Don't rely on images for critical information (like the magic link)

**For DocTalk magic links:**
- Logo at top (optional, small)
- Text-based content and CTA button
- No background images or complex graphics

### Link Hygiene

**Use clean, trackable URLs:**

✅ Good:
```html
<a href="https://www.doctalk.site/auth/callback?token=abc123">Sign in</a>
```

❌ Bad (URL shorteners in transactional email):
```html
<a href="https://bit.ly/xxx">Sign in</a>
```

**Link best practices:**
- Use HTTPS (not HTTP)
- Match domain to sender (send from doctalk.site → link to doctalk.site)
- Avoid URL shorteners (bit.ly, tinyurl) in transactional emails
- Don't hide links (text and href should match for trust)

**Sources:**
- [8 HTML Email Tips for Better Deliverability - SmartReach](https://smartreach.io/blog/html-best-practices-email-deliverability/)
- [HTML vs. Plain Text Emails - Campaign Monitor](https://www.campaignmonitor.com/blog/email-marketing/html-vs-plain-text-emails-everything-you-need-to-know/)
- [Email HTML Best Practices - Mailtrap](https://mailtrap.io/blog/html-email/)

---

## 5. Email Headers Best Practices

### List-Unsubscribe Header

**What it does:**
- Provides one-click unsubscribe button in email clients (Gmail, Yahoo, etc.)
- Reduces spam complaints (users unsubscribe instead of marking spam)
- Required by Gmail/Yahoo for senders sending >5,000 emails/day

**For transactional emails (like magic links):**
- **Not strictly required** since magic links are triggered by user action
- However, including it can still help deliverability
- Shows you follow best practices to ISPs

**Implementation:**
```
List-Unsubscribe: <https://www.doctalk.site/unsubscribe?email=user@example.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

**RFC 8058 compliance:**
- DKIM signature must cover both List-Unsubscribe headers
- One-click unsubscribe must work without login
- Prevents bot unsubscribes while enabling legitimate ones

**Benefits:**
- Reduced spam complaints (major deliverability factor)
- Positive signal to ISPs (shows responsible sender)
- Better user experience (easy opt-out)

### Reply-To Header

**Don't use noreply@ (see section 7 for details)**

✅ Good:
```
From: DocTalk <mail@doctalk.site>
Reply-To: support@doctalk.site
```

❌ Bad:
```
From: DocTalk <noreply@doctalk.site>
Reply-To: noreply@doctalk.site
```

**Why Reply-To matters:**
- Users replying to magic link emails (asking for help, reporting issues)
- Generic noreply addresses reduce trust
- Some ISPs flag noreply as indicator of spam/bulk mail

**Best practice:**
- Use monitored reply-to address (support@, hello@, contact@)
- Respond to replies (increases engagement metrics)
- Especially important for onboarding/authentication emails

### From/Return-Path Configuration

**From address:**
- Must match DKIM signing domain
- Should be recognizable brand name
- Example: `DocTalk <mail@doctalk.site>` or `DocTalk <auth@doctalk.site>`

**Return-Path (bounce address):**
- Used for bounce handling
- Usually set automatically by email provider (Resend)
- Must match SPF-authorized domain

**Alignment requirements:**
- SPF alignment: Return-Path domain matches From domain
- DKIM alignment: DKIM signature domain matches From domain
- DMARC requires at least one to pass

### Additional Headers for Transactional Emails

**Precedence header:**
```
Precedence: bulk
```
- Signals to email clients this is automated email
- Used for proper filtering (not urgent inbox placement)

**Auto-Submitted header:**
```
Auto-Submitted: auto-generated
```
- Indicates automated message
- Prevents auto-responder loops

**Message-ID:**
```
Message-ID: <unique-id@doctalk.site>
```
- Unique identifier for each email
- Used for threading and deduplication
- Usually auto-generated by email library

**Sources:**
- [How List-Unsubscribe helps email deliverability - ActiveCampaign](https://help.activecampaign.com/hc/en-us/articles/360008716499-How-List-Unsubscribe-helps-email-deliverability)
- [List-Unsubscribe Header: What It Is & How to Use It - Twilio](https://www.twilio.com/en-us/blog/insights/list-unsubscribe)
- [List-Unsubscribe header critical for sustained email delivery - Postmastery](https://www.postmastery.com/list-unsubscribe-header-critical-for-sustained-email-delivery/)

---

## 6. Auth.js / NextAuth Email Customization

### Overview

Auth.js v5 allows full customization of magic link emails via the `sendVerificationRequest` function in the Email provider configuration.

### Basic Integration with Resend

**Standard setup (minimal customization):**
```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default {
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "DocTalk <mail@doctalk.site>",
    }),
  ],
};
```

### Custom Email Template

**Full customization via sendVerificationRequest:**

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default {
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "DocTalk <mail@doctalk.site>",
      async sendVerificationRequest({
        identifier: email,
        url,
        provider,
        theme,
      }) {
        const { host } = new URL(url);

        await resend.emails.send({
          from: provider.from,
          to: email,
          subject: `Sign in to ${host}`,
          html: html({ url, host, theme }),
          text: text({ url, host }),
          headers: {
            'X-Entity-Ref-ID': crypto.randomUUID(),
          },
        });
      },
    }),
  ],
};
```

### Available Parameters

**sendVerificationRequest receives:**
- `identifier` - User's email address
- `url` - Magic link with verification token
- `provider` - Provider config (from, server, etc.)
- `theme` - UI theme customization options

### HTML Template Function Example

```typescript
function html(params: { url: string; host: string; theme: Theme }) {
  const { url, host } = params;

  const escapedHost = host.replace(/\./g, "&#8203;.");

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Sign in to ${escapedHost}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; background-color: #f9fafb; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; padding: 40px;">
          <tr>
            <td>
              <h1 style="color: #18181b; font-size: 24px; margin-bottom: 24px;">Sign in to DocTalk</h1>
              <p style="color: #52525b; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
                Click the button below to sign in to your account. This link will expire in 24 hours.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display: inline-block; background-color: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                      Sign in to DocTalk
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #71717a; font-size: 14px; line-height: 20px; margin-top: 24px;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <p style="color: #71717a; font-size: 12px; margin-top: 20px; text-align: center;">
          DocTalk - AI-powered document Q&A
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
```

### Plain Text Template Function

```typescript
function text(params: { url: string; host: string }) {
  const { url, host } = params;

  return `
Sign in to ${host}

Click the link below to sign in to your account:
${url}

This link will expire in 24 hours.

If you didn't request this email, you can safely ignore it.

---
DocTalk - AI-powered document Q&A
  `.trim();
}
```

### Custom Headers

**Add deliverability-improving headers:**
```typescript
await resend.emails.send({
  // ... other params
  headers: {
    'X-Entity-Ref-ID': crypto.randomUUID(), // Unique message ID
    'Reply-To': 'support@doctalk.site',     // Monitored reply address
  },
});
```

### Token Expiration

**Configure in Auth.js options:**
```typescript
export default {
  providers: [
    Resend({
      // ... provider config
      maxAge: 24 * 60 * 60, // 24 hours (default)
    }),
  ],
};
```

**Sources:**
- [Email Provider - NextAuth.js](https://next-auth.js.org/providers/email)
- [Auth.js Resend Configuration](https://authjs.dev/getting-started/providers/resend)
- [Auth.js Magic Link: Custom Email Provider + Code Samples](https://www.notificationapi.com/blog/auth-js-magic-link-custom-email-provider-code-samples)

---

## 7. Common Mistakes That Hurt Deliverability

### 1. Using "noreply@" Email Addresses

**Current DocTalk setup: `noreply@doctalk.site`** ⚠️

**Why it's problematic:**

**User behavior impact (major):**
- Users can't reply to ask questions or report issues
- Frustration leads to spam complaints
- Spam complaints = biggest deliverability killer

**ISP perception (moderate):**
- Some ISPs flag noreply as indicator of bulk/spam mail
- Signals impersonal, one-way communication
- Reduces trust score with email providers

**Engagement metrics (moderate):**
- Replies are positive engagement signals
- Noreply prevents building positive sender reputation
- Lower engagement = worse inbox placement over time

**Direct deliverability impact:**
- Literal string "noreply" has minimal technical impact
- The problem is the behavioral consequences (spam complaints)

**Solution:**
```
Current:  noreply@doctalk.site
Better:   mail@doctalk.site
Best:     auth@doctalk.site (with Reply-To: support@doctalk.site)
```

**Implementation:**
```typescript
Resend({
  from: "DocTalk <auth@doctalk.site>",
  // In sendVerificationRequest:
  headers: {
    'Reply-To': 'support@doctalk.site',
  },
})
```

### 2. Missing or Broken Authentication (SPF/DKIM/DMARC)

**Critical mistake:**
- Sending emails without proper DNS authentication
- Gmail, Yahoo, Microsoft **require** authentication for >5,000 emails/day
- Even low-volume senders benefit significantly

**Consequences:**
- Emails rejected outright (bounce)
- Automatic spam folder placement
- Domain reputation damage

**For DocTalk:**
- Verify all Resend DNS records are added to doctalk.site
- Check verification status in Resend dashboard
- Add DMARC record (start with `p=none`)

### 3. Sudden Volume Spikes

**The mistake:**
- Going from 10 emails/day to 1,000 emails/day overnight
- Sending mass email blast to entire user base

**Why it triggers spam filters:**
- ISPs track sending patterns
- Sudden increases look like compromised account or spam operation
- Natural business growth is gradual and predictable

**For DocTalk:**
- Magic links sent per user signup = natural growth pattern ✅
- Avoid: Marketing blast to all users without warmup ❌

**If you need to send bulk:**
- Gradually increase volume over 2-4 weeks
- Start with 10-20 emails/day, double every few days
- Monitor bounce and complaint rates

### 4. Removing Unsubscribe Links

**Common misconception:**
"Transactional emails don't need unsubscribe"

**Why it matters:**
- Users who can't unsubscribe mark as spam instead
- Spam complaints devastate sender reputation
- Gmail/Yahoo now require it for high-volume senders

**For DocTalk magic links:**
- Technically optional (user-triggered action)
- **Recommendation:** Include it anyway for best practices
- Shows responsible sending to ISPs

**Implementation:**
```
List-Unsubscribe: <https://www.doctalk.site/unsubscribe?email=user@example.com>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

### 5. Poor List Hygiene

**The mistake:**
- Sending to unverified email addresses
- Not removing bounces and invalid addresses
- Continuing to send to inactive users

**Consequences:**
- High bounce rate = major red flag to ISPs
- Spam traps (honeypot emails) damage reputation
- Engagement rate drops (more spam folder placement)

**For DocTalk:**
- Only send magic links to user-entered emails ✅
- Implement bounce handling (remove hard bounces)
- Monitor Resend bounce reports

### 6. New Domain Without Warmup

**The mistake:**
- Brand new domain sending hundreds of emails day one
- "Fresh domain blacklist" can last up to 90 days

**For DocTalk:**
- If launching with new domain, start slow
- Send to small group of engaged users first
- Gradually increase as sender reputation builds

### 7. Inconsistent Sending Patterns

**The mistake:**
- Sending 500 emails one day, 0 the next, 1000 the day after
- Erratic patterns raise suspicion

**For DocTalk:**
- Magic link volume tied to signups = naturally consistent ✅
- Predictable pattern builds trust with ISPs

### 8. Ignoring Metrics

**Critical metrics to monitor:**
- **Bounce rate** (target: <2%)
- **Spam complaint rate** (target: <0.1%)
- **Engagement rate** (opens, clicks, replies)

**Where to monitor:**
- Resend dashboard (deliverability insights)
- Resend webhook events (bounces, complaints)
- Google Postmaster Tools (for Gmail deliverability)

**Red flags:**
- Bounce rate >5% = major problem (list hygiene issue)
- Complaint rate >0.3% = reputation damage
- Low engagement (<10% opens) = heading to spam

**Sources:**
- [Improve Email Deliverability: In-Depth Guide For 2026 - Omnisend](https://www.omnisend.com/blog/email-deliverability/)
- [Does 'no-reply' email affect email deliverability? - Suped](https://www.suped.com/knowledge/email-deliverability/sender-reputation/does-no-reply-email-affect-email-deliverability)
- [Email Deliverability Issues: Diagnose, Fix, Prevent [2026] - Mailtrap](https://mailtrap.io/blog/email-deliverability-issues/)
- [5 email deliverability mistakes killing your cold outreach](https://kesq.com/stacker-money/2026/01/29/5-email-deliverability-mistakes-killing-your-cold-outreach/)

---

## Actionable Recommendations for DocTalk

### Immediate Actions (P0 - Do First)

1. **Change from `noreply@doctalk.site` to `auth@doctalk.site` or `mail@doctalk.site`**
   - Update Resend configuration
   - Add `Reply-To: support@doctalk.site` header
   - Verify `support@doctalk.site` mailbox is monitored

2. **Verify all DNS records in Resend dashboard**
   - Check SPF record (should include `_spf.resend.com`)
   - Check DKIM record (Resend provides, must be added to DNS)
   - Add DMARC record: `v=DMARC1; p=none; rua=mailto:dmarc@doctalk.site`
   - Set up `dmarc@doctalk.site` to receive reports

3. **Customize magic link email template**
   - Remove any spam trigger words (check current template)
   - Use clear, simple subject: "Sign in to DocTalk"
   - Add plain text version (multipart/alternative)
   - Use table-based layout with inline CSS
   - See code examples in section 6

### High Priority (P1 - This Week)

4. **Implement proper HTML email structure**
   - Use HTML4 transitional DOCTYPE
   - Inline all CSS styles
   - Include plain text fallback
   - Keep images minimal (logo only)
   - Test rendering in major email clients

5. **Add List-Unsubscribe header**
   - Create `/unsubscribe` endpoint
   - Add headers to email:
     ```
     List-Unsubscribe: <https://www.doctalk.site/unsubscribe?email={email}>
     List-Unsubscribe-Post: List-Unsubscribe=One-Click
     ```
   - Ensure DKIM signature covers these headers

6. **Set up bounce handling**
   - Configure Resend webhook for bounce events
   - Mark hard bounces (invalid addresses) in database
   - Stop sending to addresses that hard bounce
   - Monitor bounce rate in Resend dashboard

### Medium Priority (P2 - Next 2 Weeks)

7. **Consider subdomain strategy**
   - Evaluate using `auth.doctalk.site` for magic links
   - Separates authentication email from future marketing
   - Requires new domain verification in Resend

8. **Implement monitoring and alerting**
   - Set up Google Postmaster Tools for Gmail deliverability
   - Monitor Resend deliverability insights weekly
   - Track key metrics:
     - Bounce rate (target: <2%)
     - Complaint rate (target: <0.1%)
     - Delivery rate (target: >98%)

9. **Review email content against spam trigger words**
   - Audit current magic link email text
   - Remove/replace urgency language
   - Focus on clarity over persuasion
   - Test with Resend deliverability insights tool

### Long-term Improvements (P3 - Future)

10. **Implement email engagement tracking** (optional)
    - Track magic link clicks (already available via Auth.js)
    - Monitor which users successfully authenticate
    - Identify patterns in failed authentication attempts

11. **Set up dedicated IP** (when sending >100k emails/month)
    - Currently shared IP is fine for DocTalk's volume
    - Dedicated IP requires warmup and consistent volume
    - Only consider when scaling significantly

12. **DMARC policy progression**
    - Start: `p=none` (monitoring mode)
    - After 2-4 weeks of clean reports: `p=quarantine; pct=10`
    - After validation: `p=quarantine; pct=100`
    - Final (optional): `p=reject`

### Testing Checklist

Before deploying changes:

- [ ] Send test magic link to Gmail account
- [ ] Send test magic link to Outlook account
- [ ] Send test magic link to Yahoo account
- [ ] Verify email lands in inbox (not spam)
- [ ] Check all links work correctly
- [ ] Verify plain text version displays correctly
- [ ] Test on mobile email clients
- [ ] Confirm DNS records are verified in Resend
- [ ] Monitor first 100 production emails for bounces/complaints

---

## Summary

**Root causes of current spam issues likely:**
1. Using `noreply@` sender address (behavioral issue)
2. Potentially missing/incomplete DNS authentication (SPF/DKIM/DMARC)
3. Email template may contain spam trigger words
4. Missing plain text version
5. Possibly using external CSS instead of inline styles

**Top 3 fixes for immediate impact:**
1. **Change from noreply@ to auth@ or mail@** + add Reply-To
2. **Verify all DNS records** (SPF, DKIM, DMARC) in Resend dashboard
3. **Customize email template** with proper HTML structure, inline CSS, and plain text version

**Expected results after fixes:**
- Significantly reduced spam folder placement
- Better inbox placement rate (>90% inbox for Gmail, Outlook, Yahoo)
- Lower spam complaint rate
- Improved sender reputation over time

**Ongoing maintenance:**
- Monitor Resend deliverability insights weekly
- Handle bounces promptly (remove hard bounces from database)
- Watch for spam complaint rate spikes
- Review DMARC reports monthly
- Test deliverability when making template changes
