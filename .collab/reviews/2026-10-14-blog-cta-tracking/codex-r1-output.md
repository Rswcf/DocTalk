codex
No BLOCKER or SHOULD findings.

1. NIT — `frontend/tests/blog-cta-tracking.test.cjs:68`
Evidence: the hard-coded `/demo` Link check is line-oriented: `/<Link href="\/demo"[^\n]*/g`. It will fail if someone reformats the opening tag across lines, even if the handler remains correct. It does still fail on the important mutations: removing `blog_about`, `blog_cta`, or `blog_inline` handlers changes the exact call-site/source assertions at lines 63-75.
Concrete fix: make this check whitespace-tolerant over a bounded JSX block, or parse the file with a lightweight TSX/AST check.

I found the implementation sound for the requested purpose. The about box and CTA banner call `trackBlogDemoClick` once on their `Link` clicks, and markdown internal links only attach the handler when `isDemoHref(href)` matches `/demo`, `/demo/...`, `/demo?...`, or `/demo#...` (`BlogPostClient.tsx:286-294`, `:411`, `:436`; `blogCta.ts:12-19`). `onClick` is after `{...props}`, so any `react-markdown` prop cannot override it.

Privacy and measurement also line up. `landing_cta_clicked` is attributed, `trackEvent` buckets `path` through `safeLandingPath`, and `/blog/<slug>` is explicitly safe (`analytics.ts:16-20`, `attribution.ts:31-35`, `:61-68`, `:119-126`). Backend already allows the public event (`events.py:50-63`). The readout counts these rows by event name and `landing_path` against the listicle paths, with owner exclusion and channel mapping intact (`readout_1014.py:28`, `:31-47`, `:112-122`). No extra header/hero double-fire is introduced on blog pages; `MarketingShell` uses the editorial header, which has no tracked `/demo` CTA.

I did not run the tests: this worktree has no `frontend/node_modules`, and a direct `node -e "require.resolve('typescript')"` check exited 139 after `SecItemCopyMatching failed -50`. I did not run `git`.

SHIP


