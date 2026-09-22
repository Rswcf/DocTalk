# Answers to Fable's §3.2 repository questions (Claude, 2026-09-22)

Every answer is read from `main` @ `d91a71e`, with file and line references.

## 1. Does any wall a free user can reach offer a credit pack or another one-off purchase? No.

Every wall calls `startPlanAwareBillingAction`, whose rule is `currentPlan === 'free'` → `{ kind: 'checkout' }`.
That opens a Stripe Checkout for a **monthly subscription**: `startCheckout` → `createSubscription`
(`frontend/src/lib/billing.ts`). The walls, by caller:

| Wall | Caller | Free user lands on |
|---|---|---|
| Chat: `INSUFFICIENT_CREDITS`, `PRO_MODE_LIMIT_REACHED` / `BALANCED_MODE_LIMIT_REACHED`, `MODE_NOT_ALLOWED`, `DOMAIN_MODE_REQUIRES_PLUS` | `useChatStream.ts:185-203` → `PaywallModal.tsx:84` | Plus (or Pro) monthly Checkout |
| Conversations per document (own **and demo** documents, §9.19) | `SessionDropdown.tsx:205` | Plus monthly Checkout |
| Upload: `FILE_TOO_LARGE`, `DOCUMENT_LIMIT_REACHED`, `DOCUMENT_PAGE_LIMIT_EXCEEDED` | `DashboardPageClient.tsx:201` (CTA from `errorCopy.ts:185/217/243`) | Plus monthly Checkout |
| Mode selector (Pro answers) | `ModeSelector.tsx:35` | Plus monthly Checkout |
| Chat "+" menu (export, Domain Mode) | `ChatPanel.tsx:359` | Plus monthly Checkout |
| Collections cap | `collections/[collectionId]/page.tsx:71` | Plus monthly Checkout |
| Quote save cap (30) | `PaywallModal` path, `paywall_opened` source `quote_save` | Plus monthly Checkout |
| Extraction, question templates, document diff | `billingHref(...)` links to `/billing` | the billing page |

- **Packs appear only on `/billing`**, in the `#credit-packs` section (`BillingPageClient.tsx:939`), which a user
  has to scroll to. The only automatic jump to that section is for **Pro** users who run out of credits
  (`billing.ts` `needsCreditPack`).
- **Packs lift no wall.** `POST /api/billing/checkout` (`billing.py:868-902`) is `mode=payment` and credits the
  balance; plan-gated limits read `user.plan`.
- **Payment methods:** neither Checkout call pins `payment_method_types` (`billing.py:678`, `:885`), so the
  Stripe Dashboard decides. Which methods are on is an owner check.

## 2. How many marketing strings promise "free", "no credit card", "no signup" or state the allowance

Counted over the keys of `en.json`. Each key exists in all 11 locales. A key can match several patterns.

| Pattern | meta (`*.metaTitle` / `*.metaDescription`) | hero | FAQ (ships as FAQPage JSON-LD) | other marketing body | app UI | distinct keys |
|---|---|---|---|---|---|---|
| States the allowance (300/500 credits, monthly credits) | 0 | 0 | 22 | 19 | 6 | 47 |
| "no credit card" | 1 | 1 | 3 | 10 | 0 | 15 |
| "no signup" / "no account" | 2 | 2 | 11 | 42 | 0 | 57 |
| "free" (word) | 4 | 20 | 46 | 158 | 19 | 247 |

The 247 "free" keys, by phrase:

| Phrase | Keys | Under a trial-only Free |
|---|---|---|
| "free demo" | 74 | stays true |
| "free plan / tier / account" | 73 | would change |
| "start / try free", "for free" | 44 | "try" survives, "for free" would change |
| "free \<feature\>" | 20 | case by case |
| other | 76 | case by case |

Other places the "free" promise lives:
- **Meta keys matching any pattern:** `altsChatpdf.metaTitle`, `altsNotebooklm.metaDescription`,
  `compareNotebooklm.metaDescription`, `featuresDemo.metaTitle`, `featuresDemo.metaDescription`.
- **English pages whose hardcoded metadata says "free"** (English metadata is not in the locale files):
  `/demo`, `/tools`, `/tools/word-counter`, `/features/free-demo`, `/alternatives/{askyourpdf,chatpdf,pdf-ai}`,
  `/pricing`.
- **Blog titles with "free":** `free-ai-pdf-chat-no-signup.md` and `chatpdf-alternatives-2026.md`.

