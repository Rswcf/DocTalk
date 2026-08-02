# Codex M2 r3 — scoped verification of the r2 fix wave

Your r2 (real verdict section, `.collab/reviews/2026-08-02-quote-finder-m2-codex-r2.md:12280-12405`) left 4 findings NOT ADDRESSED + 2 new-breakage items. Five commits since your r2 head (`e5b7c01`):

```
git log --oneline e5b7c01..46af8fa
git diff e5b7c01..46af8fa
```

- 16b5081 FIX2-A (#2): multi-page extracted_text segments now DISCARD (reason "ambiguous_page_range") — no majority-bbox guessing; page_text duplicates emit one card per matching page (your probes = regression tests).
- 92a0bf6 FIX2-B (#4): chat answer+reconcile+usage = ONE atomic commit (pre-generated Message id enables post-ambiguity resolution); reconcile_credits returns the balance so REST has no post-money query; both ambiguity resolvers query row existence instead of blind refunds.
- b3659b9 FIX2-C (#5 + your new-breakage #1, same root): negation scoped by distance-to-trigger vs distance-to-paraphrase-token; your four affirmative probes route, the five negatives stay suppressed.
- 1a522cb FIX2-D (#8): complete consecutive 1..page_count coverage required (your 3-page/rows-[1,3] probe = test).
- 46af8fa FIX2-E (your new-breakage #2): scratch-DB fixture hard-refuses non-loopback hosts unless DOCTALK_TEST_DATABASE_URL explicitly set; fake Railway URL verified refused with zero network I/O.

Acknowledged residuals for adjudication (not silently dropped): (i) fixed scratch-DB name can collide across CONCURRENT local test runs — proposed PARK (solo-dev repo, loopback-only now enforced); (ii) FIX2-A's per-page duplicate cards can increase card counts when identical wording repeats — deliberate, per your own prescription.

Task: verdict the 4+2 items ADDRESSED / NOT ADDRESSED against the diff, probe adversarially (especially FIX2-B's atomic-commit + ambiguity resolvers and FIX2-C's distance heuristic edge cases), adjudicate (i)/(ii), flag NEW breakage in these five commits only. Everything else settled in r1/r2 stays settled.

Evidence (audit, don't repeat): 710 unit pass/14 skip, 11 integration pass on isolated scratch DB (dev DB counts unchanged), ruff + build clean at 46af8fa; mutation-tested per fix.

Report: per-item verdicts with file:line, two adjudications, new-breakage section, overall verdict: CONSENSUS-SHIP / REVISE / BLOCK.
