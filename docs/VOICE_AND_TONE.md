# DocTalk — Voice & Tone

**Status**: Active · **Owner**: Product/Design · **Applies to**: All user-facing copy across the product, emails, and marketing pages.

This document is the source of truth for how DocTalk sounds. Translators localize the style, not the words — the voice principles below hold across all 11 supported languages.

---

## 1. Why this exists

DocTalk's core value is **citation-precise answers**. Users — finance analysts, lawyers, researchers — use DocTalk because they cannot afford to be misled by an AI. The product's tone must reinforce that trust on every surface: a sloppy empty-state message or a cheery error can undo the credibility a precise bbox-highlighted citation just earned.

When in doubt, ask: *"Would a careful professional trust what just appeared on screen?"*

---

## 2. Voice: four traits

Voice is consistent. The same four traits apply whether we're writing an empty state, a pricing page, or a billing receipt.

### 2.1 Precise

We say what we mean and no more. We do not inflate, tease, or guess on the user's behalf.

- ✅ "Searching document..." (current `chat.searching`)
- ✅ "No documents yet"
- ❌ "🚀 Supercharging your research experience..."
- ❌ "Let's find the answer together!"

### 2.2 Honest about AI

DocTalk is an AI product whose moat is *not hiding* where the AI ends and the source begins. We surface uncertainty; we never oversell.

- ✅ "AI responses may be inaccurate. Always verify with the original document." (current `chat.disclaimer`)
- ❌ "DocTalk never gets it wrong."
- ❌ "Our AI understands every nuance."

Low-confidence citations get a visual signal *and* a copy signal (see §4.3).

### 2.3 Respectful of time

Our users are paid to work fast. Every screen of copy is a toll booth between them and their work. Remove tolls.

- Prefer 3 words over 7. Prefer 1 sentence over 2.
- No "welcome back!", no "great choice!", no "hang tight!".
- Buttons are verbs: **Send**, **Copy**, **Delete**, **Upgrade**. Not "Click here to send".

### 2.4 Domain-aware, not stuffy

We talk to finance pros, lawyers, and academics. We can use terms like *clause*, *10-K*, *citation*, *corpus* without translation. But we don't write like a regulatory filing, and we don't assume every user is an expert — a student should still understand the empty state.

- ✅ "Cross-document search" (accurate, understandable)
- ❌ "Inter-corpus retrieval augmented generation" (jargon theater)
- ❌ "The magic happens here" (condescending the other direction)

---

## 3. Tone: varies by context

Tone is voice adjusted to the moment. Four dimensions to calibrate:

| Dimension | First-time user | Power user | Error state | Success state |
|---|---|---|---|---|
| **Formality** | Warmer | Leaner | Matter-of-fact | Quiet |
| **Length** | Short + example | Shortest | Cause + next step | One line |
| **Emoji** | None | None | None | None |
| **Exclamation** | Never | Never | Never | Never |

