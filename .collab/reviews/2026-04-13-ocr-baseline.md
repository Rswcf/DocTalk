# OCR 工程基线报告 (O-1)

**日期**：2026-04-13
**范围**：**工程基线**（代码鲁棒性 + 合成样本 metrics）
**不在范围**：产品 go/no-go — 需真实扫描样本，作为 **O-2** 异步 follow-up

---

## TL;DR

1. **DocTalk 已有 OCR**：PyMuPDF + Tesseract 5.5.2，默认 `eng+chi_sim`，端到端工作
2. **合成样本表现**：200dpi/100dpi 提取质量基本一致（~4,900 chars/2 pages），15° 倾斜损失 ~10%
3. **代码鲁棒性**：4 个 edge case 全部有单元测试覆盖，7 test 通过
4. **已修正 3 处文案冲突**（旧 roadmap / en.json / zh.json），剩 9 个 locale 待 i18n 同步
5. **产品决策待 O-2**：需用户提供 3-5 份真实脱敏扫描样本（合同 / 发票 / 手写批注）

---

## 1. 代码路径 walk-through

### OCR 流程

```
Upload PDF
    ↓
parse_worker.process_document_task (backend/app/workers/parse_worker.py)
    ↓
extract_pages(file_bytes) ← 尝试从 PDF 文本层提取
    ↓
detect_scanned(pages) ← 判定：>70% 页面 < 50 字符 → 视为扫描
    ↓
[如果扫描]
settings.OCR_ENABLED?
    - False → doc.status="error", msg="Scanned PDF, OCR disabled"
    - True  → doc.status="ocr" → extract_pages_ocr(file_bytes, OCR_LANGUAGES, OCR_DPI)
        ↓
    total_chars < 50?
        - Yes → doc.status="error", msg="OCR could not extract sufficient text"
        - No  → doc.status="parsing" → 继续下游（PPTX/DOCX 转 PDF + embedding 等）
```

**关键代码位置**：
- 扫描检测：`backend/app/services/parse_service.py:168-180` — 启发式 70% 页面字符 < 50 → 扫描
- OCR 执行：`backend/app/services/parse_service.py:107-166` — `page.get_textpage_ocr(language, dpi, full=True)` 调 Tesseract
- Worker 编排：`backend/app/workers/parse_worker.py:192-237` — detect → fallback → verify
- DPI 上限：`parse_service.py:127-137` — 单页像素 > 20MP 时按比例降 DPI，最低 72

### 运行环境

- Docker `backend/Dockerfile:18` 装 `tesseract-ocr` + `tesseract-ocr-eng` + `tesseract-ocr-chi-sim`
- Env vars：`OCR_ENABLED`, `OCR_LANGUAGES=eng+chi_sim`, `OCR_DPI=300`
- 本地 macOS 环境：`brew install tesseract tesseract-lang`（已装 163 种语言，超出默认）

---

## 2. 合成样本 Baseline

### 方法

源 PDF：`backend/seed_data/alphabet-earnings.pdf`（Alphabet Q4 2023 财报节选，2 页测试）。

Rasterize 第 1-2 页为图像后无文本层地塞回 PDF（模拟纯扫描件），再过 `extract_pages_ocr(languages="eng+chi_sim", dpi=300)`。

脚本：`.collab/scripts/ocr_baseline.py`

### 结果

| 变体 | 合成大小 | Pages | Chars | Chars/Page | Wall time | Chars/s |
|------|---------|-------|-------|------------|-----------|---------|
| **clean-200dpi** | 合成 ~1MB | 2 | 4,927 | 2,464 | 3.34s | 1,475 |
| **low-res-100dpi** | 合成 ~270KB | 2 | 4,928 | 2,464 | 3.92s | 1,257 |
| **tilted-200dpi-15°** | 合成 ~1MB | 2 | 4,397 | 2,198 | 4.32s | 1,019 |

### 分析

1. **100dpi ≈ 200dpi**（4,928 vs 4,927 chars）— Tesseract 对标准 Latin 字体 DPI 耐受度高。低清扫描不会显著降低 ASCII 文本识别率
2. **15° 倾斜损失 10.8%**（2,198 vs 2,464 chars/page）— 主要因 rasterize 时边角像素被裁；Tesseract 自带 deskew 但只能拉正不能恢复裁掉的内容
3. **吞吐 ~1-1.5K chars/s**（本地 M 系 CPU）— 2 页财报 ~3-4 秒。Railway Celery worker 上若用 CPU 实例可能翻倍，实测再观察

### 样本局限（影响可信度）

- **仅测 1 份源 PDF**（alphabet-earnings，纯英文，财务表格为主）— 没测中文 / 手写 / 低质量复印件 / 带水印
- **合成扫描 ≠ 真实扫描** — 合成件没有噪点、纸张纹理、复印痕迹、墨水晕染
- 所以：**本基线仅验证代码路径可跑通，不是质量决策依据**

---

