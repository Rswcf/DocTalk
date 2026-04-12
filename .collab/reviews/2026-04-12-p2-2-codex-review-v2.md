P2-2 v2 结论：
1) `git diff` 显示三项都完成：抽 `_alert`；抽 `_is_already_exists`（先 `status_code==409`，再 `"409"` fallback）；删除 MinIO 旧文案。
2) `qdrant-client==1.16.1`；本地源码里 `UnexpectedResponse.__init__` 赋值 `self.status_code`，409 判定成立。
3) 两个 helper 都在 `lifespan()` 内定义，不会污染模块命名空间。
4) 评审结论：通过。
