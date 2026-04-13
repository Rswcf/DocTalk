判定：NEEDS-MINOR-FIX

Block：
1) `route.ts` 大小校验可绕过：先看 `content-length`，再用 `body.length`（字符数）比 10KB，UTF-8 多字节可超限（122-145）。
2) 限流不稳：`x-forwarded-for` 取首段 + serverless 冷启动/多实例重置 + `Map` 无淘汰，既可绕过也可堆内存（30-48）。
3) fingerprint 解析 URL 失败时回退原 `blockedUri`，高基数字符串会打散聚合（162-179）。
4) `Reporting-Endpoints` 用相对路径且与 `report-uri` 双写（next.config.mjs 62-63,115-117），有兼容/重复上报风险。

非阻断：
- GA 竞态一般不会挂，但 ID 双硬编码（AnalyticsWrapper.tsx:8；ga-init.js:4）有维护漂移。
- O-1 合成样本偏乐观，3 变体不足；建议 6-9。其余 9 locale stale 是文案债，不阻断 A'。