**Cost reading.** The allowance itself sits in 47 keys × 11 locales. Nearly half are FAQ answers that ship as
JSON-LD. "Free demo" and "no signup" are about the anonymous demo, so they survive any change to the signed-in
plan as long as the demo stays. The strings a trial-only Free would falsify are the ~73 "free plan / tier /
account" keys and the ~47 allowance keys — about 110 keys, ~1,200 strings across locales.

## 3. What `fix/free-credit-copy` @ `a179c80` changes (not deployed)

It changes copy only; the free plan itself is unchanged.
- **The false 500:** five translated landing FAQs (zh/ko/es/de/it, `landing.faq.a5`, also FAQPage JSON-LD) and
  three comparison pages (zh `compareHumata.pricingDocTalkPart1`, zh `comparePdfai.pricingDocTalkPart1`, de
  `compareNotebooklm.feature.pricingP2Mid`) said 500 credits a month. They now say the true 300.
- **ja/ko/it:** "hundreds of questions" becomes "dozens", as in English.
- **fr** `featuresDemo.faq.a1/a3`: the allowance and plan prices English states are restored.
- **pt** `altsChatpdf` FAQ pairs 1 and 2 are swapped back to the keys' meaning.

A test reads `PLAN_FREE_MONTHLY_CREDITS` from the backend and requires every locale to state it wherever
English does. So any change to the allowance forces those 38 English keys, and their translations, to follow.

## 4. Do `limit_hit` / `paywall_opened` events carry the backend error code? Partly.

- **Chat walls: yes.** `useChatStream.ts:200-201` sends the code itself as `reason`: `INSUFFICIENT_CREDITS`,
  `PRO_MODE_LIMIT_REACHED`, `BALANCED_MODE_LIMIT_REACHED`, `MODE_NOT_ALLOWED`, `DOMAIN_MODE_REQUIRES_PLUS`, and
  the demo/rate codes at `:223`.
- **Upload walls: no.** `DashboardPageClient.tsx:334` sends only `reason: 'file_size' | 'upload_limit'`, derived
  from the CTA link. `upload_limit` is either `DOCUMENT_LIMIT_REACHED` (the 3-document cap, CTA reason
  `document_limit`) or `DOCUMENT_PAGE_LIMIT_EXCEEDED` (CTA reason `page_limit`). The code is not recorded, and
  `metadata_json` holds only `{source, reason, plan}`.
- **The split is partly recoverable.** The page cap only exists since v0.29.0 (T_A, 2026-09-07), so an
  `upload_limit` before T_A is the document cap. After T_A the amended script infers it: at least three own
  documents created before the event means the cap, otherwise "page limit or unknown". Deleted documents make
  that a lower bound.
- **`is_demo`** is present on `session_limit` events from `SessionDropdown.tsx:120` (since T_copy). Other wall
  events do not carry it.

## 5. Which pages rank for which queries (Semrush, 2026-09-20)

Source: `.collab/reviews/2026-09-20-jev-seo/findings.md` §1–§2. The 37 rows are summarised there and were not
saved as a file.
- **Traffic:** 1 organic visit (US) in total. One keyword in the top 10: `demo document` (#6, volume 40) on
  `/features/free-demo`, the source of all organic traffic.
- **The academic cluster:** 14 of 37 rows point at `/blog/ai-research-paper-summarizer`, at positions 62–93.
- **Brand terms:** `doctalk` at #19 (`/`) and #40 (`/contact`); `doctalk login` #20 (`/contact`); `docalysis`
  #61 and #72.
- **Zero rankings for category terms** (`chat with pdf`, `ai pdf reader`, `pdf ai`, `pdf summarizer`).
- **No "free"-modified query appears among the ranking rows the findings list**, and
  `/blog/free-ai-pdf-chat-no-signup` is not among them. The 08-25 memory said that post ranked, but its source
  is not recorded; the D2 Search Console export would settle it. The brief's §5 claim is withdrawn in favour of
  this.
- **The es target** `ia para investigar gratis` (volume 720, KD 20) is in the competitor corpus: chatpdf ranks
  #12 and DocTalk does not rank.

**Reading.** Almost none of DocTalk's "free" copy carries acquisition today, because there is almost no
acquisition. The one page that brings any traffic is the free demo, and it survives any change to the signed-in
plan. The "free" copy is load-bearing for **future** rankings and for conversion on the pages people do reach,
not for current traffic.
