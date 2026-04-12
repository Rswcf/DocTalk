**APPROVED**

1. 全仓 `rg`（含 `.ts/.tsx/.js/.jsx`）`t(...)||` 命中 `0`。此批实际替换为 `12` 处 `t()||`（4+3+4+1）；你说的“第13处”是 PlusMenu 硬编码 `aria-label`，也已改为 `tOr`。  
2. `PlusMenu` 新增 `tOr` prop 合理：保持组件无 i18n hook 依赖、可测性更好；代价仅一层 prop drilling。  
3. 全部调用均为 `tOr(key, fallback)`，且 fallback 与原 `|| 'X'` 一致。  
4. 这 4 个改动文件内未发现新增硬编码 `aria-label/title/placeholder`。  
5. Fix B 范围外（含 `.ts`）也未发现 `t()||` 残留。  

残余风险：本次为静态审阅+grep，未做 11 语言 UI 回归。