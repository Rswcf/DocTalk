# Production qdrant-v2 does NOT build from this file: since 2026-09-27 its
# service source is the image qdrant/qdrant:v1.16.3 directly (set via
# serviceInstanceUpdate). This file is kept pinned to the same version so a
# rebuild from it can never jump versions again: attaching the storage volume
# once rebuilt `FROM qdrant/qdrant:latest` into 1.19.1.
FROM qdrant/qdrant:v1.16.3
EXPOSE 6333
CMD ["./qdrant"]
