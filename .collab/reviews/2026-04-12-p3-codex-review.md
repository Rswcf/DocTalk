# P3 CSP nonce 对抗审阅

判决：需修改（同意 scope，不同意 helper 说明）

1. 同意本 PR 不强推全量 nonce。`headers()` 会触发 dynamic，SEO 静态+CDN 会退化，属架构决策，应单独评估后推进。  
2. `frontend/src/components/JsonLdScript.tsx:27` 调 `headers()` 后，`try/catch` 不能避免 dynamic opt-in；`:30`“static 抛错并降级”表述不可靠，易误导在 SEO 页直接使用。  
3. `:23` 的 `Record<string, unknown>` 偏窄，JSON-LD 顶层可数组。建议改 `JsonValue`，并加 `nonce?: string`，把取 nonce 放调用方，避免组件隐式改渲染模式。  
4. 规模口径需校正：源码 `application/ld+json` 约 108 处（rg），非 213。请区分源码脚本数与运行时页面实例数。  
5. Report-Only 可拆 PR，但应紧跟补 `/api/csp-report` 与 `CSP-Report-Only`。  
6. 更简路径：先改 `AnalyticsWrapper`，去掉唯一可执行 inline；JSON-LD 再按 A/B 推进。  
