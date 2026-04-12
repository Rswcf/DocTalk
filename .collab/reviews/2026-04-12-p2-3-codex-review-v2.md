结论：实现正确：fallback 每次 error log，Sentry 按 namespace 10 分钟节流一次。

注意：`_last_sentry_alert_at` 为进程内缓存，多 worker/多实例不共享。上限应为 6×namespace×worker×实例/小时；4 namespace 即 576×worker×实例/天（非 144/天），请按配额评估。

线程：当前 async 单 loop 可；若未来有多线程入口，再加锁。
