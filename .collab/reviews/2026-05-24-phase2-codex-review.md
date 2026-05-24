warning: `--full-auto` is deprecated; use `--sandbox workspace-write` instead.
Reading prompt from stdin...
2026-05-24T08:19:18.579536Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-05-24T08:19:18.579569Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.133.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.3-codex
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019e5911-2d6b-7191-8b83-9ae5fb0f978a
--------
user
# 角色:对抗式代码审查 — DocTalk Phase 2(C4 OCR + B5 整篇覆盖)

我(Claude)在 `fix/phase2-remediation` 实现了 Phase 2:C4(OCR 多语言)+ B5(大文档 section 覆盖)。全量非集成 397 passed/0 failed,ruff 干净。请**对抗式复审**:找 bug、回归、性能、计费/引用契约破坏、边界漏洞。不要盖章。你不能 git,我提交。

## surface
- 完整 diff:`.collab/reviews/2026-05-24-phase2-diff.patch`
- 现网:`backend/app/services/document_brief_service.py`(B5)、`backend/app/services/parse_service.py` + `app/workers/parse_worker.py` + `backend/Dockerfile`(C4)
- 测试:`backend/tests/test_document_brief_service.py`、`test_ocr_languages_baseline.py`

## 重点(逐项给结论 + file:line)
1. **B5 覆盖是否真生效**:`get_summary_context` 对大文档走 `select_chunks_for_summary`,但 chat_service 调用处仍传 `max_chunks=18`(硬编码)。在 462 页 / 30+ section 文档下,18 个 chunk 能覆盖所有 section 吗?是否需要让 summary 的 max_chunks 随文档规模放大(类似 B2 _dynamic_k)?`_should_use_map_reduce` 的门槛/边界(max_chunks<18 跳过、element_chunks_count 判定)有无漏判/误判。
2. **引用契约 / 返回结构**:map-reduce 路径返回的仍是 chunk retrieval-item(含 chunk_id/page/bboxes/document_id)吗?有无字段缺失导致 [n] 引用或 bbox 高亮失效。
3. **性能**:大文档 `select(Chunk).where(document_id).order_by(chunk_index)` 全量加载所有 chunk 进内存 + 分组,500 页文档(数千 chunk)的内存/延迟风险;map/reduce 是否引入额外 LLM 调用拖慢 summary 首 token。
4. **回归**:collection per-doc 窄预算、persisted-brief、element-aware、小文档 representative 路径是否都保留;`SectionMapReducePlanner` 的 map/reduce(若含 LLM 调用)是否在检索路径被意外触发。
5. **C4**:`resolve_ocr_languages` 多语言串联(11 langs)对正常英文文档的 OCR 速度/准确率影响;Dockerfile tesseract 包名是否都正确存在(apt);locale 优先级逻辑。
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q`(应 397/0 failed)。

## 输出:Must-fix / Should-fix / Nit(各带 file:line + 可证伪理由 + 建议),最后给「可否合并 main」。

codex
我会按你给的 6 个重点做一次对抗式复审，先读 patch 和现网关键文件，再逐条验证返回结构、门槛逻辑与大文档行为，最后跑你指定的 `SKIP_INTEGRATION=1 python3 -m pytest -q` 做回归核验。先从 patch 与相关实现定位行号开始。
exec
/bin/zsh -lc 'git status --short' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/dialogue/2026-05-24-phase2-b5-prompt.md
?? .collab/dialogue/2026-05-24-phase2-review-prompt.md
?? .collab/reviews/2026-05-24-phase2-b5-impl.md
?? .collab/reviews/2026-05-24-phase2-codex-review.md
?? .collab/reviews/2026-05-24-phase2-diff.patch

exec
/bin/zsh -lc 'ls -la .collab/reviews && wc -l .collab/reviews/2026-05-24-phase2-diff.patch && rg -n "get_summary_context|select_chunks_for_summary|_should_use_map_reduce|SectionMapReducePlanner|resolve_ocr_languages|max_chunks=18|element_chunks_count|map_reduce|ocr|tesseract" backend/app/services/document_brief_service.py backend/app/services/parse_service.py backend/app/workers/parse_worker.py backend/Dockerfile backend/tests/test_document_brief_service.py backend/tests/test_ocr_languages_baseline.py .collab/reviews/2026-05-24-phase2-diff.patch' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
total 23256
drwxr-xr-x@ 128 mayijie  staff     4096 May 24 10:19 .
drwxr-xr-x@  12 mayijie  staff      384 May 19 00:15 ..
-rw-r--r--@   1 mayijie  staff      477 Feb  4 19:28 001-tech-spec-v0-review-cx.md
-rw-r--r--@   1 mayijie  staff     2398 Feb  4 19:24 001-tech-spec-v0-review.md
-rw-r--r--@   1 mayijie  staff      233 Feb  4 19:33 002-tech-spec-v1-review-cx.md
-rw-r--r--@   1 mayijie  staff     3595 Feb  5 20:11 003-auth-credits-billing-review-v2.md
-rw-r--r--@   1 mayijie  staff     1527 Feb  5 20:13 003-auth-credits-billing-review-v3.md
-rw-r--r--@   1 mayijie  staff     6565 Feb  5 20:08 003-auth-credits-billing-review.md
-rw-r--r--@   1 mayijie  staff     5872 Apr 13 12:52 2026-03-15-deep-codebase-review-findings.md
-rw-r--r--@   1 mayijie  staff     2754 Apr 13 12:52 2026-03-15-deep-codebase-review-result.md
-rw-r--r--@   1 mayijie  staff      742 Apr 13 12:52 2026-03-15-public-i18n-plan-review.md
-rw-r--r--@   1 mayijie  staff     4451 Apr 13 12:52 2026-03-15-public-i18n-review-findings.md
-rw-r--r--@   1 mayijie  staff     1008 Apr 13 12:52 2026-03-15-seo-phase-3-plan-review.md
-rw-r--r--@   1 mayijie  staff     2751 Apr 13 12:52 2026-03-16-claude-security-audit.md
-rw-r--r--@   1 mayijie  staff    14081 Apr 13 12:52 2026-03-16-codex-audit-review.md
-rw-r--r--@   1 mayijie  staff     3952 Mar 17 11:16 2026-03-16-codex-feature-plan-review.md
-rw-r--r--@   1 mayijie  staff     6269 Apr 13 12:52 2026-03-16-codex-plan-review.md
-rw-r--r--@   1 mayijie  staff     6806 Mar 17 11:16 2026-03-16-codex-spec-review.md
-rw-r--r--@   1 mayijie  staff     8124 Apr 13 12:52 2026-03-16-final-security-report.md
-rw-r--r--@   1 mayijie  staff     1497 Apr 13 12:52 2026-03-16-pr1-codex-review.md
-rw-r--r--@   1 mayijie  staff     1888 Apr 13 12:52 2026-03-16-pr2-codex-review.md
-rw-r--r--@   1 mayijie  staff     6175 Apr 13 00:02 2026-04-12-claude-codebase-review-v1.md
-rw-r--r--@   1 mayijie  staff      471 Apr 13 00:02 2026-04-12-codex-codebase-review-rebuttal.md
-rw-r--r--@   1 mayijie  staff     7568 Apr 13 00:02 2026-04-12-consensus-codebase-review.md
-rw-r--r--@   1 mayijie  staff     7867 Apr 13 00:02 2026-04-12-final-fix-report.md
-rw-r--r--@   1 mayijie  staff      248 Apr 13 00:02 2026-04-12-p1-1-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      997 Apr 13 00:02 2026-04-12-p1-1-codex-review.md
-rw-r--r--@   1 mayijie  staff      846 Apr 13 00:02 2026-04-12-p1-2-codex-review-v3.md
-rw-r--r--@   1 mayijie  staff      503 Apr 13 00:02 2026-04-12-p1-2-codex-review-v4.md
-rw-r--r--@   1 mayijie  staff     3322 Apr 13 00:02 2026-04-12-p1-2-codex-review.md
-rw-r--r--@   1 mayijie  staff      652 Apr 13 00:02 2026-04-12-p1-3-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      786 Apr 13 00:02 2026-04-12-p1-3-codex-review.md
-rw-r--r--@   1 mayijie  staff      626 Apr 13 00:02 2026-04-12-p1-4-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      589 Apr 13 00:02 2026-04-12-p1-4-codex-review.md
-rw-r--r--@   1 mayijie  staff      732 Apr 13 00:02 2026-04-12-p2-1-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      777 Apr 13 00:02 2026-04-12-p2-1-codex-review.md
-rw-r--r--@   1 mayijie  staff      409 Apr 13 00:02 2026-04-12-p2-2-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      631 Apr 13 00:02 2026-04-12-p2-2-codex-review.md
-rw-r--r--@   1 mayijie  staff      398 Apr 13 00:02 2026-04-12-p2-3-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      634 Apr 13 00:02 2026-04-12-p2-3-codex-review.md
-rw-r--r--@   1 mayijie  staff      389 Apr 13 00:02 2026-04-12-p2-4-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      598 Apr 13 00:02 2026-04-12-p2-4-codex-review.md
-rw-r--r--@   1 mayijie  staff      577 Apr 13 00:02 2026-04-12-p2-5-codex-review.md
-rw-r--r--@   1 mayijie  staff      386 Apr 13 00:02 2026-04-12-p2-6-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      575 Apr 13 00:02 2026-04-12-p2-6-codex-review.md
-rw-r--r--@   1 mayijie  staff      707 Apr 13 00:02 2026-04-12-p2-8-codex-review.md
-rw-r--r--@   1 mayijie  staff      490 Apr 13 00:02 2026-04-12-p2-8-p2-9-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      747 Apr 13 00:02 2026-04-12-p2-9-p2-10-codex-review.md
-rw-r--r--@   1 mayijie  staff      588 Apr 13 00:02 2026-04-12-p3-codex-review-v2.md
-rw-r--r--@   1 mayijie  staff      374 Apr 13 00:02 2026-04-12-p3-codex-review-v3.md
-rw-r--r--@   1 mayijie  staff      278 Apr 13 00:02 2026-04-12-p3-codex-review-v4.md
-rw-r--r--@   1 mayijie  staff      974 Apr 13 00:02 2026-04-12-p3-codex-review.md
-rw-r--r--@   1 mayijie  staff     8258 Apr 13 12:52 2026-04-13-csp-batch-a-prime.md
-rw-r--r--@   1 mayijie  staff     7895 Apr 13 12:52 2026-04-13-ocr-baseline.md
-rw-r--r--@   1 mayijie  staff     3711 Apr 13 12:52 2026-04-13-stripe-phase-b-closeout.md
-rw-r--r--@   1 mayijie  staff     1102 Apr 14 19:07 2026-04-14-billing-phase1-migration-response.md
-rw-r--r--@   1 mayijie  staff     1782 Apr 14 19:07 2026-04-14-billing-phase1-migration.md
-rw-r--r--@   1 mayijie  staff     1555 Apr 14 19:07 2026-04-14-billing-phase2-cancel-endpoint-response.md
-rw-r--r--@   1 mayijie  staff     2863 Apr 14 19:07 2026-04-14-billing-phase2-cancel-endpoint.md
-rw-r--r--@   1 mayijie  staff     1386 Apr 14 19:07 2026-04-14-billing-phase3-billing-state-response.md
-rw-r--r--@   1 mayijie  staff     2660 Apr 14 19:07 2026-04-14-billing-phase3-billing-state.md
-rw-r--r--@   1 mayijie  staff     1757 Apr 14 19:07 2026-04-14-billing-phase4-frontend-response.md
-rw-r--r--@   1 mayijie  staff     3237 Apr 14 19:07 2026-04-14-billing-phase4-frontend.md
-rw-r--r--@   1 mayijie  staff      512 Apr 14 19:07 2026-04-14-billing-phase5-docs-r2-response.md
-rw-r--r--@   1 mayijie  staff     1019 Apr 14 19:07 2026-04-14-billing-phase5-docs-r2.md
-rw-r--r--@   1 mayijie  staff     1327 Apr 14 19:07 2026-04-14-billing-phase5-docs-response.md
-rw-r--r--@   1 mayijie  staff     1293 Apr 14 19:07 2026-04-14-billing-phase5-docs.md
-rw-r--r--@   1 mayijie  staff    10311 Apr 15 00:47 2026-04-14-error-taxonomy-r1-codex.md
-rw-r--r--@   1 mayijie  staff     4148 Apr 15 00:47 2026-04-14-error-taxonomy-r2-codex.md
-rw-r--r--@   1 mayijie  staff      804 Apr 15 00:47 2026-04-14-error-taxonomy-r3-codex.md
-rw-r--r--@   1 mayijie  staff     4298 Apr 15 00:47 2026-04-15-error-taxonomy-final-codex.md
-rw-r--r--@   1 mayijie  staff     1522 Apr 15 00:47 2026-04-15-error-taxonomy-r5-codex.md
-rw-r--r--@   1 mayijie  staff      107 Apr 15 00:47 2026-04-15-error-taxonomy-r6-codex.md
-rw-r--r--@   1 mayijie  staff   215609 May 24 10:04 2026-05-20-frontend-audit-c1-impl-codex.md
-rw-r--r--@   1 mayijie  staff    30309 May 20 17:59 2026-05-20-frontend-audit-r1-codex.md
-rw-r--r--@   1 mayijie  staff     6486 May 20 17:59 2026-05-20-frontend-audit-r2-codex.md
-rw-r--r--@   1 mayijie  staff     1834 May 20 17:59 2026-05-20-frontend-audit-r3-codex.md
-rw-r--r--@   1 mayijie  staff     1639 May 20 17:59 2026-05-20-frontend-audit-r4-codex.md
-rw-r--r--@   1 mayijie  staff     2361 May 20 17:59 2026-05-20-frontend-audit-r5-codex.md
-rw-r--r--@   1 mayijie  staff      191 May 20 17:59 2026-05-20-frontend-audit-r6-codex.md
-rw-r--r--@   1 mayijie  staff    11198 May 24 10:04 2026-05-23-user-funnel-retrospective.md
-rw-r--r--@   1 mayijie  staff     2770 May 24 10:04 2026-05-24-phase1-claude-review.md
-rw-r--r--@   1 mayijie  staff  1622790 May 24 10:04 2026-05-24-phase1-codex-impl.md
-rw-r--r--@   1 mayijie  staff  1403979 May 24 10:04 2026-05-24-phase1-codex-review.md
-rw-r--r--@   1 mayijie  staff  3253320 May 24 10:04 2026-05-24-phase1-fixbatch.md
-rw-r--r--@   1 mayijie  staff    81582 May 24 10:04 2026-05-24-phase1-fulldiff.patch
-rw-r--r--@   1 mayijie  staff  2040512 May 24 10:17 2026-05-24-phase2-b5-impl.md
-rw-r--r--@   1 mayijie  staff     3325 May 24 10:19 2026-05-24-phase2-codex-review.md
-rw-r--r--@   1 mayijie  staff    17821 May 24 10:19 2026-05-24-phase2-diff.patch
-rw-r--r--@   1 mayijie  staff  1734577 May 24 10:04 2026-05-24-remediation-codex-review-r1.md
-rw-r--r--@   1 mayijie  staff   450610 May 24 10:04 2026-05-24-remediation-codex-review-r2.md
-rw-r--r--@   1 mayijie  staff      315 Feb 13 18:23 billing-corner-case-audit-review.md
-rw-r--r--@   1 mayijie  staff     7321 Feb  5 21:14 bug-hunt-report.md
-rw-r--r--@   1 mayijie  staff     2161 Feb  5 09:25 bugfix-citation-dedup-highlight-review-request.md
-rw-r--r--@   1 mayijie  staff     3116 Feb  5 09:27 bugfix-citation-dedup-highlight-review-result.md
-rw-r--r--@   1 mayijie  staff     1250 Feb  5 00:54 build-test-review.md
-rw-r--r--@   1 mayijie  staff     3080 Apr 13 12:52 citation-accuracy-fix-review.md
-rw-r--r--@   1 mayijie  staff     2085 Apr 13 12:52 citation-fix-implementation.md
-rw-r--r--@   1 mayijie  staff     1955 Apr 13 12:52 citation-hovercard-review.md
-rw-r--r--@   1 mayijie  staff     9095 Feb 12 00:16 codex-product-audit-review.md
-rw-r--r--@   1 mayijie  staff     4733 Apr 13 12:52 cross-user-doc-visibility-fix-review.md
-rw-r--r--@   1 mayijie  staff       91 Apr 13 12:52 cross-user-doc-visibility-review.md
-rw-r--r--@   1 mayijie  staff    18744 Apr 13 12:52 email-implementation-audit.md
-rw-r--r--@   1 mayijie  staff     4450 Feb  5 12:31 final-comprehensive-review.md
-rw-r--r--@   1 mayijie  staff     3144 Feb  5 12:43 final-review-round2.md
-rw-r--r--@   1 mayijie  staff     2763 May 24 10:04 frontend-ui-full-coverage-2026-05-15.md
-rw-r--r--@   1 mayijie  staff     3647 Feb  5 10:58 full-bugfix-review-result.md
-rw-r--r--@   1 mayijie  staff     1732 Feb  5 12:22 highlight-redesign-execution-result.md
-rw-r--r--@   1 mayijie  staff     2832 Feb  5 12:20 highlight-redesign-v2-review.md
-rw-r--r--@   1 mayijie  staff     2545 Feb  5 13:23 highlight-v3-execution-result.md
-rw-r--r--@   1 mayijie  staff    13090 Feb  5 23:10 landing-page-ux-review-1.md
-rw-r--r--@   1 mayijie  staff    13028 Feb  5 23:14 landing-page-ux-review-2.md
-rw-r--r--@   1 mayijie  staff     1066 Feb  5 17:51 review-layout-model-i18n-v2.md
-rw-r--r--@   1 mayijie  staff      241 Feb  5 17:45 review-layout-model-i18n.md
-rw-r--r--@   1 mayijie  staff     3840 Apr 13 12:52 security-scan-report.md
-rw-r--r--@   1 mayijie  staff     4073 Feb  5 18:42 session-management-exec.md
-rw-r--r--@   1 mayijie  staff     4481 Feb  5 18:29 session-management-review-v2.md
-rw-r--r--@   1 mayijie  staff     6348 Feb  5 18:24 session-management-review.md
-rw-r--r--@   1 mayijie  staff      384 Apr 13 12:52 shiki-codeblock-review-2.md
-rw-r--r--@   1 mayijie  staff      783 Apr 13 12:52 shiki-codeblock-review.md
-rw-r--r--@   1 mayijie  staff     2854 Feb  5 00:56 sprint1-review.md
-rw-r--r--@   1 mayijie  staff     1436 Feb  5 10:52 textlayer-fix-result.md
drwxr-xr-x@  83 mayijie  staff     2656 May 15 15:43 ui-audit-artifacts
-rw-r--r--@   1 mayijie  staff    28233 May  7 18:55 v4-bench-2026-04-25-final-adr.md
-rw-r--r--@   1 mayijie  staff      400 Apr 13 12:52 voice-and-tone-review-2.md
-rw-r--r--@   1 mayijie  staff     2504 Apr 13 12:52 voice-and-tone-review.md
-rw-r--r--@   1 mayijie  staff    18635 Feb 12 11:12 wave3-codex-review.md
-rw-r--r--@   1 mayijie  staff        9 Feb 12 11:17 wave3-codex-verdict.md
     490 .collab/reviews/2026-05-24-phase2-diff.patch
.collab/reviews/2026-05-24-phase2-diff.patch:6:        tesseract-ocr \
.collab/reviews/2026-05-24-phase2-diff.patch:7:        tesseract-ocr-eng \
.collab/reviews/2026-05-24-phase2-diff.patch:8:        tesseract-ocr-chi-sim \
.collab/reviews/2026-05-24-phase2-diff.patch:9:+       tesseract-ocr-jpn \
.collab/reviews/2026-05-24-phase2-diff.patch:10:+       tesseract-ocr-kor \
.collab/reviews/2026-05-24-phase2-diff.patch:11:+       tesseract-ocr-spa \
.collab/reviews/2026-05-24-phase2-diff.patch:12:+       tesseract-ocr-deu \
.collab/reviews/2026-05-24-phase2-diff.patch:13:+       tesseract-ocr-fra \
.collab/reviews/2026-05-24-phase2-diff.patch:14:+       tesseract-ocr-por \
.collab/reviews/2026-05-24-phase2-diff.patch:15:+       tesseract-ocr-ita \
.collab/reviews/2026-05-24-phase2-diff.patch:16:+       tesseract-ocr-ara \
.collab/reviews/2026-05-24-phase2-diff.patch:17:+       tesseract-ocr-hin \
.collab/reviews/2026-05-24-phase2-diff.patch:172:+class SectionMapReducePlanner:
.collab/reviews/2026-05-24-phase2-diff.patch:283:+    async def select_chunks_for_summary(
.collab/reviews/2026-05-24-phase2-diff.patch:356:+        section_map_reduce: SectionMapReducePlanner | None = None,
.collab/reviews/2026-05-24-phase2-diff.patch:357:+        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
.collab/reviews/2026-05-24-phase2-diff.patch:359:+        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
.collab/reviews/2026-05-24-phase2-diff.patch:360:+        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
.collab/reviews/2026-05-24-phase2-diff.patch:362:+    def _should_use_map_reduce(
.collab/reviews/2026-05-24-phase2-diff.patch:367:+        element_chunks_count: int,
.collab/reviews/2026-05-24-phase2-diff.patch:372:+        if len(chunks) < self._map_reduce_min_chunks:
.collab/reviews/2026-05-24-phase2-diff.patch:376:+        if element_chunks_count >= max_chunks:
.collab/reviews/2026-05-24-phase2-diff.patch:379:+        return len(chunks) >= max(max_chunks * 2, self._map_reduce_min_chunks)
.collab/reviews/2026-05-24-phase2-diff.patch:381:     async def get_summary_context(
.collab/reviews/2026-05-24-phase2-diff.patch:397:+        if self._should_use_map_reduce(
.collab/reviews/2026-05-24-phase2-diff.patch:400:+            element_chunks_count=len(element_chunks),
.collab/reviews/2026-05-24-phase2-diff.patch:402:+            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
.collab/reviews/2026-05-24-phase2-diff.patch:406:+            if selected_map_reduce:
.collab/reviews/2026-05-24-phase2-diff.patch:407:+                total = max(1, len(selected_map_reduce))
.collab/reviews/2026-05-24-phase2-diff.patch:413:+                    for idx, chunk in enumerate(selected_map_reduce)
.collab/reviews/2026-05-24-phase2-diff.patch:443:+def resolve_ocr_languages(locale: str | None = None) -> str:
.collab/reviews/2026-05-24-phase2-diff.patch:478:+from app.services.parse_service import ParseService, resolve_ocr_languages
.collab/reviews/2026-05-24-phase2-diff.patch:484:                         pages = service.extract_pages_ocr(
.collab/reviews/2026-05-24-phase2-diff.patch:487:+                            languages=resolve_ocr_languages(),
backend/tests/test_document_brief_service.py:13:    SectionMapReducePlanner,
backend/tests/test_document_brief_service.py:110:    monkeypatch.setattr(service, "get_summary_context", AsyncMock(side_effect=fake_context))
backend/tests/test_document_brief_service.py:142:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:164:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
backend/tests/test_document_brief_service.py:195:    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=4)
backend/tests/test_document_brief_service.py:201:async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
backend/tests/test_document_brief_service.py:209:    sampled = _select_representative_chunks(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:246:    planner = SectionMapReducePlanner(
backend/tests/test_document_brief_service.py:253:    selected = await planner.select_chunks_for_summary(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:270:async def test_large_document_summary_context_uses_section_map_reduce() -> None:
backend/tests/test_document_brief_service.py:276:    map_reduce_selected = chunks[:30]
backend/tests/test_document_brief_service.py:277:    planner = SectionMapReducePlanner()
backend/tests/test_document_brief_service.py:278:    planner.select_chunks_for_summary = AsyncMock(return_value=map_reduce_selected)
backend/tests/test_document_brief_service.py:280:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:281:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:293:    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
backend/tests/test_document_brief_service.py:295:    planner.select_chunks_for_summary.assert_awaited_once_with(chunks, max_chunks=18)
backend/tests/test_document_brief_service.py:300:async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
backend/tests/test_document_brief_service.py:306:    planner = SectionMapReducePlanner()
backend/tests/test_document_brief_service.py:307:    planner.select_chunks_for_summary = AsyncMock(return_value=chunks[:20])
backend/tests/test_document_brief_service.py:309:        section_map_reduce=planner,
backend/tests/test_document_brief_service.py:310:        map_reduce_min_chunks=36,
backend/tests/test_document_brief_service.py:322:    contexts = await service.get_summary_context(db, document_id, max_chunks=3)
backend/tests/test_document_brief_service.py:324:    planner.select_chunks_for_summary.assert_not_awaited()
backend/app/services/document_brief_service.py:153:class SectionMapReducePlanner:
backend/app/services/document_brief_service.py:264:    async def select_chunks_for_summary(
backend/app/services/document_brief_service.py:415:        section_map_reduce: SectionMapReducePlanner | None = None,
backend/app/services/document_brief_service.py:416:        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
backend/app/services/document_brief_service.py:418:        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
backend/app/services/document_brief_service.py:419:        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
backend/app/services/document_brief_service.py:421:    def _should_use_map_reduce(
backend/app/services/document_brief_service.py:426:        element_chunks_count: int,
backend/app/services/document_brief_service.py:431:        if len(chunks) < self._map_reduce_min_chunks:
backend/app/services/document_brief_service.py:435:        if element_chunks_count >= max_chunks:
backend/app/services/document_brief_service.py:438:        return len(chunks) >= max(max_chunks * 2, self._map_reduce_min_chunks)
backend/app/services/document_brief_service.py:440:    async def get_summary_context(
backend/app/services/document_brief_service.py:472:        if self._should_use_map_reduce(
backend/app/services/document_brief_service.py:475:            element_chunks_count=len(element_chunks),
backend/app/services/document_brief_service.py:477:            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
backend/app/services/document_brief_service.py:481:            if selected_map_reduce:
backend/app/services/document_brief_service.py:482:                total = max(1, len(selected_map_reduce))
backend/app/services/document_brief_service.py:488:                    for idx, chunk in enumerate(selected_map_reduce)
backend/app/services/document_brief_service.py:563:                await self.get_summary_context(
backend/Dockerfile:18:       tesseract-ocr \
backend/Dockerfile:19:       tesseract-ocr-eng \
backend/Dockerfile:20:       tesseract-ocr-chi-sim \
backend/Dockerfile:21:       tesseract-ocr-jpn \
backend/Dockerfile:22:       tesseract-ocr-kor \
backend/Dockerfile:23:       tesseract-ocr-spa \
backend/Dockerfile:24:       tesseract-ocr-deu \
backend/Dockerfile:25:       tesseract-ocr-fra \
backend/Dockerfile:26:       tesseract-ocr-por \
backend/Dockerfile:27:       tesseract-ocr-ita \
backend/Dockerfile:28:       tesseract-ocr-ara \
backend/Dockerfile:29:       tesseract-ocr-hin \
backend/tests/test_ocr_languages_baseline.py:7:RED on current build (resolve_ocr_languages does not exist / default too narrow).
backend/tests/test_ocr_languages_baseline.py:22:def test_resolve_ocr_languages_exists_and_covers_all_locales():
backend/tests/test_ocr_languages_baseline.py:23:    resolve = getattr(ps, "resolve_ocr_languages", None)
backend/tests/test_ocr_languages_baseline.py:24:    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
backend/tests/test_ocr_languages_baseline.py:32:def test_resolve_ocr_languages_prioritises_document_locale(locale, code):
backend/tests/test_ocr_languages_baseline.py:33:    resolve = getattr(ps, "resolve_ocr_languages", None)
backend/tests/test_ocr_languages_baseline.py:34:    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
backend/app/services/parse_service.py:19:def resolve_ocr_languages(locale: str | None = None) -> str:
backend/app/services/parse_service.py:151:    def extract_pages_ocr(
backend/app/services/parse_service.py:183:                    tp = page.get_textpage_ocr(language=languages, dpi=effective_dpi, full=True)
backend/app/workers/parse_worker.py:18:from app.services.parse_service import ParseService, resolve_ocr_languages
backend/app/workers/parse_worker.py:258:                    doc.status = "ocr"
backend/app/workers/parse_worker.py:263:                        pages = service.extract_pages_ocr(
backend/app/workers/parse_worker.py:265:                            languages=resolve_ocr_languages(),

codex
我已经定位到新增入口和测试点。下一步我会精读 `document_brief_service.py` / `parse_worker.py` / `parse_service.py` 与调用链（尤其 chat/summary 调用的 `max_chunks`），验证是否真覆盖、是否破坏引用契约，以及 C4 语言选择是否按 locale 生效。
exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '260,560p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import asyncio
     4	import math
     5	import uuid
     6	from dataclasses import dataclass
     7	from typing import Any, Protocol, Sequence
     8	
     9	from sqlalchemy import select
    10	from sqlalchemy.ext.asyncio import AsyncSession
    11	
    12	from app.models.tables import Chunk, Document, DocumentBrief
    13	from app.services.document_element_service import (
    14	    chunk_to_retrieval_item,
    15	    get_element_aware_chunks_async,
    16	)
    17	
    18	MIN_SUMMARY_CHUNK_CHARS = 80
    19	DEFAULT_MAX_SUMMARY_CHUNKS = 18
    20	DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
    21	DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8
    22	DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36
    23	
    24	
    25	@dataclass(frozen=True)
    26	class SectionMapGroup:
    27	    group_index: int
    28	    chunks: tuple[Any, ...]
    29	    section_titles: tuple[str, ...]
    30	
    31	
    32	@dataclass(frozen=True)
    33	class MapStepResult:
    34	    group_index: int
    35	    summary: str
    36	    selected_chunk_ids: tuple[uuid.UUID, ...]
    37	    covered_sections: tuple[str, ...]
    38	
    39	
    40	class MapStep(Protocol):
    41	    async def __call__(self, group: SectionMapGroup) -> MapStepResult: ...
    42	
    43	
    44	class ReduceStep(Protocol):
    45	    async def __call__(
    46	        self,
    47	        mapped: list[MapStepResult],
    48	        *,
    49	        max_total_chunks: int,
    50	    ) -> list[uuid.UUID]: ...
    51	
    52	
    53	def _chunk_text_length(chunk: Any) -> int:
    54	    return len((getattr(chunk, "text", "") or "").strip())
    55	
    56	
    57	def _chunk_section_title(chunk: Any) -> str:
    58	    section = str(getattr(chunk, "section_title", "") or "").strip()
    59	    if section:
    60	        return section[:200]
    61	    page = getattr(chunk, "page_start", None)
    62	    if isinstance(page, int):
    63	        return f"Page {page}"
    64	    return "Untitled"
    65	
    66	
    67	def _dynamic_section_group_count(
    68	    chunks_total: int,
    69	    *,
    70	    min_groups: int = 2,
    71	    max_groups: int = 18,
    72	    target_chunks_per_group: int = 12,
    73	) -> int:
    74	    total = max(0, int(chunks_total or 0))
    75	    if total <= 0:
    76	        return min_groups
    77	    groups = math.ceil(total / max(1, target_chunks_per_group))
    78	    return max(min_groups, min(max_groups, groups))
    79	
    80	
    81	def _dynamic_summary_chunk_budget(
    82	    base_max_chunks: int,
    83	    *,
    84	    chunks_total: int,
    85	    section_total: int,
    86	    max_total_chunks_cap: int,
    87	) -> int:
    88	    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
    89	    budget = max(floor, min(max_total_chunks_cap, floor + (max(0, chunks_total) // 24)))
    90	    if section_total > 0:
    91	        budget = max(budget, min(max_total_chunks_cap, section_total))
    92	    return min(max_total_chunks_cap, max(1, budget))
    93	
    94	
    95	def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
    96	    segments: list[tuple[str, list[Any]]] = []
    97	    current_title: str | None = None
    98	    current_items: list[Any] = []
    99	
   100	    for chunk in chunks:
   101	        title = _chunk_section_title(chunk)
   102	        if current_title is None:
   103	            current_title = title
   104	            current_items = [chunk]
   105	            continue
   106	        if title == current_title:
   107	            current_items.append(chunk)
   108	            continue
   109	        segments.append((current_title, current_items))
   110	        current_title = title
   111	        current_items = [chunk]
   112	
   113	    if current_title is not None and current_items:
   114	        segments.append((current_title, current_items))
   115	    return segments
   116	
   117	
   118	def _group_segments(
   119	    segments: Sequence[tuple[str, list[Any]]],
   120	    *,
   121	    target_groups: int,
   122	) -> list[SectionMapGroup]:
   123	    if not segments:
   124	        return []
   125	    if target_groups <= 0:
   126	        target_groups = 1
   127	    target_groups = min(target_groups, len(segments))
   128	    grouped: list[list[tuple[str, list[Any]]]] = [[] for _ in range(target_groups)]
   129	    total = len(segments)
   130	    for idx, segment in enumerate(segments):
   131	        group_index = min(target_groups - 1, (idx * target_groups) // total)
   132	        grouped[group_index].append(segment)
   133	
   134	    result: list[SectionMapGroup] = []
   135	    for group_index, raw_segments in enumerate(grouped):
   136	        if not raw_segments:
   137	            continue
   138	        section_titles: list[str] = []
   139	        chunks: list[Any] = []
   140	        for title, seg_chunks in raw_segments:
   141	            section_titles.append(title)
   142	            chunks.extend(seg_chunks)
   143	        result.append(
   144	            SectionMapGroup(
   145	                group_index=group_index,
   146	                chunks=tuple(chunks),
   147	                section_titles=tuple(section_titles),
   148	            )
   149	        )
   150	    return result
   151	
   152	
   153	class SectionMapReducePlanner:
   154	    def __init__(
   155	        self,
   156	        *,
   157	        map_step: MapStep | None = None,
   158	        reduce_step: ReduceStep | None = None,
   159	        min_groups: int = 2,
   160	        max_groups: int = 18,
   161	        max_group_chunks: int = 6,
   162	        max_total_chunks_cap: int = 64,
   163	        max_concurrency: int = 4,
   164	    ) -> None:
   165	        self._map_step = map_step
   166	        self._reduce_step = reduce_step
   167	        self._min_groups = max(1, int(min_groups))
   168	        self._max_groups = max(self._min_groups, int(max_groups))
   169	        self._max_group_chunks = max(1, int(max_group_chunks))
   170	        self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
   171	        self._max_concurrency = max(1, int(max_concurrency))
   172	
   173	    def _truncate_group_chunks(self, group: SectionMapGroup) -> SectionMapGroup:
   174	        """Cap per-group map context while preserving at least one chunk/section."""
   175	        section_anchor_set: set[uuid.UUID] = set()
   176	        selected: list[Any] = []
   177	        seen_sections: set[str] = set()
   178	        for chunk in group.chunks:
   179	            section = _chunk_section_title(chunk)
   180	            if section in seen_sections:
   181	                continue
   182	            seen_sections.add(section)
   183	            selected.append(chunk)
   184	            section_anchor_set.add(chunk.id)
   185	
   186	        # Fill extra room with evenly spaced body chunks for long sections.
   187	        if len(selected) < self._max_group_chunks and len(group.chunks) > len(selected):
   188	            remaining = [
   189	                chunk
   190	                for chunk in group.chunks
   191	                if chunk.id not in section_anchor_set
   192	            ]
   193	            budget = self._max_group_chunks - len(selected)
   194	            if remaining and budget > 0:
   195	                if len(remaining) <= budget:
   196	                    selected.extend(remaining)
   197	                elif budget == 1:
   198	                    selected.append(remaining[len(remaining) // 2])
   199	                else:
   200	                    for slot in range(budget):
   201	                        selected.append(
   202	                            remaining[round(slot * (len(remaining) - 1) / (budget - 1))]
   203	                        )
   204	
   205	        if not selected:
   206	            return group
   207	
   208	        # Keep map payload ordered by chunk index.
   209	        selected.sort(key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   210	        return SectionMapGroup(
   211	            group_index=group.group_index,
   212	            chunks=tuple(selected),
   213	            section_titles=group.section_titles,
   214	        )
   215	
   216	    async def _default_map_step(self, group: SectionMapGroup) -> MapStepResult:
   217	        selected_ids: list[uuid.UUID] = []
   218	        covered_sections: list[str] = []
   219	        seen_sections: set[str] = set()
   220	
   221	        for chunk in group.chunks:
   222	            section = _chunk_section_title(chunk)
   223	            if section in seen_sections:
   224	                continue
   225	            seen_sections.add(section)
   226	            covered_sections.append(section)
   227	            selected_ids.append(chunk.id)
   228	
   229	        if not selected_ids and group.chunks:
   230	            selected_ids.append(group.chunks[0].id)
   231	            covered_sections.append(_chunk_section_title(group.chunks[0]))
   232	
   233	        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
   234	        return MapStepResult(
   235	            group_index=group.group_index,
   236	            summary=summary,
   237	            selected_chunk_ids=tuple(selected_ids),
   238	            covered_sections=tuple(covered_sections),
   239	        )
   240	
   241	    async def _default_reduce_step(
   242	        self,
   243	        mapped: list[MapStepResult],
   244	        *,
   245	        max_total_chunks: int,
   246	    ) -> list[uuid.UUID]:
   247	        ordered: list[uuid.UUID] = []
   248	        seen: set[uuid.UUID] = set()
   249	        for item in sorted(mapped, key=lambda value: value.group_index):
   250	            for chunk_id in item.selected_chunk_ids:
   251	                if chunk_id in seen:
   252	                    continue
   253	                seen.add(chunk_id)
   254	                ordered.append(chunk_id)
   255	                if len(ordered) >= max_total_chunks:
   256	                    return ordered
   257	        return ordered[:max_total_chunks]
   258	
   259	    async def _run_map_step(self, group: SectionMapGroup, semaphore: asyncio.Semaphore) -> MapStepResult:
   260	        async with semaphore:

 succeeded in 0ms:
   260	        async with semaphore:
   261	            step = self._map_step or self._default_map_step
   262	            return await step(group)
   263	
   264	    async def select_chunks_for_summary(
   265	        self,
   266	        chunks: Sequence[Any],
   267	        *,
   268	        max_chunks: int,
   269	    ) -> list[Any]:
   270	        ordered_chunks = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   271	        if not ordered_chunks:
   272	            return []
   273	
   274	        segments = _section_segments(ordered_chunks)
   275	        if not segments:
   276	            return list(ordered_chunks[:max_chunks])
   277	
   278	        section_total = len(segments)
   279	        desired_groups = _dynamic_section_group_count(
   280	            len(ordered_chunks),
   281	            min_groups=self._min_groups,
   282	            max_groups=self._max_groups,
   283	        )
   284	        section_bound_groups = math.ceil(section_total / max(1, self._max_group_chunks))
   285	        target_groups = min(self._max_groups, max(desired_groups, section_bound_groups))
   286	        target_groups = max(self._min_groups, min(target_groups, section_total))
   287	
   288	        groups = _group_segments(segments, target_groups=target_groups)
   289	        prepared_groups = [self._truncate_group_chunks(group) for group in groups]
   290	        if not prepared_groups:
   291	            return list(ordered_chunks[:max_chunks])
   292	
   293	        max_total_chunks = _dynamic_summary_chunk_budget(
   294	            max_chunks,
   295	            chunks_total=len(ordered_chunks),
   296	            section_total=section_total,
   297	            max_total_chunks_cap=self._max_total_chunks_cap,
   298	        )
   299	
   300	        semaphore = asyncio.Semaphore(self._max_concurrency)
   301	        mapped = await asyncio.gather(
   302	            *(self._run_map_step(group, semaphore) for group in prepared_groups)
   303	        )
   304	        reduce_step = self._reduce_step or self._default_reduce_step
   305	        selected_ids = await reduce_step(mapped, max_total_chunks=max_total_chunks)
   306	
   307	        if not selected_ids:
   308	            selected_ids = [
   309	                group.chunks[0].id
   310	                for group in prepared_groups
   311	                if group.chunks
   312	            ][:max_total_chunks]
   313	
   314	        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
   315	        selected: list[Any] = []
   316	        seen: set[uuid.UUID] = set()
   317	        for chunk_id in selected_ids:
   318	            chunk = chunk_by_id.get(chunk_id)
   319	            if chunk is None or chunk.id in seen:
   320	                continue
   321	            seen.add(chunk.id)
   322	            selected.append(chunk)
   323	
   324	        return selected
   325	
   326	
   327	def _select_representative_chunks(
   328	    chunks: Sequence[Any],
   329	    *,
   330	    max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
   331	) -> list[Any]:
   332	    """Select ordered chunks for broad document coverage.
   333	
   334	    This deliberately does not use query similarity. Whole-document summaries
   335	    need beginning/middle/end coverage and section diversity, while semantic
   336	    top-k often over-selects tables, appendices, or repeated sidebars for vague
   337	    prompts like "summarize this document".
   338	    """
   339	    usable = [
   340	        ch for ch in chunks
   341	        if _chunk_text_length(ch) >= MIN_SUMMARY_CHUNK_CHARS
   342	    ]
   343	    if not usable:
   344	        return list(chunks[:max_chunks])
   345	    if len(usable) <= max_chunks:
   346	        return list(usable)
   347	
   348	    selected_indices: set[int] = set()
   349	
   350	    # Preserve early orientation: title, thesis, intro, abstract often appear
   351	    # near the front, but cap it to avoid front-loaded summaries.
   352	    front_count = min(4, max_chunks // 3)
   353	    selected_indices.update(range(front_count))
   354	
   355	    # Keep likely conclusion / appendix tail coverage without over-weighting it.
   356	    selected_indices.update(range(max(0, len(usable) - 2), len(usable)))
   357	
   358	    # Add chunks when a new section title appears. This recovers broad structure
   359	    # cheaply until a durable section index exists.
   360	    seen_sections: set[str] = set()
   361	    for idx, chunk in enumerate(usable):
   362	        section = (getattr(chunk, "section_title", None) or "").strip().lower()
   363	        if not section or section in seen_sections:
   364	            continue
   365	        seen_sections.add(section)
   366	        selected_indices.add(idx)
   367	        if len(selected_indices) >= max_chunks:
   368	            break
   369	
   370	    # Fill remaining budget with evenly spaced coverage.
   371	    remaining = max_chunks - len(selected_indices)
   372	    if remaining > 0:
   373	        if remaining == 1:
   374	            selected_indices.add(len(usable) // 2)
   375	        else:
   376	            for slot in range(remaining):
   377	                idx = round(slot * (len(usable) - 1) / (remaining - 1))
   378	                selected_indices.add(idx)
   379	
   380	    # If section titles consumed too much budget, keep deterministic coverage:
   381	    # earliest orientation, evenly-spaced body, tail.
   382	    if len(selected_indices) > max_chunks:
   383	        fixed = set(range(front_count))
   384	        fixed.update(range(max(0, len(usable) - 2), len(usable)))
   385	        middle_budget = max_chunks - len(fixed)
   386	        middle = [
   387	            idx for idx in selected_indices
   388	            if idx not in fixed
   389	        ]
   390	        if middle_budget > 0 and middle:
   391	            step = max(1, math.ceil(len(middle) / middle_budget))
   392	            fixed.update(middle[::step][:middle_budget])
   393	        selected_indices = set(sorted(fixed)[:max_chunks])
   394	
   395	    return [usable[idx] for idx in sorted(selected_indices)[:max_chunks]]
   396	
   397	
   398	def _chunk_to_retrieval_item(chunk: Chunk, score: float) -> dict[str, Any]:
   399	    return {
   400	        "chunk_id": chunk.id,
   401	        "text": chunk.text,
   402	        "page": chunk.page_start,
   403	        "page_end": chunk.page_end,
   404	        "bboxes": chunk.bboxes,
   405	        "score": score,
   406	        "section_title": chunk.section_title,
   407	        "document_id": chunk.document_id,
   408	    }
   409	
   410	
   411	class DocumentBriefService:
   412	    def __init__(
   413	        self,
   414	        *,
   415	        section_map_reduce: SectionMapReducePlanner | None = None,
   416	        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
   417	    ) -> None:
   418	        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
   419	        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
   420	
   421	    def _should_use_map_reduce(
   422	        self,
   423	        chunks: Sequence[Any],
   424	        *,
   425	        max_chunks: int,
   426	        element_chunks_count: int,
   427	    ) -> bool:
   428	        if max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
   429	            # Collection summary allocates a narrow per-document budget.
   430	            return False
   431	        if len(chunks) < self._map_reduce_min_chunks:
   432	            return False
   433	        if len(chunks) <= max_chunks:
   434	            return False
   435	        if element_chunks_count >= max_chunks:
   436	            return True
   437	        # No reliable element coverage: still promote large docs to section map-reduce.
   438	        return len(chunks) >= max(max_chunks * 2, self._map_reduce_min_chunks)
   439	
   440	    async def get_summary_context(
   441	        self,
   442	        db: AsyncSession,
   443	        document_id: uuid.UUID,
   444	        *,
   445	        max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
   446	    ) -> list[dict[str, Any]]:
   447	        persisted = await self._get_persisted_summary_context(
   448	            db,
   449	            document_id,
   450	            max_chunks=max_chunks,
   451	        )
   452	        if persisted:
   453	            return persisted
   454	
   455	        element_chunks = await get_element_aware_chunks_async(
   456	            db,
   457	            document_id,
   458	            max_chunks=max_chunks,
   459	        )
   460	        if element_chunks and len(element_chunks) < max_chunks:
   461	            return [
   462	                chunk_to_retrieval_item(chunk, score, include_document_id=True)
   463	                for chunk, score in element_chunks
   464	            ]
   465	
   466	        rows = await db.execute(
   467	            select(Chunk)
   468	            .where(Chunk.document_id == document_id)
   469	            .order_by(Chunk.chunk_index)
   470	        )
   471	        chunks = list(rows.scalars())
   472	        if self._should_use_map_reduce(
   473	            chunks,
   474	            max_chunks=max_chunks,
   475	            element_chunks_count=len(element_chunks),
   476	        ):
   477	            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
   478	                chunks,
   479	                max_chunks=max_chunks,
   480	            )
   481	            if selected_map_reduce:
   482	                total = max(1, len(selected_map_reduce))
   483	                return [
   484	                    _chunk_to_retrieval_item(
   485	                        chunk,
   486	                        1.0 - (idx / (total + 1)) * 0.2,
   487	                    )
   488	                    for idx, chunk in enumerate(selected_map_reduce)
   489	                ]
   490	
   491	        if element_chunks:
   492	            return [
   493	                chunk_to_retrieval_item(chunk, score, include_document_id=True)
   494	                for chunk, score in element_chunks
   495	            ]
   496	
   497	        selected = _select_representative_chunks(chunks, max_chunks=max_chunks)
   498	        total = max(1, len(selected))
   499	        return [
   500	            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
   501	            for idx, chunk in enumerate(selected)
   502	        ]
   503	
   504	    async def _get_persisted_summary_context(
   505	        self,
   506	        db: AsyncSession,
   507	        document_id: uuid.UUID,
   508	        *,
   509	        max_chunks: int,
   510	    ) -> list[dict[str, Any]]:
   511	        brief_row = await db.execute(
   512	            select(DocumentBrief.coverage).where(DocumentBrief.document_id == document_id)
   513	        )
   514	        coverage = brief_row.scalar_one_or_none()
   515	        if not isinstance(coverage, dict):
   516	            return []
   517	        raw_ids = coverage.get("selected_chunk_ids")
   518	        if not isinstance(raw_ids, list) or not raw_ids:
   519	            return []
   520	
   521	        chunk_ids: list[uuid.UUID] = []
   522	        for raw_id in raw_ids[:max_chunks]:
   523	            try:
   524	                chunk_ids.append(uuid.UUID(str(raw_id)))
   525	            except (TypeError, ValueError):
   526	                continue
   527	        if not chunk_ids:
   528	            return []
   529	
   530	        rows = await db.execute(
   531	            select(Chunk)
   532	            .where(Chunk.document_id == document_id)
   533	            .where(Chunk.id.in_(chunk_ids))
   534	        )
   535	        chunks_by_id = {chunk.id: chunk for chunk in rows.scalars()}
   536	        ordered = [
   537	            chunks_by_id[chunk_id]
   538	            for chunk_id in chunk_ids
   539	            if chunk_id in chunks_by_id
   540	        ]
   541	        total = max(1, len(ordered))
   542	        return [
   543	            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
   544	            for idx, chunk in enumerate(ordered)
   545	        ]
   546	
   547	    async def get_collection_summary_context(
   548	        self,
   549	        db: AsyncSession,
   550	        document_ids: Sequence[uuid.UUID],
   551	        *,
   552	        max_chunks: int = DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS,
   553	        max_docs: int = DEFAULT_MAX_COLLECTION_SUMMARY_DOCS,
   554	    ) -> list[dict[str, Any]]:
   555	        selected_doc_ids = list(document_ids[:max_docs])
   556	        if not selected_doc_ids:
   557	            return []
   558	
   559	        per_doc_budget = max(1, max_chunks // len(selected_doc_ids))
   560	        contexts: list[dict[str, Any]] = []

exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '560,860p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   560	        contexts: list[dict[str, Any]] = []
   561	        for doc_id in selected_doc_ids:
   562	            contexts.extend(
   563	                await self.get_summary_context(
   564	                    db,
   565	                    doc_id,
   566	                    max_chunks=per_doc_budget,
   567	                )
   568	            )
   569	            if len(contexts) >= max_chunks:
   570	                break
   571	        return contexts[:max_chunks]
   572	
   573	    async def get_document_label(self, db: AsyncSession, document_id: uuid.UUID) -> str:
   574	        doc = await db.get(Document, document_id)
   575	        return doc.filename if doc else "document"
   576	
   577	
   578	document_brief_service = DocumentBriefService()

exec
/bin/zsh -lc "nl -ba backend/Dockerfile | sed -n '1,120p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/workers/parse_worker.py | sed -n '220,340p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	# syntax=docker/dockerfile:1
     2	# Pin to patch version for build reproducibility. Bump deliberately — major
     3	# or minor drift can change OpenSSL, sqlite3, or glibc under us.
     4	FROM python:3.12.7-slim
     5	
     6	ENV PYTHONDONTWRITEBYTECODE=1 \
     7	    PYTHONUNBUFFERED=1 \
     8	    PIP_NO_CACHE_DIR=1 \
     9	    PYTHONPATH=/app \
    10	    HOME=/home/app
    11	
    12	WORKDIR /app
    13	
    14	# System deps for PyMuPDF + LibreOffice headless (PPTX/DOCX→PDF conversion) + CJK fonts
    15	RUN apt-get update \
    16	    && apt-get install -y --no-install-recommends \
    17	       build-essential \
    18	       tesseract-ocr \
    19	       tesseract-ocr-eng \
    20	       tesseract-ocr-chi-sim \
    21	       tesseract-ocr-jpn \
    22	       tesseract-ocr-kor \
    23	       tesseract-ocr-spa \
    24	       tesseract-ocr-deu \
    25	       tesseract-ocr-fra \
    26	       tesseract-ocr-por \
    27	       tesseract-ocr-ita \
    28	       tesseract-ocr-ara \
    29	       tesseract-ocr-hin \
    30	       libreoffice-core \
    31	       libreoffice-impress \
    32	       libreoffice-writer \
    33	       fonts-liberation \
    34	       fonts-noto-cjk \
    35	       libpango-1.0-0 \
    36	       libpangocairo-1.0-0 \
    37	       libgdk-pixbuf-2.0-0 \
    38	    && rm -rf /var/lib/apt/lists/*
    39	
    40	# Install Python dependencies
    41	COPY backend/requirements.txt /tmp/requirements.txt
    42	RUN pip install -r /tmp/requirements.txt greenlet psycopg[binary] && rm /tmp/requirements.txt
    43	
    44	# Create non-root user with writable home (required by LibreOffice for user profile)
    45	RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --ingroup app --home /home/app app \
    46	    && mkdir -p /home/app && chown app:app /home/app
    47	
    48	# Copy backend code and entrypoint. `COPY backend/ /app/` already brings in
    49	# entrypoint.sh; a second explicit COPY of it was redundant and tripped a
    50	# buildkit cache-key checksum ("/backend/entrypoint.sh": not found) on the
    51	# Railway Metal builder, so it's removed. The chmod below still verifies the
    52	# file is present — the build fails loudly here if entrypoint.sh is ever missing.
    53	COPY version.json /app/version.json
    54	COPY backend/ /app/
    55	
    56	EXPOSE 8000
    57	
    58	# Entrypoint script with process supervision:
    59	# - Runs Alembic migrations
    60	# - Starts Celery worker with automatic restart on crash
    61	# - Starts uvicorn API server
    62	# - Forwards SIGTERM to both processes for graceful shutdown
    63	RUN chmod +x /app/entrypoint.sh && chown -R app:app /app
    64	
    65	USER app
    66	
    67	CMD ["/app/entrypoint.sh"]

 succeeded in 0ms:
   220	                            page_number=ep.page_number,
   221	                            width_pt=ep.width_pt or 612.0,
   222	                            height_pt=ep.height_pt or 792.0,
   223	                            rotation=0,
   224	                            blocks=blocks,
   225	                        )
   226	                    )
   227	            else:
   228	                # ---- PDF extraction path (existing logic) ----
   229	                try:
   230	                    pages = service.extract_pages(file_bytes)
   231	                except SoftTimeLimitExceeded:
   232	                    raise
   233	                except Exception as e:
   234	                    logger.exception("PyMuPDF extraction failed for %s: %s", document_id, e)
   235	                    _set_doc_error(doc, "PDF_PARSE_FAILED", "PDF parsing failed, file may be corrupted")
   236	                    db.add(doc)
   237	                    db.commit()
   238	                    return
   239	
   240	                doc.page_count = len(pages)
   241	                db.add(doc)
   242	                db.commit()
   243	
   244	                # Detect scanned PDFs — attempt OCR fallback
   245	                if service.detect_scanned(pages):
   246	                    if not settings.OCR_ENABLED:
   247	                        _set_doc_error(
   248	                            doc,
   249	                            "OCR_DISABLED",
   250	                            "This document is a scanned PDF without a text layer. OCR is disabled.",
   251	                        )
   252	                        db.add(doc)
   253	                        db.commit()
   254	                        logger.info("Document %s marked as scanned / error (OCR disabled)", document_id)
   255	                        return
   256	
   257	                    logger.info("Document %s appears scanned, attempting OCR", document_id)
   258	                    doc.status = "ocr"
   259	                    db.add(doc)
   260	                    db.commit()
   261	
   262	                    try:
   263	                        pages = service.extract_pages_ocr(
   264	                            file_bytes,
   265	                            languages=resolve_ocr_languages(),
   266	                            dpi=settings.OCR_DPI,
   267	                        )
   268	                    except SoftTimeLimitExceeded:
   269	                        raise
   270	                    except Exception as e:
   271	                        logger.exception("OCR extraction failed for %s: %s", document_id, e)
   272	                        _set_doc_error(doc, "OCR_FAILED", "OCR text recognition failed")
   273	                        db.add(doc)
   274	                        db.commit()
   275	                        return
   276	
   277	                    # Verify OCR produced enough text
   278	                    total_chars = sum(sum(len(b.text) for b in p.blocks) for p in pages)
   279	                    if total_chars < 50:
   280	                        _set_doc_error(doc, "OCR_INSUFFICIENT_TEXT", "OCR could not extract sufficient text")
   281	                        db.add(doc)
   282	                        db.commit()
   283	                        logger.info("Document %s: OCR produced only %d chars", document_id, total_chars)
   284	                        return
   285	
   286	                    logger.info("OCR succeeded for %s: %d chars extracted", document_id, total_chars)
   287	                    doc.status = "parsing"
   288	                    db.add(doc)
   289	                    db.commit()
   290	
   291	            # ---- Best-effort: convert PPTX/DOCX to PDF for visual rendering ----
   292	            if file_type in CONVERTIBLE_TYPES and not doc.converted_storage_key:
   293	                try:
   294	                    pdf_bytes = convert_to_pdf(file_bytes, file_type)
   295	                    converted_key = f"documents/{doc.id}/converted.pdf"
   296	                    from app.services.storage_service import storage_service as _storage
   297	
   298	                    _storage.upload_file(pdf_bytes, converted_key, content_type="application/pdf")
   299	                    doc.converted_storage_key = converted_key
   300	                    db.add(doc)
   301	                    db.commit()
   302	                    logger.info("Converted %s to PDF for %s (%d bytes)", file_type, document_id, len(pdf_bytes))
   303	                except SoftTimeLimitExceeded:
   304	                    raise
   305	                except Exception as e:
   306	                    logger.warning("PDF conversion failed for %s (non-blocking): %s", document_id, e)
   307	
   308	            # ---- Shared path: persist pages, chunk, and embed ----
   309	
   310	            # Persist pages and update progress every 10 pages
   311	            try:
   312	                for i, p in enumerate(pages, start=1):
   313	                    raw_content = extracted_content_map.get(p.page_number)
   314	                    db.add(
   315	                        Page(
   316	                            document_id=doc.id,
   317	                            page_number=p.page_number,
   318	                            width_pt=p.width_pt,
   319	                            height_pt=p.height_pt,
   320	                            rotation=p.rotation,
   321	                            content=raw_content.replace("\x00", "") if raw_content else raw_content,
   322	                        )
   323	                    )
   324	                    if (i % 10) == 0 or i == len(pages):
   325	                        doc.pages_parsed = i
   326	                        db.add(doc)
   327	                        db.commit()
   328	            except SoftTimeLimitExceeded:
   329	                raise
   330	            except Exception as e:
   331	                logger.exception("Failed to persist pages for %s: %s", document_id, e)
   332	                db.rollback()
   333	                doc = db.get(Document, uuid.UUID(document_id))
   334	                if doc:
   335	                    _set_doc_error(doc, "PERSIST_PAGES_FAILED", "Failed to save document pages to database")
   336	                    db.add(doc)
   337	                    db.commit()
   338	                return
   339	
   340	            # Persist canonical document elements (heading/paragraph stream).

exec
/bin/zsh -lc "nl -ba backend/app/services/parse_service.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from dataclasses import dataclass
     4	from statistics import median
     5	from typing import Any, List, Optional, Sequence, Tuple
     6	
     7	import fitz  # PyMuPDF
     8	
     9	# OCR language resolution (Phase 2 C4). Scanned / non-Latin PDFs need the matching
    10	# Tesseract traineddata; eng+chi_sim alone produced garbage for Urdu/Arabic
    11	# (U13/U40). The Dockerfile installs the packs for every code below.
    12	_LOCALE_TESSERACT = {
    13	    "en": "eng", "zh": "chi_sim", "ja": "jpn", "ko": "kor", "es": "spa",
    14	    "de": "deu", "fr": "fra", "pt": "por", "it": "ita", "ar": "ara", "hi": "hin",
    15	}
    16	_DEFAULT_OCR_LANGUAGES = "eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin"
    17	
    18	
    19	def resolve_ocr_languages(locale: str | None = None) -> str:
    20	    """Tesseract language string for OCR, covering all product locales.
    21	
    22	    Unions the configured OCR_LANGUAGES with the full locale set so a scanned
    23	    non-Latin document is never rejected for lack of a pack. When the document's
    24	    locale is known it is placed first for OCR accuracy.
    25	    """
    26	    codes: list[str] = []
    27	    try:
    28	        from app.core.config import settings
    29	        configured = (getattr(settings, "OCR_LANGUAGES", "") or "").split("+")
    30	    except Exception:
    31	        configured = []
    32	    for code in [*configured, *_DEFAULT_OCR_LANGUAGES.split("+")]:
    33	        code = code.strip()
    34	        if code and code not in codes:
    35	            codes.append(code)
    36	    if locale:
    37	        primary = _LOCALE_TESSERACT.get(locale.split("-")[0].split("_")[0].lower())
    38	        if primary:
    39	            codes = [primary] + [c for c in codes if c != primary]
    40	    return "+".join(codes)
    41	
    42	
    43	@dataclass
    44	class BlockInfo:
    45	    page: int
    46	    text: str
    47	    bbox: Tuple[float, float, float, float]  # x0, y0, x1, y1 in PDF points
    48	    font_size: float
    49	
    50	
    51	@dataclass
    52	class PageInfo:
    53	    page_number: int  # 1-based
    54	    width_pt: float
    55	    height_pt: float
    56	    rotation: int
    57	    blocks: List[BlockInfo]
    58	
    59	
    60	@dataclass
    61	class CleanBlock:
    62	    page: int
    63	    text: str
    64	    bbox: Tuple[float, float, float, float]
    65	    font_size: float
    66	
    67	
    68	@dataclass
    69	class ChunkInfo:
    70	    text: str
    71	    chunk_index: int
    72	    page_start: int
    73	    page_end: int
    74	    bboxes: List[dict]  # [{page, x, y, w, h}] normalized to [0,1]
    75	    section_title: Optional[str]
    76	    token_count: int
    77	
    78	
    79	@dataclass
    80	class ElementInfo:
    81	    element_type: str
    82	    page_start: int
    83	    page_end: int
    84	    bbox: dict[str, Any]
    85	    text: str
    86	    reading_order: int
    87	    metadata_json: dict[str, Any]
    88	
    89	
    90	class ParseService:
    91	    """Core PDF parsing, cleaning and chunking utilities.
    92	
    93	    This class is intentionally stateless across calls, except that some helper
    94	    methods compute global signals (e.g., header/footer texts) from a list of
    95	    pages to support per-page cleaning heuristics.
    96	    """
    97	
    98	    HEADER_FOOTER_REGION_RATIO = 0.10  # top/bottom 10%
    99	    HEADER_FOOTER_FREQ_THRESHOLD = 0.60  # appears in >60% pages
   100	
   101	    TARGET_MIN_TOKENS = 150
   102	    TARGET_MAX_TOKENS = 300
   103	    OVERLAP_TOKENS = 50
   104	
   105	    SENTENCE_DELIMS = "。！？；.!?"  # Chinese + English basic punctuation
   106	
   107	    # -------------------------- Public API --------------------------
   108	    def extract_pages(self, pdf_bytes: bytes) -> List[PageInfo]:
   109	        """Use PyMuPDF to extract all pages with text blocks and geometries.
   110	
   111	        Returns a list of PageInfo entries, one per page.
   112	        """
   113	        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
   114	        try:
   115	            pages: List[PageInfo] = []
   116	            for pi, page in enumerate(doc, start=1):
   117	                rect = page.rect
   118	                rotation = int(page.rotation or 0)
   119	                width_pt = float(rect.width)
   120	                height_pt = float(rect.height)
   121	
   122	                # Extract text as dictionary to access spans and sizes
   123	                page_dict = page.get_text("dict")
   124	                blocks: List[BlockInfo] = []
   125	                for blk in page_dict.get("blocks", []):
   126	                    if blk.get("type", 0) != 0:  # 0=text, 1=image, etc.
   127	                        continue
   128	                    lines = blk.get("lines", [])
   129	                    if not lines:
   130	                        continue
   131	
   132	                    # Emit one BlockInfo per line for precise bbox granularity
   133	                    for line_info in self._extract_line_blocks(pi, lines):
   134	                        blocks.append(line_info)
   135	
   136	                pages.append(
   137	                    PageInfo(
   138	                        page_number=pi,
   139	                        width_pt=width_pt,
   140	                        height_pt=height_pt,
   141	                        rotation=rotation,
   142	                        blocks=blocks,
   143	                    )
   144	                )
   145	
   146	            return pages
   147	        finally:
   148	            # Always close the PDF document to free resources
   149	            doc.close()
   150	
   151	    def extract_pages_ocr(
   152	        self, pdf_bytes: bytes, languages: str = "eng+chi_sim", dpi: int = 300
   153	    ) -> List[PageInfo]:
   154	        """Extract pages using Tesseract OCR via PyMuPDF.
   155	
   156	        Same interface as extract_pages() but uses OCR for scanned PDFs.
   157	        Requires Tesseract to be installed on the system.
   158	        """
   159	        import logging
   160	        logger = logging.getLogger(__name__)
   161	        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
   162	        try:
   163	            pages: List[PageInfo] = []
   164	            for pi, page in enumerate(doc, start=1):
   165	                try:
   166	                    rect = page.rect
   167	                    rotation = int(page.rotation or 0)
   168	                    width_pt = float(rect.width)
   169	                    height_pt = float(rect.height)
   170	
   171	                    # Cap rendered image size at 20MP to prevent Tesseract crashes
   172	                    page_w_px = width_pt * dpi / 72
   173	                    page_h_px = height_pt * dpi / 72
   174	                    max_pixels = 20_000_000
   175	                    if page_w_px * page_h_px > max_pixels:
   176	                        scale = (max_pixels / (page_w_px * page_h_px)) ** 0.5
   177	                        effective_dpi = max(72, int(dpi * scale))
   178	                        logger.info("Page %d too large (%.0fx%.0f px at %d DPI), reducing to %d DPI",
   179	                                    pi, page_w_px, page_h_px, dpi, effective_dpi)
   180	                    else:
   181	                        effective_dpi = dpi
   182	
   183	                    tp = page.get_textpage_ocr(language=languages, dpi=effective_dpi, full=True)
   184	                    page_dict = page.get_text("dict", textpage=tp)
   185	                    blocks: List[BlockInfo] = []
   186	                    for blk in page_dict.get("blocks", []):
   187	                        if blk.get("type", 0) != 0:
   188	                            continue
   189	                        lines = blk.get("lines", [])
   190	                        if not lines:
   191	                            continue
   192	                        for line_info in self._extract_line_blocks(pi, lines):
   193	                            blocks.append(line_info)
   194	
   195	                    pages.append(
   196	                        PageInfo(
   197	                            page_number=pi,
   198	                            width_pt=width_pt,
   199	                            height_pt=height_pt,
   200	                            rotation=rotation,
   201	                            blocks=blocks,
   202	                        )
   203	                    )
   204	                except Exception as e:
   205	                    logger.warning("OCR failed on page %d: %s", pi, e)
   206	                    # Skip this page but continue with the rest
   207	                    continue
   208	            return pages
   209	        finally:
   210	            doc.close()
   211	
   212	    def detect_scanned(self, pages: Sequence[PageInfo]) -> bool:
   213	        """Return True if the document appears to be scanned (no text layer).
   214	
   215	        Heuristic: if >70% of pages have text length <50 chars, mark as scanned.
   216	        """
   217	        if not pages:
   218	            return True
   219	        low_text_pages = 0
   220	        for p in pages:
   221	            total_len = sum(len(b.text) for b in p.blocks)
   222	            if total_len < 50:
   223	                low_text_pages += 1
   224	        return (low_text_pages / max(1, len(pages))) > 0.70
   225	
   226	    def clean_text_blocks(
   227	        self,
   228	        blocks: Sequence[BlockInfo],
   229	        page_width: float,
   230	        page_height: float,
   231	        header_texts: Optional[set[str]] = None,
   232	        footer_texts: Optional[set[str]] = None,
   233	    ) -> List[CleanBlock]:
   234	        """Remove common header/footer texts and fix hyphenations.
   235	
   236	        - Removes any block whose text matches a commonly repeated header/footer
   237	          phrase that appears in the top/bottom 10% region across >60% pages.
   238	        - Returns cleaned blocks with basic normalization.
   239	        """
   240	        header_texts = header_texts or set()
   241	        footer_texts = footer_texts or set()
   242	        top_cutoff = page_height * self.HEADER_FOOTER_REGION_RATIO
   243	        bottom_cutoff = page_height * (1.0 - self.HEADER_FOOTER_REGION_RATIO)
   244	
   245	        cleaned: List[CleanBlock] = []
   246	        for b in blocks:
   247	            x0, y0, x1, y1 = b.bbox
   248	            is_top = y0 <= top_cutoff
   249	            is_bottom = y1 >= bottom_cutoff
   250	            text_norm = self._normalize_inline_text(b.text)
   251	
   252	            if is_top and text_norm in header_texts:
   253	                continue
   254	            if is_bottom and text_norm in footer_texts:
   255	                continue
   256	
   257	            cleaned.append(CleanBlock(page=b.page, text=text_norm, bbox=b.bbox, font_size=b.font_size))
   258	
   259	        return cleaned
   260	

exec
/bin/zsh -lc "nl -ba .collab/reviews/2026-05-24-phase2-diff.patch | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	diff --git a/backend/Dockerfile b/backend/Dockerfile
     2	index 2aee1c8..7abade9 100644
     3	--- a/backend/Dockerfile
     4	+++ b/backend/Dockerfile
     5	@@ -18,6 +18,15 @@ RUN apt-get update \
     6	        tesseract-ocr \
     7	        tesseract-ocr-eng \
     8	        tesseract-ocr-chi-sim \
     9	+       tesseract-ocr-jpn \
    10	+       tesseract-ocr-kor \
    11	+       tesseract-ocr-spa \
    12	+       tesseract-ocr-deu \
    13	+       tesseract-ocr-fra \
    14	+       tesseract-ocr-por \
    15	+       tesseract-ocr-ita \
    16	+       tesseract-ocr-ara \
    17	+       tesseract-ocr-hin \
    18	        libreoffice-core \
    19	        libreoffice-impress \
    20	        libreoffice-writer \
    21	diff --git a/backend/app/services/document_brief_service.py b/backend/app/services/document_brief_service.py
    22	index 90a39bf..ceef22d 100644
    23	--- a/backend/app/services/document_brief_service.py
    24	+++ b/backend/app/services/document_brief_service.py
    25	@@ -1,8 +1,10 @@
    26	 from __future__ import annotations
    27	 
    28	+import asyncio
    29	 import math
    30	 import uuid
    31	-from typing import Any, Sequence
    32	+from dataclasses import dataclass
    33	+from typing import Any, Protocol, Sequence
    34	 
    35	 from sqlalchemy import select
    36	 from sqlalchemy.ext.asyncio import AsyncSession
    37	@@ -17,12 +19,311 @@ MIN_SUMMARY_CHUNK_CHARS = 80
    38	 DEFAULT_MAX_SUMMARY_CHUNKS = 18
    39	 DEFAULT_MAX_COLLECTION_SUMMARY_CHUNKS = 24
    40	 DEFAULT_MAX_COLLECTION_SUMMARY_DOCS = 8
    41	+DEFAULT_MAP_REDUCE_MIN_CHUNKS = 36
    42	+
    43	+
    44	+@dataclass(frozen=True)
    45	+class SectionMapGroup:
    46	+    group_index: int
    47	+    chunks: tuple[Any, ...]
    48	+    section_titles: tuple[str, ...]
    49	+
    50	+
    51	+@dataclass(frozen=True)
    52	+class MapStepResult:
    53	+    group_index: int
    54	+    summary: str
    55	+    selected_chunk_ids: tuple[uuid.UUID, ...]
    56	+    covered_sections: tuple[str, ...]
    57	+
    58	+
    59	+class MapStep(Protocol):
    60	+    async def __call__(self, group: SectionMapGroup) -> MapStepResult: ...
    61	+
    62	+
    63	+class ReduceStep(Protocol):
    64	+    async def __call__(
    65	+        self,
    66	+        mapped: list[MapStepResult],
    67	+        *,
    68	+        max_total_chunks: int,
    69	+    ) -> list[uuid.UUID]: ...
    70	 
    71	 
    72	 def _chunk_text_length(chunk: Any) -> int:
    73	     return len((getattr(chunk, "text", "") or "").strip())
    74	 
    75	 
    76	+def _chunk_section_title(chunk: Any) -> str:
    77	+    section = str(getattr(chunk, "section_title", "") or "").strip()
    78	+    if section:
    79	+        return section[:200]
    80	+    page = getattr(chunk, "page_start", None)
    81	+    if isinstance(page, int):
    82	+        return f"Page {page}"
    83	+    return "Untitled"
    84	+
    85	+
    86	+def _dynamic_section_group_count(
    87	+    chunks_total: int,
    88	+    *,
    89	+    min_groups: int = 2,
    90	+    max_groups: int = 18,
    91	+    target_chunks_per_group: int = 12,
    92	+) -> int:
    93	+    total = max(0, int(chunks_total or 0))
    94	+    if total <= 0:
    95	+        return min_groups
    96	+    groups = math.ceil(total / max(1, target_chunks_per_group))
    97	+    return max(min_groups, min(max_groups, groups))
    98	+
    99	+
   100	+def _dynamic_summary_chunk_budget(
   101	+    base_max_chunks: int,
   102	+    *,
   103	+    chunks_total: int,
   104	+    section_total: int,
   105	+    max_total_chunks_cap: int,
   106	+) -> int:
   107	+    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
   108	+    budget = max(floor, min(max_total_chunks_cap, floor + (max(0, chunks_total) // 24)))
   109	+    if section_total > 0:
   110	+        budget = max(budget, min(max_total_chunks_cap, section_total))
   111	+    return min(max_total_chunks_cap, max(1, budget))
   112	+
   113	+
   114	+def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
   115	+    segments: list[tuple[str, list[Any]]] = []
   116	+    current_title: str | None = None
   117	+    current_items: list[Any] = []
   118	+
   119	+    for chunk in chunks:
   120	+        title = _chunk_section_title(chunk)
   121	+        if current_title is None:
   122	+            current_title = title
   123	+            current_items = [chunk]
   124	+            continue
   125	+        if title == current_title:
   126	+            current_items.append(chunk)
   127	+            continue
   128	+        segments.append((current_title, current_items))
   129	+        current_title = title
   130	+        current_items = [chunk]
   131	+
   132	+    if current_title is not None and current_items:
   133	+        segments.append((current_title, current_items))
   134	+    return segments
   135	+
   136	+
   137	+def _group_segments(
   138	+    segments: Sequence[tuple[str, list[Any]]],
   139	+    *,
   140	+    target_groups: int,
   141	+) -> list[SectionMapGroup]:
   142	+    if not segments:
   143	+        return []
   144	+    if target_groups <= 0:
   145	+        target_groups = 1
   146	+    target_groups = min(target_groups, len(segments))
   147	+    grouped: list[list[tuple[str, list[Any]]]] = [[] for _ in range(target_groups)]
   148	+    total = len(segments)
   149	+    for idx, segment in enumerate(segments):
   150	+        group_index = min(target_groups - 1, (idx * target_groups) // total)
   151	+        grouped[group_index].append(segment)
   152	+
   153	+    result: list[SectionMapGroup] = []
   154	+    for group_index, raw_segments in enumerate(grouped):
   155	+        if not raw_segments:
   156	+            continue
   157	+        section_titles: list[str] = []
   158	+        chunks: list[Any] = []
   159	+        for title, seg_chunks in raw_segments:
   160	+            section_titles.append(title)
   161	+            chunks.extend(seg_chunks)
   162	+        result.append(
   163	+            SectionMapGroup(
   164	+                group_index=group_index,
   165	+                chunks=tuple(chunks),
   166	+                section_titles=tuple(section_titles),
   167	+            )
   168	+        )
   169	+    return result
   170	+
   171	+
   172	+class SectionMapReducePlanner:
   173	+    def __init__(
   174	+        self,
   175	+        *,
   176	+        map_step: MapStep | None = None,
   177	+        reduce_step: ReduceStep | None = None,
   178	+        min_groups: int = 2,
   179	+        max_groups: int = 18,
   180	+        max_group_chunks: int = 6,
   181	+        max_total_chunks_cap: int = 64,
   182	+        max_concurrency: int = 4,
   183	+    ) -> None:
   184	+        self._map_step = map_step
   185	+        self._reduce_step = reduce_step
   186	+        self._min_groups = max(1, int(min_groups))
   187	+        self._max_groups = max(self._min_groups, int(max_groups))
   188	+        self._max_group_chunks = max(1, int(max_group_chunks))
   189	+        self._max_total_chunks_cap = max(1, int(max_total_chunks_cap))
   190	+        self._max_concurrency = max(1, int(max_concurrency))
   191	+
   192	+    def _truncate_group_chunks(self, group: SectionMapGroup) -> SectionMapGroup:
   193	+        """Cap per-group map context while preserving at least one chunk/section."""
   194	+        section_anchor_set: set[uuid.UUID] = set()
   195	+        selected: list[Any] = []
   196	+        seen_sections: set[str] = set()
   197	+        for chunk in group.chunks:
   198	+            section = _chunk_section_title(chunk)
   199	+            if section in seen_sections:
   200	+                continue
   201	+            seen_sections.add(section)
   202	+            selected.append(chunk)
   203	+            section_anchor_set.add(chunk.id)
   204	+
   205	+        # Fill extra room with evenly spaced body chunks for long sections.
   206	+        if len(selected) < self._max_group_chunks and len(group.chunks) > len(selected):
   207	+            remaining = [
   208	+                chunk
   209	+                for chunk in group.chunks
   210	+                if chunk.id not in section_anchor_set
   211	+            ]
   212	+            budget = self._max_group_chunks - len(selected)
   213	+            if remaining and budget > 0:
   214	+                if len(remaining) <= budget:
   215	+                    selected.extend(remaining)
   216	+                elif budget == 1:
   217	+                    selected.append(remaining[len(remaining) // 2])
   218	+                else:
   219	+                    for slot in range(budget):
   220	+                        selected.append(
   221	+                            remaining[round(slot * (len(remaining) - 1) / (budget - 1))]
   222	+                        )
   223	+
   224	+        if not selected:
   225	+            return group
   226	+
   227	+        # Keep map payload ordered by chunk index.
   228	+        selected.sort(key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   229	+        return SectionMapGroup(
   230	+            group_index=group.group_index,
   231	+            chunks=tuple(selected),
   232	+            section_titles=group.section_titles,
   233	+        )
   234	+
   235	+    async def _default_map_step(self, group: SectionMapGroup) -> MapStepResult:
   236	+        selected_ids: list[uuid.UUID] = []
   237	+        covered_sections: list[str] = []
   238	+        seen_sections: set[str] = set()
   239	+
   240	+        for chunk in group.chunks:
   241	+            section = _chunk_section_title(chunk)
   242	+            if section in seen_sections:
   243	+                continue
   244	+            seen_sections.add(section)
   245	+            covered_sections.append(section)
   246	+            selected_ids.append(chunk.id)
   247	+
   248	+        if not selected_ids and group.chunks:
   249	+            selected_ids.append(group.chunks[0].id)
   250	+            covered_sections.append(_chunk_section_title(group.chunks[0]))
   251	+
   252	+        summary = f"Group {group.group_index} covers {len(covered_sections)} sections."
   253	+        return MapStepResult(
   254	+            group_index=group.group_index,
   255	+            summary=summary,
   256	+            selected_chunk_ids=tuple(selected_ids),
   257	+            covered_sections=tuple(covered_sections),
   258	+        )
   259	+
   260	+    async def _default_reduce_step(

exec
/bin/zsh -lc "nl -ba .collab/reviews/2026-05-24-phase2-diff.patch | sed -n '260,520p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   260	+    async def _default_reduce_step(
   261	+        self,
   262	+        mapped: list[MapStepResult],
   263	+        *,
   264	+        max_total_chunks: int,
   265	+    ) -> list[uuid.UUID]:
   266	+        ordered: list[uuid.UUID] = []
   267	+        seen: set[uuid.UUID] = set()
   268	+        for item in sorted(mapped, key=lambda value: value.group_index):
   269	+            for chunk_id in item.selected_chunk_ids:
   270	+                if chunk_id in seen:
   271	+                    continue
   272	+                seen.add(chunk_id)
   273	+                ordered.append(chunk_id)
   274	+                if len(ordered) >= max_total_chunks:
   275	+                    return ordered
   276	+        return ordered[:max_total_chunks]
   277	+
   278	+    async def _run_map_step(self, group: SectionMapGroup, semaphore: asyncio.Semaphore) -> MapStepResult:
   279	+        async with semaphore:
   280	+            step = self._map_step or self._default_map_step
   281	+            return await step(group)
   282	+
   283	+    async def select_chunks_for_summary(
   284	+        self,
   285	+        chunks: Sequence[Any],
   286	+        *,
   287	+        max_chunks: int,
   288	+    ) -> list[Any]:
   289	+        ordered_chunks = sorted(chunks, key=lambda chunk: int(getattr(chunk, "chunk_index", 0) or 0))
   290	+        if not ordered_chunks:
   291	+            return []
   292	+
   293	+        segments = _section_segments(ordered_chunks)
   294	+        if not segments:
   295	+            return list(ordered_chunks[:max_chunks])
   296	+
   297	+        section_total = len(segments)
   298	+        desired_groups = _dynamic_section_group_count(
   299	+            len(ordered_chunks),
   300	+            min_groups=self._min_groups,
   301	+            max_groups=self._max_groups,
   302	+        )
   303	+        section_bound_groups = math.ceil(section_total / max(1, self._max_group_chunks))
   304	+        target_groups = min(self._max_groups, max(desired_groups, section_bound_groups))
   305	+        target_groups = max(self._min_groups, min(target_groups, section_total))
   306	+
   307	+        groups = _group_segments(segments, target_groups=target_groups)
   308	+        prepared_groups = [self._truncate_group_chunks(group) for group in groups]
   309	+        if not prepared_groups:
   310	+            return list(ordered_chunks[:max_chunks])
   311	+
   312	+        max_total_chunks = _dynamic_summary_chunk_budget(
   313	+            max_chunks,
   314	+            chunks_total=len(ordered_chunks),
   315	+            section_total=section_total,
   316	+            max_total_chunks_cap=self._max_total_chunks_cap,
   317	+        )
   318	+
   319	+        semaphore = asyncio.Semaphore(self._max_concurrency)
   320	+        mapped = await asyncio.gather(
   321	+            *(self._run_map_step(group, semaphore) for group in prepared_groups)
   322	+        )
   323	+        reduce_step = self._reduce_step or self._default_reduce_step
   324	+        selected_ids = await reduce_step(mapped, max_total_chunks=max_total_chunks)
   325	+
   326	+        if not selected_ids:
   327	+            selected_ids = [
   328	+                group.chunks[0].id
   329	+                for group in prepared_groups
   330	+                if group.chunks
   331	+            ][:max_total_chunks]
   332	+
   333	+        chunk_by_id = {chunk.id: chunk for chunk in ordered_chunks}
   334	+        selected: list[Any] = []
   335	+        seen: set[uuid.UUID] = set()
   336	+        for chunk_id in selected_ids:
   337	+            chunk = chunk_by_id.get(chunk_id)
   338	+            if chunk is None or chunk.id in seen:
   339	+                continue
   340	+            seen.add(chunk.id)
   341	+            selected.append(chunk)
   342	+
   343	+        return selected
   344	+
   345	+
   346	 def _select_representative_chunks(
   347	     chunks: Sequence[Any],
   348	     *,
   349	@@ -108,6 +409,34 @@ def _chunk_to_retrieval_item(chunk: Chunk, score: float) -> dict[str, Any]:
   350	 
   351	 
   352	 class DocumentBriefService:
   353	+    def __init__(
   354	+        self,
   355	+        *,
   356	+        section_map_reduce: SectionMapReducePlanner | None = None,
   357	+        map_reduce_min_chunks: int = DEFAULT_MAP_REDUCE_MIN_CHUNKS,
   358	+    ) -> None:
   359	+        self._section_map_reduce = section_map_reduce or SectionMapReducePlanner()
   360	+        self._map_reduce_min_chunks = max(1, int(map_reduce_min_chunks))
   361	+
   362	+    def _should_use_map_reduce(
   363	+        self,
   364	+        chunks: Sequence[Any],
   365	+        *,
   366	+        max_chunks: int,
   367	+        element_chunks_count: int,
   368	+    ) -> bool:
   369	+        if max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
   370	+            # Collection summary allocates a narrow per-document budget.
   371	+            return False
   372	+        if len(chunks) < self._map_reduce_min_chunks:
   373	+            return False
   374	+        if len(chunks) <= max_chunks:
   375	+            return False
   376	+        if element_chunks_count >= max_chunks:
   377	+            return True
   378	+        # No reliable element coverage: still promote large docs to section map-reduce.
   379	+        return len(chunks) >= max(max_chunks * 2, self._map_reduce_min_chunks)
   380	+
   381	     async def get_summary_context(
   382	         self,
   383	         db: AsyncSession,
   384	@@ -128,7 +457,7 @@ class DocumentBriefService:
   385	             document_id,
   386	             max_chunks=max_chunks,
   387	         )
   388	-        if element_chunks:
   389	+        if element_chunks and len(element_chunks) < max_chunks:
   390	             return [
   391	                 chunk_to_retrieval_item(chunk, score, include_document_id=True)
   392	                 for chunk, score in element_chunks
   393	@@ -140,6 +469,31 @@ class DocumentBriefService:
   394	             .order_by(Chunk.chunk_index)
   395	         )
   396	         chunks = list(rows.scalars())
   397	+        if self._should_use_map_reduce(
   398	+            chunks,
   399	+            max_chunks=max_chunks,
   400	+            element_chunks_count=len(element_chunks),
   401	+        ):
   402	+            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
   403	+                chunks,
   404	+                max_chunks=max_chunks,
   405	+            )
   406	+            if selected_map_reduce:
   407	+                total = max(1, len(selected_map_reduce))
   408	+                return [
   409	+                    _chunk_to_retrieval_item(
   410	+                        chunk,
   411	+                        1.0 - (idx / (total + 1)) * 0.2,
   412	+                    )
   413	+                    for idx, chunk in enumerate(selected_map_reduce)
   414	+                ]
   415	+
   416	+        if element_chunks:
   417	+            return [
   418	+                chunk_to_retrieval_item(chunk, score, include_document_id=True)
   419	+                for chunk, score in element_chunks
   420	+            ]
   421	+
   422	         selected = _select_representative_chunks(chunks, max_chunks=max_chunks)
   423	         total = max(1, len(selected))
   424	         return [
   425	diff --git a/backend/app/services/parse_service.py b/backend/app/services/parse_service.py
   426	index d70ee48..d532be1 100644
   427	--- a/backend/app/services/parse_service.py
   428	+++ b/backend/app/services/parse_service.py
   429	@@ -6,6 +6,39 @@ from typing import Any, List, Optional, Sequence, Tuple
   430	 
   431	 import fitz  # PyMuPDF
   432	 
   433	+# OCR language resolution (Phase 2 C4). Scanned / non-Latin PDFs need the matching
   434	+# Tesseract traineddata; eng+chi_sim alone produced garbage for Urdu/Arabic
   435	+# (U13/U40). The Dockerfile installs the packs for every code below.
   436	+_LOCALE_TESSERACT = {
   437	+    "en": "eng", "zh": "chi_sim", "ja": "jpn", "ko": "kor", "es": "spa",
   438	+    "de": "deu", "fr": "fra", "pt": "por", "it": "ita", "ar": "ara", "hi": "hin",
   439	+}
   440	+_DEFAULT_OCR_LANGUAGES = "eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin"
   441	+
   442	+
   443	+def resolve_ocr_languages(locale: str | None = None) -> str:
   444	+    """Tesseract language string for OCR, covering all product locales.
   445	+
   446	+    Unions the configured OCR_LANGUAGES with the full locale set so a scanned
   447	+    non-Latin document is never rejected for lack of a pack. When the document's
   448	+    locale is known it is placed first for OCR accuracy.
   449	+    """
   450	+    codes: list[str] = []
   451	+    try:
   452	+        from app.core.config import settings
   453	+        configured = (getattr(settings, "OCR_LANGUAGES", "") or "").split("+")
   454	+    except Exception:
   455	+        configured = []
   456	+    for code in [*configured, *_DEFAULT_OCR_LANGUAGES.split("+")]:
   457	+        code = code.strip()
   458	+        if code and code not in codes:
   459	+            codes.append(code)
   460	+    if locale:
   461	+        primary = _LOCALE_TESSERACT.get(locale.split("-")[0].split("_")[0].lower())
   462	+        if primary:
   463	+            codes = [primary] + [c for c in codes if c != primary]
   464	+    return "+".join(codes)
   465	+
   466	 
   467	 @dataclass
   468	 class BlockInfo:
   469	diff --git a/backend/app/workers/parse_worker.py b/backend/app/workers/parse_worker.py
   470	index 296175b..0c9d3e3 100644
   471	--- a/backend/app/workers/parse_worker.py
   472	+++ b/backend/app/workers/parse_worker.py
   473	@@ -15,7 +15,7 @@ from app.models.sync_database import SyncSessionLocal
   474	 from app.models.tables import Chunk, Document, DocumentBrief, DocumentElement, Page
   475	 from app.services.conversion_service import CONVERTIBLE_TYPES, convert_to_pdf
   476	 from app.services.embedding_service import embedding_service
   477	-from app.services.parse_service import ParseService
   478	+from app.services.parse_service import ParseService, resolve_ocr_languages
   479	 
   480	 from .celery_app import celery_app
   481	 
   482	@@ -262,7 +262,7 @@ def parse_document(self, document_id: str) -> None:
   483	                     try:
   484	                         pages = service.extract_pages_ocr(
   485	                             file_bytes,
   486	-                            languages=settings.OCR_LANGUAGES,
   487	+                            languages=resolve_ocr_languages(),
   488	                             dpi=settings.OCR_DPI,
   489	                         )
   490	                     except SoftTimeLimitExceeded:

codex
我在 patch 里确认了两个关键点：`get_summary_context` 只在 `max_chunks>=18` 且满足门槛时启用 map-reduce；OCR 现在是 `resolve_ocr_languages()` 但 parse worker 没传文档 locale。接下来我会读测试和 chat 调用链，验证这些行为是否被覆盖或遗漏。
exec
/bin/zsh -lc "nl -ba backend/tests/test_document_brief_service.py | sed -n '1,420p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from types import SimpleNamespace
     5	from unittest.mock import AsyncMock
     6	
     7	import pytest
     8	
     9	from app.services.document_brief_service import (
    10	    DocumentBriefService,
    11	    MapStepResult,
    12	    SectionMapGroup,
    13	    SectionMapReducePlanner,
    14	    _dynamic_section_group_count,
    15	    _select_representative_chunks,
    16	)
    17	
    18	
    19	class _ScalarOneOrNoneResult:
    20	    def __init__(self, value):
    21	        self._value = value
    22	
    23	    def scalar_one_or_none(self):
    24	        return self._value
    25	
    26	
    27	class _ScalarsResult:
    28	    def __init__(self, values):
    29	        self._values = values
    30	
    31	    def scalars(self):
    32	        return self._values
    33	
    34	
    35	def _chunk(index: int, *, section: str | None = None, text: str | None = None):
    36	    return SimpleNamespace(
    37	        id=uuid.uuid4(),
    38	        document_id=uuid.uuid4(),
    39	        chunk_index=index,
    40	        text=text or f"Chunk {index} " + ("important document content " * 8),
    41	        section_title=section,
    42	        page_start=index + 1,
    43	        page_end=index + 1,
    44	        bboxes=[],
    45	    )
    46	
    47	
    48	def test_representative_selection_covers_front_middle_and_tail() -> None:
    49	    chunks = [_chunk(i, section=f"Section {i // 5}") for i in range(30)]
    50	
    51	    selected = _select_representative_chunks(chunks, max_chunks=10)
    52	    selected_indices = [item.chunk_index for item in selected]
    53	
    54	    assert 0 in selected_indices
    55	    assert 1 in selected_indices
    56	    assert any(10 <= idx <= 20 for idx in selected_indices)
    57	    assert 28 in selected_indices
    58	    assert 29 in selected_indices
    59	    assert selected_indices == sorted(selected_indices)
    60	    assert len(selected_indices) <= 10
    61	
    62	
    63	def test_representative_selection_skips_tiny_sidebar_chunks() -> None:
    64	    chunks = [
    65	        _chunk(0, text="p.1"),
    66	        _chunk(1, text="short"),
    67	        _chunk(2, text="Main narrative " * 20),
    68	        _chunk(3, text="Conclusion narrative " * 20),
    69	    ]
    70	
    71	    selected = _select_representative_chunks(chunks, max_chunks=4)
    72	
    73	    assert [item.chunk_index for item in selected] == [2, 3]
    74	
    75	
    76	def test_representative_selection_falls_back_for_short_documents() -> None:
    77	    chunks = [
    78	        _chunk(0, text="Short memo."),
    79	        _chunk(1, text="Tiny appendix."),
    80	    ]
    81	
    82	    selected = _select_representative_chunks(chunks, max_chunks=4)
    83	
    84	    assert [item.chunk_index for item in selected] == [0, 1]
    85	
    86	
    87	def test_representative_selection_keeps_all_small_documents() -> None:
    88	    chunks = [_chunk(i) for i in range(4)]
    89	
    90	    selected = _select_representative_chunks(chunks, max_chunks=10)
    91	
    92	    assert [item.chunk_index for item in selected] == [0, 1, 2, 3]
    93	
    94	
    95	@pytest.mark.asyncio
    96	async def test_collection_summary_context_caps_docs_and_chunks(
    97	    monkeypatch: pytest.MonkeyPatch,
    98	) -> None:
    99	    service = DocumentBriefService()
   100	    doc_ids = [uuid.uuid4() for _ in range(10)]
   101	    calls: list[tuple[uuid.UUID, int]] = []
   102	
   103	    async def fake_context(_db, document_id, *, max_chunks):
   104	        calls.append((document_id, max_chunks))
   105	        return [
   106	            {"chunk_id": uuid.uuid4(), "document_id": document_id, "text": f"{document_id}:{idx}"}
   107	            for idx in range(max_chunks)
   108	        ]
   109	
   110	    monkeypatch.setattr(service, "get_summary_context", AsyncMock(side_effect=fake_context))
   111	
   112	    contexts = await service.get_collection_summary_context(
   113	        SimpleNamespace(),
   114	        doc_ids,
   115	        max_chunks=12,
   116	        max_docs=4,
   117	    )
   118	
   119	    assert [doc_id for doc_id, _budget in calls] == doc_ids[:4]
   120	    assert all(budget == 3 for _doc_id, budget in calls)
   121	    assert len(contexts) == 12
   122	
   123	
   124	@pytest.mark.asyncio
   125	async def test_summary_context_prefers_persisted_coverage_order() -> None:
   126	    document_id = uuid.uuid4()
   127	    first = _chunk(0)
   128	    second = _chunk(1)
   129	    first.document_id = document_id
   130	    second.document_id = document_id
   131	    db = SimpleNamespace(
   132	        execute=AsyncMock(
   133	            side_effect=[
   134	                _ScalarOneOrNoneResult(
   135	                    {"selected_chunk_ids": [str(second.id), str(uuid.uuid4()), str(first.id)]}
   136	                ),
   137	                _ScalarsResult([first, second]),
   138	            ]
   139	        )
   140	    )
   141	
   142	    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
   143	
   144	    assert [item["chunk_id"] for item in contexts] == [second.id, first.id]
   145	
   146	
   147	@pytest.mark.asyncio
   148	async def test_summary_context_falls_back_when_persisted_coverage_is_stale() -> None:
   149	    document_id = uuid.uuid4()
   150	    chunks = [_chunk(i) for i in range(3)]
   151	    for chunk in chunks:
   152	        chunk.document_id = document_id
   153	    db = SimpleNamespace(
   154	        execute=AsyncMock(
   155	            side_effect=[
   156	                _ScalarOneOrNoneResult({"selected_chunk_ids": [str(uuid.uuid4())]}),
   157	                _ScalarsResult([]),
   158	                _ScalarsResult([]),
   159	                _ScalarsResult(chunks),
   160	            ]
   161	        )
   162	    )
   163	
   164	    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=8)
   165	
   166	    assert [item["chunk_id"] for item in contexts] == [chunk.id for chunk in chunks]
   167	
   168	
   169	@pytest.mark.asyncio
   170	async def test_summary_context_uses_document_elements_before_chunk_fallback() -> None:
   171	    document_id = uuid.uuid4()
   172	    first = _chunk(0, text="Intro narrative " * 20)
   173	    table_page = _chunk(1, text="Target price table context " * 20)
   174	    first.document_id = document_id
   175	    table_page.document_id = document_id
   176	    table_page.page_start = 7
   177	    table_page.page_end = 7
   178	    element = SimpleNamespace(
   179	        element_type="table",
   180	        page_start=7,
   181	        page_end=7,
   182	        reading_order=70_000,
   183	        text="Table page 7\nCompany | Rating | Target price",
   184	    )
   185	    db = SimpleNamespace(
   186	        execute=AsyncMock(
   187	            side_effect=[
   188	                _ScalarOneOrNoneResult(None),
   189	                _ScalarsResult([element]),
   190	                _ScalarsResult([first, table_page]),
   191	            ]
   192	        )
   193	    )
   194	
   195	    contexts = await DocumentBriefService().get_summary_context(db, document_id, max_chunks=4)
   196	
   197	    assert contexts[0]["chunk_id"] == table_page.id
   198	
   199	
   200	@pytest.mark.asyncio
   201	async def test_section_map_reduce_covers_all_sections_with_stubbed_llm() -> None:
   202	    section_count = 26
   203	    chunks = [
   204	        _chunk(index, section=f"Chapter {index}", text=(f"Section {index} narrative " * 20))
   205	        for index in range(section_count)
   206	    ]
   207	    expected_sections = {chunk.section_title for chunk in chunks}
   208	
   209	    sampled = _select_representative_chunks(chunks, max_chunks=18)
   210	    sampled_sections = {chunk.section_title for chunk in sampled}
   211	    assert sampled_sections != expected_sections
   212	
   213	    async def fake_map(group: SectionMapGroup) -> MapStepResult:
   214	        selected_ids: list[uuid.UUID] = []
   215	        covered_sections: list[str] = []
   216	        seen_sections: set[str] = set()
   217	        for chunk in group.chunks:
   218	            section = (chunk.section_title or "").strip()
   219	            if not section or section in seen_sections:
   220	                continue
   221	            seen_sections.add(section)
   222	            covered_sections.append(section)
   223	            selected_ids.append(chunk.id)
   224	        return MapStepResult(
   225	            group_index=group.group_index,
   226	            summary=f"covers {len(covered_sections)} sections",
   227	            selected_chunk_ids=tuple(selected_ids),
   228	            covered_sections=tuple(covered_sections),
   229	        )
   230	
   231	    async def fake_reduce(
   232	        mapped: list[MapStepResult],
   233	        *,
   234	        max_total_chunks: int,
   235	    ) -> list[uuid.UUID]:
   236	        ordered: list[uuid.UUID] = []
   237	        seen: set[uuid.UUID] = set()
   238	        for item in mapped:
   239	            for chunk_id in item.selected_chunk_ids:
   240	                if chunk_id in seen:
   241	                    continue
   242	                seen.add(chunk_id)
   243	                ordered.append(chunk_id)
   244	        return ordered[:max_total_chunks]
   245	
   246	    planner = SectionMapReducePlanner(
   247	        map_step=fake_map,
   248	        reduce_step=fake_reduce,
   249	        max_total_chunks_cap=64,
   250	        max_group_chunks=6,
   251	        max_groups=18,
   252	    )
   253	    selected = await planner.select_chunks_for_summary(chunks, max_chunks=18)
   254	    selected_sections = {chunk.section_title for chunk in selected}
   255	
   256	    assert selected_sections == expected_sections
   257	
   258	
   259	def test_dynamic_section_group_count_scales_with_document_size() -> None:
   260	    small = _dynamic_section_group_count(24)
   261	    medium = _dynamic_section_group_count(240)
   262	    huge = _dynamic_section_group_count(2400)
   263	
   264	    assert small >= 2
   265	    assert medium > small
   266	    assert huge >= medium
   267	
   268	
   269	@pytest.mark.asyncio
   270	async def test_large_document_summary_context_uses_section_map_reduce() -> None:
   271	    document_id = uuid.uuid4()
   272	    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
   273	    for chunk in chunks:
   274	        chunk.document_id = document_id
   275	
   276	    map_reduce_selected = chunks[:30]
   277	    planner = SectionMapReducePlanner()
   278	    planner.select_chunks_for_summary = AsyncMock(return_value=map_reduce_selected)
   279	    service = DocumentBriefService(
   280	        section_map_reduce=planner,
   281	        map_reduce_min_chunks=36,
   282	    )
   283	    db = SimpleNamespace(
   284	        execute=AsyncMock(
   285	            side_effect=[
   286	                _ScalarOneOrNoneResult(None),
   287	                _ScalarsResult([]),
   288	                _ScalarsResult(chunks),
   289	            ]
   290	        )
   291	    )
   292	
   293	    contexts = await service.get_summary_context(db, document_id, max_chunks=18)
   294	
   295	    planner.select_chunks_for_summary.assert_awaited_once_with(chunks, max_chunks=18)
   296	    assert len(contexts) == 30
   297	
   298	
   299	@pytest.mark.asyncio
   300	async def test_small_per_doc_budget_skips_map_reduce_for_collection_path() -> None:
   301	    document_id = uuid.uuid4()
   302	    chunks = [_chunk(i, section=f"Chapter {i}", text=("Long narrative " * 25)) for i in range(50)]
   303	    for chunk in chunks:
   304	        chunk.document_id = document_id
   305	
   306	    planner = SectionMapReducePlanner()
   307	    planner.select_chunks_for_summary = AsyncMock(return_value=chunks[:20])
   308	    service = DocumentBriefService(
   309	        section_map_reduce=planner,
   310	        map_reduce_min_chunks=36,
   311	    )
   312	    db = SimpleNamespace(
   313	        execute=AsyncMock(
   314	            side_effect=[
   315	                _ScalarOneOrNoneResult(None),
   316	                _ScalarsResult([]),
   317	                _ScalarsResult(chunks),
   318	            ]
   319	        )
   320	    )
   321	
   322	    contexts = await service.get_summary_context(db, document_id, max_chunks=3)
   323	
   324	    planner.select_chunks_for_summary.assert_not_awaited()
   325	    assert len(contexts) == 3

exec
/bin/zsh -lc "nl -ba backend/tests/test_ocr_languages_baseline.py | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"""Phase 2 C4 baseline: OCR must cover DocTalk's locales, not just eng+chi_sim.
     2	
     3	Scanned/non-Latin PDFs parsed to garbage because Tesseract only had eng+chi_sim
     4	(U13 Urdu "coded/encrypted text", U40 Arabic, U38 scanned). This locks the
     5	language-resolution logic; the Dockerfile must also install the matching packs.
     6	
     7	RED on current build (resolve_ocr_languages does not exist / default too narrow).
     8	"""
     9	from __future__ import annotations
    10	
    11	import pytest
    12	
    13	from app.services import parse_service as ps
    14	
    15	# The 11 product locales -> expected Tesseract traineddata codes.
    16	_LOCALE_CODES = {
    17	    "en": "eng", "zh": "chi_sim", "ja": "jpn", "ko": "kor", "es": "spa",
    18	    "de": "deu", "fr": "fra", "pt": "por", "it": "ita", "ar": "ara", "hi": "hin",
    19	}
    20	
    21	
    22	def test_resolve_ocr_languages_exists_and_covers_all_locales():
    23	    resolve = getattr(ps, "resolve_ocr_languages", None)
    24	    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
    25	    default = resolve()
    26	    codes = set(default.split("+"))
    27	    missing = [c for c in _LOCALE_CODES.values() if c not in codes]
    28	    assert not missing, f"default OCR languages missing locale packs: {missing}"
    29	
    30	
    31	@pytest.mark.parametrize("locale,code", list(_LOCALE_CODES.items()))
    32	def test_resolve_ocr_languages_prioritises_document_locale(locale, code):
    33	    resolve = getattr(ps, "resolve_ocr_languages", None)
    34	    assert resolve is not None, "parse_service.resolve_ocr_languages not implemented (C4)"
    35	    result = resolve(locale)
    36	    assert result.split("+")[0] == code, (
    37	        f"locale {locale} should put {code} first for OCR accuracy, got {result!r}"
    38	    )

exec
/bin/zsh -lc "rg -n \"get_summary_context\\(|DEFAULT_MAX_SUMMARY_CHUNKS|max_chunks=18|collection_summary|document_brief_service|select_chunks_for_summary|_should_use_map_reduce\" backend/app -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/document_brief_service.py:19:DEFAULT_MAX_SUMMARY_CHUNKS = 18
backend/app/services/document_brief_service.py:88:    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
backend/app/services/document_brief_service.py:264:    async def select_chunks_for_summary(
backend/app/services/document_brief_service.py:330:    max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
backend/app/services/document_brief_service.py:421:    def _should_use_map_reduce(
backend/app/services/document_brief_service.py:428:        if max_chunks < DEFAULT_MAX_SUMMARY_CHUNKS:
backend/app/services/document_brief_service.py:440:    async def get_summary_context(
backend/app/services/document_brief_service.py:445:        max_chunks: int = DEFAULT_MAX_SUMMARY_CHUNKS,
backend/app/services/document_brief_service.py:472:        if self._should_use_map_reduce(
backend/app/services/document_brief_service.py:477:            selected_map_reduce = await self._section_map_reduce.select_chunks_for_summary(
backend/app/services/document_brief_service.py:547:    async def get_collection_summary_context(
backend/app/services/document_brief_service.py:563:                await self.get_summary_context(
backend/app/services/document_brief_service.py:578:document_brief_service = DocumentBriefService()
backend/app/services/summary_service.py:23:from app.services.document_brief_service import _select_representative_chunks
backend/app/services/chat_service.py:36:from app.services.document_brief_service import document_brief_service
backend/app/services/chat_service.py:1091:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1094:                    max_chunks=18,
backend/app/services/chat_service.py:1102:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/chat_service.py:1108:                retrieval_strategy = "collection_summary_context"
backend/app/services/chat_service.py:1191:            if is_collection_session and retrieval_strategy == "collection_summary_context":
backend/app/api/admin.py:1218:    "collection_summary_context": "Multi-document summary context",
backend/app/api/admin.py:1228:    "collection_summary_context": "The system selected representative sections across multiple documents.",

codex
我已经看到测试覆盖了“会返回 30 chunk”的路径，但没有验证 chat 端是否真正消费这 30 个，也没有验证 OCR locale 实际传入。现在我去看 `chat_service` 的调用与后续截断，确认 B5 在真实链路是否被硬截断。
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1040,1160p'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1160,1300p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1040	                    "error",
  1041	                    {
  1042	                        "code": "INSUFFICIENT_CREDITS",
  1043	                        "message": "Insufficient credits to start chat",
  1044	                        "required": estimated,
  1045	                        "balance": balance,
  1046	                    },
  1047	                )
  1048	                return
  1049	
  1050	        settled = False
  1051	        setup_error_code = "CHAT_SETUP_ERROR"
  1052	        try:
  1053	            # 2) Save user message
  1054	            await self._persist_user_message_and_title(
  1055	                db=db,
  1056	                session_id=session_id,
  1057	                user_message=user_message,
  1058	            )
  1059	
  1060	            # 3) Load history (last N*2 messages before current user msg)
  1061	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  1062	            max_msgs = max_turns * 2
  1063	            msgs_row = await db.execute(
  1064	                select(Message)
  1065	                .where(Message.session_id == session_id)
  1066	                .order_by(Message.created_at.desc())
  1067	                .limit(max_msgs + 1)
  1068	            )
  1069	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  1070	            history_msgs.reverse()  # back to chronological order
  1071	
  1072	            # Convert to Claude message format (excluding system)
  1073	            claude_messages: List[dict] = []
  1074	            for m in history_msgs:
  1075	                claude_messages.append({"role": m.role, "content": m.content})
  1076	
  1077	            # 4) Route + retrieval (with error handling — e.g. Qdrant down or no vectors yet).
  1078	            # Whole-document summaries must not use ordinary semantic top-k: vague
  1079	            # summary prompts frequently retrieve tables/appendices instead of
  1080	            # representative document structure. Route them to an ordered context
  1081	            # selector until the durable hierarchical brief index lands.
  1082	            setup_error_code = "RETRIEVAL_ERROR"
  1083	            retrieval_strategy = "semantic_top_k"
  1084	            retrieval_evaluation = None
  1085	            retrieval_plan: QueryPlan | None = None
  1086	            if (
  1087	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1088	                and document_id
  1089	                and not is_collection_session
  1090	            ):
  1091	                retrieved = await document_brief_service.get_summary_context(
  1092	                    db,
  1093	                    document_id,
  1094	                    max_chunks=18,
  1095	                )
  1096	                retrieval_strategy = "document_summary_context"
  1097	            elif (
  1098	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1099	                and is_collection_session
  1100	                and collection_doc_ids
  1101	            ):
  1102	                retrieved = await document_brief_service.get_collection_summary_context(
  1103	                    db,
  1104	                    collection_doc_ids,
  1105	                    max_chunks=24,
  1106	                    max_docs=8,
  1107	                )
  1108	                retrieval_strategy = "collection_summary_context"
  1109	            elif is_collection_session and collection_doc_ids:
  1110	                corrective = await corrective_retrieval_service.retrieve_multi(
  1111	                    user_message,
  1112	                    query_route,
  1113	                    collection_doc_ids,
  1114	                    top_k=8,
  1115	                    db=db,
  1116	                )
  1117	                retrieved = corrective.retrieved
  1118	                retrieval_strategy = corrective.strategy
  1119	                retrieval_evaluation = corrective.evaluation
  1120	                retrieval_plan = corrective.plan
  1121	            elif (
  1122	                document_id
  1123	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1124	                and query_route.page_ref is not None
  1125	            ):
  1126	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1127	                retrieval_strategy = "page_lookup"
  1128	                if not retrieved:
  1129	                    # Page out of range / no chunks there → fall back to semantic.
  1130	                    corrective = await corrective_retrieval_service.retrieve_single(
  1131	                        user_message, query_route, document_id, top_k=8, db=db,
  1132	                        doc_pages=getattr(doc, "page_count", None),
  1133	                    )
  1134	                    retrieved = corrective.retrieved
  1135	                    retrieval_strategy = corrective.strategy
  1136	                    retrieval_evaluation = corrective.evaluation
  1137	                    retrieval_plan = corrective.plan
  1138	            elif document_id:
  1139	                corrective = await corrective_retrieval_service.retrieve_single(
  1140	                    user_message,
  1141	                    query_route,
  1142	                    document_id,
  1143	                    top_k=8,
  1144	                    db=db,
  1145	                    doc_pages=getattr(doc, "page_count", None),
  1146	                )
  1147	                retrieved = corrective.retrieved
  1148	                retrieval_strategy = corrective.strategy
  1149	                retrieval_evaluation = corrective.evaluation
  1150	                retrieval_plan = corrective.plan
  1151	            else:
  1152	                retrieved = []
  1153	
  1154	            # 5) Build prompt (system)
  1155	            setup_error_code = "CHAT_SETUP_ERROR"
  1156	            numbered_chunks: List[str] = []
  1157	            chunk_map: dict[int, _ChunkInfo] = {}
  1158	            for idx, item in enumerate(retrieved, start=1):
  1159	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1160	                text = item["text"] or ""

 succeeded in 0ms:
  1160	                text = item["text"] or ""
  1161	                truncated = text[:1400]
  1162	                chunk_doc_id = item.get("document_id")
  1163	                doc_label = ""
  1164	                if is_collection_session and chunk_doc_id:
  1165	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1166	                    if fname:
  1167	                        doc_label = f"(from: {fname}) "
  1168	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  1169	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  1170	                numbered_chunks.append(f"[{idx}] {doc_label}{evidence_label}{truncated}")
  1171	                chunk_map[idx] = _ChunkInfo(
  1172	                    id=item["chunk_id"],
  1173	                    page_start=int(item["page"]),
  1174	                    page_end=int(item.get("page_end", item["page"])),
  1175	                    bboxes=item.get("bboxes") or [],
  1176	                    text=text,
  1177	                    section_title=item.get("section_title") or "",
  1178	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  1179	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  1180	                    if chunk_doc_id
  1181	                    else "",
  1182	                    score=item.get("score", 0.0),
  1183	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  1184	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  1185	                )
  1186	
  1187	            rules = get_rules_for_model(
  1188	                effective_model, is_collection=is_collection_session
  1189	            )
  1190	
  1191	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  1192	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1193	                system_prompt = (
  1194	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  1195	                    + SYSTEM_PROMPT_META_RULE
  1196	                    + f"## Available Documents\n{doc_list}\n\n"
  1197	                    + "## Collection Coverage Excerpts\n"
  1198	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1199	                    + "\n\n## Summary Rules\n"
  1200	                    + "1. Treat these excerpts as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  1201	                    + "2. Do NOT say the collection is just unrelated excerpts merely because the context is excerpted.\n"
  1202	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  1203	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  1204	                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
  1205	                    + "6. Your response language MUST match the language of the user's question.\n"
  1206	                    + _citation_contract()
  1207	                )
  1208	            elif is_collection_session:
  1209	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1210	                system_prompt = (
  1211	                    "You are a document analysis assistant. Answer the user's question based on excerpts from multiple documents.\n\n"
  1212	                    + SYSTEM_PROMPT_META_RULE
  1213	                    + f"## Available Documents\n{doc_list}\n\n"
  1214	                    + "## Document Excerpts\n"
  1215	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1216	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  1217	                    + _query_plan_contract(retrieval_plan)
  1218	                    + "\n\n## Rules\n" + rules
  1219	                    + _citation_contract()
  1220	                )
  1221	            elif retrieval_strategy == "document_summary_context":
  1222	                system_prompt = (
  1223	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  1224	                    + SYSTEM_PROMPT_META_RULE
  1225	                    + "## Document Coverage Excerpts\n"
  1226	                    + (
  1227	                        "\n".join(numbered_chunks)
  1228	                        if numbered_chunks
  1229	                        else "(none)"
  1230	                    )
  1231	                    + "\n\n## Summary Rules\n"
  1232	                    + "1. Treat these excerpts as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  1233	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is excerpted.\n"
  1234	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  1235	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  1236	                    + "5. Cite every factual paragraph or bullet using the excerpt numbers listed above.\n"
  1237	                    + "6. Your response language MUST match the language of the user's question.\n"
  1238	                    + _citation_contract()
  1239	                )
  1240	            else:
  1241	                system_prompt = (
  1242	                    "You are a document analysis assistant. Answer the user's question based on the following document excerpts.\n\n"
  1243	                    + SYSTEM_PROMPT_META_RULE
  1244	                    + "## Document Excerpts\n"
  1245	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1246	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  1247	                    + _query_plan_contract(retrieval_plan)
  1248	                    + "\n\n## Rules\n" + rules
  1249	                    + _citation_contract()
  1250	                )
  1251	
  1252	            # Inject custom instructions if present
  1253	            if doc and doc.custom_instructions:
  1254	                system_prompt += (
  1255	                    "\n## Custom Instructions\n"
  1256	                    "The user has provided the following custom instructions for this document. Follow them:\n"
  1257	                    + doc.custom_instructions + "\n"
  1258	                )
  1259	
  1260	            # Inject domain-specific rules (legal/academic mode overlay)
  1261	            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
  1262	            # domain_mode=None means Default (no extra rules), string means apply rules
  1263	            if domain_mode:
  1264	                from app.core.model_profiles import DOMAIN_RULES
  1265	                domain_rules = DOMAIN_RULES.get(domain_mode)
  1266	                if domain_rules:
  1267	                    base_rule_count = len(rules.strip().split('\n'))
  1268	                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
  1269	                    for i, rule in enumerate(domain_rules, start=base_rule_count + 1):
  1270	                        domain_rules_text += f"{i}. {rule}\n"
  1271	                    system_prompt += domain_rules_text
  1272	
  1273	            # Persist domain_mode to session (null clears, string sets)
  1274	            if domain_mode != session_obj.domain_mode:
  1275	                session_obj.domain_mode = domain_mode
  1276	                await db.commit()
  1277	
  1278	        except asyncio.CancelledError:
  1279	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1280	                try:
  1281	                    with anyio.CancelScope(shield=True):
  1282	                        await asyncio.wait_for(
  1283	                            _settle_predebit_on_cancel(
  1284	                                user_id=user.id,
  1285	                                pre_debited=pre_debited,
  1286	                                predebit_ledger_id=predebit_ledger_id,
  1287	                                has_answer=False,
  1288	                                prompt_tokens=None,
  1289	                                output_tokens=None,
  1290	                                model=effective_model,
  1291	                                mode=effective_mode,
  1292	                            ),
  1293	                            timeout=_CANCEL_IO_TIMEOUT_S,
  1294	                        )
  1295	                    settled = True
  1296	                except Exception:
  1297	                    logger.exception(
  1298	                        "Failed to settle pre-debit during chat setup cancellation for user %s",
  1299	                        user.id,
  1300	                    )

exec
/bin/zsh -lc "nl -ba backend/app/services/summary_service.py | sed -n '1,240p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"""Generate persisted hierarchical document briefs after parsing.
     2	
     3	Runs in Celery worker context with synchronous DB and OpenAI-compatible clients.
     4	This is best-effort product metadata generation: failures are persisted on the
     5	brief row when possible, but never change the document's parse status.
     6	"""
     7	from __future__ import annotations
     8	
     9	import json
    10	import re
    11	import uuid
    12	from datetime import datetime, timezone
    13	from typing import Any, Optional, Sequence
    14	
    15	from celery.utils.log import get_task_logger
    16	from openai import OpenAI
    17	from sqlalchemy import select
    18	from sqlalchemy.orm import Session
    19	
    20	from app.core.config import settings
    21	from app.models.sync_database import SyncSessionLocal
    22	from app.models.tables import Chunk, Document, DocumentBrief
    23	from app.services.document_brief_service import _select_representative_chunks
    24	
    25	logger = get_task_logger(__name__)
    26	
    27	BRIEF_PROMPT_VERSION = "document_brief_v1"
    28	BRIEF_SCHEMA_VERSION = 1
    29	BRIEF_MODEL = settings.MODE_MODELS.get("quick", settings.LLM_MODEL)
    30	BRIEF_MAX_CHUNKS = 24
    31	BRIEF_MAX_CHARS_PER_CHUNK = 1000
    32	
    33	BRIEF_PROMPT = """You are building a structured document brief for a professional document workspace.
    34	
    35	Use only the numbered document excerpts. Every outline item, key point, and fact must cite one or more excerpt numbers from the provided context.
    36	
    37	Return valid JSON only:
    38	{{
    39	  "summary": "One concise paragraph explaining what the document is and why it matters.",
    40	  "outline": [
    41	    {{"title": "Section or theme", "level": 1, "summary": "What this section/theme covers.", "source_refs": [1]}}
    42	  ],
    43	  "key_points": [
    44	    {{"text": "Important takeaway stated as a complete sentence.", "source_refs": [1, 2]}}
    45	  ],
    46	  "facts": [
    47	    {{"label": "Metric, date, party, clause, or finding", "value": "Exact value or short answer", "context": "Why it matters.", "source_refs": [3]}}
    48	  ],
    49	  "questions": [
    50	    "A useful question a reader may ask next?"
    51	  ]
    52	}}
    53	
    54	Caps:
    55	- summary: 1 paragraph.
    56	- outline: 4 to 8 items.
    57	- key_points: 5 to 10 items.
    58	- facts: up to 12 items.
    59	- questions: exactly 5 concise questions.
    60	
    61	Document excerpts:
    62	---
    63	{chunks_text}
    64	---
    65	"""
    66	
    67	
    68	def _is_deepseek_official_model(model: str) -> bool:
    69	    return model in settings.DEEPSEEK_OFFICIAL_MODELS
    70	
    71	
    72	def _get_llm_client(model: str) -> OpenAI | None:
    73	    if _is_deepseek_official_model(model):
    74	        if not settings.DEEPSEEK_API_KEY:
    75	            return None
    76	        return OpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
    77	    if not settings.OPENROUTER_API_KEY:
    78	        return None
    79	    return OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url=settings.OPENROUTER_BASE_URL)
    80	
    81	
    82	def _apply_provider_options(kwargs: dict[str, Any], model: str) -> None:
    83	    if _is_deepseek_official_model(model):
    84	        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    85	
    86	
    87	def _json_from_text(text: str) -> dict[str, Any]:
    88	    content = (text or "").strip()
    89	    if content.startswith("```"):
    90	        content = re.sub(r"^```(?:json)?\s*", "", content)
    91	        content = re.sub(r"\s*```$", "", content)
    92	    try:
    93	        data = json.loads(content)
    94	    except json.JSONDecodeError:
    95	        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
    96	        if not match:
    97	            raise
    98	        data = json.loads(match.group(0))
    99	    if not isinstance(data, dict):
   100	        raise ValueError("Brief response must be a JSON object")
   101	    return data
   102	
   103	
   104	def _str(value: Any, fallback: str = "", *, limit: int = 4000) -> str:
   105	    text = str(value).strip() if value is not None else fallback
   106	    return text[:limit]
   107	
   108	
   109	def _source_ref_from_chunk(chunk: Chunk) -> dict[str, Any]:
   110	    return {
   111	        "chunk_id": str(chunk.id),
   112	        "chunk_index": int(chunk.chunk_index),
   113	        "page": int(chunk.page_start),
   114	        "page_end": int(chunk.page_end),
   115	    }
   116	
   117	
   118	def _ref_number(value: Any) -> int | None:
   119	    if isinstance(value, dict):
   120	        for key in ("ref", "ref_index", "source_ref", "source"):
   121	            if key in value:
   122	                return _ref_number(value.get(key))
   123	        return None
   124	    try:
   125	        return int(value)
   126	    except (TypeError, ValueError):
   127	        return None
   128	
   129	
   130	def _normalize_refs(value: Any, ref_lookup: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
   131	    if not ref_lookup:
   132	        return []
   133	    values = value if isinstance(value, list) else []
   134	    refs: list[dict[str, Any]] = []
   135	    seen: set[str] = set()
   136	    for raw in values:
   137	        ref_num = _ref_number(raw)
   138	        if ref_num is None or ref_num not in ref_lookup:
   139	            continue
   140	        ref = ref_lookup[ref_num]
   141	        key = ref["chunk_id"]
   142	        if key in seen:
   143	            continue
   144	        seen.add(key)
   145	        refs.append(dict(ref))
   146	    if refs:
   147	        return refs[:4]
   148	    return []
   149	
   150	
   151	def _page_ranges(chunks: Sequence[Chunk]) -> list[list[int]]:
   152	    ranges: list[list[int]] = []
   153	    for chunk in chunks:
   154	        start = int(chunk.page_start)
   155	        end = int(chunk.page_end)
   156	        if not ranges or start > ranges[-1][1] + 1:
   157	            ranges.append([start, end])
   158	        else:
   159	            ranges[-1][1] = max(ranges[-1][1], end)
   160	    return ranges
   161	
   162	
   163	def _normalize_outline(raw_items: Any, ref_lookup: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
   164	    items = raw_items if isinstance(raw_items, list) else []
   165	    normalized: list[dict[str, Any]] = []
   166	    for item in items[:8]:
   167	        if not isinstance(item, dict):
   168	            continue
   169	        try:
   170	            level = int(item.get("level") or 1)
   171	        except (TypeError, ValueError):
   172	            level = 1
   173	        source_refs = _normalize_refs(item.get("source_refs"), ref_lookup)
   174	        if not source_refs:
   175	            continue
   176	        normalized.append(
   177	            {
   178	                "title": _str(item.get("title"), "Section", limit=180),
   179	                "level": min(3, max(1, level)),
   180	                "summary": _str(item.get("summary"), limit=800),
   181	                "source_refs": source_refs,
   182	            }
   183	        )
   184	    return normalized
   185	
   186	
   187	def normalize_document_brief(
   188	    raw: dict[str, Any],
   189	    selected_chunks: Sequence[Chunk],
   190	    *,
   191	    chunks_total: int,
   192	    pages_total: int | None,
   193	) -> dict[str, Any]:
   194	    ref_lookup = {
   195	        idx: _source_ref_from_chunk(chunk)
   196	        for idx, chunk in enumerate(selected_chunks, start=1)
   197	    }
   198	
   199	    key_points_raw = raw.get("key_points") if isinstance(raw.get("key_points"), list) else []
   200	    facts_raw = raw.get("facts") if isinstance(raw.get("facts"), list) else []
   201	    questions_raw = raw.get("questions") if isinstance(raw.get("questions"), list) else []
   202	
   203	    key_points: list[dict[str, Any]] = []
   204	    for item in key_points_raw[:10]:
   205	        source_refs = _normalize_refs(item.get("source_refs") if isinstance(item, dict) else [], ref_lookup)
   206	        if not source_refs:
   207	            continue
   208	        key_points.append(
   209	            {
   210	                "text": _str(item.get("text") if isinstance(item, dict) else item, limit=900),
   211	                "source_refs": source_refs,
   212	            }
   213	        )
   214	
   215	    facts: list[dict[str, Any]] = []
   216	    for item in facts_raw[:12]:
   217	        source_refs = _normalize_refs(item.get("source_refs") if isinstance(item, dict) else [], ref_lookup)
   218	        if not source_refs:
   219	            continue
   220	        facts.append(
   221	            {
   222	                "label": _str(item.get("label") if isinstance(item, dict) else "Fact", limit=160),
   223	                "value": _str(item.get("value") if isinstance(item, dict) else item, limit=260),
   224	                "context": _str(item.get("context") if isinstance(item, dict) else "", limit=700),
   225	                "source_refs": source_refs,
   226	            }
   227	        )
   228	
   229	    return {
   230	        "summary": _str(raw.get("summary"), limit=2400),
   231	        "outline": _normalize_outline(raw.get("outline"), ref_lookup),
   232	        "key_points": key_points,
   233	        "facts": facts,
   234	        "questions": [_str(q, limit=220) for q in questions_raw[:5] if _str(q, limit=220)],
   235	        "coverage": {
   236	            "status": "representative",
   237	            "strategy": "representative_chunks_v1",
   238	            "chunks_total": int(chunks_total),
   239	            "pages_total": int(pages_total) if pages_total else None,
   240	            "selected_chunk_ids": [str(chunk.id) for chunk in selected_chunks],

exec
/bin/zsh -lc "nl -ba backend/app/services/summary_service.py | sed -n '240,520p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   240	            "selected_chunk_ids": [str(chunk.id) for chunk in selected_chunks],
   241	            "selected_chunk_indices": [int(chunk.chunk_index) for chunk in selected_chunks],
   242	            "selected_page_ranges": _page_ranges(selected_chunks),
   243	        },
   244	    }
   245	
   246	
   247	def _build_chunks_text(chunks: Sequence[Chunk]) -> str:
   248	    parts: list[str] = []
   249	    for ref, chunk in enumerate(chunks, start=1):
   250	        section = f" | {chunk.section_title}" if chunk.section_title else ""
   251	        page = f"p.{chunk.page_start}" if chunk.page_start == chunk.page_end else f"p.{chunk.page_start}-{chunk.page_end}"
   252	        text = (chunk.text or "").strip()[:BRIEF_MAX_CHARS_PER_CHUNK]
   253	        parts.append(f"[{ref}] {page}{section}\n{text}")
   254	    return "\n\n".join(parts)
   255	
   256	
   257	def _get_existing_brief(db: Session, document_id: uuid.UUID) -> DocumentBrief | None:
   258	    return db.execute(
   259	        select(DocumentBrief).where(DocumentBrief.document_id == document_id)
   260	    ).scalar_one_or_none()
   261	
   262	
   263	def _apply_payload_to_doc_and_brief(
   264	    doc: Document,
   265	    brief: DocumentBrief,
   266	    payload: dict[str, Any],
   267	    *,
   268	    model: str,
   269	) -> None:
   270	    brief.schema_version = BRIEF_SCHEMA_VERSION
   271	    brief.prompt_version = BRIEF_PROMPT_VERSION
   272	    brief.model = model
   273	    brief.summary = payload.get("summary") or None
   274	    brief.outline = payload.get("outline") or []
   275	    brief.key_points = payload.get("key_points") or []
   276	    brief.facts = payload.get("facts") or []
   277	    brief.questions = payload.get("questions") or []
   278	    brief.coverage = payload.get("coverage") or {}
   279	    brief.error_code = None
   280	    brief.error_message = None
   281	    brief.generated_at = datetime.now(timezone.utc)
   282	
   283	    doc.summary = brief.summary
   284	    doc.suggested_questions = brief.questions
   285	
   286	
   287	def _persist_brief_error(
   288	    db: Session,
   289	    doc: Document,
   290	    *,
   291	    code: str,
   292	    message: str,
   293	    model: str,
   294	) -> None:
   295	    brief = _get_existing_brief(db, doc.id)
   296	    if brief is None:
   297	        brief = DocumentBrief(
   298	            document_id=doc.id,
   299	            outline=[],
   300	            key_points=[],
   301	            facts=[],
   302	            questions=[],
   303	            coverage={},
   304	        )
   305	    brief.schema_version = BRIEF_SCHEMA_VERSION
   306	    brief.prompt_version = BRIEF_PROMPT_VERSION
   307	    brief.model = model
   308	    brief.error_code = code
   309	    brief.error_message = message[:2000]
   310	    brief.generated_at = datetime.now(timezone.utc)
   311	    db.add(brief)
   312	    db.commit()
   313	
   314	
   315	def _selected_chunks_still_current(
   316	    db: Session,
   317	    doc: Document,
   318	    selected_chunks: Sequence[Chunk],
   319	) -> bool:
   320	    selected_ids = [chunk.id for chunk in selected_chunks]
   321	    if not selected_ids:
   322	        return False
   323	    rows = db.execute(
   324	        select(Chunk.id)
   325	        .where(Chunk.document_id == doc.id)
   326	        .where(Chunk.id.in_(selected_ids))
   327	    )
   328	    current_ids = {chunk_id for chunk_id in rows.scalars()}
   329	    return current_ids == set(selected_ids)
   330	
   331	
   332	def generate_document_brief_sync(document_id: str) -> None:
   333	    """Load representative chunks, call the LLM, and persist a structured brief."""
   334	    with SyncSessionLocal() as db:
   335	        doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
   336	        if not doc:
   337	            logger.warning("Document %s not found for brief generation", document_id)
   338	            return
   339	
   340	        client = _get_llm_client(BRIEF_MODEL)
   341	        if client is None:
   342	            logger.warning("No LLM API key configured, recording brief generation failure")
   343	            _persist_brief_error(
   344	                db,
   345	                doc,
   346	                code="BRIEF_LLM_UNAVAILABLE",
   347	                message="No LLM API key configured for document brief generation",
   348	                model=BRIEF_MODEL,
   349	            )
   350	            return
   351	
   352	        chunks = list(
   353	            db.execute(
   354	                select(Chunk)
   355	                .where(Chunk.document_id == doc.id)
   356	                .order_by(Chunk.chunk_index)
   357	            ).scalars()
   358	        )
   359	        if not chunks:
   360	            logger.warning("No chunks found for document %s, skipping brief generation", document_id)
   361	            _persist_brief_error(
   362	                db,
   363	                doc,
   364	                code="BRIEF_NO_CHUNKS",
   365	                message="No chunks found for document brief generation",
   366	                model=BRIEF_MODEL,
   367	            )
   368	            return
   369	
   370	        selected_chunks = _select_representative_chunks(chunks, max_chunks=BRIEF_MAX_CHUNKS)
   371	        if not selected_chunks:
   372	            logger.warning("No representative chunks selected for document %s", document_id)
   373	            _persist_brief_error(
   374	                db,
   375	                doc,
   376	                code="BRIEF_NO_REPRESENTATIVE_CHUNKS",
   377	                message="No representative chunks selected for document brief generation",
   378	                model=BRIEF_MODEL,
   379	            )
   380	            return
   381	
   382	        prompt = BRIEF_PROMPT.format(chunks_text=_build_chunks_text(selected_chunks))
   383	
   384	        try:
   385	            kwargs: dict[str, Any] = {
   386	                "model": BRIEF_MODEL,
   387	                "messages": [{"role": "user", "content": prompt}],
   388	                "temperature": 0.2,
   389	                "max_tokens": 2200,
   390	            }
   391	            _apply_provider_options(kwargs, BRIEF_MODEL)
   392	            response = client.chat.completions.create(**kwargs)
   393	            raw = _json_from_text(response.choices[0].message.content or "")
   394	            payload = normalize_document_brief(
   395	                raw,
   396	                selected_chunks,
   397	                chunks_total=len(chunks),
   398	                pages_total=doc.page_count,
   399	            )
   400	
   401	            db.refresh(doc)
   402	            if doc.status != "ready" or not _selected_chunks_still_current(db, doc, selected_chunks):
   403	                logger.warning("Document %s changed during brief generation; discarding stale brief", document_id)
   404	                return
   405	
   406	            brief = _get_existing_brief(db, doc.id)
   407	            if brief is None:
   408	                brief = DocumentBrief(document_id=doc.id)
   409	            _apply_payload_to_doc_and_brief(doc, brief, payload, model=BRIEF_MODEL)
   410	            db.add(brief)
   411	            db.add(doc)
   412	            db.commit()
   413	            logger.info(
   414	                "Document brief generated for %s: %d outline items, %d key points, %d facts",
   415	                document_id,
   416	                len(brief.outline),
   417	                len(brief.key_points),
   418	                len(brief.facts),
   419	            )
   420	        except json.JSONDecodeError as exc:
   421	            logger.warning("Failed to parse document brief JSON for %s: %s", document_id, exc)
   422	            _persist_brief_error(db, doc, code="BRIEF_JSON_INVALID", message=str(exc), model=BRIEF_MODEL)
   423	        except Exception as exc:
   424	            logger.exception("Document brief generation failed for %s: %s", document_id, exc)
   425	            _persist_brief_error(db, doc, code="BRIEF_GENERATION_FAILED", message=str(exc), model=BRIEF_MODEL)
   426	
   427	
   428	def generate_summary_sync(document_id: str) -> None:
   429	    """Compatibility wrapper for the old parse-worker call site."""
   430	    generate_document_brief_sync(document_id)

exec
/bin/zsh -lc "rg -n \"locale|language|OCR_LANGUAGES|extract_pages_ocr\\(|detect_scanned\\(\" backend/app/workers/parse_worker.py backend/app/models/tables.py backend/app/services -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '1,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/models/tables.py:510:    locale: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
backend/app/workers/parse_worker.py:18:from app.services.parse_service import ParseService, resolve_ocr_languages
backend/app/workers/parse_worker.py:245:                if service.detect_scanned(pages):
backend/app/workers/parse_worker.py:263:                        pages = service.extract_pages_ocr(
backend/app/workers/parse_worker.py:265:                            languages=resolve_ocr_languages(),
backend/app/services/question_template_service.py:168:            locale = scope.get("locale")
backend/app/services/question_template_service.py:188:                    raw, p_tokens, c_tokens = _call_llm(template, chunks, locale, None)
backend/app/services/action_planner.py:282:        locale: str | None = None,
backend/app/services/action_planner.py:314:            f"Locale: {locale or 'unknown'}\n"
backend/app/services/document_diff_service.py:147:    locale: str | None,
backend/app/services/document_diff_service.py:149:    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
backend/app/services/document_diff_service.py:151:        f"{language_rule}\n\n"
backend/app/services/document_diff_service.py:166:    locale: str | None,
backend/app/services/document_diff_service.py:171:        {"role": "user", "content": _user_prompt(old_doc, new_doc, old_chunks, new_chunks, locale)},
backend/app/services/document_diff_service.py:399:                scope.get("locale"),
backend/app/services/query_router.py:134:# Positional "what is on page N" detection across DocTalk locales (+ Czech, the
backend/app/services/query_router.py:135:# paying user's language). Pure semantic top-k can't resolve a page number, so a
backend/app/services/chat_service.py:100:def _normalize_locale(locale: Optional[str]) -> str:
backend/app/services/chat_service.py:101:    return (locale or "").strip().lower().replace("_", "-").split("-")[0]
backend/app/services/chat_service.py:104:def _continuation_language_label(locale: Optional[str], existing_response: Optional[str]) -> Optional[str]:
backend/app/services/chat_service.py:105:    normalized = _normalize_locale(locale)
backend/app/services/chat_service.py:123:def _continuation_prompt(locale: Optional[str], existing_response: Optional[str]) -> str:
backend/app/services/chat_service.py:124:    language = _continuation_language_label(locale, existing_response)
backend/app/services/chat_service.py:125:    target = f" Continue in {language}." if language else ""
backend/app/services/chat_service.py:130:        "The previous assistant response, not this control instruction, determines the answer language. "
backend/app/services/chat_service.py:131:        "Do not switch languages because this continuation instruction is written in English."
backend/app/services/chat_service.py:135:def _continuation_system_rule(locale: Optional[str], existing_response: Optional[str]) -> str:
backend/app/services/chat_service.py:136:    language = _continuation_language_label(locale, existing_response)
backend/app/services/chat_service.py:137:    target = f" The target language is {language}." if language else ""
backend/app/services/chat_service.py:141:        "Continue the existing assistant answer in the same language and style already used."
backend/app/services/chat_service.py:384:    locale: Optional[str],
backend/app/services/chat_service.py:389:    language = _continuation_language_label(locale, assistant_text) or "the same language as the user's question"
backend/app/services/chat_service.py:405:        f"Write in {language}. Return only the corrected final answer, with citations."
backend/app/services/chat_service.py:858:        locale: Optional[str],
backend/app/services/chat_service.py:878:                locale=locale,
backend/app/services/chat_service.py:925:        locale: Optional[str] = None,
backend/app/services/chat_service.py:1000:            locale=locale,
backend/app/services/chat_service.py:1008:                locale=locale,
backend/app/services/chat_service.py:1205:                    + "6. Your response language MUST match the language of the user's question.\n"
backend/app/services/chat_service.py:1237:                    + "6. Your response language MUST match the language of the user's question.\n"
backend/app/services/chat_service.py:1520:                    locale=locale,
backend/app/services/chat_service.py:1674:        locale: Optional[str] = None,
backend/app/services/chat_service.py:1861:                "content": _continuation_prompt(locale, asst_msg.content),
backend/app/services/chat_service.py:1908:            system_prompt += "\n" + _continuation_system_rule(locale, asst_msg.content)
backend/app/services/chat_service.py:2112:                    user_message=_continuation_prompt(locale, base_assistant_text),
backend/app/services/chat_service.py:2118:                    locale=locale,
backend/app/services/parse_service.py:9:# OCR language resolution (Phase 2 C4). Scanned / non-Latin PDFs need the matching
backend/app/services/parse_service.py:16:_DEFAULT_OCR_LANGUAGES = "eng+chi_sim+jpn+kor+spa+deu+fra+por+ita+ara+hin"
backend/app/services/parse_service.py:19:def resolve_ocr_languages(locale: str | None = None) -> str:
backend/app/services/parse_service.py:20:    """Tesseract language string for OCR, covering all product locales.
backend/app/services/parse_service.py:22:    Unions the configured OCR_LANGUAGES with the full locale set so a scanned
backend/app/services/parse_service.py:24:    locale is known it is placed first for OCR accuracy.
backend/app/services/parse_service.py:29:        configured = (getattr(settings, "OCR_LANGUAGES", "") or "").split("+")
backend/app/services/parse_service.py:32:    for code in [*configured, *_DEFAULT_OCR_LANGUAGES.split("+")]:
backend/app/services/parse_service.py:36:    if locale:
backend/app/services/parse_service.py:37:        primary = _LOCALE_TESSERACT.get(locale.split("-")[0].split("_")[0].lower())
backend/app/services/parse_service.py:151:    def extract_pages_ocr(
backend/app/services/parse_service.py:152:        self, pdf_bytes: bytes, languages: str = "eng+chi_sim", dpi: int = 300
backend/app/services/parse_service.py:183:                    tp = page.get_textpage_ocr(language=languages, dpi=effective_dpi, full=True)
backend/app/services/parse_service.py:212:    def detect_scanned(self, pages: Sequence[PageInfo]) -> bool:
backend/app/services/extraction_service.py:279:def _user_prompt(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None) -> str:
backend/app/services/extraction_service.py:280:    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
backend/app/services/extraction_service.py:284:        f"{language_rule}\n\n"
backend/app/services/extraction_service.py:290:def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
backend/app/services/extraction_service.py:294:        {"role": "user", "content": _user_prompt(template, chunks, locale)},
backend/app/services/extraction_service.py:540:            locale = (job.input_scope or {}).get("locale")
backend/app/services/extraction_service.py:546:            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
backend/app/services/chat_tool_executor.py:117:    locale: str | None,
backend/app/services/chat_tool_executor.py:149:            "locale": locale,
backend/app/services/chat_tool_executor.py:415:        locale: str | None,
backend/app/services/chat_tool_executor.py:472:                locale=locale,

 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from datetime import datetime
     5	from typing import List, Optional
     6	
     7	import sqlalchemy as sa
     8	from sqlalchemy.dialects.postgresql import JSONB, UUID
     9	from sqlalchemy.orm import Mapped, mapped_column, relationship
    10	
    11	from .base import Base
    12	
    13	
    14	# Documents table
    15	class Document(Base):
    16	    __tablename__ = "documents"
    17	
    18	    id: Mapped[uuid.UUID] = mapped_column(
    19	        UUID(as_uuid=True),
    20	        primary_key=True,
    21	        server_default=sa.text("gen_random_uuid()"),
    22	    )
    23	    filename: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    24	    file_size: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    25	    page_count: Mapped[Optional[int]] = mapped_column(sa.Integer, nullable=True)
    26	    storage_key: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    27	    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'uploading'"))
    28	    error_msg: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    29	
    30	    pages_parsed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    31	    chunks_total: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    32	    chunks_indexed: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    33	
    34	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
    35	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
    36	
    37	    # Optional owner user (nullable; set null on user delete)
    38	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
    39	        UUID(as_uuid=True),
    40	        sa.ForeignKey("users.id", ondelete="SET NULL"),
    41	        nullable=True,
    42	        index=True,
    43	    )
    44	
    45	    # Auto-generated summary and suggested questions (populated after parsing)
    46	    summary: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    47	    suggested_questions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    48	
    49	    # Custom AI instructions per document (user-provided, max 2000 chars)
    50	    custom_instructions: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    51	
    52	    # File type (pdf, docx, pptx, xlsx, txt, md)
    53	    file_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'pdf'"))
    54	
    55	    # Storage key for converted PDF (PPTX/DOCX → PDF via LibreOffice)
    56	    converted_storage_key: Mapped[Optional[str]] = mapped_column(sa.String(500), nullable=True)
    57	
    58	    # Source URL for URL-ingested documents
    59	    source_url: Mapped[Optional[str]] = mapped_column(sa.String(2000), nullable=True)
    60	
    61	    # Demo documents have a slug (e.g. "alphabet-earnings"); user docs have None
    62	    demo_slug: Mapped[Optional[str]] = mapped_column(
    63	        sa.String(50), nullable=True, unique=True
    64	    )
    65	
    66	    @property
    67	    def is_demo(self) -> bool:
    68	        return self.demo_slug is not None
    69	
    70	    pages: Mapped[List[Page]] = relationship("Page", back_populates="document", cascade="all, delete-orphan")
    71	    chunks: Mapped[List[Chunk]] = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    72	    elements: Mapped[List["DocumentElement"]] = relationship(
    73	        "DocumentElement",
    74	        back_populates="document",
    75	        cascade="all, delete-orphan",
    76	    )
    77	    sessions: Mapped[List[ChatSession]] = relationship(
    78	        "ChatSession", back_populates="document", cascade="all, delete-orphan",
    79	        foreign_keys="ChatSession.document_id",
    80	    )
    81	    collections: Mapped[List["Collection"]] = relationship(
    82	        "Collection",
    83	        secondary="collection_documents",
    84	        back_populates="documents",
    85	    )
    86	    brief: Mapped[Optional["DocumentBrief"]] = relationship(
    87	        "DocumentBrief",
    88	        back_populates="document",
    89	        cascade="all, delete-orphan",
    90	        uselist=False,
    91	    )
    92	
    93	
    94	# Pages table
    95	class Page(Base):
    96	    __tablename__ = "pages"
    97	
    98	    id: Mapped[uuid.UUID] = mapped_column(
    99	        UUID(as_uuid=True),
   100	        primary_key=True,
   101	        server_default=sa.text("gen_random_uuid()"),
   102	    )
   103	    document_id: Mapped[uuid.UUID] = mapped_column(
   104	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
   105	    )
   106	    page_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   107	    width_pt: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
   108	    height_pt: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
   109	    rotation: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   110	    content: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
   111	
   112	    document: Mapped[Document] = relationship("Document", back_populates="pages")
   113	
   114	    __table_args__ = (
   115	        sa.UniqueConstraint("document_id", "page_number", name="uq_pages_document_page"),
   116	        sa.Index("idx_pages_document", "document_id"),
   117	    )
   118	
   119	
   120	# Chunks table
   121	class Chunk(Base):
   122	    __tablename__ = "chunks"
   123	
   124	    id: Mapped[uuid.UUID] = mapped_column(
   125	        UUID(as_uuid=True),
   126	        primary_key=True,
   127	        server_default=sa.text("gen_random_uuid()"),
   128	    )
   129	    document_id: Mapped[uuid.UUID] = mapped_column(
   130	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
   131	    )
   132	    chunk_index: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   133	    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
   134	    token_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   135	    page_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   136	    page_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   137	    bboxes: Mapped[dict] = mapped_column(JSONB, nullable=False)
   138	    section_title: Mapped[Optional[str]] = mapped_column(sa.String(500))
   139	    vector_id: Mapped[Optional[str]] = mapped_column(sa.String(100))
   140	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   141	
   142	    document: Mapped[Document] = relationship("Document", back_populates="chunks")
   143	
   144	    __table_args__ = (
   145	        sa.UniqueConstraint("document_id", "chunk_index", name="uq_chunks_document_index"),
   146	        sa.Index("idx_chunks_document", "document_id"),
   147	    )
   148	
   149	
   150	class DocumentElement(Base):
   151	    __tablename__ = "document_elements"
   152	
   153	    id: Mapped[uuid.UUID] = mapped_column(
   154	        UUID(as_uuid=True),
   155	        primary_key=True,
   156	        server_default=sa.text("gen_random_uuid()"),
   157	    )
   158	    document_id: Mapped[uuid.UUID] = mapped_column(
   159	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
   160	    )
   161	    element_type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   162	    page_start: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   163	    page_end: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   164	    bbox: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
   165	    text: Mapped[str] = mapped_column(sa.Text, nullable=False)
   166	    reading_order: Mapped[int] = mapped_column(sa.Integer, nullable=False)
   167	    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   168	        UUID(as_uuid=True), sa.ForeignKey("document_elements.id", ondelete="SET NULL"), nullable=True
   169	    )
   170	    metadata_json: Mapped[dict] = mapped_column(
   171	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   172	    )
   173	    created_at: Mapped[datetime] = mapped_column(
   174	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   175	    )
   176	    updated_at: Mapped[datetime] = mapped_column(
   177	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
   178	    )
   179	
   180	    document: Mapped["Document"] = relationship("Document", back_populates="elements")
   181	
   182	    __table_args__ = (
   183	        sa.Index("idx_document_elements_doc_type_order", "document_id", "element_type", "reading_order"),
   184	        sa.Index("idx_document_elements_doc_pages", "document_id", "page_start", "page_end"),
   185	    )
   186	
   187	
   188	# Sessions table (use ChatSession to avoid conflict with SQLAlchemy Session)
   189	class ChatSession(Base):
   190	    __tablename__ = "sessions"
   191	
   192	    id: Mapped[uuid.UUID] = mapped_column(
   193	        UUID(as_uuid=True),
   194	        primary_key=True,
   195	        server_default=sa.text("gen_random_uuid()"),
   196	    )
   197	    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   198	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
   199	    )
   200	    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   201	        UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=True
   202	    )
   203	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   204	        UUID(as_uuid=True),
   205	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   206	        nullable=True,
   207	        index=True,
   208	    )
   209	    title: Mapped[Optional[str]] = mapped_column(sa.String(200), nullable=True)
   210	    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
   211	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   212	    updated_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now())
   213	
   214	    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
   215	    document: Mapped[Optional[Document]] = relationship("Document", back_populates="sessions", foreign_keys=[document_id])
   216	    collection: Mapped[Optional["Collection"]] = relationship("Collection", back_populates="sessions")
   217	    messages: Mapped[List[Message]] = relationship("Message", back_populates="session", cascade="all, delete-orphan")
   218	
   219	
   220	# Messages table
   221	class Message(Base):
   222	    __tablename__ = "messages"
   223	
   224	    id: Mapped[uuid.UUID] = mapped_column(
   225	        UUID(as_uuid=True),
   226	        primary_key=True,
   227	        server_default=sa.text("gen_random_uuid()"),
   228	    )
   229	    session_id: Mapped[uuid.UUID] = mapped_column(
   230	        UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
   231	    )
   232	    role: Mapped[str] = mapped_column(sa.String(10), nullable=False)
   233	    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
   234	    citations: Mapped[Optional[dict]] = mapped_column(JSONB)
   235	    metadata_json: Mapped[dict] = mapped_column(
   236	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   237	    )
   238	    prompt_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   239	    output_tokens: Mapped[Optional[int]] = mapped_column(sa.Integer)
   240	    continuation_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   241	    created_at: Mapped[sa.DateTime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   242	
   243	    session: Mapped[ChatSession] = relationship("ChatSession", back_populates="messages")
   244	
   245	    __table_args__ = (
   246	        sa.Index("idx_messages_session", "session_id", "created_at"),
   247	    )
   248	
   249	
   250	# Users table
   251	class User(Base):
   252	    __tablename__ = "users"
   253	
   254	    id: Mapped[uuid.UUID] = mapped_column(
   255	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   256	    )
   257	    email: Mapped[str] = mapped_column(sa.String(255), unique=True, nullable=False, index=True)
   258	    name: Mapped[Optional[str]] = mapped_column(sa.String(255))
   259	    image: Mapped[Optional[str]] = mapped_column(sa.String(500))
   260	    email_verified: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   261	    credits_balance: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   262	    signup_bonus_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   263	    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
   264	    stripe_customer_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   265	    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(sa.String(255))
   266	    monthly_credits_granted_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True))
   267	    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.text("now()"))
   268	    updated_at: Mapped[datetime] = mapped_column(
   269	        sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.func.now()
   270	    )
   271	
   272	    # Relationships
   273	    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="user", cascade="all, delete-orphan")
   274	
   275	
   276	class Account(Base):
   277	    __tablename__ = "accounts"
   278	
   279	    id: Mapped[uuid.UUID] = mapped_column(
   280	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")

exec
/bin/zsh -lc "nl -ba backend/app/models/tables.py | sed -n '460,560p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   460	    id: Mapped[uuid.UUID] = mapped_column(
   461	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   462	    )
   463	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   464	        UUID(as_uuid=True),
   465	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   466	        nullable=True,
   467	        index=True,
   468	    )
   469	    event_name: Mapped[str] = mapped_column(sa.String(64), nullable=False, index=True)
   470	    source: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
   471	    reason: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
   472	    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   473	    billing: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   474	    metadata_json: Mapped[dict] = mapped_column(
   475	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   476	    )
   477	    created_at: Mapped[datetime] = mapped_column(
   478	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   479	    )
   480	
   481	    user: Mapped[Optional["User"]] = relationship("User")
   482	
   483	    __table_args__ = (
   484	        sa.Index("idx_product_events_created", sa.text("created_at DESC")),
   485	        sa.Index("idx_product_events_name_created", "event_name", sa.text("created_at DESC")),
   486	        sa.Index("idx_product_events_user_created", "user_id", sa.text("created_at DESC")),
   487	    )
   488	
   489	
   490	class UserFeedback(Base):
   491	    __tablename__ = "user_feedback"
   492	
   493	    id: Mapped[uuid.UUID] = mapped_column(
   494	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   495	    )
   496	    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   497	        UUID(as_uuid=True),
   498	        sa.ForeignKey("users.id", ondelete="SET NULL"),
   499	        nullable=True,
   500	        index=True,
   501	    )
   502	    type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   503	    area: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   504	    severity: Mapped[str] = mapped_column(sa.String(16), nullable=False)
   505	    selected_options: Mapped[dict] = mapped_column(
   506	        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
   507	    )
   508	    message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
   509	    path: Mapped[Optional[str]] = mapped_column(sa.String(256), nullable=True)
   510	    locale: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   511	    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
   512	    status: Mapped[str] = mapped_column(sa.String(16), nullable=False, server_default=sa.text("'new'"))
   513	    user_agent: Mapped[Optional[str]] = mapped_column(sa.String(256), nullable=True)
   514	    created_at: Mapped[datetime] = mapped_column(
   515	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   516	    )
   517	    updated_at: Mapped[datetime] = mapped_column(
   518	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
   519	    )
   520	
   521	    user: Mapped[Optional["User"]] = relationship("User")
   522	
   523	    __table_args__ = (
   524	        sa.Index("idx_user_feedback_created", sa.text("created_at DESC")),
   525	        sa.Index("idx_user_feedback_status_created", "status", sa.text("created_at DESC")),
   526	        sa.Index("idx_user_feedback_type_created", "type", sa.text("created_at DESC")),
   527	        sa.Index("idx_user_feedback_area_created", "area", sa.text("created_at DESC")),
   528	        sa.Index("idx_user_feedback_user_created", "user_id", sa.text("created_at DESC")),
   529	    )
   530	
   531	
   532	class DocumentJob(Base):
   533	    __tablename__ = "document_jobs"
   534	
   535	    id: Mapped[uuid.UUID] = mapped_column(
   536	        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
   537	    )
   538	    user_id: Mapped[uuid.UUID] = mapped_column(
   539	        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
   540	    )
   541	    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   542	        UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True
   543	    )
   544	    collection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
   545	        UUID(as_uuid=True), sa.ForeignKey("collections.id", ondelete="CASCADE"), nullable=True, index=True
   546	    )
   547	    job_type: Mapped[str] = mapped_column(sa.String(32), nullable=False)
   548	    status: Mapped[str] = mapped_column(sa.String(24), nullable=False, server_default=sa.text("'queued'"))
   549	    input_scope: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
   550	    cost_credits: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
   551	    error_code: Mapped[Optional[str]] = mapped_column(sa.String(64), nullable=True)
   552	    error_message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
   553	    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
   554	    created_at: Mapped[datetime] = mapped_column(
   555	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
   556	    )
   557	    updated_at: Mapped[datetime] = mapped_column(
   558	        sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()"), onupdate=sa.func.now()
   559	    )
   560	    completed_at: Mapped[Optional[datetime]] = mapped_column(sa.DateTime(timezone=True), nullable=True)

exec
/bin/zsh -lc "rg -n \"parse_document\\(|delay\\(.*parse_document|send_task\\(.*parse_document|enqueue.*parse|queue.*parse\" backend/app -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/workers/celery_app.py:47:    "app.workers.parse_worker.parse_document": {"queue": "parse"},
backend/app/workers/parse_worker.py:120:def parse_document(self, document_id: str) -> None:
backend/app/api/documents.py:774:async def reparse_document(

exec
/bin/zsh -lc "nl -ba backend/app/api/documents.py | sed -n '620,840p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   620	
   621	    status_value = "failed" if brief.error_code else "ready"
   622	    return DocumentHierarchicalBriefResponse(
   623	        status=status_value,
   624	        updated_at=brief.updated_at,
   625	        generated_at=brief.generated_at,
   626	        summary=brief.summary,
   627	        outline=_hydrate_brief_items(outline, chunks_by_id),
   628	        key_points=_hydrate_brief_items(key_points, chunks_by_id),
   629	        facts=_hydrate_brief_items(facts, chunks_by_id),
   630	        questions=brief.questions if isinstance(brief.questions, list) else [],
   631	        coverage=brief.coverage if isinstance(brief.coverage, dict) else {},
   632	        error_code=brief.error_code,
   633	        error_message=brief.error_message,
   634	    )
   635	
   636	
   637	@documents_router.get("/{document_id}/file-url", response_model=DocumentFileUrlResponse)
   638	async def get_document_file_url(
   639	    document_id: uuid.UUID,
   640	    variant: Optional[str] = Query(None, description="'converted' for converted PDF"),
   641	    user: Optional[User] = Depends(get_current_user_optional),
   642	    db: AsyncSession = Depends(get_db_session),
   643	):
   644	    import asyncio
   645	
   646	    doc = await doc_service.get_document(document_id, db)
   647	    if not doc:
   648	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   649	    if not can_access_document(doc, user):
   650	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   651	
   652	    storage_key = doc.converted_storage_key if variant == "converted" else doc.storage_key
   653	    if variant == "converted" and not doc.converted_storage_key:
   654	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   655	
   656	    # Run synchronous MinIO call in a thread to avoid blocking the event loop.
   657	    # When MinIO is unreachable, urllib3 retries can block for seconds.
   658	    try:
   659	        url = await asyncio.to_thread(
   660	            storage_service.get_presigned_url, storage_key, settings.MINIO_PRESIGN_TTL
   661	        )
   662	    except Exception:
   663	        raise HTTPException(
   664	            status_code=502,
   665	            detail={
   666	                "error": "STORAGE_UNAVAILABLE",
   667	                "message": "Storage service unavailable",
   668	            },
   669	        )
   670	
   671	    return DocumentFileUrlResponse(url=url, expires_in=int(settings.MINIO_PRESIGN_TTL))
   672	
   673	
   674	@documents_router.get("/{document_id}/text-content", response_model=DocumentTextContentResponse)
   675	async def get_document_text_content(
   676	    document_id: uuid.UUID,
   677	    user: Optional[User] = Depends(get_current_user_optional),
   678	    db: AsyncSession = Depends(get_db_session),
   679	):
   680	    """Return extracted text content grouped by page for non-PDF viewer.
   681	
   682	    Prefers Page.content (original extracted text) over chunk reconstruction
   683	    to avoid overlap/duplication artifacts from the chunking pipeline.
   684	    """
   685	    from sqlalchemy import select as sa_select  # noqa: I001
   686	
   687	    from app.models.tables import Chunk, Page as PageModel
   688	
   689	    doc = await doc_service.get_document(document_id, db)
   690	    if not doc:
   691	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   692	    if not can_access_document(doc, user):
   693	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   694	
   695	    # Try Page.content first (available for newly parsed non-PDF documents)
   696	    result = await db.execute(
   697	        sa_select(PageModel)
   698	        .where(PageModel.document_id == document_id)
   699	        .order_by(PageModel.page_number)
   700	    )
   701	    db_pages = result.scalars().all()
   702	
   703	    section_titles: dict[int, str] = {}
   704	    result = await db.execute(
   705	        sa_select(Chunk)
   706	        .where(Chunk.document_id == document_id)
   707	        .where(Chunk.section_title.is_not(None))
   708	        .order_by(Chunk.chunk_index)
   709	    )
   710	    for chunk in result.scalars().all():
   711	        title = (chunk.section_title or "").strip()
   712	        if not title:
   713	            continue
   714	        for page_num in range(chunk.page_start, chunk.page_end + 1):
   715	            section_titles.setdefault(page_num, title)
   716	
   717	    # Check if any page has content stored
   718	    has_content = any(p.content for p in db_pages)
   719	
   720	    if has_content:
   721	        pages_list = [
   722	            {
   723	                "page_number": p.page_number,
   724	                "text": p.content or '',
   725	                "section_title": section_titles.get(p.page_number),
   726	            }
   727	            for p in db_pages
   728	            if p.content
   729	        ]
   730	    else:
   731	        # Fallback: reconstruct from chunks (for legacy documents parsed before this change)
   732	        result = await db.execute(
   733	            sa_select(Chunk)
   734	            .where(Chunk.document_id == document_id)
   735	            .order_by(Chunk.page_start, Chunk.chunk_index)
   736	        )
   737	        chunks = result.scalars().all()
   738	
   739	        pages_dict: dict[int, list[str]] = {}
   740	        for chunk in chunks:
   741	            for page_num in range(chunk.page_start, chunk.page_end + 1):
   742	                if page_num not in pages_dict:
   743	                    pages_dict[page_num] = []
   744	                pages_dict[page_num].append(chunk.text)
   745	
   746	        pages_list = [
   747	            {
   748	                "page_number": pn,
   749	                "text": "\n".join(texts),
   750	                "section_title": section_titles.get(pn),
   751	            }
   752	            for pn, texts in sorted(pages_dict.items())
   753	        ]
   754	
   755	    source_url = getattr(doc, 'source_url', None)
   756	    domain = urlparse(source_url).netloc if source_url else None
   757	    title = getattr(doc, 'filename', None)
   758	    if source_url and isinstance(title, str) and title.lower().endswith((".txt", ".md")):
   759	        title = title.rsplit(".", 1)[0]
   760	    return {
   761	        "file_type": getattr(doc, 'file_type', 'pdf'),
   762	        "pages": pages_list,
   763	        "title": title,
   764	        "source_url": source_url,
   765	        "domain": domain,
   766	    }
   767	
   768	
   769	@documents_router.post(
   770	    "/{document_id}/reparse",
   771	    status_code=status.HTTP_202_ACCEPTED,
   772	    response_model=StatusResponse,
   773	)
   774	async def reparse_document(
   775	    document_id: uuid.UUID,
   776	    user: User = Depends(require_auth),
   777	    db: AsyncSession = Depends(get_db_session),
   778	):
   779	    """Re-parse an existing document (e.g., after chunk config changes)."""
   780	    from app.models.tables import Document
   781	
   782	    doc = await db.get(Document, document_id)
   783	    if not doc or doc.user_id != user.id:
   784	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   785	    if doc.status not in ("ready", "error"):
   786	        raise HTTPException(
   787	            status_code=409,
   788	            detail={
   789	                "error": "DOCUMENT_PROCESSING",
   790	                "message": "Document is still processing",
   791	                "status": doc.status,
   792	            },
   793	        )
   794	    doc.status = "parsing"
   795	    db.add(doc)
   796	    await db.commit()
   797	    from app.workers.parse_worker import parse_document
   798	    parse_document.delay(str(doc.id))
   799	    return {"status": "reparsing"}
   800	
   801	
   802	@documents_router.delete(
   803	    "/{document_id}",
   804	    status_code=status.HTTP_202_ACCEPTED,
   805	    response_model=StatusResponse,
   806	)
   807	async def delete_document(
   808	    document_id: uuid.UUID,
   809	    user: User = Depends(require_auth),
   810	    db: AsyncSession = Depends(get_db_session),
   811	):
   812	    doc = await doc_service.get_document(document_id, db)
   813	    if not doc:
   814	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   815	    # Only the document owner can delete; demo docs (user_id=None) are not deletable via API
   816	    if doc.user_id != user.id:
   817	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   818	    await doc_service.delete_document(document_id, db)
   819	    return JSONResponse(status_code=202, content={"status": "deleted"})
   820	
   821	
   822	class UpdateDocumentRequest(BaseModel):
   823	    custom_instructions: Optional[str] = Field(None)
   824	
   825	
   826	@documents_router.patch("/{document_id}", response_model=StatusResponse)
   827	async def update_document(
   828	    document_id: uuid.UUID,
   829	    body: UpdateDocumentRequest,
   830	    user: User = Depends(require_auth),
   831	    db: AsyncSession = Depends(get_db_session),
   832	):
   833	    from app.models.tables import Document
   834	
   835	    doc = await db.get(Document, document_id)
   836	    if not doc or doc.user_id != user.id:
   837	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   838	    if body.custom_instructions is not None:
   839	        if len(body.custom_instructions) > 2000:
   840	            raise HTTPException(

exec
/bin/zsh -lc "rg -n \"DocumentJob\\(|job_type=.*parse|input_scope.*locale|locale.*document|parse_document.delay|create\\(.*document\" backend/app/api backend/app/services -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/api/document_diffs.py:175:    job = DocumentJob(
backend/app/services/demo_seed.py:115:                        parse_document.delay(str(existing.id))
backend/app/services/demo_seed.py:164:                parse_document.delay(str(doc_id))
backend/app/api/tables.py:148:    job = DocumentJob(
backend/app/api/tables.py:229:    job = DocumentJob(
backend/app/api/question_templates.py:253:    job = DocumentJob(
backend/app/services/document_diff_service.py:149:    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
backend/app/api/documents.py:435:        parse_document.delay(str(doc.id))
backend/app/api/documents.py:481:        parse_document.delay(str(doc.id))
backend/app/api/documents.py:798:    parse_document.delay(str(doc.id))
backend/app/services/doc_service.py:103:            parse_document.delay(str(doc.id))
backend/app/services/extraction_service.py:280:    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
backend/app/services/extraction_service.py:540:            locale = (job.input_scope or {}).get("locale")
backend/app/api/extractions.py:196:    job = DocumentJob(
backend/app/services/chat_tool_executor.py:142:    job = DocumentJob(
backend/app/services/chat_tool_executor.py:330:        job = DocumentJob(

exec
/bin/zsh -lc "nl -ba backend/app/api/documents.py | sed -n '340,520p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   340	        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
   341	        raise HTTPException(
   342	            status_code=403,
   343	            detail={
   344	                "error": "DOCUMENT_LIMIT_REACHED",
   345	                "message": "Document limit reached for current plan",
   346	                "limit": max_docs,
   347	                "current": user_doc_count,
   348	                "plan": plan,
   349	            },
   350	        )
   351	
   352	    try:
   353	        import asyncio
   354	
   355	        from app.services.extractors.url_extractor import fetch_and_extract_url
   356	        title, pages, pdf_bytes = await asyncio.to_thread(fetch_and_extract_url, url)
   357	    except ValueError as e:
   358	        code = str(e)
   359	        if code in URL_BLOCKED_REASONS:
   360	            log_security_event("url_fetch_blocked", user_id=user.id, reason=code, url=url)
   361	            raise HTTPException(
   362	                status_code=400,
   363	                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
   364	            )
   365	        if code == "URL_CONTENT_TOO_LARGE":
   366	            raise HTTPException(
   367	                status_code=400,
   368	                detail={
   369	                    "error": "URL_CONTENT_TOO_LARGE",
   370	                    "message": "URL content is too large",
   371	                },
   372	            )
   373	        if code == "NO_TEXT_CONTENT":
   374	            raise HTTPException(
   375	                status_code=400,
   376	                detail={"error": "NO_TEXT_CONTENT", "message": "No text content found at URL"},
   377	            )
   378	        if code == "REDIRECT_NO_LOCATION":
   379	            log_security_event("url_fetch_failed", user_id=user.id, reason=code, url=url)
   380	            raise HTTPException(
   381	                status_code=400,
   382	                detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
   383	            )
   384	        logger.exception("Unexpected ValueError in ingest_url fetch")
   385	        raise HTTPException(status_code=500, detail=SERVER_ERROR_DETAIL)
   386	    except Exception as e:
   387	        logger.error("URL fetch failed for %s: %s", url, e)
   388	        log_security_event("url_fetch_failed", user_id=user.id, reason=type(e).__name__, url=url)
   389	        raise HTTPException(
   390	            status_code=400,
   391	            detail={"error": "URL_FETCH_FAILED", "message": "Failed to fetch URL"},
   392	        )
   393	
   394	    max_size_mb = {
   395	        "free": settings.FREE_MAX_FILE_SIZE_MB,
   396	        "plus": settings.PLUS_MAX_FILE_SIZE_MB,
   397	        "pro": settings.PRO_MAX_FILE_SIZE_MB,
   398	    }.get(plan, settings.FREE_MAX_FILE_SIZE_MB)
   399	
   400	    if pdf_bytes:
   401	        if len(pdf_bytes) > max_size_mb * 1024 * 1024:
   402	            log_security_event("upload_rejected", user_id=user.id, reason="file_too_large", size=len(pdf_bytes), max_mb=max_size_mb)
   403	            raise HTTPException(
   404	                status_code=400,
   405	                detail={
   406	                    "error": "FILE_TOO_LARGE",
   407	                    "message": "File is too large",
   408	                    "max_mb": max_size_mb,
   409	                    "plan": plan,
   410	                },
   411	            )
   412	
   413	        # URL returned a PDF — process through normal PDF pipeline
   414	        doc_id = uuid.uuid4()
   415	        storage_key = f"documents/{doc_id}/{title}"
   416	        try:
   417	            await asyncio.to_thread(storage_service.upload_file, pdf_bytes, storage_key, 'application/pdf')
   418	        except StorageUnavailableError:
   419	            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=STORAGE_UNAVAILABLE_DETAIL)
   420	
   421	        doc = Document(
   422	            id=doc_id,
   423	            filename=title,
   424	            file_size=len(pdf_bytes),
   425	            storage_key=storage_key,
   426	            status="parsing",
   427	            user_id=user.id,
   428	            file_type="pdf",
   429	            source_url=url,
   430	        )
   431	        db.add(doc)
   432	        await db.commit()
   433	
   434	        from app.workers.parse_worker import parse_document
   435	        parse_document.delay(str(doc.id))
   436	
   437	        return JSONResponse(
   438	            status_code=status.HTTP_202_ACCEPTED,
   439	            content={"document_id": str(doc_id), "status": "parsing", "filename": title},
   440	        )
   441	    else:
   442	        # URL returned HTML: store a structured Markdown snapshot and process
   443	        # it through the URL text pipeline.
   444	        text_content = '\n\n'.join(p.text for p in pages)
   445	        text_bytes = text_content.encode('utf-8')
   446	        if len(text_bytes) > max_size_mb * 1024 * 1024:
   447	            log_security_event("upload_rejected", user_id=user.id, reason="file_too_large", size=len(text_bytes), max_mb=max_size_mb)
   448	            raise HTTPException(
   449	                status_code=400,
   450	                detail={
   451	                    "error": "FILE_TOO_LARGE",
   452	                    "message": "File is too large",
   453	                    "max_mb": max_size_mb,
   454	                    "plan": plan,
   455	                },
   456	            )
   457	
   458	        doc_id = uuid.uuid4()
   459	        display_title = (title or urlparse(url).netloc or "Imported webpage")[:100]
   460	        storage_filename = sanitize_filename(f"{display_title}.md", max_length=140)
   461	        storage_key = f"documents/{doc_id}/{storage_filename}"
   462	        try:
   463	            await asyncio.to_thread(storage_service.upload_file, text_bytes, storage_key, 'text/markdown')
   464	        except StorageUnavailableError:
   465	            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=STORAGE_UNAVAILABLE_DETAIL)
   466	
   467	        doc = Document(
   468	            id=doc_id,
   469	            filename=display_title,
   470	            file_size=len(text_bytes),
   471	            storage_key=storage_key,
   472	            status="parsing",
   473	            user_id=user.id,
   474	            file_type="url",
   475	            source_url=url,
   476	        )
   477	        db.add(doc)
   478	        await db.commit()
   479	
   480	        from app.workers.parse_worker import parse_document
   481	        parse_document.delay(str(doc.id))
   482	
   483	        return JSONResponse(
   484	            status_code=status.HTTP_202_ACCEPTED,
   485	            content={"document_id": str(doc_id), "status": "parsing", "filename": display_title},
   486	        )
   487	
   488	
   489	@documents_router.get("/{document_id}", response_model=DocumentResponse)
   490	async def get_document(
   491	    document_id: uuid.UUID,
   492	    user: Optional[User] = Depends(get_current_user_optional),
   493	    db: AsyncSession = Depends(get_db_session),
   494	):
   495	    doc = await doc_service.get_document(document_id, db)
   496	    if not doc:
   497	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   498	    if not can_access_document(doc, user):
   499	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   500	    resp = DocumentResponse.model_validate(doc)
   501	    if doc.source_url and resp.filename.lower().endswith((".txt", ".md")):
   502	        resp.filename = resp.filename.rsplit(".", 1)[0]
   503	    resp.has_converted_pdf = bool(doc.converted_storage_key)
   504	    return resp
   505	
   506	
   507	def _brief_chunk_ids(*groups: list[dict]) -> list[uuid.UUID]:
   508	    chunk_ids: list[uuid.UUID] = []
   509	    seen: set[uuid.UUID] = set()
   510	    for group in groups:
   511	        for item in group or []:
   512	            if not isinstance(item, dict):
   513	                continue
   514	            refs = item.get("source_refs")
   515	            if not isinstance(refs, list):
   516	                continue
   517	            for ref in refs:
   518	                if not isinstance(ref, dict):
   519	                    continue
   520	                try:

exec
/bin/zsh -lc "rg -n \"locale\" backend/app/api/documents.py backend/app/schemas -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/schemas/admin.py:187:    locale: str | None = None
backend/app/schemas/chat.py:14:    locale: Optional[str] = None  # Frontend locale code (en/zh/es/fr/de)
backend/app/schemas/chat.py:20:    locale: Optional[str] = None
backend/app/schemas/feedback.py:40:    locale: str | None = Field(default=None, max_length=16)

exec
/bin/zsh -lc "nl -ba backend/app/services/document_element_service.py | sed -n '1,360p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	import math
     4	import uuid
     5	from typing import Any, Sequence
     6	
     7	from sqlalchemy import select
     8	from sqlalchemy.ext.asyncio import AsyncSession
     9	from sqlalchemy.orm import Session
    10	
    11	from app.models.tables import Chunk, DocumentElement
    12	
    13	MIN_ELEMENT_TEXT_CHARS = 24
    14	MIN_CONTEXT_CHUNK_CHARS = 80
    15	
    16	
    17	def _element_text_length(element: Any) -> int:
    18	    return len((getattr(element, "text", "") or "").strip())
    19	
    20	
    21	def _usable_elements(elements: Sequence[Any]) -> list[Any]:
    22	    usable: list[Any] = []
    23	    for element in elements:
    24	        element_type = (getattr(element, "element_type", "") or "").strip()
    25	        text_len = _element_text_length(element)
    26	        if element_type == "table":
    27	            usable.append(element)
    28	        elif element_type == "heading" and text_len >= 3:
    29	            usable.append(element)
    30	        elif text_len >= MIN_ELEMENT_TEXT_CHARS:
    31	            usable.append(element)
    32	    return sorted(usable, key=lambda el: int(getattr(el, "reading_order", 0) or 0))
    33	
    34	
    35	def select_representative_elements(
    36	    elements: Sequence[Any],
    37	    *,
    38	    max_elements: int,
    39	) -> list[Any]:
    40	    """Select broad document structure without relying on vector top-k.
    41	
    42	    The selector keeps orientation, section transitions, table elements, tail
    43	    coverage, and evenly spaced body coverage. The result is deterministic so
    44	    summaries/extractions/diffs get stable context while the legacy chunk
    45	    retriever remains available for local question answering.
    46	    """
    47	    usable = _usable_elements(elements)
    48	    if not usable or max_elements <= 0:
    49	        return []
    50	    if len(usable) <= max_elements:
    51	        return usable
    52	
    53	    selected_indices: set[int] = set()
    54	    front_count = min(4, max(1, max_elements // 3))
    55	    selected_indices.update(range(front_count))
    56	    selected_indices.update(range(max(0, len(usable) - 2), len(usable)))
    57	
    58	    for priority_type in ("table", "heading"):
    59	        for idx, element in enumerate(usable):
    60	            if getattr(element, "element_type", "") == priority_type:
    61	                selected_indices.add(idx)
    62	            if len(selected_indices) >= max_elements:
    63	                break
    64	        if len(selected_indices) >= max_elements:
    65	            break
    66	
    67	    remaining = max_elements - len(selected_indices)
    68	    if remaining > 0:
    69	        if remaining == 1:
    70	            selected_indices.add(len(usable) // 2)
    71	        else:
    72	            for slot in range(remaining):
    73	                selected_indices.add(round(slot * (len(usable) - 1) / (remaining - 1)))
    74	
    75	    if len(selected_indices) > max_elements:
    76	        fixed = set(range(front_count))
    77	        fixed.update(range(max(0, len(usable) - 2), len(usable)))
    78	        middle_budget = max(0, max_elements - len(fixed))
    79	        middle = [idx for idx in sorted(selected_indices) if idx not in fixed]
    80	        if middle_budget and middle:
    81	            step = max(1, math.ceil(len(middle) / middle_budget))
    82	            fixed.update(middle[::step][:middle_budget])
    83	        selected_indices = set(sorted(fixed)[:max_elements])
    84	
    85	    return [usable[idx] for idx in sorted(selected_indices)[:max_elements]]
    86	
    87	
    88	def _chunk_overlaps_element(chunk: Chunk, element: Any) -> bool:
    89	    return (
    90	        int(chunk.page_start or 1) <= int(getattr(element, "page_end", 1) or 1)
    91	        and int(chunk.page_end or chunk.page_start or 1) >= int(getattr(element, "page_start", 1) or 1)
    92	    )
    93	
    94	
    95	def _element_score(element: Any, rank: int) -> float:
    96	    element_type = getattr(element, "element_type", "") or ""
    97	    base = {
    98	        "table": 0.92,
    99	        "heading": 0.88,
   100	        "paragraph": 0.82,
   101	        "caption": 0.80,
   102	        "figure": 0.78,
   103	        "footnote": 0.76,
   104	    }.get(element_type, 0.78)
   105	    return max(0.55, base - rank * 0.01)
   106	
   107	
   108	def select_chunks_for_elements(
   109	    chunks: Sequence[Chunk],
   110	    elements: Sequence[Any],
   111	    *,
   112	    max_chunks: int,
   113	) -> list[tuple[Chunk, float]]:
   114	    if max_chunks <= 0:
   115	        return []
   116	
   117	    ordered_chunks = sorted(chunks, key=lambda ch: int(ch.chunk_index or 0))
   118	    usable_chunks = [
   119	        chunk for chunk in ordered_chunks
   120	        if len((chunk.text or "").strip()) >= MIN_CONTEXT_CHUNK_CHARS
   121	    ] or ordered_chunks
   122	    if not usable_chunks:
   123	        return []
   124	
   125	    selected: list[tuple[Chunk, float]] = []
   126	    seen: set[uuid.UUID] = set()
   127	    representative_elements = select_representative_elements(
   128	        elements,
   129	        max_elements=max(max_chunks * 2, max_chunks),
   130	    )
   131	
   132	    for rank, element in enumerate(representative_elements):
   133	        if len(selected) >= max_chunks:
   134	            break
   135	        element_mid = (
   136	            int(getattr(element, "page_start", 1) or 1)
   137	            + int(getattr(element, "page_end", getattr(element, "page_start", 1)) or 1)
   138	        ) / 2
   139	        candidates = [
   140	            chunk for chunk in usable_chunks
   141	            if chunk.id not in seen and _chunk_overlaps_element(chunk, element)
   142	        ]
   143	        if not candidates:
   144	            continue
   145	        chosen = min(
   146	            candidates,
   147	            key=lambda chunk: (
   148	                abs(element_mid - ((int(chunk.page_start or 1) + int(chunk.page_end or chunk.page_start or 1)) / 2)),
   149	                int(chunk.chunk_index or 0),
   150	            ),
   151	        )
   152	        seen.add(chosen.id)
   153	        selected.append((chosen, _element_score(element, rank)))
   154	
   155	    if len(selected) >= max_chunks:
   156	        return selected[:max_chunks]
   157	
   158	    remaining = [chunk for chunk in usable_chunks if chunk.id not in seen]
   159	    remaining_budget = max_chunks - len(selected)
   160	    if remaining_budget <= 0 or not remaining:
   161	        return selected
   162	
   163	    if len(remaining) <= remaining_budget:
   164	        fill = remaining
   165	    elif remaining_budget == 1:
   166	        fill = [remaining[len(remaining) // 2]]
   167	    else:
   168	        fill = [
   169	            remaining[round(slot * (len(remaining) - 1) / (remaining_budget - 1))]
   170	            for slot in range(remaining_budget)
   171	        ]
   172	    for idx, chunk in enumerate(fill):
   173	        if chunk.id in seen:
   174	            continue
   175	        selected.append((chunk, max(0.5, 0.72 - idx * 0.01)))
   176	        seen.add(chunk.id)
   177	        if len(selected) >= max_chunks:
   178	            break
   179	    return selected[:max_chunks]
   180	
   181	
   182	def chunk_to_retrieval_item(chunk: Chunk, score: float, *, include_document_id: bool = False) -> dict[str, Any]:
   183	    item = {
   184	        "chunk_id": chunk.id,
   185	        "text": chunk.text,
   186	        "page": chunk.page_start,
   187	        "page_end": chunk.page_end,
   188	        "bboxes": chunk.bboxes,
   189	        "score": score,
   190	        "section_title": chunk.section_title,
   191	    }
   192	    if include_document_id:
   193	        item["document_id"] = chunk.document_id
   194	    return item
   195	
   196	
   197	def get_element_aware_chunks(
   198	    db: Session,
   199	    document_id: uuid.UUID,
   200	    *,
   201	    max_chunks: int,
   202	) -> list[tuple[Chunk, float]]:
   203	    element_rows = db.execute(
   204	        select(DocumentElement)
   205	        .where(DocumentElement.document_id == document_id)
   206	        .order_by(DocumentElement.reading_order)
   207	    )
   208	    elements = list(element_rows.scalars())
   209	    if not _usable_elements(elements):
   210	        return []
   211	
   212	    chunk_rows = db.execute(
   213	        select(Chunk)
   214	        .where(Chunk.document_id == document_id)
   215	        .order_by(Chunk.chunk_index)
   216	    )
   217	    chunks = list(chunk_rows.scalars())
   218	    return select_chunks_for_elements(chunks, elements, max_chunks=max_chunks)
   219	
   220	
   221	async def get_element_aware_chunks_async(
   222	    db: AsyncSession,
   223	    document_id: uuid.UUID,
   224	    *,
   225	    max_chunks: int,
   226	) -> list[tuple[Chunk, float]]:
   227	    element_rows = await db.execute(
   228	        select(DocumentElement)
   229	        .where(DocumentElement.document_id == document_id)
   230	        .order_by(DocumentElement.reading_order)
   231	    )
   232	    elements = list(element_rows.scalars())
   233	    if not _usable_elements(elements):
   234	        return []
   235	
   236	    chunk_rows = await db.execute(
   237	        select(Chunk)
   238	        .where(Chunk.document_id == document_id)
   239	        .order_by(Chunk.chunk_index)
   240	    )
   241	    chunks = list(chunk_rows.scalars())
   242	    return select_chunks_for_elements(chunks, elements, max_chunks=max_chunks)

web search: 
web search: 
exec
/bin/zsh -lc "rg -n \"class _ChunkInfo|document_id:|bboxes|chunk_map|citation|\\[n\\]|source_refs\" backend/app/services/chat_service.py backend/app/schemas -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/chat_service.py:198:def _citation_payload(ref_num: int, chunk: "_ChunkInfo", offset: int) -> Dict[str, Any]:
backend/app/services/chat_service.py:201:        for bb in (chunk.bboxes or [])
backend/app/services/chat_service.py:227:    citation_data: Dict[str, Any] = {
backend/app/services/chat_service.py:232:        "bboxes": all_bbs,
backend/app/services/chat_service.py:236:    citation_data["confidence_score"] = round(chunk.score, 3)
backend/app/services/chat_service.py:237:    citation_data["context_text"] = (chunk.text or "")[:900]
backend/app/services/chat_service.py:238:    if chunk.document_id:
backend/app/services/chat_service.py:239:        citation_data["document_id"] = str(chunk.document_id)
backend/app/services/chat_service.py:241:        citation_data["document_filename"] = chunk.document_filename
backend/app/services/chat_service.py:243:        citation_data["table_id"] = chunk.table_id
backend/app/services/chat_service.py:244:        citation_data["retrieval_modality"] = chunk.retrieval_modality or "table"
backend/app/services/chat_service.py:245:        citation_data["table_context"] = (chunk.text or "")[:1400]
backend/app/services/chat_service.py:246:    return citation_data
backend/app/services/chat_service.py:263:def _citation_anchor_offsets(text: str, *, limit: int = 8) -> list[tuple[int, str]]:
backend/app/services/chat_service.py:284:def _fallback_citations(
backend/app/services/chat_service.py:286:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:291:    """Create deterministic citations when the model forgets bracket refs.
backend/app/services/chat_service.py:293:    The primary path is still model-authored [n] markers. This fallback prevents
backend/app/services/chat_service.py:297:    if not assistant_text.strip() or not chunk_map:
backend/app/services/chat_service.py:302:        for ref_num, chunk in chunk_map.items()
backend/app/services/chat_service.py:307:    for offset, anchor_text in _citation_anchor_offsets(assistant_text, limit=limit):
backend/app/services/chat_service.py:317:            best_ref = min(chunk_map.keys())
backend/app/services/chat_service.py:322:        fallback.append(_citation_payload(best_ref, chunk_map[best_ref], base_offset + offset))
backend/app/services/chat_service.py:329:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:331:    fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:333:    citations: List[dict] = []
backend/app/services/chat_service.py:337:        elif ev["event"] == "citation":
backend/app/services/chat_service.py:338:            citations.append(ev["data"])
backend/app/services/chat_service.py:341:    if not citations:
backend/app/services/chat_service.py:342:        citations = _fallback_citations(clean_text, chunk_map)
backend/app/services/chat_service.py:343:    return clean_text, citations
backend/app/services/chat_service.py:350:        "invalid_citation_count",
backend/app/services/chat_service.py:351:        "low_overlap_citation_count",
backend/app/services/chat_service.py:352:        "numeric_mismatch_citation_count",
backend/app/services/chat_service.py:380:    citations: List[dict],
backend/app/services/chat_service.py:381:    chunk_map: dict[int, "_ChunkInfo"],
backend/app/services/chat_service.py:386:    if verification.get("status") == "pass" or not chunk_map or not assistant_text.strip():
backend/app/services/chat_service.py:402:        "Every factual sentence, paragraph, or bullet must end with one or more bracket citations like [1].\n"
backend/app/services/chat_service.py:405:        f"Write in {language}. Return only the corrected final answer, with citations."
backend/app/services/chat_service.py:439:        repaired_text, repaired_citations = _parse_cited_answer(repaired_raw, chunk_map)
backend/app/services/chat_service.py:442:            repaired_citations,
backend/app/services/chat_service.py:443:            set(chunk_map.keys()),
backend/app/services/chat_service.py:444:            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:457:            citations=repaired_citations if applied else citations,
backend/app/services/chat_service.py:465:        logger.warning("Failed to repair RAG answer citations", exc_info=True)
backend/app/services/chat_service.py:469:            citations=citations,
backend/app/services/chat_service.py:478:def _citation_contract() -> str:
backend/app/services/chat_service.py:481:        "- Every answer based on document excerpts MUST include clickable bracket citations like [1].\n"
backend/app/services/chat_service.py:482:        "- Put a citation at the end of every factual paragraph or bullet that uses document content.\n"
backend/app/services/chat_service.py:483:        "- Prefer short factual bullets over dense paragraphs; one bullet should contain one main claim and its citation.\n"
backend/app/services/chat_service.py:485:        "- A response with no [n] citations is invalid unless there are no relevant excerpts.\n"
backend/app/services/chat_service.py:522:        "- If one side has evidence and another side does not, state that asymmetry with citations instead of filling the gap.\n"
backend/app/services/chat_service.py:572:    citations: Optional[List[dict]] = None,
backend/app/services/chat_service.py:585:            citations=citations or None,
backend/app/services/chat_service.py:598:    new_citations: List[dict],
backend/app/services/chat_service.py:609:        merged_citations = list(asst_msg.citations or []) + list(new_citations or [])
backend/app/services/chat_service.py:611:        asst_msg.citations = merged_citations if merged_citations else None
backend/app/services/chat_service.py:651:    document_id: uuid.UUID,
backend/app/services/chat_service.py:694:            "citation_count": verification.get("citation_count"),
backend/app/services/chat_service.py:695:            "invalid_citation_count": verification.get("invalid_citation_count"),
backend/app/services/chat_service.py:696:            "low_overlap_citation_count": verification.get("low_overlap_citation_count"),
backend/app/services/chat_service.py:697:            "numeric_mismatch_citation_count": verification.get("numeric_mismatch_citation_count"),
backend/app/services/chat_service.py:725:class _ChunkInfo:
backend/app/services/chat_service.py:729:    bboxes: list
backend/app/services/chat_service.py:732:    document_id: Optional[uuid.UUID] = None
backend/app/services/chat_service.py:742:    citations: List[dict]
backend/app/services/chat_service.py:750:def _chunk_info_from_persisted_citation(
backend/app/services/chat_service.py:752:    citation: dict,
backend/app/services/chat_service.py:755:    table_id = str(citation.get("table_id") or "") or None
backend/app/services/chat_service.py:756:    table_context = citation.get("table_context")
backend/app/services/chat_service.py:760:        page_start=int(citation.get("page") or chunk.page_start) if is_table else chunk.page_start,
backend/app/services/chat_service.py:761:        page_end=int(citation.get("page_end") or citation.get("page") or chunk.page_end) if is_table else chunk.page_end,
backend/app/services/chat_service.py:762:        bboxes=citation.get("bboxes") or [] if is_table else chunk.bboxes or [],
backend/app/services/chat_service.py:767:        score=float(citation.get("confidence_score") or 0.0),
backend/app/services/chat_service.py:774:    """解析 LLM 流式输出中的 [n] 引用标记
backend/app/services/chat_service.py:781:    def __init__(self, chunk_map: dict[int, _ChunkInfo]):
backend/app/services/chat_service.py:782:        self.chunk_map = chunk_map
backend/app/services/chat_service.py:802:                    if inner.isdigit() and (int(inner) in self.chunk_map):
backend/app/services/chat_service.py:804:                        chunk = self.chunk_map[ref_num]
backend/app/services/chat_service.py:805:                        events.append(sse("citation", _citation_payload(ref_num, chunk, self.char_offset)))
backend/app/services/chat_service.py:860:        document_id: uuid.UUID | None,
backend/app/services/chat_service.py:892:                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
backend/app/services/chat_service.py:908:                    "citations_count": 0,
backend/app/services/chat_service.py:939:        8) Save assistant message + citations
backend/app/services/chat_service.py:1138:            elif document_id:
backend/app/services/chat_service.py:1157:            chunk_map: dict[int, _ChunkInfo] = {}
backend/app/services/chat_service.py:1171:                chunk_map[idx] = _ChunkInfo(
backend/app/services/chat_service.py:1175:                    bboxes=item.get("bboxes") or [],
backend/app/services/chat_service.py:1206:                    + _citation_contract()
backend/app/services/chat_service.py:1219:                    + _citation_contract()
backend/app/services/chat_service.py:1238:                    + _citation_contract()
backend/app/services/chat_service.py:1249:                    + _citation_contract()
backend/app/services/chat_service.py:1350:        citations: List[dict] = []
backend/app/services/chat_service.py:1351:        fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:1392:                            elif ev["event"] == "citation":
backend/app/services/chat_service.py:1393:                                citations.append(ev["data"])
backend/app/services/chat_service.py:1417:                if not citations:
backend/app/services/chat_service.py:1419:                    fallback_citations = _fallback_citations(assistant_snapshot, chunk_map)
backend/app/services/chat_service.py:1420:                    if fallback_citations:
backend/app/services/chat_service.py:1422:                            "LLM emitted no citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:1423:                            len(fallback_citations),
backend/app/services/chat_service.py:1426:                        for citation in fallback_citations:
backend/app/services/chat_service.py:1427:                            citations.append(citation)
backend/app/services/chat_service.py:1428:                            yield sse("citation", citation)
backend/app/services/chat_service.py:1474:                    citations=citations or None,
backend/app/services/chat_service.py:1503:                citations,
backend/app/services/chat_service.py:1504:                set(chunk_map.keys()),
backend/app/services/chat_service.py:1505:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1509:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:1516:                    citations=citations,
backend/app/services/chat_service.py:1517:                    chunk_map=chunk_map,
backend/app/services/chat_service.py:1530:                        citations = repair.citations
backend/app/services/chat_service.py:1534:                            citations,
backend/app/services/chat_service.py:1535:                            set(chunk_map.keys()),
backend/app/services/chat_service.py:1536:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1543:                                "citations": citations,
backend/app/services/chat_service.py:1549:                    "RAG verification status=%s score=%.3f claims=%d citations=%d reasons=%s",
backend/app/services/chat_service.py:1553:                    verification_report.citation_count,
backend/app/services/chat_service.py:1561:                asst_msg.citations = citations or None
backend/app/services/chat_service.py:1577:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1610:                "citations_count": len(citations),
backend/app/services/chat_service.py:1628:                                citations=citations,
backend/app/services/chat_service.py:1778:            # 6) Reconstruct chunk_map from original citations
backend/app/services/chat_service.py:1779:            chunk_map: dict[int, _ChunkInfo] = {}
backend/app/services/chat_service.py:1780:            original_citations = asst_msg.citations or []
backend/app/services/chat_service.py:1781:            if original_citations:
backend/app/services/chat_service.py:1784:                ref_to_citation: dict[int, dict] = {}
backend/app/services/chat_service.py:1786:                for cit in original_citations:
backend/app/services/chat_service.py:1799:                        ref_to_citation[normalized_ref] = cit
backend/app/services/chat_service.py:1828:                            citation = dict(ref_to_citation.get(ref_num) or {})
backend/app/services/chat_service.py:1829:                            table_id = citation.get("table_id")
backend/app/services/chat_service.py:1830:                            if table_id and not citation.get("table_context"):
backend/app/services/chat_service.py:1833:                                    citation["table_context"] = table_evidence_text(table)
backend/app/services/chat_service.py:1834:                                    citation["page"] = table.page
backend/app/services/chat_service.py:1835:                                    citation["page_end"] = table.page
backend/app/services/chat_service.py:1836:                            chunk_map[ref_num] = _chunk_info_from_persisted_citation(
backend/app/services/chat_service.py:1838:                                citation,
backend/app/services/chat_service.py:1864:            # 8) Build system prompt with chunk_map context
backend/app/services/chat_service.py:1866:            for idx in sorted(chunk_map.keys()):
backend/app/services/chat_service.py:1867:                info = chunk_map[idx]
backend/app/services/chat_service.py:1870:                if is_collection_session and info.document_id:
backend/app/services/chat_service.py:1889:                    + _citation_contract()
backend/app/services/chat_service.py:1898:                    + _citation_contract()
backend/app/services/chat_service.py:1973:        new_citations: List[dict] = []
backend/app/services/chat_service.py:1974:        fsm = RefParserFSM(chunk_map)
backend/app/services/chat_service.py:1975:        fsm.char_offset = len(asst_msg.content)  # Offset citations relative to full text
backend/app/services/chat_service.py:2007:                            elif ev["event"] == "citation":
backend/app/services/chat_service.py:2008:                                new_citations.append(ev["data"])
backend/app/services/chat_service.py:2028:                if not new_citations:
backend/app/services/chat_service.py:2030:                    fallback_citations = _fallback_citations(
backend/app/services/chat_service.py:2032:                        chunk_map,
backend/app/services/chat_service.py:2035:                    if fallback_citations:
backend/app/services/chat_service.py:2037:                            "LLM emitted no continuation citation markers; generated %d fallback citations model=%s",
backend/app/services/chat_service.py:2038:                            len(fallback_citations),
backend/app/services/chat_service.py:2041:                        for citation in fallback_citations:
backend/app/services/chat_service.py:2042:                            new_citations.append(citation)
backend/app/services/chat_service.py:2043:                            yield sse("citation", citation)
backend/app/services/chat_service.py:2071:            merged_citations = list(asst_msg.citations or []) + new_citations
backend/app/services/chat_service.py:2074:                asst_msg.citations = merged_citations if merged_citations else None
backend/app/services/chat_service.py:2101:                merged_citations,
backend/app/services/chat_service.py:2102:                set(chunk_map.keys()),
backend/app/services/chat_service.py:2103:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2107:                yield sse("tool_status", {"message": "Checking citation support..."})
backend/app/services/chat_service.py:2114:                    citations=merged_citations,
backend/app/services/chat_service.py:2115:                    chunk_map=chunk_map,
backend/app/services/chat_service.py:2128:                        merged_citations = repair.citations
backend/app/services/chat_service.py:2131:                            merged_citations,
backend/app/services/chat_service.py:2132:                            set(chunk_map.keys()),
backend/app/services/chat_service.py:2133:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2140:                                "citations": merged_citations,
backend/app/services/chat_service.py:2146:                    "RAG continuation verification status=%s score=%.3f claims=%d citations=%d reasons=%s",
backend/app/services/chat_service.py:2150:                    verification_report.citation_count,
backend/app/services/chat_service.py:2156:                asst_msg.citations = merged_citations if merged_citations else None
backend/app/services/chat_service.py:2171:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2203:                "citations_count": len(merged_citations) if merged_citations else 0,
backend/app/services/chat_service.py:2221:                                new_citations=new_citations,
backend/app/schemas/search.py:18:    bboxes: list
backend/app/schemas/document.py:50:    bboxes: list[dict] = Field(default_factory=list)
backend/app/schemas/document.py:58:    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)
backend/app/schemas/document.py:63:    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)
backend/app/schemas/document.py:70:    source_refs: list[DocumentBriefSourceRef] = Field(default_factory=list)
backend/app/schemas/document.py:96:    document_id: str
backend/app/schemas/document.py:102:    document_id: str
backend/app/schemas/chat.py:28:    citations: Optional[List[dict]] = None
backend/app/schemas/chat.py:38:    document_id: uuid.UUID
backend/app/schemas/feedback.py:11:    "citation_problem",
backend/app/schemas/feedback.py:20:    "citation_jump",

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '160,280p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   160	
   161	def _is_deepseek_official_model(model: str) -> bool:
   162	    return model in settings.DEEPSEEK_OFFICIAL_MODELS
   163	
   164	
   165	def _get_deepseek_client() -> AsyncOpenAI:
   166	    global _deepseek_client
   167	    if not settings.DEEPSEEK_API_KEY:
   168	        raise RuntimeError("DEEPSEEK_API_KEY is not configured")
   169	    if _deepseek_client is None:
   170	        _deepseek_client = AsyncOpenAI(
   171	            api_key=settings.DEEPSEEK_API_KEY,
   172	            base_url=settings.DEEPSEEK_BASE_URL,
   173	        )
   174	    return _deepseek_client
   175	
   176	
   177	def _get_llm_client(model: str) -> AsyncOpenAI:
   178	    if _is_deepseek_official_model(model):
   179	        return _get_deepseek_client()
   180	    return _get_openai_client()
   181	
   182	
   183	def _apply_provider_options(create_kwargs: dict[str, Any], model: str) -> None:
   184	    """Apply provider-specific body options.
   185	
   186	    DeepSeek V4 defaults to thinking enabled. DocTalk's interactive Flash/Pro
   187	    modes are the non-thinking variants unless a future product surface enables
   188	    a separately priced reasoning path.
   189	    """
   190	    if _is_deepseek_official_model(model):
   191	        create_kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
   192	
   193	
   194	def _is_valid_bbox(bb: dict) -> bool:
   195	    return all(isinstance(bb.get(k), (int, float)) for k in ("x", "y", "w", "h"))
   196	
   197	
   198	def _citation_payload(ref_num: int, chunk: "_ChunkInfo", offset: int) -> Dict[str, Any]:
   199	    all_bbs = [
   200	        bb
   201	        for bb in (chunk.bboxes or [])
   202	        if isinstance(bb, dict) and _is_valid_bbox(bb)
   203	    ]
   204	    all_bbs.sort(
   205	        key=lambda b: (
   206	            int(b.get("page", chunk.page_start))
   207	            if isinstance(b.get("page", chunk.page_start), (int, float))
   208	            else chunk.page_start,
   209	            b.get("y", 0),
   210	            b.get("x", 0),
   211	        )
   212	    )
   213	    page_counts: dict[int, int] = {}
   214	    for bb in all_bbs:
   215	        page_val = bb.get("page", chunk.page_start)
   216	        page = (
   217	            int(page_val)
   218	            if isinstance(page_val, (int, float))
   219	            else chunk.page_start
   220	        )
   221	        page_counts[page] = page_counts.get(page, 0) + 1
   222	    best_page = (
   223	        min(page_counts, key=lambda p: (-page_counts[p], p))
   224	        if page_counts
   225	        else chunk.page_start
   226	    )
   227	    citation_data: Dict[str, Any] = {
   228	        "ref_index": ref_num,
   229	        "chunk_id": str(chunk.id),
   230	        "page": best_page,
   231	        "page_end": chunk.page_end,
   232	        "bboxes": all_bbs,
   233	        "text_snippet": ((f"{chunk.section_title}: " if chunk.section_title else "") + (chunk.text or ""))[:100],
   234	        "offset": offset,
   235	    }
   236	    citation_data["confidence_score"] = round(chunk.score, 3)
   237	    citation_data["context_text"] = (chunk.text or "")[:900]
   238	    if chunk.document_id:
   239	        citation_data["document_id"] = str(chunk.document_id)
   240	    if chunk.document_filename:
   241	        citation_data["document_filename"] = chunk.document_filename
   242	    if chunk.table_id:
   243	        citation_data["table_id"] = chunk.table_id
   244	        citation_data["retrieval_modality"] = chunk.retrieval_modality or "table"
   245	        citation_data["table_context"] = (chunk.text or "")[:1400]
   246	    return citation_data
   247	
   248	
   249	_LATIN_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9_\-]{2,}")
   250	_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
   251	
   252	
   253	def _text_features(text: str) -> set[str]:
   254	    lowered = text.lower()
   255	    features = set(_LATIN_WORD_RE.findall(lowered))
   256	    cjk_chars = _CJK_RE.findall(text)
   257	    features.update(cjk_chars)
   258	    for i in range(len(cjk_chars) - 1):
   259	        features.add(cjk_chars[i] + cjk_chars[i + 1])
   260	    return features
   261	
   262	
   263	def _citation_anchor_offsets(text: str, *, limit: int = 8) -> list[tuple[int, str]]:
   264	    anchors: list[tuple[int, str]] = []
   265	    cursor = 0
   266	    for raw_line in text.splitlines(keepends=True):
   267	        line = raw_line.strip()
   268	        cursor += len(raw_line)
   269	        if not line:
   270	            continue
   271	        if len(line) < 24 and not re.match(r"^(\d+\.|[-*•])\s+", line):
   272	            continue
   273	        anchors.append((max(0, cursor - len(raw_line) + len(raw_line.rstrip("\n\r"))), line))
   274	        if len(anchors) >= limit:
   275	            return anchors
   276	
   277	    if anchors:
   278	        return anchors
   279	
   280	    stripped = text.strip()

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '700,780p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   700	            "route": getattr(getattr(query_route, "primary_intent", None), "value", None),
   701	        }
   702	        if repair_metadata:
   703	            metadata_json.update(repair_metadata)
   704	        db.add(
   705	            ProductEvent(
   706	                user_id=user.id if user else None,
   707	                event_name="rag_verification_completed",
   708	                source="chat",
   709	                reason=str(verification.get("status") or "unknown")[:64],
   710	                plan=(user.plan if user else None),
   711	                metadata_json=metadata_json,
   712	            )
   713	        )
   714	        await db.commit()
   715	    except Exception:
   716	        await db.rollback()
   717	        logger.warning("Failed to record RAG verification event", exc_info=True)
   718	
   719	
   720	# ---------------------------
   721	# RefParserFSM
   722	# ---------------------------
   723	
   724	@dataclass
   725	class _ChunkInfo:
   726	    id: uuid.UUID
   727	    page_start: int
   728	    page_end: int
   729	    bboxes: list
   730	    text: str
   731	    section_title: str = ""
   732	    document_id: Optional[uuid.UUID] = None
   733	    document_filename: str = ""
   734	    score: float = 0.0
   735	    table_id: Optional[str] = None
   736	    retrieval_modality: str = "text"
   737	
   738	
   739	@dataclass
   740	class _CitationRepairResult:
   741	    text: str
   742	    citations: List[dict]
   743	    verification: dict
   744	    metadata: dict[str, Any]
   745	    prompt_tokens: int = 0
   746	    output_tokens: int = 0
   747	    applied: bool = False
   748	
   749	
   750	def _chunk_info_from_persisted_citation(
   751	    chunk: Chunk,
   752	    citation: dict,
   753	    collection_doc_names: dict[uuid.UUID, str],
   754	) -> _ChunkInfo:
   755	    table_id = str(citation.get("table_id") or "") or None
   756	    table_context = citation.get("table_context")
   757	    is_table = table_id is not None and isinstance(table_context, str) and table_context.strip()
   758	    return _ChunkInfo(
   759	        id=chunk.id,
   760	        page_start=int(citation.get("page") or chunk.page_start) if is_table else chunk.page_start,
   761	        page_end=int(citation.get("page_end") or citation.get("page") or chunk.page_end) if is_table else chunk.page_end,
   762	        bboxes=citation.get("bboxes") or [] if is_table else chunk.bboxes or [],
   763	        text=table_context if is_table else chunk.text,
   764	        section_title=(table_context.splitlines()[0][:200] if is_table else chunk.section_title or ""),
   765	        document_id=chunk.document_id,
   766	        document_filename=collection_doc_names.get(chunk.document_id, ""),
   767	        score=float(citation.get("confidence_score") or 0.0),
   768	        table_id=table_id,
   769	        retrieval_modality="table" if is_table else "text",
   770	    )
   771	
   772	
   773	class RefParserFSM:
   774	    """解析 LLM 流式输出中的 [n] 引用标记
   775	
   776	    - state: TEXT | MAYBE_REF
   777	    - buffer 上限 8 字符，超限回退
   778	    - char_offset: 已输出字符计数
   779	    """
   780	

web search: 
web search: 
web search: 
web search: 
exec
/bin/zsh -lc "rg -n \"generate_summary_sync|generate_document_brief_sync|DocumentBrief|brief\" backend/app/workers/parse_worker.py backend/app/services -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/workers/parse_worker.py:15:from app.models.tables import Chunk, Document, DocumentBrief, DocumentElement, Page
backend/app/workers/parse_worker.py:102:def _queue_document_brief(document_id: str) -> None:
backend/app/workers/parse_worker.py:104:        from app.workers.brief_worker import generate_document_brief
backend/app/workers/parse_worker.py:106:        generate_document_brief.delay(document_id)
backend/app/workers/parse_worker.py:108:        logger.warning("Failed to queue document brief generation for %s: %s", document_id, exc)
backend/app/workers/parse_worker.py:141:            db.execute(sa_delete(DocumentBrief).where(DocumentBrief.document_id == doc.id))
backend/app/workers/parse_worker.py:489:                # Best-effort: generate persisted brief + legacy summary fields in a separate task.
backend/app/workers/parse_worker.py:490:                _queue_document_brief(document_id)
backend/app/services/document_brief_service.py:12:from app.models.tables import Chunk, Document, DocumentBrief
backend/app/services/document_brief_service.py:411:class DocumentBriefService:
backend/app/services/document_brief_service.py:511:        brief_row = await db.execute(
backend/app/services/document_brief_service.py:512:            select(DocumentBrief.coverage).where(DocumentBrief.document_id == document_id)
backend/app/services/document_brief_service.py:514:        coverage = brief_row.scalar_one_or_none()
backend/app/services/document_brief_service.py:578:document_brief_service = DocumentBriefService()
backend/app/services/chat_service.py:36:from app.services.document_brief_service import document_brief_service
backend/app/services/chat_service.py:1081:            # selector until the durable hierarchical brief index lands.
backend/app/services/chat_service.py:1091:                retrieved = await document_brief_service.get_summary_context(
backend/app/services/chat_service.py:1102:                retrieved = await document_brief_service.get_collection_summary_context(
backend/app/services/query_router.py:73:    r"\bbrief(ing)?\b",
backend/app/services/extraction_service.py:57:        description="A concise cited brief for business and research readers.",
backend/app/services/summary_service.py:1:"""Generate persisted hierarchical document briefs after parsing.
backend/app/services/summary_service.py:5:brief row when possible, but never change the document's parse status.
backend/app/services/summary_service.py:22:from app.models.tables import Chunk, Document, DocumentBrief
backend/app/services/summary_service.py:23:from app.services.document_brief_service import _select_representative_chunks
backend/app/services/summary_service.py:27:BRIEF_PROMPT_VERSION = "document_brief_v1"
backend/app/services/summary_service.py:33:BRIEF_PROMPT = """You are building a structured document brief for a professional document workspace.
backend/app/services/summary_service.py:187:def normalize_document_brief(
backend/app/services/summary_service.py:257:def _get_existing_brief(db: Session, document_id: uuid.UUID) -> DocumentBrief | None:
backend/app/services/summary_service.py:259:        select(DocumentBrief).where(DocumentBrief.document_id == document_id)
backend/app/services/summary_service.py:263:def _apply_payload_to_doc_and_brief(
backend/app/services/summary_service.py:265:    brief: DocumentBrief,
backend/app/services/summary_service.py:270:    brief.schema_version = BRIEF_SCHEMA_VERSION
backend/app/services/summary_service.py:271:    brief.prompt_version = BRIEF_PROMPT_VERSION
backend/app/services/summary_service.py:272:    brief.model = model
backend/app/services/summary_service.py:273:    brief.summary = payload.get("summary") or None
backend/app/services/summary_service.py:274:    brief.outline = payload.get("outline") or []
backend/app/services/summary_service.py:275:    brief.key_points = payload.get("key_points") or []
backend/app/services/summary_service.py:276:    brief.facts = payload.get("facts") or []
backend/app/services/summary_service.py:277:    brief.questions = payload.get("questions") or []
backend/app/services/summary_service.py:278:    brief.coverage = payload.get("coverage") or {}
backend/app/services/summary_service.py:279:    brief.error_code = None
backend/app/services/summary_service.py:280:    brief.error_message = None
backend/app/services/summary_service.py:281:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:283:    doc.summary = brief.summary
backend/app/services/summary_service.py:284:    doc.suggested_questions = brief.questions
backend/app/services/summary_service.py:287:def _persist_brief_error(
backend/app/services/summary_service.py:295:    brief = _get_existing_brief(db, doc.id)
backend/app/services/summary_service.py:296:    if brief is None:
backend/app/services/summary_service.py:297:        brief = DocumentBrief(
backend/app/services/summary_service.py:305:    brief.schema_version = BRIEF_SCHEMA_VERSION
backend/app/services/summary_service.py:306:    brief.prompt_version = BRIEF_PROMPT_VERSION
backend/app/services/summary_service.py:307:    brief.model = model
backend/app/services/summary_service.py:308:    brief.error_code = code
backend/app/services/summary_service.py:309:    brief.error_message = message[:2000]
backend/app/services/summary_service.py:310:    brief.generated_at = datetime.now(timezone.utc)
backend/app/services/summary_service.py:311:    db.add(brief)
backend/app/services/summary_service.py:332:def generate_document_brief_sync(document_id: str) -> None:
backend/app/services/summary_service.py:333:    """Load representative chunks, call the LLM, and persist a structured brief."""
backend/app/services/summary_service.py:337:            logger.warning("Document %s not found for brief generation", document_id)
backend/app/services/summary_service.py:342:            logger.warning("No LLM API key configured, recording brief generation failure")
backend/app/services/summary_service.py:343:            _persist_brief_error(
backend/app/services/summary_service.py:347:                message="No LLM API key configured for document brief generation",
backend/app/services/summary_service.py:360:            logger.warning("No chunks found for document %s, skipping brief generation", document_id)
backend/app/services/summary_service.py:361:            _persist_brief_error(
backend/app/services/summary_service.py:365:                message="No chunks found for document brief generation",
backend/app/services/summary_service.py:373:            _persist_brief_error(
backend/app/services/summary_service.py:377:                message="No representative chunks selected for document brief generation",
backend/app/services/summary_service.py:394:            payload = normalize_document_brief(
backend/app/services/summary_service.py:403:                logger.warning("Document %s changed during brief generation; discarding stale brief", document_id)
backend/app/services/summary_service.py:406:            brief = _get_existing_brief(db, doc.id)
backend/app/services/summary_service.py:407:            if brief is None:
backend/app/services/summary_service.py:408:                brief = DocumentBrief(document_id=doc.id)
backend/app/services/summary_service.py:409:            _apply_payload_to_doc_and_brief(doc, brief, payload, model=BRIEF_MODEL)
backend/app/services/summary_service.py:410:            db.add(brief)
backend/app/services/summary_service.py:414:                "Document brief generated for %s: %d outline items, %d key points, %d facts",
backend/app/services/summary_service.py:416:                len(brief.outline),
backend/app/services/summary_service.py:417:                len(brief.key_points),
backend/app/services/summary_service.py:418:                len(brief.facts),
backend/app/services/summary_service.py:421:            logger.warning("Failed to parse document brief JSON for %s: %s", document_id, exc)
backend/app/services/summary_service.py:422:            _persist_brief_error(db, doc, code="BRIEF_JSON_INVALID", message=str(exc), model=BRIEF_MODEL)
backend/app/services/summary_service.py:424:            logger.exception("Document brief generation failed for %s: %s", document_id, exc)
backend/app/services/summary_service.py:425:            _persist_brief_error(db, doc, code="BRIEF_GENERATION_FAILED", message=str(exc), model=BRIEF_MODEL)
backend/app/services/summary_service.py:428:def generate_summary_sync(document_id: str) -> None:
backend/app/services/summary_service.py:430:    generate_document_brief_sync(document_id)
backend/app/services/action_planner.py:59:_SUMMARY_RE = re.compile(r"\b(summarize|summary|brief|overview|tldr|executive summary)\b|总结|摘要|概括|要点", re.IGNORECASE)
backend/app/services/action_planner.py:203:    if has_summary and re.search(r"\bexecutive\s+summary|deliverable|briefing\b|交付|简报", text, re.IGNORECASE):
backend/app/services/table_service.py:528:                    "warnings": ["brief uncertainty notes"],

exec
/bin/zsh -lc "nl -ba backend/app/workers/parse_worker.py | sed -n '80,150p' && nl -ba backend/app/workers/parse_worker.py | sed -n '460,520p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    80	        response.close()
    81	        response.release_conn()
    82	    return data
    83	
    84	
    85	def _set_timeout_error(document_id: str, message: str) -> None:
    86	    try:
    87	        doc_uuid = uuid.UUID(document_id)
    88	    except Exception:
    89	        logger.warning("Failed to parse document id during timeout handling: %s", document_id)
    90	        return
    91	
    92	    with SyncSessionLocal() as db:
    93	        doc: Optional[Document] = db.get(Document, doc_uuid)
    94	        if not doc:
    95	            logger.warning("Timeout handler could not find document: %s", document_id)
    96	            return
    97	        _set_doc_error(doc, "PARSE_TIMEOUT", message)
    98	        db.add(doc)
    99	        db.commit()
   100	
   101	
   102	def _queue_document_brief(document_id: str) -> None:
   103	    try:
   104	        from app.workers.brief_worker import generate_document_brief
   105	
   106	        generate_document_brief.delay(document_id)
   107	    except Exception as exc:
   108	        logger.warning("Failed to queue document brief generation for %s: %s", document_id, exc)
   109	
   110	
   111	@celery_app.task(
   112	    name="app.workers.parse_worker.parse_document",
   113	    bind=True,
   114	    time_limit=600,
   115	    soft_time_limit=540,
   116	    autoretry_for=(Exception,),
   117	    retry_kwargs={"max_retries": 2},
   118	    retry_backoff=60,
   119	)
   120	def parse_document(self, document_id: str) -> None:
   121	    """Parse a document from object storage, chunk it and persist metadata.
   122	
   123	    Supports PDF (via PyMuPDF) and non-PDF formats (DOCX, PPTX, XLSX, TXT, MD)
   124	    via format-specific extractors.
   125	    """
   126	    logger.info("Starting parse_document for %s", document_id)
   127	
   128	    timeout_message = "Document parsing timed out after 9 minutes"
   129	    service = ParseService()
   130	
   131	    try:
   132	        with SyncSessionLocal() as db:
   133	            doc: Optional[Document] = db.get(Document, uuid.UUID(document_id))
   134	            if not doc:
   135	                logger.error("Document %s not found", document_id)
   136	                return
   137	
   138	            # Clean up partial data from previous attempts (idempotent re-parse)
   139	            from sqlalchemy import delete as sa_delete
   140	
   141	            db.execute(sa_delete(DocumentBrief).where(DocumentBrief.document_id == doc.id))
   142	            db.execute(sa_delete(DocumentElement).where(DocumentElement.document_id == doc.id))
   143	            db.execute(sa_delete(Chunk).where(Chunk.document_id == doc.id))
   144	            db.execute(sa_delete(Page).where(Page.document_id == doc.id))
   145	            doc.pages_parsed = 0
   146	            doc.chunks_total = 0
   147	            doc.chunks_indexed = 0
   148	            doc.summary = None
   149	            doc.suggested_questions = None
   150	            doc.status = "parsing"
   460	                                    "page_start": int(c.page_start),
   461	                                },
   462	                            )
   463	                        )
   464	
   465	                    # Upsert to Qdrant
   466	                    qclient.upsert(collection_name=settings.QDRANT_COLLECTION, points=points, wait=True)
   467	
   468	                    # Update vector_id for chunks in DB
   469	                    for c in batch:
   470	                        c.vector_id = str(c.id)
   471	                        db.add(c)
   472	
   473	                    total_indexed += len(batch)
   474	                    doc.chunks_indexed = total_indexed
   475	                    db.add(doc)
   476	                    db.commit()
   477	
   478	                    # Adaptive spacing: only add delay if the batch was too fast.
   479	                    elapsed = time.time() - batch_start
   480	                    if elapsed < 0.2:
   481	                        time.sleep(0.2 - elapsed)
   482	
   483	                # All done
   484	                doc.status = "ready"
   485	                db.add(doc)
   486	                db.commit()
   487	                logger.info("Embedding completed for %s: %d indexed", document_id, total_indexed)
   488	
   489	                # Best-effort: generate persisted brief + legacy summary fields in a separate task.
   490	                _queue_document_brief(document_id)
   491	
   492	            except SoftTimeLimitExceeded:
   493	                raise
   494	            except Exception as e:
   495	                logger.exception("Embedding/indexing failed for %s: %s", document_id, e)
   496	                _set_doc_error(doc, "VECTORIZE_FAILED", "Vectorization or indexing failed")
   497	                db.add(doc)
   498	                db.commit()
   499	                return
   500	    except SoftTimeLimitExceeded:
   501	        logger.warning("parse_document soft time limit exceeded for %s", document_id)
   502	        _set_timeout_error(document_id, timeout_message)
   503	        raise

exec
/bin/zsh -lc "nl -ba backend/app/workers/brief_worker.py | sed -n '1,220p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from celery.exceptions import SoftTimeLimitExceeded
     4	from celery.utils.log import get_task_logger
     5	
     6	from app.services.summary_service import generate_document_brief_sync
     7	
     8	from .celery_app import celery_app
     9	
    10	logger = get_task_logger(__name__)
    11	
    12	
    13	@celery_app.task(
    14	    name="app.workers.brief_worker.generate_document_brief",
    15	    bind=True,
    16	    time_limit=240,
    17	    soft_time_limit=210,
    18	)
    19	def generate_document_brief(self, document_id: str) -> None:
    20	    try:
    21	        generate_document_brief_sync(document_id)
    22	    except SoftTimeLimitExceeded:
    23	        logger.warning("Document brief generation timed out for %s", document_id)
    24	        raise

exec
/bin/zsh -lc "rg -n \"pre_debit|predebit|estimate|estimated|retrieved_count|prompt_tokens|cost|credits\" backend/app/services/chat_service.py backend/app/services/credit_service.py backend/app/core -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/credit_service.py:24:    # Legacy rates (kept for historical UsageRecord cost lookups)
backend/app/services/credit_service.py:36:# Estimated cost per mode for pre-debit (generous upper bound to avoid under-debit).
backend/app/services/credit_service.py:41:def get_estimated_cost(mode: str) -> int:
backend/app/services/credit_service.py:42:    """Return estimated credit cost for a mode (used for pre-debit)."""
backend/app/services/credit_service.py:46:def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str, mode: str | None = None) -> int:
backend/app/services/credit_service.py:47:    """Calculate credit cost for token usage, with optional mode multiplier."""
backend/app/services/credit_service.py:49:    input_cost = round(prompt_tokens * input_rate / 1000)
backend/app/services/credit_service.py:50:    output_cost = round(completion_tokens * output_rate / 1000)
backend/app/services/credit_service.py:51:    base_cost = max(1, input_cost + output_cost)
backend/app/services/credit_service.py:54:    return max(1, int(base_cost * multiplier))
backend/app/services/credit_service.py:57:async def get_user_credits(db: AsyncSession, user_id: UUID) -> int:
backend/app/services/credit_service.py:60:    return user.credits_balance if user else 0
backend/app/services/credit_service.py:63:async def debit_credits(
backend/app/services/credit_service.py:66:    cost: int,
backend/app/services/credit_service.py:71:    """Atomically debit credits. Returns the CreditLedger entry ID on success, None if insufficient.
backend/app/services/credit_service.py:76:    if cost <= 0:
backend/app/services/credit_service.py:82:        .where(User.credits_balance >= cost)
backend/app/services/credit_service.py:83:        .values(credits_balance=User.credits_balance - cost)
backend/app/services/credit_service.py:84:        .returning(User.credits_balance)
backend/app/services/credit_service.py:94:        delta=-cost,
backend/app/services/credit_service.py:106:async def credit_credits(
backend/app/services/credit_service.py:114:    """Add credits. Returns new balance.
backend/app/services/credit_service.py:125:        .values(credits_balance=User.credits_balance + amount)
backend/app/services/credit_service.py:126:        .returning(User.credits_balance)
backend/app/services/credit_service.py:149:    prompt_tokens: int,
backend/app/services/credit_service.py:151:    cost_credits: int,
backend/app/services/credit_service.py:158:        prompt_tokens=prompt_tokens,
backend/app/services/credit_service.py:160:        total_tokens=prompt_tokens + completion_tokens,
backend/app/services/credit_service.py:161:        cost_credits=cost_credits,
backend/app/services/credit_service.py:167:async def reconcile_credits(
backend/app/services/credit_service.py:170:    predebit_ledger_id: UUID,
backend/app/services/credit_service.py:171:    pre_debited: int,
backend/app/services/credit_service.py:172:    actual_cost: int,
backend/app/services/credit_service.py:174:    """Reconcile pre-debited credits against actual cost after streaming.
backend/app/services/credit_service.py:177:    one ledger row (reason="chat") instead of two (predebit + reconcile).
backend/app/services/credit_service.py:179:    - If pre_debited == actual_cost → no-op
backend/app/services/credit_service.py:182:    diff = pre_debited - actual_cost
backend/app/services/credit_service.py:189:        .values(credits_balance=User.credits_balance + diff)
backend/app/services/credit_service.py:190:        .returning(User.credits_balance)
backend/app/services/credit_service.py:195:    # Update the original ledger entry to reflect actual cost
backend/app/services/credit_service.py:198:        .where(CreditLedger.id == predebit_ledger_id)
backend/app/services/credit_service.py:200:            delta=-actual_cost,
backend/app/services/credit_service.py:207:            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
backend/app/services/credit_service.py:212:async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
backend/app/services/credit_service.py:213:    """Grant monthly credits if last grant was over 30 days ago.
backend/app/services/credit_service.py:224:    last = user.monthly_credits_granted_at
backend/app/services/credit_service.py:242:        user.monthly_credits_granted_at = now
backend/app/services/credit_service.py:251:        user.monthly_credits_granted_at = now
backend/app/services/credit_service.py:255:    # Grant credits and update marker
backend/app/services/credit_service.py:256:    await credit_credits(
backend/app/services/credit_service.py:264:    user.monthly_credits_granted_at = now
backend/app/services/chat_service.py:419:    prompt_tokens = 0
backend/app/services/chat_service.py:435:        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
backend/app/services/chat_service.py:444:            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:460:            prompt_tokens=prompt_tokens,
backend/app/services/chat_service.py:472:            prompt_tokens=prompt_tokens,
backend/app/services/chat_service.py:533:async def _refund_predebit(
backend/app/services/chat_service.py:536:    pre_debited: int,
backend/app/services/chat_service.py:537:    predebit_ledger_id: uuid.UUID,
backend/app/services/chat_service.py:551:        sa.delete(CreditLedger).where(CreditLedger.id == predebit_ledger_id)
backend/app/services/chat_service.py:556:            .values(credits_balance=User.credits_balance + pre_debited)
backend/app/services/chat_service.py:573:    prompt_tokens: Optional[int] = None,
backend/app/services/chat_service.py:586:            prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
backend/app/services/chat_service.py:618:async def _settle_predebit_on_cancel(
backend/app/services/chat_service.py:621:    pre_debited: int,
backend/app/services/chat_service.py:622:    predebit_ledger_id: uuid.UUID,
backend/app/services/chat_service.py:624:    prompt_tokens: Optional[int],
backend/app/services/chat_service.py:631:            actual_cost = credit_service.calculate_cost(
backend/app/services/chat_service.py:632:                int(prompt_tokens or 0),
backend/app/services/chat_service.py:637:            await credit_service.reconcile_credits(
backend/app/services/chat_service.py:640:                predebit_ledger_id,
backend/app/services/chat_service.py:641:                pre_debited,
backend/app/services/chat_service.py:642:                actual_cost,
backend/app/services/chat_service.py:646:            await _refund_predebit(settle_db, user_id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:682:    retrieved_count: int,
backend/app/services/chat_service.py:698:            "retrieved_count": retrieved_count,
backend/app/services/chat_service.py:745:    prompt_tokens: int = 0
backend/app/services/chat_service.py:1023:        # Pre-debit estimated credits BEFORE streaming (prevents TOCTOU + free rides)
backend/app/services/chat_service.py:1024:        pre_debited = 0
backend/app/services/chat_service.py:1025:        predebit_ledger_id = None
backend/app/services/chat_service.py:1027:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1029:                estimated = max(estimated, estimated * 2)
backend/app/services/chat_service.py:1030:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1031:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1034:            if predebit_ledger_id:
backend/app/services/chat_service.py:1035:                pre_debited = estimated
backend/app/services/chat_service.py:1038:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1043:                        "message": "Insufficient credits to start chat",
backend/app/services/chat_service.py:1044:                        "required": estimated,
backend/app/services/chat_service.py:1279:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
backend/app/services/chat_service.py:1283:                            _settle_predebit_on_cancel(
backend/app/services/chat_service.py:1285:                                pre_debited=pre_debited,
backend/app/services/chat_service.py:1286:                                predebit_ledger_id=predebit_ledger_id,
backend/app/services/chat_service.py:1288:                                prompt_tokens=None,
backend/app/services/chat_service.py:1303:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:1305:                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1309:                        "Failed to refund pre-debited credits during chat setup failure for user %s",
backend/app/services/chat_service.py:1319:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:1321:                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1325:                        "Failed to refund pre-debited credits before LLM client setup for user %s",
backend/app/services/chat_service.py:1354:        prompt_tokens: Optional[int] = None
backend/app/services/chat_service.py:1402:                        prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
backend/app/services/chat_service.py:1452:                    and pre_debited > 0
backend/app/services/chat_service.py:1453:                    and predebit_ledger_id is not None
backend/app/services/chat_service.py:1457:                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1461:                            "Failed to refund pre-debited credits after LLM error for user %s",
backend/app/services/chat_service.py:1475:                    prompt_tokens=int(prompt_tokens) if prompt_tokens is not None else None,
backend/app/services/chat_service.py:1486:                    and pre_debited > 0
backend/app/services/chat_service.py:1487:                    and predebit_ledger_id is not None
backend/app/services/chat_service.py:1491:                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1495:                            "Failed to refund pre-debited credits after PERSIST_FAILED for user %s",
backend/app/services/chat_service.py:1505:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1524:                    if repair.prompt_tokens:
backend/app/services/chat_service.py:1525:                        prompt_tokens = int(prompt_tokens or 0) + repair.prompt_tokens
backend/app/services/chat_service.py:1536:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1562:                asst_msg.prompt_tokens = int(prompt_tokens) if prompt_tokens is not None else None
backend/app/services/chat_service.py:1577:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:1581:            # Credits: reconcile pre-debited estimate against actual cost
backend/app/services/chat_service.py:1582:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:1583:                pt = int(prompt_tokens or 0)
backend/app/services/chat_service.py:1586:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:1587:                    await credit_service.reconcile_credits(
backend/app/services/chat_service.py:1588:                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
backend/app/services/chat_service.py:1595:                        prompt_tokens=pt,
backend/app/services/chat_service.py:1597:                        cost_credits=actual_cost,
backend/app/services/chat_service.py:1629:                                prompt_tokens=prompt_tokens,
backend/app/services/chat_service.py:1642:                and pre_debited > 0
backend/app/services/chat_service.py:1643:                and predebit_ledger_id is not None
backend/app/services/chat_service.py:1649:                            _settle_predebit_on_cancel(
backend/app/services/chat_service.py:1651:                                pre_debited=pre_debited,
backend/app/services/chat_service.py:1652:                                predebit_ledger_id=predebit_ledger_id,
backend/app/services/chat_service.py:1654:                                prompt_tokens=prompt_tokens,
backend/app/services/chat_service.py:1754:        # 5) Pre-debit credits
backend/app/services/chat_service.py:1755:        pre_debited = 0
backend/app/services/chat_service.py:1756:        predebit_ledger_id = None
backend/app/services/chat_service.py:1758:            estimated = credit_service.get_estimated_cost(effective_mode)
backend/app/services/chat_service.py:1759:            predebit_ledger_id = await credit_service.debit_credits(
backend/app/services/chat_service.py:1760:                db, user_id=user.id, cost=estimated,
backend/app/services/chat_service.py:1763:            if predebit_ledger_id:
backend/app/services/chat_service.py:1764:                pre_debited = estimated
backend/app/services/chat_service.py:1767:                balance = await credit_service.get_user_credits(db, user.id)
backend/app/services/chat_service.py:1770:                    "message": "Insufficient credits",
backend/app/services/chat_service.py:1771:                    "required": estimated,
backend/app/services/chat_service.py:1910:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
backend/app/services/chat_service.py:1914:                            _settle_predebit_on_cancel(
backend/app/services/chat_service.py:1916:                                pre_debited=pre_debited,
backend/app/services/chat_service.py:1917:                                predebit_ledger_id=predebit_ledger_id,
backend/app/services/chat_service.py:1919:                                prompt_tokens=None,
backend/app/services/chat_service.py:1934:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:1936:                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1940:                        "Failed to refund pre-debited credits during continuation setup failure for user %s",
backend/app/services/chat_service.py:1950:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:1952:                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:1956:                        "Failed to refund pre-debited credits before continuation LLM client setup for user %s",
backend/app/services/chat_service.py:1978:        prompt_tokens: Optional[int] = None
backend/app/services/chat_service.py:2015:                        prompt_tokens = getattr(chunk.usage, "prompt_tokens", None)
backend/app/services/chat_service.py:2053:                    and pre_debited > 0
backend/app/services/chat_service.py:2054:                    and predebit_ledger_id is not None
backend/app/services/chat_service.py:2058:                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:2062:                            "Failed to refund pre-debited credits after continuation LLM error for user %s",
backend/app/services/chat_service.py:2084:                    and pre_debited > 0
backend/app/services/chat_service.py:2085:                    and predebit_ledger_id is not None
backend/app/services/chat_service.py:2089:                        await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
backend/app/services/chat_service.py:2093:                            "Failed to refund pre-debited credits after continuation PERSIST_FAILED for user %s",
backend/app/services/chat_service.py:2103:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2122:                    if repair.prompt_tokens:
backend/app/services/chat_service.py:2123:                        prompt_tokens = int(prompt_tokens or 0) + repair.prompt_tokens
backend/app/services/chat_service.py:2133:                            retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2171:                retrieved_count=len(chunk_map),
backend/app/services/chat_service.py:2176:            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
backend/app/services/chat_service.py:2177:                pt = int(prompt_tokens or 0)
backend/app/services/chat_service.py:2180:                    actual_cost = credit_service.calculate_cost(pt, ct, effective_model, mode=effective_mode)
backend/app/services/chat_service.py:2181:                    await credit_service.reconcile_credits(
backend/app/services/chat_service.py:2182:                        db, user.id, predebit_ledger_id, pre_debited, actual_cost,
backend/app/services/chat_service.py:2189:                        prompt_tokens=pt,
backend/app/services/chat_service.py:2191:                        cost_credits=actual_cost,
backend/app/services/chat_service.py:2234:                and pre_debited > 0
backend/app/services/chat_service.py:2235:                and predebit_ledger_id is not None
backend/app/services/chat_service.py:2241:                            _settle_predebit_on_cancel(
backend/app/services/chat_service.py:2243:                                pre_debited=pre_debited,
backend/app/services/chat_service.py:2244:                                predebit_ledger_id=predebit_ledger_id,
backend/app/services/chat_service.py:2246:                                prompt_tokens=prompt_tokens,

exec
/bin/zsh -lc "nl -ba backend/app/services/credit_service.py | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	from __future__ import annotations
     2	
     3	from typing import Optional
     4	from uuid import UUID
     5	
     6	import sqlalchemy as sa
     7	from sqlalchemy.ext.asyncio import AsyncSession
     8	
     9	from app.core.config import settings
    10	from app.models.tables import CreditLedger, UsageRecord, User
    11	
    12	# Token-to-credit rates by model tier
    13	CREDIT_RATES = {
    14	    # Active models (reachable via mode system)
    15	    "deepseek-v4-flash": (1, 3),
    16	    "deepseek-v4-pro": (2, 6),
    17	    "deepseek/deepseek-v3.2": (1, 5),
    18	    "mistralai/mistral-medium-3.1": (2, 10),
    19	    "mistralai/mistral-large-2512": (2, 10),
    20	    # Fallback models (in ALLOWED_MODELS)
    21	    "qwen/qwen3-30b-a3b": (1, 5),
    22	    "mistralai/mistral-medium-3": (2, 10),
    23	    "openai/gpt-5.2": (3, 15),
    24	    # Legacy rates (kept for historical UsageRecord cost lookups)
    25	    "x-ai/grok-4.1-fast": (1, 5),
    26	    "minimax/minimax-m2.1": (1, 5),
    27	    "moonshotai/kimi-k2.5": (1, 5),
    28	    "google/gemini-3-flash-preview": (1, 5),
    29	    "google/gemini-3-pro-preview": (3, 15),
    30	    "anthropic/claude-sonnet-4.5": (3, 15),
    31	    "anthropic/claude-opus-4.6": (15, 75),
    32	}
    33	DEFAULT_RATE = (3, 15)
    34	MIN_CREDITS_FOR_CHAT = 10
    35	
    36	# Estimated cost per mode for pre-debit (generous upper bound to avoid under-debit).
    37	# Internal mode IDs are kept for compatibility: quick=Flash, balanced=Pro.
    38	MODE_ESTIMATED_COST: dict[str, int] = {"quick": 5, "balanced": 15}
    39	
    40	
    41	def get_estimated_cost(mode: str) -> int:
    42	    """Return estimated credit cost for a mode (used for pre-debit)."""
    43	    return MODE_ESTIMATED_COST.get(mode, MODE_ESTIMATED_COST["balanced"])
    44	
    45	
    46	def calculate_cost(prompt_tokens: int, completion_tokens: int, model: str, mode: str | None = None) -> int:
    47	    """Calculate credit cost for token usage, with optional mode multiplier."""
    48	    input_rate, output_rate = CREDIT_RATES.get(model, DEFAULT_RATE)
    49	    input_cost = round(prompt_tokens * input_rate / 1000)
    50	    output_cost = round(completion_tokens * output_rate / 1000)
    51	    base_cost = max(1, input_cost + output_cost)
    52	    # Apply mode multiplier
    53	    multiplier = settings.MODE_CREDIT_MULTIPLIER.get(mode or "balanced", 1.0)
    54	    return max(1, int(base_cost * multiplier))
    55	
    56	
    57	async def get_user_credits(db: AsyncSession, user_id: UUID) -> int:
    58	    """Get user's current credit balance."""
    59	    user = await db.get(User, user_id)
    60	    return user.credits_balance if user else 0
    61	
    62	
    63	async def debit_credits(
    64	    db: AsyncSession,
    65	    user_id: UUID,
    66	    cost: int,
    67	    reason: str,
    68	    ref_type: Optional[str] = None,
    69	    ref_id: Optional[str] = None,
    70	) -> Optional[UUID]:
    71	    """Atomically debit credits. Returns the CreditLedger entry ID on success, None if insufficient.
    72	
    73	    The balance update and ledger entry are written in the same transaction.
    74	    Caller must call db.commit() to persist changes.
    75	    """
    76	    if cost <= 0:
    77	        raise ValueError("Cost must be positive")
    78	
    79	    result = await db.execute(
    80	        sa.update(User)
    81	        .where(User.id == user_id)
    82	        .where(User.credits_balance >= cost)
    83	        .values(credits_balance=User.credits_balance - cost)
    84	        .returning(User.credits_balance)
    85	    )
    86	    row = result.fetchone()
    87	
    88	    if row is None:
    89	        return None
    90	
    91	    new_balance = row[0]
    92	    ledger = CreditLedger(
    93	        user_id=user_id,
    94	        delta=-cost,
    95	        balance_after=new_balance,
    96	        reason=reason,
    97	        ref_type=ref_type,
    98	        ref_id=ref_id,
    99	    )
   100	    db.add(ledger)
   101	    # Flush to ensure ledger is written in same transaction as balance update
   102	    await db.flush()
   103	    return ledger.id
   104	
   105	
   106	async def credit_credits(
   107	    db: AsyncSession,
   108	    user_id: UUID,
   109	    amount: int,
   110	    reason: str,
   111	    ref_type: Optional[str] = None,
   112	    ref_id: Optional[str] = None,
   113	) -> int:
   114	    """Add credits. Returns new balance.
   115	
   116	    The balance update and ledger entry are written in the same transaction.
   117	    Caller must call db.commit() to persist changes.
   118	    """
   119	    if amount <= 0:
   120	        raise ValueError("Amount must be positive")
   121	
   122	    result = await db.execute(
   123	        sa.update(User)
   124	        .where(User.id == user_id)
   125	        .values(credits_balance=User.credits_balance + amount)
   126	        .returning(User.credits_balance)
   127	    )
   128	    new_balance = result.scalar_one()
   129	
   130	    ledger = CreditLedger(
   131	        user_id=user_id,
   132	        delta=amount,
   133	        balance_after=new_balance,
   134	        reason=reason,
   135	        ref_type=ref_type,
   136	        ref_id=ref_id,
   137	    )
   138	    db.add(ledger)
   139	    # Flush to ensure ledger is written in same transaction as balance update
   140	    await db.flush()
   141	    return new_balance
   142	
   143	
   144	async def record_usage(
   145	    db: AsyncSession,
   146	    user_id: UUID,
   147	    message_id: Optional[UUID],
   148	    model: str,
   149	    prompt_tokens: int,
   150	    completion_tokens: int,
   151	    cost_credits: int,
   152	) -> UsageRecord:
   153	    """Record detailed usage information."""
   154	    usage = UsageRecord(
   155	        user_id=user_id,
   156	        message_id=message_id,
   157	        model=model,
   158	        prompt_tokens=prompt_tokens,
   159	        completion_tokens=completion_tokens,
   160	        total_tokens=prompt_tokens + completion_tokens,
   161	        cost_credits=cost_credits,
   162	    )
   163	    db.add(usage)
   164	    return usage
   165	
   166	
   167	async def reconcile_credits(
   168	    db: AsyncSession,
   169	    user_id: UUID,
   170	    predebit_ledger_id: UUID,
   171	    pre_debited: int,
   172	    actual_cost: int,
   173	) -> None:
   174	    """Reconcile pre-debited credits against actual cost after streaming.
   175	
   176	    Updates the ORIGINAL ledger entry in-place so each chat produces exactly
   177	    one ledger row (reason="chat") instead of two (predebit + reconcile).
   178	
   179	    - If pre_debited == actual_cost → no-op
   180	    - If diff != 0 → adjust user balance and update the original ledger entry
   181	    """
   182	    diff = pre_debited - actual_cost
   183	    if diff == 0:
   184	        return
   185	
   186	    balance_result = await db.execute(
   187	        sa.update(User)
   188	        .where(User.id == user_id)
   189	        .values(credits_balance=User.credits_balance + diff)
   190	        .returning(User.credits_balance)
   191	    )
   192	    if balance_result.scalar_one_or_none() is None:
   193	        raise RuntimeError(f"User {user_id} not found during credit reconciliation")
   194	
   195	    # Update the original ledger entry to reflect actual cost
   196	    ledger_result = await db.execute(
   197	        sa.update(CreditLedger)
   198	        .where(CreditLedger.id == predebit_ledger_id)
   199	        .values(
   200	            delta=-actual_cost,
   201	            balance_after=CreditLedger.balance_after + diff,
   202	        )
   203	        .returning(CreditLedger.id)
   204	    )
   205	    if ledger_result.scalar_one_or_none() is None:
   206	        raise RuntimeError(
   207	            f"Predebit ledger {predebit_ledger_id} not found during credit reconciliation"
   208	        )
   209	    await db.flush()
   210	
   211	
   212	async def ensure_monthly_credits(db: AsyncSession, user: User) -> None:
   213	    """Grant monthly credits if last grant was over 30 days ago.
   214	
   215	    Idempotency: checks CreditLedger for any recent 'monthly_allowance' within 30 days.
   216	    """
   217	    from datetime import datetime, timedelta, timezone
   218	
   219	    if (user.plan or "free").lower() != "free":
   220	        return
   221	
   222	    # Determine if grant needed based on timestamp
   223	    now = datetime.now(timezone.utc)
   224	    last = user.monthly_credits_granted_at
   225	    if last is not None and last.tzinfo is None:
   226	        # Treat naive as UTC
   227	        last = last.replace(tzinfo=timezone.utc)
   228	    needs_grant = last is None or (now - last) >= timedelta(days=30)
   229	    if not needs_grant:
   230	        return
   231	
   232	    # Check ledger for idempotency within last 30 days
   233	    cutoff = now - timedelta(days=30)
   234	    existing = await db.scalar(
   235	        sa.select(CreditLedger)
   236	        .where(CreditLedger.user_id == user.id)
   237	        .where(CreditLedger.reason == "monthly_allowance")
   238	        .where(CreditLedger.created_at >= cutoff)
   239	    )
   240	    if existing:
   241	        # Still update marker to avoid repeatedly checking in future requests
   242	        user.monthly_credits_granted_at = now
   243	        await db.flush()
   244	        return
   245	
   246	    # Only free users are eligible in this path.
   247	    allowance = int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
   248	
   249	    if allowance <= 0:
   250	        # Nothing to grant
   251	        user.monthly_credits_granted_at = now
   252	        await db.flush()
   253	        return
   254	
   255	    # Grant credits and update marker
   256	    await credit_credits(
   257	        db,
   258	        user_id=user.id,
   259	        amount=allowance,
   260	        reason="monthly_allowance",

exec
/bin/zsh -lc "rg -n \"_chunk_to_retrieval_item\\(|chunk_to_retrieval_item\\(\" backend/app/services/document_brief_service.py backend/app/services/chat_service.py backend/tests/test_document_brief_service.py -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/document_brief_service.py:398:def _chunk_to_retrieval_item(chunk: Chunk, score: float) -> dict[str, Any]:
backend/app/services/document_brief_service.py:462:                chunk_to_retrieval_item(chunk, score, include_document_id=True)
backend/app/services/document_brief_service.py:484:                    _chunk_to_retrieval_item(
backend/app/services/document_brief_service.py:493:                chunk_to_retrieval_item(chunk, score, include_document_id=True)
backend/app/services/document_brief_service.py:500:            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
backend/app/services/document_brief_service.py:543:            _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
backend/app/services/chat_service.py:671:    return [chunk_to_retrieval_item(ch, 1.0, include_document_id=True) for ch in chunks]

exec
/bin/zsh -lc "nl -ba backend/app/services/document_brief_service.py | sed -n '80,100p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    80	
    81	def _dynamic_summary_chunk_budget(
    82	    base_max_chunks: int,
    83	    *,
    84	    chunks_total: int,
    85	    section_total: int,
    86	    max_total_chunks_cap: int,
    87	) -> int:
    88	    floor = max(int(base_max_chunks or DEFAULT_MAX_SUMMARY_CHUNKS), DEFAULT_MAX_SUMMARY_CHUNKS)
    89	    budget = max(floor, min(max_total_chunks_cap, floor + (max(0, chunks_total) // 24)))
    90	    if section_total > 0:
    91	        budget = max(budget, min(max_total_chunks_cap, section_total))
    92	    return min(max_total_chunks_cap, max(1, budget))
    93	
    94	
    95	def _section_segments(chunks: Sequence[Any]) -> list[tuple[str, list[Any]]]:
    96	    segments: list[tuple[str, list[Any]]] = []
    97	    current_title: str | None = None
    98	    current_items: list[Any] = []
    99	
   100	    for chunk in chunks:

web search: 
web search: 
codex
接下来我先跑你指定的回归命令确认当前分支测试基线，然后我会把发现按 `Must-fix / Should-fix / Nit` 给出可证伪理由和修复建议。
exec
/bin/zsh -lc 'SKIP_INTEGRATION=1 python3 -m pytest -q' in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 4416ms:
..........................ss............................................ [ 17%]
........................................................................ [ 35%]
........................................................................ [ 53%]
.s.s...............s....................s............................... [ 71%]
........................................................................ [ 89%]
................s...........................                             [100%]
=============================== warnings summary ===============================
app/api/admin.py:325
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:325: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:461
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:461: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    period: str = Query("day", regex="^(day|week|month)$"),

app/api/admin.py:1482
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/admin.py:1482: DeprecationWarning: `regex` has been deprecated, please use `pattern` instead
    by: str = Query("tokens", regex="^(tokens|credits|documents)$"),

../../../../Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35
  /Users/mayijie/Library/Python/3.9/lib/python/site-packages/urllib3/__init__.py:35: NotOpenSSLWarning: urllib3 v2 only supports OpenSSL 1.1.1+, currently the 'ssl' module is compiled with 'LibreSSL 2.8.3'. See: https://github.com/urllib3/urllib3/issues/3020
    warnings.warn(

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyPacked has no __module__ attribute

<frozen importlib._bootstrap>:228
<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type SwigPyObject has no __module__ attribute

<frozen importlib._bootstrap>:228
  <frozen importlib._bootstrap>:228: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

app/api/collections.py:43
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/collections.py:43: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class CollectionBrief(BaseModel):

app/api/users.py:38
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/users.py:38: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserMeResponse(BaseModel):

app/schemas/document.py:18
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/document.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class DocumentResponse(BaseModel):

app/schemas/chat.py:23
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/chat.py:23: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class ChatMessageResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:18: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class UserResponse(BaseModel):

tests/test_export_api.py::test_export_requires_auth
  /Users/mayijie/Projects/Code/010_DocTalk/backend/app/schemas/auth.py:52: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.12/migration/
    class AccountResponse(BaseModel):

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
397 passed, 7 skipped, 15 warnings in 3.62s
sys:1: DeprecationWarning: builtin type swigvarlink has no __module__ attribute

exec
/bin/zsh -lc "python3 - <<'PY'
import uuid, asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app.services.document_brief_service import DocumentBriefService, SectionMapReducePlanner, SectionMapGroup

# 1) Gate check: 30 chunks/30 sections but map_reduce_min_chunks=36 -> False
svc = DocumentBriefService(map_reduce_min_chunks=36)
chunks = [SimpleNamespace(id=uuid.uuid4(), chunk_index=i, section_title=f'S{i}', page_start=i+1, text='x'*200) for i in range(30)]
print('should_use_map_reduce_30chunks=', svc._should_use_map_reduce(chunks, max_chunks=18, element_chunks_count=0))

# 2) Truncate cap check: max_group_chunks=6 but 10 distinct sections in one group
planner = SectionMapReducePlanner(max_group_chunks=6)
group = SectionMapGroup(group_index=0, chunks=tuple(chunks[:10]), section_titles=tuple(f'S{i}' for i in range(10)))
trunc = planner._truncate_group_chunks(group)
print('truncate_len_distinct10_cap6=', len(trunc.chunks))

# 3) Persisted path bypasses map_reduce
class _ScalarOneOrNoneResult:
    def __init__(self, value): self._value=value
    def scalar_one_or_none(self): return self._value
class _ScalarsResult:
    def __init__(self, values): self._values=values
    def scalars(self): return self._values

persist_ids = [str(c.id) for c in chunks[:24]]
db = SimpleNamespace(execute=AsyncMock(side_effect=[
    _ScalarOneOrNoneResult({'selected_chunk_ids': persist_ids}),
    _ScalarsResult(chunks[:24]),
]))
planner2 = SectionMapReducePlanner()
planner2.select_chunks_for_summary = AsyncMock(return_value=chunks)
svc2 = DocumentBriefService(section_map_reduce=planner2, map_reduce_min_chunks=1)
async def main():
    out = await svc2.get_summary_context(db, uuid.uuid4(), max_chunks=18)
    print('persisted_len=', len(out))
    print('map_reduce_called=', planner2.select_chunks_for_summary.await_count)
asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 exited 1 in 173ms:
Traceback (most recent call last):
  File "<stdin>", line 37, in <module>
should_use_map_reduce_30chunks= False
truncate_len_distinct10_cap6= 10
  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/runners.py", line 44, in run
    return loop.run_until_complete(main)
  File "/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/asyncio/base_events.py", line 642, in run_until_complete
    return future.result()
  File "<stdin>", line 34, in main
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py", line 447, in get_summary_context
    persisted = await self._get_persisted_summary_context(
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py", line 542, in _get_persisted_summary_context
    return [
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py", line 543, in <listcomp>
    _chunk_to_retrieval_item(chunk, 1.0 - (idx / (total + 1)) * 0.2)
  File "/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py", line 403, in _chunk_to_retrieval_item
    "page_end": chunk.page_end,
AttributeError: 'types.SimpleNamespace' object has no attribute 'page_end'

exec
/bin/zsh -lc "python3 - <<'PY'
import uuid, asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app.services.document_brief_service import DocumentBriefService, SectionMapReducePlanner

class _ScalarOneOrNoneResult:
    def __init__(self, value): self._value=value
    def scalar_one_or_none(self): return self._value
class _ScalarsResult:
    def __init__(self, values): self._values=values
    def scalars(self): return self._values

doc_id = uuid.uuid4()
chunks = [SimpleNamespace(id=uuid.uuid4(), document_id=doc_id, chunk_index=i, section_title=f'S{i}', page_start=i+1, page_end=i+1, bboxes=[], text='x'*200) for i in range(24)]
persist_ids = [str(c.id) for c in chunks]

db = SimpleNamespace(execute=AsyncMock(side_effect=[
    _ScalarOneOrNoneResult({'selected_chunk_ids': persist_ids}),
    _ScalarsResult(chunks),
]))
planner = SectionMapReducePlanner()
planner.select_chunks_for_summary = AsyncMock(return_value=chunks)
svc = DocumentBriefService(section_map_reduce=planner, map_reduce_min_chunks=1)

async def main():
    out = await svc.get_summary_context(db, doc_id, max_chunks=18)
    print('persisted_len', len(out))
    print('map_reduce_called', planner.select_chunks_for_summary.await_count)

asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 171ms:
persisted_len 18
map_reduce_called 0

exec
/bin/zsh -lc "python3 - <<'PY'
import uuid, asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app.services.document_brief_service import DocumentBriefService

class _ScalarOneOrNoneResult:
    def __init__(self, value): self._value=value
    def scalar_one_or_none(self): return self._value
class _ScalarsResult:
    def __init__(self, values): self._values=values
    def scalars(self): return self._values

doc_id = uuid.uuid4()
chunks = [SimpleNamespace(id=uuid.uuid4(), document_id=doc_id, chunk_index=i, section_title=f'S{i}', page_start=i+1, page_end=i+1, bboxes=[], text='y'*200) for i in range(10)]
# persisted none, element none, all chunks
fake_db = SimpleNamespace(execute=AsyncMock(side_effect=[
    _ScalarOneOrNoneResult(None),
    _ScalarsResult([]),
    _ScalarsResult(chunks),
]))

svc = DocumentBriefService()

async def main():
    out = await svc.get_summary_context(fake_db, doc_id, max_chunks=3)
    print('keys', sorted(out[0].keys()))
    print('has_document_id', 'document_id' in out[0])

asyncio.run(main())
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 176ms:
keys ['bboxes', 'chunk_id', 'document_id', 'page', 'page_end', 'score', 'section_title', 'text']
has_document_id True

exec
/bin/zsh -lc "python3 - <<'PY'
from app.services.parse_service import resolve_ocr_languages
print(resolve_ocr_languages())
print(len(resolve_ocr_languages().split('+')))
print(resolve_ocr_languages('en-US').split('+')[:3])
print(resolve_ocr_languages('ar').split('+')[:3])
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 119ms:
exec
/bin/zsh -lc "python3 - <<'PY'
from app.core.config import settings
from app.services.parse_service import resolve_ocr_languages
orig = settings.OCR_LANGUAGES
settings.OCR_LANGUAGES = 'eng'
print(resolve_ocr_languages())
settings.OCR_LANGUAGES = 'eng+chi_sim'
print(resolve_ocr_languages())
settings.OCR_LANGUAGES = orig
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 119ms:
exec
/bin/zsh -lc "python3 - <<'PY'
import uuid
from types import SimpleNamespace
from app.services.document_brief_service import DocumentBriefService
svc = DocumentBriefService(map_reduce_min_chunks=36)

def mk(n):
    return [SimpleNamespace(id=uuid.uuid4(), chunk_index=i, section_title=f'S{i}', page_start=i+1, text='x'*100) for i in range(n)]
for n,ec,maxc in [(35,18,18),(36,18,18),(30,18,18),(40,0,18),(34,0,18),(50,17,18),(50,18,18),(50,0,17)]:
    print(n,ec,maxc,svc._should_use_map_reduce(mk(n), max_chunks=maxc, element_chunks_count=ec))
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 163ms:
35 18 18 False
36 18 18 True
30 18 18 False
40 0 18 True
34 0 18 False
50 17 18 True
50 18 18 True
50 0 17 False

exec
/bin/zsh -lc "rg -n \"extract_pages_ocr\\(\" -g'*.py' backend/app" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
backend/app/services/parse_service.py:151:    def extract_pages_ocr(
backend/app/workers/parse_worker.py:263:                        pages = service.extract_pages_ocr(

exec
/bin/zsh -lc "rg -n \"idx_chunks_document|chunk_index\" backend/app/models/alembic* backend/alembic -g'*.py'" in /Users/mayijie/Projects/Code/010_DocTalk
 exited 1 in 0ms:
zsh:1: no matches found: backend/app/models/alembic*

exec
/bin/zsh -lc "nl -ba .claude/rules/backend.md | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	---
     2	paths:
     3	  - "backend/**"
     4	---
     5	
     6	# Backend Conventions
     7	
     8	## Async Safety
     9	- **MinIO calls MUST use `asyncio.to_thread()`** in async endpoints. MinIO client is sync (urllib3). Direct calls block event loop; when MinIO is unreachable, blocks ALL requests for 30+s. Client configured with short timeouts (connect=5s, read=10s, 2 retries)
    10	- **Celery uses sync DB** (`psycopg`), API uses async (`asyncpg`). Never mix.
    11	
    12	## Credits & Billing
    13	- **Two-stage debit**: ① Pre-check balance (402 if insufficient) → ② `debit_credits()` pre-debits estimated cost (returns ledger ID) → stream → `reconcile_credits()` UPDATEs same ledger entry to actual cost. Single ledger record per chat. LLM failure → DELETE entry + full refund
    14	- **`ChatRequest` exposes only `mode` field** (`quick`/`balanced`; legacy `thorough` is retired). `model` field removed — prevents billing bypass
    15	- Stripe webhook: `checkout.session.completed` for subscriptions only updates plan (no credits); `invoice.payment_succeeded` grants monthly credits (idempotent by invoice.id)
    16	- `POST /api/billing/cancel` is self-serve and records optional `cancel_reason`, `cancel_feedback`, and `refund_requested` metadata in `plan_transitions`. `refund_requested` is an internal review flag; do not issue Stripe refunds from this path unless an explicit refund workflow is added.
    17	
    18	## Parse Worker
    19	- `time_limit=600`, `soft_time_limit=540`, `autoretry_for=(Exception,)`, max 2 retries, 60s backoff
    20	- Idempotent: deletes existing pages/chunks on re-run
    21	
    22	## Auth
    23	- **`FOR UPDATE` lock** on verification tokens to prevent TOCTOU
    24	- Internal Auth Adapter API uses `X-Adapter-Secret` header
    25	
    26	## Error Handling
    27	- Use `HTTPException` (not `JSONResponse`) for all non-SSE endpoints
    28	- Lifespan pattern (`@asynccontextmanager`) instead of deprecated `@app.on_event`
    29	
    30	## Demo System
    31	- 3 seed PDFs auto-deployed at startup from `backend/seed_data/`. Self-healing: detects Qdrant data loss → full re-seed
    32	- Anonymous: 5 msgs/session, 500 sessions/doc, 10 req/min/IP, forced DeepSeek V4 Flash
    33	- Logged-in users accessing demo docs use their credits with no message limit

exec
/bin/zsh -lc "python3 - <<'PY'
from app.services.document_brief_service import _dynamic_summary_chunk_budget
for total in [36,72,240,600,1200,2400]:
    print(total, _dynamic_summary_chunk_budget(18, chunks_total=total, section_total=30, max_total_chunks_cap=64))
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 160ms:
36 30
72 30
240 30
600 43
1200 64
2400 64

web search: 
web search: 
web search: 
web search: 
exec
/bin/zsh -lc "python3 - <<'PY'
import uuid
from types import SimpleNamespace
from app.services.document_brief_service import _chunk_to_retrieval_item
c = SimpleNamespace(id=uuid.uuid4(), text='abc', page_start=1, page_end=2, bboxes=[{'x':0.1,'y':0.2,'w':0.3,'h':0.4}], section_title='S', document_id=uuid.uuid4())
print(sorted(_chunk_to_retrieval_item(c, 0.9).keys()))
PY" in /Users/mayijie/Projects/Code/010_DocTalk/backend
 succeeded in 166ms:
['bboxes', 'chunk_id', 'document_id', 'page', 'page_end', 'score', 'section_title', 'text']

codex
我已经拿到复现证据：`B5` 在“已生成 persisted brief”场景会被短路，`map-reduce` 不会执行（实际返回仍是 18 chunk）；另外 OCR 侧 `resolve_ocr_languages(locale)` 的 locale 优先级目前在 parse worker 没有被用上。最后我会按你要的分级格式汇总并给出是否可合并结论。
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
web search: 
codex
**Must-fix**
1. B5 在“已生成 persisted brief”场景被短路，整篇覆盖目标在主路径失效。  
[`document_brief_service.py:447`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:447), [`document_brief_service.py:522`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:522), [`chat_service.py:1094`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1094), [`summary_service.py:30`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/summary_service.py:30), [`summary_service.py:370`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/summary_service.py:370), [`parse_worker.py:489`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:489)  
可证伪理由：我本地复现 `persisted_len 18 / map_reduce_called 0`，说明一旦 `DocumentBrief.coverage` 存在，`get_summary_context` 直接返回 persisted，`map-reduce` 根本不执行，且 `max_chunks=18` 会硬截断。  
建议：summary 路径对 `coverage.strategy != section_map_reduce_*` 的 persisted 结果禁用短路，或把 persisted coverage 升级为 B5 选择器并允许 >18 的动态预算。

2. C4 的 locale 优先级逻辑在生产调用链未生效。  
[`parse_worker.py:265`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:265), [`parse_service.py:36`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:36)  
可证伪理由：`resolve_ocr_languages(locale)` 支持 locale first，但 worker 调用不传 locale，等价于永远用默认顺序。  
建议：把上传侧可得 locale 透传到 parse task，再调用 `resolve_ocr_languages(locale)`。

3. `OCR_LANGUAGES` 配置被“全量 union”覆盖，性能调优开关失效。  
[`parse_service.py:22`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:22), [`parse_service.py:32`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:32)  
可证伪理由：本地把 `settings.OCR_LANGUAGES='eng'` 后，返回仍是 11 语种串。  
建议：保留 fallback 机制，但不要无条件 union；可改为“首轮 locale/config 小集合，失败再扩到全量”。

**Should-fix**
1. `_should_use_map_reduce` 对“section 多但 chunk < 36”的文档会漏判。  
[`document_brief_service.py:431`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:431)  
可证伪理由：30 chunk / 30 section / `max_chunks=18` 时返回 `False`，仍可能覆盖不全。  
建议：门槛用 `section_total` 或 `max(section_total, chunks_total)`，不要只看 chunk 数。

2. 大文档路径存在重复全量加载 chunk，内存和延迟放大。  
[`document_element_service.py:236`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_element_service.py:236), [`document_brief_service.py:466`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:466)  
可证伪理由：element-aware 已查一遍全量 chunk，`get_summary_context` 又查一遍。500 页/数千 chunk 会双倍开销。  
建议：复用第一次查询结果，或改为按需字段/流式选择。

3. `_truncate_group_chunks` 名义上限 `max_group_chunks`，实际对“多 section 组”不封顶。  
[`document_brief_service.py:173`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:173), [`document_brief_service.py:187`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:187)  
可证伪理由：`max_group_chunks=6`、10 个不同 section 时返回长度 10。  
建议：先选 section anchor 后再硬裁剪到上限，避免未来 map-step 接 LLM 时 prompt 爆炸。

**Nit**
1. 缺少“persisted brief + B5”回归测试，当前测试主要覆盖“无 persisted”路径。  
[`test_document_brief_service.py:270`](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_document_brief_service.py:270)  
建议：补一个用 persisted coverage 的用例，断言 summary 路径是否按策略走 B5 或降级。

2. C4 只测了解析函数，没测 worker 集成是否传 locale。  
[`test_ocr_languages_baseline.py:22`](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_ocr_languages_baseline.py:22), [`parse_worker.py:263`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:263)

**重点逐项结论**
1. B5 覆盖：部分生效。无 persisted 时可扩到 >18；有 persisted 时被 18 截断并短路，主路径失效。见 Must-fix #1。  
2. 引用契约：map-reduce 返回结构完整（含 `chunk_id/page/bboxes/document_id`），未见字段缺失。[`document_brief_service.py:398`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:398)  
3. 性能：全量 chunk 双查询有风险；map/reduce 默认不额外打 LLM（只是本地 async gather）。[`document_brief_service.py:301`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:301)  
4. 回归：collection 窄预算、小文档 representative 保留；persisted-brief 与 B5 存在冲突；map/reduce 未在普通检索路径误触发。  
5. C4：11 语种串会拖慢英文 OCR；locale 优先级逻辑未接入 worker；Dockerfile 包名看起来合理，但我未在此环境做 apt 构建验真。  
6. 测试：`SKIP_INTEGRATION=1 python3 -m pytest -q` 实测 `397 passed, 7 skipped, 0 failed`。

**可否合并 `main`**
不建议合并。至少先修 Must-fix #1 和 #2/#3。
tokens used
126,220
**Must-fix**
1. B5 在“已生成 persisted brief”场景被短路，整篇覆盖目标在主路径失效。  
[`document_brief_service.py:447`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:447), [`document_brief_service.py:522`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:522), [`chat_service.py:1094`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1094), [`summary_service.py:30`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/summary_service.py:30), [`summary_service.py:370`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/summary_service.py:370), [`parse_worker.py:489`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:489)  
可证伪理由：我本地复现 `persisted_len 18 / map_reduce_called 0`，说明一旦 `DocumentBrief.coverage` 存在，`get_summary_context` 直接返回 persisted，`map-reduce` 根本不执行，且 `max_chunks=18` 会硬截断。  
建议：summary 路径对 `coverage.strategy != section_map_reduce_*` 的 persisted 结果禁用短路，或把 persisted coverage 升级为 B5 选择器并允许 >18 的动态预算。

2. C4 的 locale 优先级逻辑在生产调用链未生效。  
[`parse_worker.py:265`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:265), [`parse_service.py:36`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:36)  
可证伪理由：`resolve_ocr_languages(locale)` 支持 locale first，但 worker 调用不传 locale，等价于永远用默认顺序。  
建议：把上传侧可得 locale 透传到 parse task，再调用 `resolve_ocr_languages(locale)`。

3. `OCR_LANGUAGES` 配置被“全量 union”覆盖，性能调优开关失效。  
[`parse_service.py:22`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:22), [`parse_service.py:32`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/parse_service.py:32)  
可证伪理由：本地把 `settings.OCR_LANGUAGES='eng'` 后，返回仍是 11 语种串。  
建议：保留 fallback 机制，但不要无条件 union；可改为“首轮 locale/config 小集合，失败再扩到全量”。

**Should-fix**
1. `_should_use_map_reduce` 对“section 多但 chunk < 36”的文档会漏判。  
[`document_brief_service.py:431`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:431)  
可证伪理由：30 chunk / 30 section / `max_chunks=18` 时返回 `False`，仍可能覆盖不全。  
建议：门槛用 `section_total` 或 `max(section_total, chunks_total)`，不要只看 chunk 数。

2. 大文档路径存在重复全量加载 chunk，内存和延迟放大。  
[`document_element_service.py:236`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_element_service.py:236), [`document_brief_service.py:466`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:466)  
可证伪理由：element-aware 已查一遍全量 chunk，`get_summary_context` 又查一遍。500 页/数千 chunk 会双倍开销。  
建议：复用第一次查询结果，或改为按需字段/流式选择。

3. `_truncate_group_chunks` 名义上限 `max_group_chunks`，实际对“多 section 组”不封顶。  
[`document_brief_service.py:173`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:173), [`document_brief_service.py:187`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:187)  
可证伪理由：`max_group_chunks=6`、10 个不同 section 时返回长度 10。  
建议：先选 section anchor 后再硬裁剪到上限，避免未来 map-step 接 LLM 时 prompt 爆炸。

**Nit**
1. 缺少“persisted brief + B5”回归测试，当前测试主要覆盖“无 persisted”路径。  
[`test_document_brief_service.py:270`](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_document_brief_service.py:270)  
建议：补一个用 persisted coverage 的用例，断言 summary 路径是否按策略走 B5 或降级。

2. C4 只测了解析函数，没测 worker 集成是否传 locale。  
[`test_ocr_languages_baseline.py:22`](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_ocr_languages_baseline.py:22), [`parse_worker.py:263`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/workers/parse_worker.py:263)

**重点逐项结论**
1. B5 覆盖：部分生效。无 persisted 时可扩到 >18；有 persisted 时被 18 截断并短路，主路径失效。见 Must-fix #1。  
2. 引用契约：map-reduce 返回结构完整（含 `chunk_id/page/bboxes/document_id`），未见字段缺失。[`document_brief_service.py:398`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:398)  
3. 性能：全量 chunk 双查询有风险；map/reduce 默认不额外打 LLM（只是本地 async gather）。[`document_brief_service.py:301`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/document_brief_service.py:301)  
4. 回归：collection 窄预算、小文档 representative 保留；persisted-brief 与 B5 存在冲突；map/reduce 未在普通检索路径误触发。  
5. C4：11 语种串会拖慢英文 OCR；locale 优先级逻辑未接入 worker；Dockerfile 包名看起来合理，但我未在此环境做 apt 构建验真。  
6. 测试：`SKIP_INTEGRATION=1 python3 -m pytest -q` 实测 `397 passed, 7 skipped, 0 failed`。

**可否合并 `main`**
不建议合并。至少先修 Must-fix #1 和 #2/#3。
