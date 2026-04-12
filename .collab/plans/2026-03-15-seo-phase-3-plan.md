# SEO Phase 3 Plan

Date: 2026-03-15
Owner: Codex
Status: Reviewed by Claude Code and revised

## Objective

Ship the next highest-leverage SEO improvements for DocTalk without reopening large architectural work.

This phase focuses on:
1. Internal linking and information architecture on public pages
2. Public-page JavaScript reduction where the implementation cost is low and the performance upside is clear
3. Full validation, production deployment, and a fresh live audit

This phase explicitly does not include locale-prefixed URLs and `hreflang`. That is still the correct long-term international SEO move, but it is a separate architecture project and should not be mixed into this execution batch.

## Why This Scope

Current production already scores well on foundational SEO:
- Core SEO: 100
- Crawlability: 100
- Structured Data: 100
- Social Media: 100

The most meaningful remaining issues are:
- weak internal links into several public hub and detail pages
- public marketing pages pulling more client JavaScript than necessary
- content hubs that still behave like isolated card grids instead of topic clusters

The lowest-risk, highest-return next move is therefore to improve crawl paths and topic clustering first, then trim obvious shared client code on public routes.

## Success Criteria

### Primary
- The previously weak public pages gain multiple relevant inbound links from higher-authority public pages
- Public hubs expose clearer adjacency between features, use cases, compare pages, alternatives, blog, pricing, and demo
- Marketing/public pages stop statically importing application-only header logic when it is not needed

### Validation
- `cd frontend && npm run lint` passes
- `cd frontend && npm run build` passes
- production deploy succeeds on `stable`
- fresh live audit on `https://www.doctalk.site` shows no regression in:
  - Core SEO
  - Crawlability
  - Structured Data
  - Social Media

### Stretch
- overall live audit score improves beyond the current `85 / B`
- shared JS warnings are reduced or at least partially improved on public routes

## Execution Plan

## Claude Code Review Outcome

Claude Code agreed with the overall priority order and confirmed that internal linking is the highest-ROI batch.

The key revisions from review are:
- widen the linking sweep to all feature detail pages, all use-case detail pages, and commercial compare detail pages
- treat Batch 2 as a dedicated `PublicHeader` extraction for public routes, not an incremental refactor of the existing app header
- prioritize footer and hub-page architecture because that is the fastest way to improve crawl paths sitewide
- validate sitemap and robots coverage alongside the new internal links

### Batch 1: Strengthen Internal Linking

#### 1. Global crawl paths
- Expand the minimal public header so it links to the highest-value public hubs, not only demo and pricing
- Expand the footer with a compact but meaningful public information architecture:
  - product hubs: features, use cases, compare, alternatives
  - content hub: blog
  - conversion pages: demo, pricing

#### 2. Homepage as hub distributor
- Add a visible section on the homepage that routes users and crawlers into the main topic clusters:
  - features
  - use cases
  - compare
  - alternatives
  - blog
- Ensure links are contextual and not just a flat sitemap dump

#### 3. Public hub pages become cluster hubs
- Strengthen `/features`
  - add short “related workflows” or “popular next steps” links to compare/use cases/pricing/demo
- Strengthen `/use-cases`
  - add adjacent links to relevant features and compare pages
- Strengthen `/compare`
  - add links to alternatives, feature hub, pricing, demo, and selected compare detail pages
- Strengthen `/alternatives`
  - add links to compare, features, pricing, and demo
- Strengthen `/blog/category/[category]`
  - add related category or hub links so category pages are not dead-end archives

#### 4. Weak detail pages receive more inbound references
- Ensure the weakest pages have at least 3 to 5 relevant internal links from other public pages:
  - `/features/free-demo`
  - `/features/performance-modes`
  - `/use-cases/finance`
  - `/use-cases/hr-contracts`
  - `/blog/category/comparisons`
- Also include the rest of the public commercial and topical detail pages in the linking sweep:
  - `/features/citations`
  - `/features/multi-format`
  - `/features/multilingual`
  - `/use-cases/lawyers`
  - `/use-cases/students`
  - compare detail pages under `/compare/*`
- Prefer semantically relevant contextual links over generic repeated CTA links

### Batch 2: Reduce Public-Page JavaScript

#### 1. Split marketing header concerns from app header concerns
- Create a dedicated `PublicHeader` for public marketing routes
- Leave the current `Header.tsx` focused on app routes and document-reader flows
- Ensure public pages no longer statically import application-only controls or state

#### 2. Preserve UX without bloating marketing routes
- Keep public navigation functional
- Keep sign-in or app-entry affordances available
- Avoid hydration-heavy logic on routes whose primary job is discovery and conversion

#### 3. Keep changes incremental
- Prefer a clean component boundary over conditionally loaded app logic
- Do not destabilize document-reader or logged-in app flows
- If public-header extraction introduces regressions or broad churn, defer the change rather than forcing it into the release

### Batch 3: Validation and Release

#### 1. Local verification
- Run lint
- Run production build
- Spot-check major public routes locally if the build suggests route-specific changes
- Verify `robots.ts` and `sitemap.ts` still cover the public hubs being strengthened
- Run a local SEO audit against the local or preview build before touching production if practical

#### 2. Git and deployment
- Commit only files relevant to this SEO phase
- Push to `main`
- Merge `main` into `stable`
- Push `stable`
- Let Vercel production deploy from `stable`

#### 3. Post-deploy audit
- Run a fresh live audit on production
- Compare against the previous baseline
- Record what improved, what stayed flat, and what should move to the next phase

## Likely Files

### Navigation and shell
- `frontend/src/components/Header.tsx`
- `frontend/src/components/PublicHeader.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/app/HomePageClient.tsx`

### Public hubs
- `frontend/src/app/features/FeaturesHubClient.tsx`
- `frontend/src/app/use-cases/UseCasesHubClient.tsx`
- `frontend/src/app/compare/CompareHubClient.tsx`
- `frontend/src/app/alternatives/AlternativesHubClient.tsx`
- `frontend/src/app/blog/category/[category]/CategoryClient.tsx`

### Possible related detail pages
- `frontend/src/app/features/free-demo/FreeDemoClient.tsx`
- `frontend/src/app/features/performance-modes/PerformanceModesClient.tsx`
- `frontend/src/app/use-cases/finance/FinanceClient.tsx`
- `frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx`

## Constraints

- Do not touch locale routing in this phase
- Do not break app-only routes while optimizing public pages
- Do not add low-value sitewide links just to inflate link counts
- Keep copy additions useful to users, not SEO filler
- Avoid creating meaningless circular link loops; every new internal link should help navigation, not just metrics