**DocTalk does not use emoji or exclamation marks in product UI** going forward. (Marketing landing pages may occasionally; product surfaces don't.) This is a deliberate choice to distance us from consumer-AI tone.

> **Migration note**: existing product copy is not yet fully compliant. Known non-compliant strings in `en.json` to migrate opportunistically: `billing.purchaseSuccess`, `demo.limitReachedMessage`, `profile.usage.noData`, `landing.faq.a5`, `instructions.saved`, `chat.copied`, `billing.upgradeSuccess`. Also inline literals in `BillingPageClient.tsx`, `MessageBubble.tsx`, `useChatStream.ts`. Don't ship fixes as their own PR — change them when you touch the surface for another reason.

---

## 4. Surface-specific patterns

### 4.1 Empty states

Every empty state answers two questions: *what goes here* and *how do I fill it*.

**Template**: `[What's missing]. [One-action CTA].`

| Surface | Copy |
|---|---|
| No documents | "No documents yet." → CTA: **Upload a document** |
| No chats in session list | "Start a conversation by uploading a document." → CTA: **Upload** |
| Empty search results in doc | "No matches for \"{query}\"." |
| No citations found for answer | "This answer is not grounded in your document. Consider rephrasing." |

**Do not**:
- ❌ "It's quiet in here... 🌙"
- ❌ "Looks like you haven't uploaded anything yet!"
- ❌ "Your documents will appear here once you upload them. To upload a document, click the Upload button in the top right corner..."

### 4.2 Error states

**Template**: `[What happened]. [Why, if known]. [What to do next].`

State the cause if we know it. Never blame the user. Never apologize theatrically.

| Scenario | ✅ Good | ❌ Bad |
|---|---|---|
| Upload failed (network) | "Upload failed. Check your connection and try again." | "Oops! Something went wrong 😬" |
| File too large | "File exceeds 50 MB. Try splitting or compressing it." | "Error: FILE_TOO_LARGE" |
| OCR failed on scanned PDF | "OCR couldn't read this document. The scan quality may be too low." | "OCR text recognition failed" (current `upload.ocrFailed` — too terse, no next step) |
| Out of credits | "You've used all 500 credits for this month. Upgrade for more." | "Insufficient Credits" + "You've run out of credits. Purchase more to continue chatting." (current — wordy, and "chatting" is too casual for paying users) |
| Backend 500 | "Something went wrong on our end. Try again in a moment." | "Internal Server Error (500)" |

**Never use**:
- "Oops" / "Whoops" / "Yikes"
- Emoji in error text
- "Please" as filler ("Please try again" → "Try again")
- Stack traces or error codes visible to end users (log them, display a human sentence)

### 4.3 Uncertainty & low confidence

Because citation precision is our moat, **we surface uncertainty explicitly**.

Current implementation (`CitationPopover.tsx`) shows confidence via colored dot: emerald ≥0.8, amber ≥0.5, red below. This is good. Extend to copy:

| Confidence | Visual | Optional inline copy near answer |
|---|---|---|
| High (≥0.8) | Emerald dot | (no extra copy — the citation speaks) |
| Medium (0.5–0.8) | Amber dot | — |
| Low (<0.5) | Red dot | "This citation has low confidence — verify in the source." |

When the model has **no** citation for a sentence (ungrounded), the existing disclaimer at the bottom carries the weight. In future, consider inline markers for ungrounded claims.

**Language for uncertainty** (in AI-authored answers — shapes system prompts):
- ✅ "The document states..." (direct, citation-backed)
- ✅ "Based on p. 12, ..." (source-anchored)
- ✅ "The document does not specify X." (honest negative)
- ❌ "I think..." (personal opinion — the AI is not a person)
- ❌ "It probably means..." (unanchored speculation)
- ❌ "As an AI, I..." (meta-commentary adds nothing)

### 4.4 Citations & sources

Citation UI is the product's signature. Copy around it must be **minimal** and **factual**.

- Citation hover card: filename + page + confidence + context snippet. No interpretive text.
- Jump-to-page tooltip: `Jump to page {page}` (current — good, keep)
- "View in original" link (current — good, keep)
- Never label a citation as "proof" or "evidence" — those are legal/scientific terms the user applies, not us.

### 4.5 Streaming & processing states

These states are the user staring at a loading screen. They must answer: *is something happening, and will it finish?*

**Current**: "Searching document..." (single state, three bouncing dots).

**Recommended stages** (to implement when backend emits phase events):

| Phase | Copy | When |
|---|---|---|
| Retrieving | "Searching document..." | 0 – retrieval complete |
| Analyzing | "Reading relevant passages..." | retrieval → first token |
| Writing | (no label — streaming cursor only) | first token → end |

Never use: "Thinking...", "Crunching numbers...", "Working my magic...".

### 4.6 Destructive actions

Three rules:

1. **Name the object**: "Delete this chat" — not "Delete?"
2. **Name the consequence**: "This cannot be undone." (current phrasing is good)
3. **Destructive button uses the verb + object**: **Delete chat**, not **Confirm** or **OK**.

The existing i18n key `session.deleteChatConfirm` ("Are you sure you want to delete this chat? This cannot be undone.") ✅ follows this pattern.

However, the **actual session-delete UI in `SessionDropdown.tsx`** uses a different (non-compliant) inline flow: `dashboard.deletePrompt` = "Delete?" with `common.yes` / `common.no` buttons. This violates all three rules above (no object named, no consequence stated, buttons don't name the verb + object). Migrate this surface to use `session.deleteChatConfirm` with **Delete chat** / **Cancel** buttons when next touched.

### 4.7 Paywalls & upgrade prompts

Pricing copy is where honesty matters most. Never dark-pattern.

- State the limit reached, not the FOMO: "You've used all 500 credits for this month." → not "Don't miss out on Pro!"
- State what upgrading unlocks in **concrete** terms, not marketing adjectives: "3,000 credits/month" beats "Unlimited power".
- Never auto-select the annual toggle without making the monthly price equally visible.
- "Manage subscription" > "Cancel anytime" — the latter reads as reassurance to someone who already doesn't trust you.

### 4.8 Disclaimers & trust copy

Where they live: below the chat input, on the pricing page footer, on marketing pages near the fold.

| Current | Verdict |
|---|---|
| "AI responses may be inaccurate. Always verify with the original document." | ✅ Keep verbatim |
| "Privacy-first: your docs stay yours" | ✅ Keep |
| "We never use your data for model training" | ✅ Keep — factual, specific |
| "TLS encrypted in transit, AES-256 at rest" | ✅ Keep — specific beats "secure" |

### 4.9 Onboarding & tour (driver.js)

Tour steps should be observational, not motivational.

- ✅ "This is the citation marker. Click to jump to the page."
- ❌ "Let's explore the amazing citation feature!"
- Every step ends with either an action or "Next" — never "Got it!" or "Awesome!".

---

## 5. Microcopy reference

### 5.1 Buttons

| Action | Label |
|---|---|
| Primary CTA on hero | **Try example PDF** / **Upload a document** |
| Submit chat message | **Send** |
| Regenerate response | **Regenerate** |
| Stop generation | **Stop** |
| Copy response | **Copy** → on success: **Copied** (current — good) |
| Upgrade plan | **Upgrade** (not "Upgrade now", not "Get Pro") |
| Delete | **Delete {object}** (name the object) |
| Cancel dialog | **Cancel** |
| Destructive confirm | Verb + object — **Delete chat**, **Remove document** |

### 5.2 Forms & inputs

- Labels are nouns: "Email", "Password", "Document name". Not "Your email" / "Enter your email".
- Placeholders are examples, not instructions: `jane@example.com`, not "Type your email here".
- Error text appears below the field: "Invalid email format." — not "Please enter a valid email address."

### 5.3 Numbers

- Use digits for all counts: "3 documents", not "three documents".
- Credits always shown with unit: "500 credits", "500 left this month".
- Prices: `$9.99/month`, `$9.99 per month` — never `USD 9.99`.

### 5.4 Tense & voice

- Present tense: "Document uploaded" (not "Document has been uploaded" or "Document was uploaded").
- Active voice: "DocTalk encrypts your files." (not "Your files are encrypted by DocTalk.")
- Second person: **you** / **your**. Never **we + your-user**.

---

## 6. Localization notes

The 11 locales should **adapt tone to language norms**, not translate literally. Specifically:

- **zh** (Simplified Chinese, current locale): No exclamation marks (matching English rule). Use standard `""` and `''` quotes — do not import Traditional/Japanese `「」` or `『』`. Full-width punctuation (。，：；) in body, half-width inside code and brand names.
- **ja**: Default formality up one notch (丁寧語). Avoid casual forms (だ/である) in product UI; use です/ます. Use 「」 for quotes (native Japanese convention).
- **ko**: Use 존댓말 (haeyo-che: -어요/-아요 or formal -습니다) throughout. Never use 반말.
- **de**: Use *Sie* (not *du*) in all product copy — finance/legal users expect formal register. Compound nouns are fine, but avoid chains longer than 3 roots.
- **fr**: Non-breaking space before `:`, `;`, `!`, `?`, and inside `« »` guillemets per French typography. Use *vous*, never *tu*.
- **es / pt / it**: Use *usted / você (PT-BR formal) / Lei* for formal register. Never use diminutives ("rapidito", "pequenininho") in product copy — they read as childish in a professional tool. PT: default to PT-BR spelling unless a PT-PT locale is added separately.
- **hi**: Use आप (not तुम or तू). Hindi numerals optional — digits (0–9) are fine and often preferred in professional contexts.
- **ar**: RTL layouts already handled. Use Arabic comma `،` (not `,`), Arabic question mark `؟`, and Arabic semicolon `؛`. Prefer Modern Standard Arabic (فصحى) over any regional dialect.

Translators: if a source English phrase feels too terse in your language, lengthen it by **at most** one clause. Do not add hedges, emoji, or motivational language the source doesn't have.

---

## 7. Anti-patterns checklist

When reviewing any new copy, reject if it matches any of these:

- [ ] Contains emoji in product surface
- [ ] Contains exclamation mark
- [ ] Uses "Oops", "Whoops", "Yikes", "Hmm", "Uh-oh"
- [ ] Uses "we" when describing AI output ("We found..." → "The document shows...")
- [ ] Contains "Please" as filler
- [ ] Button label is "Click here", "Submit", "Continue" without context, or "OK" for destructive
- [ ] Error message is a raw exception or status code
- [ ] Empty state has no CTA
- [ ] Disclaimer is hidden below the fold when the AI can hallucinate in view
- [ ] Upgrade copy uses FOMO ("Don't miss out", "Limited time")
- [ ] Onboarding step ends with "Awesome!" or "Got it!"

If you can't reject, ship it.

---

## 8. Reference systems

This guide draws from the following public design systems' Voice & Tone pages:

- **Shopify Polaris** — structure and "voice vs tone" framing
- **GitHub Primer** — terseness and verb-based button labels
- **Atlassian Design System** — destructive-action patterns
- **Vercel Geist** — disclaimer and trust-copy style

When extending this document for a new surface, consult the nearest analog in those systems first.
