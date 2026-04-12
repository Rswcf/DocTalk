# PlusMenu 导出菜单 i18n 渲染 bug — Claude 初步发现

**日期**: 2026-04-12
**作者**: Claude
**上下文**: 用户截图显示 PlusMenu 中 3 个导出项显示为原始 i18n key（`chat.exportMarkdown`、`chat.exportPdf`、`chat.exportDocx`），而同一菜单内「自定义指令」正常显示。用户要求检查功能是否可用。

---

## 现象

截图（zh 语言）中 PlusMenu 下拉菜单：
- ✅ `自定义指令`  （`chat.customInstructions` 正常翻译）
- ❌ `chat.exportMarkdown` （raw key）
- ❌ `chat.exportPdf` （raw key）
- ❌ `chat.exportDocx` （raw key）

## 根因 (Root Cause)

**3 个 i18n key 在全部 11 份 locale 文件中均缺失**：

```
frontend/src/i18n/locales/{ar,de,en,es,fr,hi,it,ja,ko,pt,zh}.json
```

执行 grep 全量命中仅有 `pricing.comparison.exportMarkdown`，没有 `chat.exportMarkdown / chat.exportPdf / chat.exportDocx`。

对比 `chat.customInstructions` 在 11 个语言文件中均已定义（zh:「自定义指令」、en:「Custom Instructions」等），因而正常渲染。

## 为什么 `|| 'Export PDF'` fallback 不生效？

`frontend/src/components/Chat/PlusMenu.tsx:112,133,159`：
```tsx
<span>{t('chat.exportMarkdown') || 'Export Markdown'}</span>
<span>{t('chat.exportPdf') || 'Export PDF'}</span>
<span>{t('chat.exportDocx') || 'Export DOCX'}</span>
```

看似有兜底，但 `frontend/src/i18n/LocaleProvider.tsx:73-89` 的 `t()` 实现：
```ts
const translated = activeTranslations?.[key] ?? loadedTranslations.en?.[key];
let str = translated ?? key;   // ← 关键：缺失时返回 key 本身
...
return str;
```

`t('chat.exportPdf')` 返回字符串 `"chat.exportPdf"`（truthy），因此 `|| 'Export PDF'` 永远不会触发。这是一个**假兜底**。

## 功能本身是否可用？

代码链路正确，仅是标签渲染错了：

1. **Markdown 导出** (`ChatPanel.tsx:177-180`)
   - 纯客户端：`exportConversationAsMarkdown(messages, docName)`
   - 无网络依赖，应当可用

2. **PDF / DOCX 导出** (`ChatPanel.tsx:182-197`)
   - 调用 `exportSession(sessionId, format)` → `frontend/src/lib/api.ts:272-279`
   - 请求 `${PROXY_BASE}/api/sessions/${sessionId}/export?format=pdf|docx`
   - 后端端点存在：`backend/app/api/export.py:30-31`（`@router.get("/api/sessions/{session_id}/export")`）
   - 走 `/api/proxy/*`，JWT 由 proxy 注入（符合 `.claude/rules/frontend.md` 约定）

3. **自定义指令** (`ChatPanel.tsx:217`)
   - `canUseCustomInstructions = !!onOpenSettings`，由父组件传入
   - 未定阶：仅凭静态审计无法保证用户计划判断与 Pro 门禁都已正确；代码面看入口存在，但运行时行为需人工或冒烟测试验证

## 修复建议

**唯一修复点**：在 11 份 locale 文件中补齐 3 个 key。命名与现有兜底文案、同类 `pricing.comparison.*` 命名风格对齐。

示例（zh.json）：
```json
"chat.exportMarkdown": "导出 Markdown",
"chat.exportPdf": "导出 PDF",
"chat.exportDocx": "导出 DOCX",
```

示例（en.json）：
```json
"chat.exportMarkdown": "Export Markdown",
"chat.exportPdf": "Export PDF",
"chat.exportDocx": "Export DOCX",
```

**不建议**改 `t()` 实现把 missing key 返回空串 —— 会影响其他 call site、且开发模式已通过 `console.warn` 暴露缺失键（LocaleProvider.tsx:79-81），修复「数据」而非「逻辑」更合规。

## 留给 Codex 审阅的问题

请重点辩论：
1. 本次只补 i18n 数据是否足够？需不需要顺手强化 `t()` 兜底（例如开发期 throw / 生产期 humanize key）？
2. 3 个功能的运行时可用性是否仍需冒烟测试？是否应增加 E2E 用例防止回归？
3. 翻译是否在 11 种语言下都应使用「Export」英文还是本地化？业界同类产品（ChatGPT / Claude）惯例是？
4. 命名应是 `chat.exportMarkdown` 还是 `chat.export.markdown`（现有 schema 是点分扁平 key，需保持一致性）？
