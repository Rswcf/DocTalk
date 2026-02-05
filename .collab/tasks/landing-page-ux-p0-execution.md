# Landing Page UX P0 执行计划

**状态**: ✅ P0 完成
**执行者**: Codex (CX)
**审核者**: Claude Code (CC)

---

## P0 任务清单

### Task 1: 后端上传接口 require_auth

**文件**: `backend/app/api/documents.py`

**改动**:
1. 将 `upload_document` 的依赖从 `get_current_user_optional` 改为 `get_current_user`
2. 确保 `document.user_id` 使用 `user.id`

**验收**:
- 未携带 Authorization header 的上传请求返回 401
- 携带有效 token 的上传请求正常工作

---

### Task 2: 前端 API 走代理

**文件**: `frontend/src/lib/api.ts`

**改动**:
1. 定义 `PROXY_BASE = '/api/proxy'`
2. 以下接口改走代理:
   - `uploadDocument` → `${PROXY_BASE}/api/documents/upload`
   - `deleteDocument` → `${PROXY_BASE}/api/documents/{id}`
   - `createSession` → `${PROXY_BASE}/api/documents/{id}/sessions`
   - `deleteSession` → `${PROXY_BASE}/api/sessions/{id}`
3. 保持公开接口直连:
   - `getDocumentStatus`
   - `getFileUrl`
   - `health`

**验收**:
- 登录用户可上传文件
- 未登录用户上传返回 401

---

### Task 3: AuthModal 组件

**文件**: `frontend/src/components/AuthModal.tsx` (新建)

**实现**:
1. 使用查询参数 `?auth=1` 控制显示
2. 包含 Google SSO 按钮
3. 包含隐私承诺文案
4. 包含激励文案 (50 credits)
5. 支持 ESC 关闭
6. 响应式设计

**i18n 键**:
- `auth.loginToContinue`: "登录以继续"
- `auth.loginBenefits`: "登录后可上传文档、保存对话、多设备同步"
- `auth.privacyNote`: "我们不使用你的文档训练模型"
- `auth.freeCredits`: "新用户赠送 50 credits（约 10 次对话）"

---

### Task 4: 根布局集成 AuthModal

**文件**: `frontend/src/app/layout.tsx`

**改动**:
1. 导入 AuthModal
2. 在 Providers 内部渲染 AuthModal

---

### Task 5: 首页动态 CTA

**文件**: `frontend/src/app/page.tsx`

**改动**:
1. 使用 `useSession()` 获取登录状态
2. 未登录时:
   - 主 CTA: "立即体验示例 PDF" → /demo
   - 次级: "登录上传你的 PDF" → ?auth=1
   - 显示 Google 登录按钮
3. 已登录时:
   - 主 CTA: 上传区域
   - 次级: "试用示例" → /demo
   - 显示 "我的文档" 列表 (暂用 localStorage)
4. 点击上传区域时检查登录状态，未登录则触发 ?auth=1

**i18n 键**:
- `home.tagline`: "与你的 PDF 对话，智能引用，精准定位"
- `home.tryDemo`: "立即体验示例 PDF"
- `home.loginToUpload`: "登录上传你的 PDF"

---

### Task 6: PrivacyBadge 组件

**文件**: `frontend/src/components/PrivacyBadge.tsx` (新建)

**实现**:
1. 单行显示: 🔒 你的文档安全：不用于训练 · 加密存储 · 随时删除
2. 可点击展开详情卡片
3. 链接到 /privacy 和 /terms

**i18n 键**:
- `privacy.badge`: "你的文档安全：不用于训练 · 加密存储 · 随时删除"
- `privacy.details`: "隐私详情"

---

### Task 7: Demo 选择页

**文件**: `frontend/src/app/demo/page.tsx` (新建)

**实现**:
1. 显示 3 个示例选项卡片:
   - 财报分析 (10k)
   - 研究论文 (paper)
   - 合同审查 (contract)
2. 每个卡片显示示例问题
3. 点击进入 /demo/[sample]
4. 底部提示: 登录后可上传自己的 PDF

**i18n 键**:
- `demo.title`: "选择一个示例文档体验 DocTalk"
- `demo.hint`: "点击引用编号 [1] 会跳转到原文并高亮显示"
- `demo.sample.10k`: "财报分析"
- `demo.sample.paper`: "研究论文"
- `demo.sample.contract`: "合同审查"

---

### Task 8: Demo 阅读页

**文件**: `frontend/src/app/demo/[sample]/page.tsx` (新建)

**实现**:
1. 加载 `/public/samples/{sample}.pdf`
2. 左侧 Chat，右侧 PDF Viewer
3. 前端消息限制 (5 条)
4. 顶部横幅: 登录后可保存对话
5. 输入框上方显示剩余次数
6. 达到限制时弹出 AuthModal

**注意**: 暂时使用一个占位 PDF，P1 再添加真实示例

---

### Task 9: 简版隐私页

**文件**: `frontend/src/app/privacy/page.tsx` (新建)

**内容**:
- DocTalk 隐私政策
- 数据收集: 邮箱、上传文档
- 数据使用: 不用于训练
- 数据存储: 加密、30 天保留
- 用户权利: 随时删除
- 联系方式

---

### Task 10: 简版条款页

**文件**: `frontend/src/app/terms/page.tsx` (新建)

**内容**:
- DocTalk 服务条款
- 服务说明
- 用户责任
- 免责声明
- 变更通知

---

### Task 11: i18n 文本更新

**文件**: `frontend/src/i18n/locales/*.json` (8 个文件)

**新增键值**: 上述所有 i18n 键

---

## 执行顺序

1. Task 1 (后端) + Task 2 (API 代理) - 可并行
2. Task 3 (AuthModal) + Task 6 (PrivacyBadge) - 可并行
3. Task 4 (布局集成)
4. Task 5 (首页改造)
5. Task 7 + Task 8 (Demo 页面)
6. Task 9 + Task 10 (法务页面)
7. Task 11 (i18n)

---

## 验收流程

每个 Task 完成后:
1. Codex 报告完成
2. CC 验证代码
3. CC 运行构建测试
4. 确认无误后继续下一任务
