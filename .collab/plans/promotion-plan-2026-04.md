# DocTalk Promotion Plan (90-day, post-live)

*Drafted: 2026-04-14 · Synthesis of 4 parallel research streams*
*Research inputs (all in this directory):*
- Agent A — Launch playbook (Product Hunt / Show HN / X / aggregators / press)
- Agent B — Community-driven growth (Reddit / Discord / LinkedIn / newsletters)
- Agent C — AEO / LLM citation visibility (AEO, review sites, schema)
- Agent D — Paid acquisition + partnerships (Google / Bing / plugins / geo)

*Assumptions:* solo founder, Berlin, ~10-15 hrs/week on promo, $500-2000/mo
paid budget after month 1. Product: live paid Stripe, 11 locales, freemium
$0/$9.99/$19.99. Zero existing audience.

---

## 0. Prerequisites (finish before any push)

| # | Item | Effort | Blocks |
|---|---|---|---|
| 0.1 | Virtual business address + Gewerbeanmeldung + Steuernummer | 30 min + 2-6 wk wait | Any outreach that links to a fake-address imprint. Competitor Abmahnung risk if growing traffic sees placeholder. |
| 0.2 | Stripe content-platform review cleared (deadline 2026-04-24) | passive | Any "buy Plus/Pro" CTA on outbound — if payments pause on 4-24 you burn goodwill on day 1 |
| 0.3 | `robots.txt` allows `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot` | 10 min | Zero LLM citation pickup if blocked |
| 0.4 | Schema.org: `SoftwareApplication` + `Organization` + `FAQPage` + `HowTo` site-wide | 1 day | AEO baseline (81% of cited pages have schema per AccuraCast 2025) |
| 0.5 | Wikidata item for DocTalk with `sameAs` → GitHub / X / LinkedIn | 30 min | Entity disambiguation in ChatGPT/Claude |
| 0.6 | G2 + Capterra + AlternativeTo free listings created | 2 hrs | 99-100% of ChatGPT-cited SaaS have these listings |
| 0.7 | Tolt (or Rewardful) affiliate program with 30%-recurring-12mo payout | 1 hr | No viral / partner acquisition possible without this |
| 0.8 | Resolve the billing `resource_missing` edge case (stale stripe IDs → graceful) | 30 min | Growing user base will hit this; current behaviour is 502 |

Do 0.3–0.6 **this week** regardless of when you start public push. Compounds from day 1.

---

## 1. Phase 1 — Days 1-30 (Launch window)

**Thesis**: the first 30 days after going live are the only window with
this much "new launch" oxygen. Maximise surface area across 3-4
concurrent channels; don't save ammo for later.

### 1.1 Weekly time allocation (solo, ~12 hrs/wk)

| Activity | Hrs/wk | Type |
|---|---|---|
| X / Twitter — build-in-public cadence + threads | 5 | Organic |
| Reddit — r/PhD, r/GradSchool, r/LawSchool, r/SideProject (problem-first) | 3 | Organic |
| Content — 1 comparison page `/vs/*` per week | 2 | SEO + AEO |
| Launch-event prep + execution (PH, Show HN, one-off pitches) | 2 | Event |
| Support / bug triage / analytics review | 0.5-1 | Ops |

### 1.2 Week-by-week

#### Week 1 — Foundations + Show HN

- Ship §0 prerequisites 0.3-0.6 (robots, schema, Wikidata, G2 listing created with 0 reviews is fine).
- **Show HN** — Tuesday 8-10 AM ET
  - Title: `Show HN: DocTalk – Chat with your PDFs and jump to the cited passage`
  - First-comment: 3-5 paragraphs on **technical decisions** — bbox citation anchoring, why DeepSeek V3.2 for free, chunking approach, 11-locale pipeline
  - Demo path **must not require signup** for the first query. Pre-load a demo PDF with a "try this question" hint.
  - Be online 8 hrs straight post-submit. Reply non-defensively, especially to hostile comments.
  - *Worst case: <10 pts and dies. Base case: 60-150 pts → 5-15k visits, 200-500 signups, 5-15 paid.*
