NEEDS CHANGES

1. Blocking: lint/CI will fail due import ordering issues introduced in this PR.  
[backend/app/api/documents.py#L1](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py#L1), [backend/app/api/documents.py#L16](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/documents.py#L16), [backend/app/main.py#L1](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py#L1).  
`ruff check app/main.py app/api/documents.py` reports `I001` and `E402` errors.

2. Regression risk: `/health?deep=true` now hard-fails with `403` unless `X-Health-Secret` matches `ADAPTER_SECRET`.  
[backend/app/main.py#L162](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py#L162), [backend/app/main.py#L170](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/main.py#L170).  
I found no in-repo callers, but any external monitor/caller using deep health without this header will break.

3. Completeness gap: no tests added for the new deep-health auth behavior or sanitized URL error behavior.  
Current smoke tests only cover shallow `/health`: [backend/tests/test_smoke.py#L20](/Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_smoke.py#L20).  
Add coverage for:
- deep health without header => `403`
- deep health with valid header => `200`
- `/api/documents/ingest-url` unexpected exception => generic `"Failed to fetch URL"` response.

Security intent itself looks correct (`python-multipart` bump, compare-digest gate, no raw exception in API responses).