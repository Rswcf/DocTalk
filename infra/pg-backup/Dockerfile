# syntax=docker/dockerfile:1
# Nightly off-site backup of production Postgres to Cloudflare R2.
# Runbook: README.md in this directory. Plan: .collab/plans/2026-09-27-postgres-backups.md
#
# pg_dump refuses a server with a newer major version, so this client must be
# at least the server's major (production is 17.11). Pinned by digest; bump
# deliberately when Railway moves Postgres to a new major.
FROM postgres:17.11-bookworm@sha256:639ab7ceb90e13123085b741fb31ef493fba25463002f6da665352e7b534b652

# Debian-packaged tools only (bookworm: age 1.1, rclone 1.60, curl 7.88, jq 1.6).
RUN apt-get update \
    && apt-get install -y --no-install-recommends age ca-certificates curl jq rclone \
    && rm -rf /var/lib/apt/lists/*

COPY backup.sh /opt/doctalk/backup.sh
RUN chmod 0755 /opt/doctalk/backup.sh

# initdb (the in-container restore test) refuses to run as root.
USER postgres
WORKDIR /tmp

# The base image's entrypoint would start a database server instead.
ENTRYPOINT []
CMD ["/opt/doctalk/backup.sh"]
