# One-time RetainPDF volume migration

The reviewed upstream switched from UID 0 to UID 10001. The first production image failed before API startup because the legacy mounted /data was root-owned. The old image was rolled back and its authenticated API recovered.

An independently reviewed temporary maintenance image used the same pinned upstream plus the final footnote/contract patches. Before starting any API, it performed a complete preflight over the seven explicitly named runtime subtrees: same device, no setuid/setgid modes, no symlink traversal, errors fail closed. It changed ownership, preserved ordinary permissions/content, skipped lost+found, then execed setpriv with UID/GID 10001 and no-new-privs. Railway's single-volume deployment lifecycle removed the old writer before this startup.

Production migration log: 397 paths changed. Local Docker volume regression: original file content preserved, mode0640 retained, owner10001, actual PID1 UID/GID10001, NoNewPrivs1, write/read successful as UID10001, second startup idempotent. Auth was required: the test without an API key failed closed; the test with a synthetic local key started normally.

The final application image is the original reviewed Dockerfile with USER retainpdf:retainpdf. The root migration wrapper is not retained in the final deployed image. Rollback to the old root image does not require reversing ownership.

A new /health platform probe exposed that Railway PORT must explicitly equal the existing RUST_API_PORT=41000. The maintenance deployment's probe used the wrong default port, so it was canceled after migration; the final deployment uses PORT=41000. Existing API authentication/private networking/volume/region are preserved.