## 3. Edge Case 单元测试覆盖

`backend/tests/test_parse_service.py` 运行结果：`7 passed`

| # | 场景 | 测试 | 验证结果 |
|---|------|------|---------|
| 1 | 空 pages → detect_scanned 返回 True | `test_empty_pages_is_scanned` | ✅ |
| 2 | 足够文本 → detect_scanned 返回 False | `test_pages_with_text_not_scanned` | ✅ |
| 3 | 70% 低文本 → detect_scanned 返回 True | `test_pages_with_little_text_is_scanned` | ✅ |
| 4 | 混合阈值（30%文本）→ False | `test_mixed_pages_threshold` | ✅ |
| 5 | **OCR 语言 / DPI 传参正确** | `test_ocr_calls_get_textpage_ocr` | ✅ |
| 6 | **tesseract 缺失 → 页面跳过不 crash** | `test_ocr_skips_failed_page` | ✅ |
| 7 | **超大页（640 inch）DPI 自动降到 ≥72** | `test_ocr_caps_dpi_for_large_pages` | ✅ |

**行为确认**：
- 单页 OCR 失败 → `logger.warning` + 跳过，整体不 crash
- 若所有页都跳过 → 返回空 list → `parse_worker` 检查 `total_chars < 50` → `doc.status="error"` → 用户看到 "OCR could not extract sufficient text"
- 超大页保护：`max_pixels=20_000_000`，DPI 下限 72 — 防 Tesseract OOM / 超时

---

## 4. 文案冲突修正

| 位置 | 修正前 | 修正后 | 状态 |
|------|-------|-------|------|
| `.collab/plans/2026-03-16-user-pain-points-feature-roadmap.md:32` | ❌ 无OCR支持 | ⚠️ 有 Tesseract OCR（eng+chi_sim），质量基线未量化 | ✅ |
| `frontend/src/i18n/locales/en.json:891` lawyers FAQ q4 | "...Scanned image-only PDFs without OCR may have limited text extraction." | "...DocTalk automatically runs OCR using Tesseract (English + Simplified Chinese)..." | ✅ |
| `frontend/src/i18n/locales/zh.json:891` lawyers FAQ q4 | "...建议先使用 OCR 工具处理。" | "...DocTalk 会自动使用 Tesseract（英文 + 简体中文）进行 OCR 提取..." | ✅ |

### 待 follow-up（未改）

其他 9 个 locale（ar / de / es / fr / hi / it / ja / ko / pt）的 `useCasesLawyers.faq.q4.answer` 仍为旧英文或旧翻译。**建议作为独立 i18n 同步 PR**（批量翻译，避免此次 OCR batch 膨胀）。

---

## 5. O-1 Done 标准对照

| 项 | 要求 | 状态 |
|----|------|------|
| 3 合成样本 metrics | chars / density / latency | ✅ |
| 4 edge case | DPI cap / 语言 / 空页 / tesseract 缺失 | ✅（7 unit test 覆盖 4 个核心 case） |
| 代码 walk-through | parse_worker + parse_service | ✅ §1 |
| ≥2 处文案冲突修正 | commit | ✅ 3 处 |
| 明确声明 "非产品 go/no-go" | 写入报告 | ✅ TL;DR + §2 样本局限 |

**O-1 Done。** 进入 A'（CSP 分步落地）。

---

## 6. O-2 触发条件

用户提供 **3-5 份真实脱敏扫描样本**（推荐类型）：

1. **中英混合合同**（1-3 页）— 测 `chi_sim + eng` 并行
2. **发票/表格**（1 页）— 测表格结构还原
3. **手写批注 PDF**（1-2 页）— 测 Tesseract 对非印刷体失效边界
4. **低质量复印件**（1 页）— 测真实噪点下的字符准确率（非 chars 总数）
5. **双栏学术 PDF 扫描**（2 页）— 测版式理解

Claude 拿到后：
- 跑现有 Tesseract baseline
- 对比 Mistral Document AI API（benchmark）
- 对比 pdfplumber-ocr / Unstructured.io
- 给 **go/no-go**：是否值得引入云 OCR（预估成本 + 质量提升 vs 现状）

---

## 7. Known limitations for production

基于本基线 + 已知代码路径：

1. **chi_tra（繁体中文）未启用** — Dockerfile 只装 `chi-sim`。台湾/香港繁体扫描件会降级到 "best-effort"。若目标市场包含 HK/TW，需加 `tesseract-ocr-chi-tra`
2. **手写识别能力弱** — Tesseract 是印刷体 OCR，手写字符准确率会显著下降。若需 handwriting，考虑引入云 OCR
3. **OCR 延迟放大 parse 时间** — 100 页扫描件预计 3-5 分钟（vs 文本型 <10 秒）。Celery `soft_time_limit=540` 是够的，但用户体感差
4. **OCR_DPI=300 固定** — 未按页面大小动态调整（除超 20MP 保护），对 A4 小文档是过度，对 A3 大图是不足
