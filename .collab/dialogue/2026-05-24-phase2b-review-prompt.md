# 角色:对抗式代码审查 — DocTalk Phase 2b 真 map-reduce(全文覆盖)
我(Claude)在 `fix/phase2b-true-mapreduce` 实现了真 LLM map-reduce 整篇覆盖(eval 证明 section 覆盖 12%→100%)。全量非集成 405 passed/0 failed,ruff 干净。请**对抗式复审**,不要盖章。你不能 git。
## surface
- diff:`.collab/reviews/2026-05-24-phase2b-diff.patch`
- 现网:`backend/app/services/document_brief_service.py`(build_summary_context/map/reduce/denoise/fallback)、`chat_service.py`(DOCUMENT_SUMMARY 接入 + prompt)
- 测试:`backend/tests/test_document_brief_service.py`、`test_chat_summary_routing.py`
## 重点(逐项,file:line)
1. **成本/延迟**:大文档 summary 现发 ≤18 个 Flash map + 1 reduce。并发上限、超时、组数上限是否真的封顶?free 用户滥用(反复 summary 大文档)的成本风险?有无缓存(同文档 summary 复用 brief)?
2. **引用质量**:summary context item 的 [n] 锚是单个 anchor chunk,但 text 是整组摘要 → 引用页码是否会误导(摘要覆盖多节,却只指向一个 chunk 的页)?bbox 高亮是否仍有意义?
3. **鲁棒性**:map/reduce 的 LLM JSON 解析(response_format json_object 的 provider 兼容)、map 部分失败(部分组成功部分失败)、超时回退路径是否完整且不丢覆盖。
4. **回归**:小文档/collection/persisted/element-aware 路径未受影响?map-reduce 只在大单文档 summary 触发?
5. **质量真伪**:覆盖 100% 是"结构性"(所有节进了某组)。若某组 map 摘要质量差/漏内容,covered_sections 仍标记已覆盖 → 是否存在"假覆盖"?如何降低?
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q`(应 405/0 failed)。
## 输出:Must-fix/Should-fix/Nit(file:line+可证伪+建议),最后给「可否合并 main」。