- **X thread** same day as Show HN (regardless of HN outcome): 8-12 tweet launch thread with citation-jump GIF, 1 demo video, pricing, "RT helps a solo dev in Berlin" close.
- **Peerlist launch** Monday (free, DR75 dofollow, ~30 min of work).
- **Aggregator submit-and-forget**: Uneed, Fazier, MicroLaunch, Tiny Launch, OpenHunts, SaaSHub. (2 hrs total, do in one sitting.)
- **Build PH launch list**: reach out to anyone you know on LinkedIn / X who might comment on Sat/Sun of week 2. Aim ~150 confirmed. PH penalises upvote-only spikes; comments drive the real rank.
- **Seed 6 comparison pages** in the repo: `/vs/notebooklm`, `/vs/chatpdf`, `/vs/humata`, `/vs/pdfai`, `/alternatives/notebooklm`, `/alternatives/chatpdf`. Format: 40-60-word answer capsule under H1, feature comparison table, honest "pick the other when…" section, `ItemList` + `SoftwareApplication` schema, `dateModified`. Ship at least 2 by end of week 1.

#### Week 2 — Product Hunt + momentum

- **Product Hunt launch** Saturday or Sunday 12:01 AM PT
  - Self-hunt is fine in 2026. Tagline: "Chat with your PDFs in 11 languages, jump to the cited passage." Avoid "AI-powered".
  - Activate the 150-person list via LinkedIn DM + X DM (highest-ROI activation channels per 2025 PH post-mortems). Comments matter more than upvotes.
  - Skip if Stripe audit is still pending (you'll drive traffic to a "payments paused" message on 4-24).
- **Ben's Bites** — submit via their tool form. Angle: "solo EU founder, citation-precision, multi-format." Hit rate ~10-15%. 30 min.
- **TLDR AI** + **Mindstream** — same form-submit motion. 30 min total.
- **Reddit seeds** (1 post in each over the week, not same day):
  - r/PhD — "Lit-review workflow that actually works for a 60-paper survey" (DocTalk mentioned in comment if asked)
  - r/GradSchool — variation of above
  - r/SideProject — honest "just shipped" post with revenue
  - r/LawSchool — case-brief workflow (only if you have a credible angle)
- **X**: 1 post/day — revenue numbers, lessons, feature clips. Engage with 3-5 relevant accounts per day genuinely.

#### Week 3 — German press + content compound

- **German-press pitch** (highest-conversion angle for a Berlin founder):
  - Heise online — email with "Berliner Solo-Gründer launcht KI-Tool mit EU-Datenschutz-Fokus"
  - t3n Pro & Indie — same angle, emphasise multilingual coverage
  - Golem — technical angle (citation anchoring, locale architecture)
  - ~2 hrs pitching. Realistic: 1 hit, 1 interested "maybe next month", 1 ignore.
- **AlternativeTo** — add DocTalk under ChatPDF, NotebookLM, AskYourPDF, Humata. High AEO value (cited in LLM answers for "alternative" queries).
- **Comparison pages 3-4** shipped (cumulative: 4 of 6 live by end of week).
- **X**: maintain daily cadence. Mid-week "day 14 post-launch — here's the data" transparency thread.

#### Week 4 — 30-day retrospective + audit

- **30-day transparency thread** on X + cross-post to Indie Hackers:
  - Day-1 signups vs day-30, MRR, churn, what surprised me
  - This is **often the highest-performing post** of the whole window
- **Re-run baseline LLM citation check** — same 20 prompts on ChatGPT / Claude (web) / Perplexity / Google AI Mode / Copilot. Log any mention.
- **Last 2 comparison pages** shipped.
- **Audit**: which channels produced signups? Which were vanity traffic? Kill anything with <5 signups @ zero cost-per-hour (your time is not free).

### 1.3 Phase-1 realistic outcome

| Metric | Pessimistic | Base | Optimistic |
|---|---|---|---|
| Signups | 500 | 1,500-4,000 | 10,000+ |
| Paid conversions | 3 | 20-40 | 100+ |
| MRR contribution | $30 | $200-500 | $1,500+ |
| X followers | +200 | +600-1,200 | +3,000 |
| Press hits | 0 | 1 (DE) | 2-3 (DE + 1 AI newsletter) |
| Backlinks | 5-8 | 15-25 | 40+ |

**Non-metrics (but most valuable)**: G2 listing with 3-5 reviews; Wikidata item; ~6 comparison pages published; the X thread that compounds for 6 months.

---

## 2. Phase 2 — Days 31-60 (Compound)

**Thesis**: the launch spike is gone. Now double down on the 2-3
channels that actually produced signups in phase 1, and add measured
paid.

### 2.1 Weekly time (unchanged: ~12 hrs)

- Whichever org channel won in phase 1 gets 60% of time
- X stays a constant (compounding investment)
- Week 5+: start paid (Google + Bing) parallel to org
- 1 YouTube demo/tutorial shipped by week 8

### 2.2 New activities

- **Google Ads** (week 5, $300 for 14 days)
  - Keywords: competitor-alternative only ("notebooklm alternative", "chatpdf alternative"), plus branded-competitor long-tail. AVOID "ai", "chatgpt", "pdf reader" — money sinks.
  - Landing page: demo-forward (drag-drop on hero, "try without signup"), not pricing-forward.
  - Target: <$50 CPA for Plus signup. Kill any keyword <1% CTR after 1k impressions.
- **Bing Ads** (week 6, +$150/mo)
  - Import Google winners. Expected ~30-50% cheaper CPC, 20-30% of Google volume. Often better ROAS for Pro-tier targeting (Windows/Office-native audience).
- **Obsidian / Zotero community plugin** (ship week 7, highest ROI partnership at this stage)
  - Brings researchers/knowledge workers in via top-of-funnel with pre-existing workflow fit
  - Free distribution channel, significant LLM citation value (GitHub + community docs)
- **YouTube demo** (record week 7, publish week 8)
  - 3-min "DocTalk vs NotebookLM" comparison. Google AI Overviews heavily cite YouTube.
  - Share to r/ObsidianMD, r/NotebookLM, DocTalk X
- **Reddit Ads experiment** ($200 cap, week 6)
  - Only if organic Reddit already converted. Target r/GradSchool, r/LawSchool, r/ChatGPT.
  - Expected weak direct response; measure brand-lift via direct/brand-search traffic increase.

### 2.3 What to kill / not do

- **LinkedIn Ads** — defer. Below $5k/mo is statistical noise for this category.
- **AppSumo / LTD** — skip entirely. Refund rate 15-25% on AI tools, token cost vs lifetime price inverts unit economics, $49-69 anchor poisons $9.99 positioning.
- **Newsletter sponsorships** ($500-2000 range) — LTV math doesn't work yet ($96 Plus annual < typical CPC via newsletter). Vertical-only exception: Law Next, Legaltech Hub, The Diff at $500-1500.
- **Twitter engagement pods** — downranked by algorithm.

### 2.4 Phase-2 target

- MRR end of day 60: $600-1,500
- Affiliate partners active: 5-10
- Comparison pages ranking top-10 for 2-3 queries
- 1 YouTube demo published
- G2 reviews: 10+
- First measurable LLM citation (ChatGPT or Perplexity name-drops DocTalk in answer to a relevant query)

---

## 3. Phase 3 — Days 61-90 (Scale proven channels)

**Thesis**: quit experimenting. Pour time/$ into whichever 1-2 channels
have proven ROAS. Phase 3 is where you double the things that work.

### 3.1 Geographic expansion (paid)

If US/DE Google Ads are profitable, expand to cheaper English markets:

1. **Netherlands** — top pick. 95% English literacy, AI early adopters, CPC 30-40% below US.
2. **Ireland** — low CPC, EU billing friendly.
3. **Singapore** — small TAM but Pro-tier willingness-to-pay.
4. **Sweden / Denmark / Norway** — similar dynamic to NL.
5. **Australia / New Zealand** — English, 70% of US CPC.
6. **UAE** — English business language, AI-curious gov push. Pro-tier.

**Avoid in phase 3**: India, Brazil, Mexico (traffic yes, $9.99 conversion no). Japan, Korea (need native creative).

### 3.2 Partnerships

- **YouTube sponsorships** — PhD-productivity vertical ($300-700 flat fee, 1-2/mo)
  - Targets: Thomas Frank Explains, Andy Stapleton (PhD advice), Odysseas
  - Use unique discount codes for attribution
- **GitHub Student Pack** submission (apply week 9 if not earlier)
- **Raycast extension** — pairs with Obsidian plugin for knowledge-worker funnel

### 3.3 Phase-3 content

- 2 long-form posts with original data: "We analysed 100k uploaded documents — here's what people actually ask their PDFs"
  - +37% citation lift per Princeton GEO study
  - Pitch to Hacker News, TLDR, The Rundown, Ben's Bites
- "EU-hosted AI document privacy" whitepaper (leverages German geo as moat vs US competitors). Target German B2B segments.
- 2nd Product Hunt launch — time to a new feature (Collections, Custom Prompts, API)

### 3.4 Phase-3 target

- MRR end of day 90: $1,500-3,500
- Active affiliates: 15-25
- LLM citation for 3-5 queries
- 2+ independent backlinks from tier-2 SaaS publications
- G2 reviews: 25+, 4+ star average
- **Decision point**: which 2 channels scale to $1-2k/mo each in phase 4?

---

## 4. Channel prioritisation matrix

Each channel scored on (effort per signup) × (ceiling) × (time-to-signal) for a solo founder with $0-500 budget (early) then $500-2000 (later).

### Top tier (must do, immediately)

| Channel | Why | Weekly hrs |
|---|---|---|
| X / Twitter | Only compounding channel that amplifies across AI-tool listers | 5 |
| Show HN (one-shot) | Technical audience fits DocTalk perfectly; 5-15k visits possible | 1 day |
| Reddit (organic) | 30-40% of LLM citations come from Reddit; also direct signups | 3 |
| Comparison pages (AEO) | 33% of LLM-cited content; competitor-alt keywords cheapest Google CPC | 2 |
| G2 + Capterra listings | 99-100% of ChatGPT-cited SaaS have them | 2 hrs one-shot |

### Second tier (after phase 1 signal)

| Channel | Why | When |
|---|---|---|
| Google Ads (competitor-alt only) | Direct signals, $25-50 CPA viable | Week 5 |
| Bing Ads | 30-50% cheaper CPC, imports Google winners | Week 6 |
| Obsidian / Zotero / Raycast plugin | Highest top-of-funnel conversion for research/KW segment | Week 7 |
| YouTube (organic + sponsorship) | Google AIO heavily cites YouTube; PhD vertical has mid-cost creators | Week 8+ |
| Product Hunt (Sat/Sun self-hunt) | Permanent backlink + badge, not day-1 MRR | Week 2, re-launch Month 3 |
| German press (Heise / t3n / Golem) | EU angle is moat vs US competitors | Week 3 |
| Tolt affiliate program | Compounds with zero marginal effort after setup | Week 1, recruit from month 2 |
| LinkedIn (organic carousels only) | Credibility layer for B2B buyers | Week 3+ ongoing |
| Geographic arbitrage (NL / IE / SE) | 30-40% cheaper CPC than US | Month 3 |

### Third tier (defer until signal/budget)

| Channel | Why defer |
|---|---|
| LinkedIn Ads | Below $5k/mo is noise |
| AppSumo / LTD | Toxic unit economics for AI tools |
| Reddit Ads | Organic Reddit much better ROI |
| Newsletter sponsorships ($500-2k) | LTV math fails except for niche verticals |
| Cold press (TC, Verge) | Zero hit rate for bootstrap AI tools |
| Wikipedia page | Notability bar requires tier-1 press first |

---

## 5. KPIs + kill switches

### Weekly tracking (5 min)

- Signups (free) + paid upgrades
- MRR delta
- X follower delta
- Google Search Console impressions for `/vs/*` pages
- LLM citation manual check — 5 prompts × 3 engines rotating

### Monthly tracking (30 min)

- Full 20-prompt LLM citation baseline across 5 engines
- Channel-attributed signups (UTMs)
- CAC by paid channel (blended <$50 for Plus; <$100 for Pro)
- Reddit post performance (upvotes → profile visits → signups)

### Kill switches

- Any paid channel >$60 CPA after $300 spent → pause
- Any keyword <1% CTR after 1k impressions → pause
- Any Reddit post with direct link in OP → delete within 1 hr (auto-mod ban risk)
- Any content generated by LLM posted on X → stop; algorithm demotes
- Discord/Slack server where you haven't provided 30 days of value-add → don't even attempt a tool mention

---

## 6. Do-not-do list (hard-earned 2025-2026 lessons)

| Thing | Why |
|---|---|
| Cold-email TechCrunch / Verge / Wired | Zero hit rate for unfunded bootstrap AI tools |
| Post launch thread tagging "AI gurus" / VCs | They don't reshare bootstrap; adds noise, hurts algorithm |
| Pay for Gartner Magic Quadrant placement | LLMs can't read paywalled analyst content → invisible |
| Submit to "ChatGPT plugins" directories | Dead ecosystem since 2024 |
| Create `llms.txt` | Proposed but not honored by any major LLM in production |
| Publish via "we'll get you in ChatGPT training data" agencies | Scam — that product doesn't exist |
| Heavy LinkedIn hashtag spam | Algorithm now penalises |
| External link in LinkedIn OP | Cuts reach ~40%; put link in first comment |
| Build community first, product later | The community that matters (X / Reddit / G2) grows around usage, not vice versa |
| Chase front-page Product Hunt | 89% of PH founders regret launching twice; optimize for badge + backlink + 30 signups, not rank |

---

## 7. Appendix: amplifier accounts to engage (X)

*Based on 2025-2026 reshare behaviour for indie AI tools. Interact
genuinely for 2-3 weeks before any pitch.*

| Handle | Why | DM or reply-first? |
|---|---|---|
| @levelsio | Resharer of interesting build stories | Reply-first |
| @marc_louvion | Boosts solo bootstrappers + Stripe-first stories | Reply-first |
| @tibo_maker | Reshares clean SaaS demos | Reply-first |
| @dannypostma | Indie AI-curious | Reply-first |
| @dagorenouf | Indie AI builder | Reply-first |
| @itsandrewgao | AI-tool lister | DM with Loom (30s) |
| @minchoi | Large AI-tool lister | DM with Loom |
| @rowancheung | Newsletter + tool coverage | DM |
| @heyBarsee | Tool lister | DM |
| @aaditsh | Tool lister | DM |
| @IndieHackers | Amplifies good launches | Quote-tweet with IH post link |
| @bentossell | Ben's Bites, covers when angle is fresh | Submit via form + tag on launch |

**DO NOT** tag VCs, "thought leaders", or anyone >500k followers — they don't reshare bootstrap, and the noise hurts.

---

## 8. Weekly ritual (30 min/week, mandatory)

1. Sunday evening: plan the week's one X thread + one Reddit post topic
2. Monday: run through 5 LLM prompts, log citation status
3. Wednesday: review Search Console + PostHog/Plausible
4. Friday: ship one comparison page OR one schema.org improvement OR one G2 review outreach email
5. End of month: 30-min retrospective → update this plan

Not optional. Consistency beats intensity in this window.

---

## Changelog

- 2026-04-14: initial synthesis of 4-agent research. Next review: 2026-05-15 after phase-1 data.
