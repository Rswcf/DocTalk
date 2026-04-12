## 一致意见
1. Claude 对这次 PlusMenu raw key 的主根因判断是对的：`chat.exportMarkdown / chat.exportPdf / chat.exportDocx` 在 11 份 locale 都缺失，而组件直接调用了这些 key。证据在 [PlusMenu.tsx:112](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx:112)、[PlusMenu.tsx:133](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx:133)、[PlusMenu.tsx:159](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx:159)。
2. `|| 'fallback'` 确实是“假兜底”：`t()` 缺失时返回 key 本身（truthy），所以不会走右侧 fallback。证据在 [LocaleProvider.tsx:73](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/LocaleProvider.tsx:73) 到 [LocaleProvider.tsx:89](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/LocaleProvider.tsx:89)。
3. 后端 export 路由确实存在且已挂载：路由定义在 [export.py:30](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/export.py:30)，注册在 [main.py:186](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py:186)。
4. 对末尾问题 #4（命名）立场：**同意 `chat.exportMarkdown`，不建议 `chat.export.markdown`**。现有 schema 是“点分扁平 + 末段 camelCase”，如 [en.json:40](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/en.json:40) 的 `chat.export`、[en.json:645](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/i18n/locales/en.json:645) 的 `pricing.comparison.exportMarkdown`。

## 分歧点
1. 对末尾问题 #1（只补 i18n 数据是否足够）立场：**反对**“只补这 3 个 key 就够”。我做了静态扫描，`t('...')` 字面量 key 缺失不止这 3 个：还缺 `chat.share`、`profile.credits.prevPage`、`profile.credits.nextPage`、`altsHub.askyourpdfTagline`、`altsHub.pdfaiTagline`。这说明是系统性问题，不是单点事故。
2. 对末尾问题 #1（是否强化 t()）立场：**补充**。我不建议把 `t()` 改成“生产环境 humanize key”来掩盖错误，但建议增强“防扩散机制”：开发期 strict 模式（缺 key 抛错或 telemetry）+ CI 校验 key 完整性。仅靠 `console.warn` 不够。
3. 对末尾问题 #2（是否仍需冒烟/E2E）立场：**同意**。静态链路可读通，但运行时不可替代。并且当前 `backend/tests/test_export_api.py` 本地并未真正覆盖到 export 逻辑（在导入 `app.main` 时就因 [main.py:194](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py:194) 的类型注解在 Python 3.9 下报错）。
4. 对末尾问题 #3（11 语言都用英文 Export 吗）立场：**反对**。业界惯例是“动作词本地化，格式名保留技术词”。  
   证据：ChatGPT 西语帮助文档里是“Controles de datos / Exportación de datos / Exportar”；Claude 西语是“Exportar datos”；Notion 西语是“Exportar contenido / Exportar / Formato de exportación”，同时保留 `PDF/HTML/Markdown`。  
   这是基于官方帮助中心文案做的推断，不是拍脑袋。

## 新发现
1. 除了 PlusMenu 三个 key，还存在同类缺失键会触发 raw key 或无障碍文本异常：  
   [ChatPanel.tsx:372](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:372)、[ChatPanel.tsx:373](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:373)、[CreditsSection.tsx:232](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Profile/CreditsSection.tsx:232)、[CreditsSection.tsx:241](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Profile/CreditsSection.tsx:241)、[AlternativesHubClient.tsx:35](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/alternatives/AlternativesHubClient.tsx:35)、[AlternativesHubClient.tsx:41](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/alternatives/AlternativesHubClient.tsx:41)。
2. PlusMenu 按钮 `aria-label` 是硬编码英文 `"More options"`，未走 i18n。证据：[PlusMenu.tsx:54](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx:54)。
3. Plus+/Pro 门禁有产品决策待确认点：  
   `showCustomInstructions = canUseCustomInstructions || userPlan==='free'`，而 `canUseCustomInstructions` 来自 `profile.plan === 'pro'`。结果是 **Plus 用户不显示“自定义指令（Pro 锁）”入口**。证据：[ChatPanel.tsx:217](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:217)、[ChatPanel.tsx:218](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatPanel.tsx:218)、[useUserPlanProfile.ts:35](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useUserPlanProfile.ts:35)。
4. 在 collection 页面，`ChatPanel` 未传 `onOpenSettings`，即使 Pro 也无自定义指令入口。证据：[collections/page.tsx:259](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/collections/[collectionId]/page.tsx:259)。
5. 测试覆盖薄弱：前端没有对应单测/E2E；后端 `test_export_api.py` 目前只验证未登录 401，未覆盖 403/200 路径。

## 修复行动项最终提议
1. **P0**：一次性补齐所有已发现缺失 key（不只 3 个），至少先补：`chat.exportMarkdown/pdf/docx`、`chat.share`、`profile.credits.prevPage/nextPage`、`altsHub.askyourpdfTagline/pdfaiTagline`，11 语同步。
2. **P0**：补 `chat.moreOptions`，替换 [PlusMenu.tsx:54](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/PlusMenu.tsx:54) 的硬编码 aria 文案。
3. **P1**：建立 i18n CI 校验（扫描 `t('literal')` 与 locale 对比；en 基线 + 多语言完整性校验），防止新漏键进入主干。
4. **P1**：统一处理 `t() || 'fallback'` 反模式（例如增加 `tOr(key,fallback)` 并在 `t(key)===key` 时才走 fallback），避免“假兜底”继续扩散。
5. **P1**：补测试：  
   前端加 PlusMenu/ChatPanel 的 i18n 与门禁行为测试；  
   后端加 export 403（free）/200（plus/pro）用例；  
   再加一条最小 E2E 冒烟（zh 下菜单文本 + 三种导出行为）。
6. **P2（产品确认）**：明确 Plus 用户是否应该看到“自定义指令（Pro 锁）”入口，以及 collection 场景是否应提供该入口。

业界参考来源（用于第 #3 点）：
- OpenAI（语言设置）：https://help.openai.com/en/articles/8357869-how-to-change-your-language-setting-in-chatgpt  
- OpenAI（西语导出流程）：https://help.openai.com/es-419/articles/7260999-c%C3%B3mo-puedo-exportar-mi-historial-y-datos-de-chatgpt  
- Claude（语言设置）：https://support.claude.com/en/articles/10769299-how-to-use-claude-in-your-preferred-language  
- Claude（西语导出流程）：https://support.claude.com/es/articles/9450526-como-puedo-exportar-mis-datos-de-claude  
- Notion（语言设置）：https://www.notion.com/help/change-your-language  
- Notion（西语导出流程）：https://www.notion.com/es/help/export-your-content