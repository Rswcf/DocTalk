---
id: A-12-C08-01
matrix: A
agent: claude
cell_id: A-12-C08
row_key: fastapi_metadata
column_key: sensitive_exposure_enum
finding_key: fastapi_metadata_endpoints_always_on
severity: P2
confidence: high
status: deficiency
files:
  - "backend/app/main.py:153"
exploit_preconditions:
  - "unauthenticated network access to backend-production-a62e.up.railway.app"
---

## Observation
`FastAPI(title=..., lifespan=lifespan)` is initialized with default configuration (`main.py:153`), which enables `/docs`, `/redoc`, and `/openapi.json` on all environments. These expose the full API schema — every route, every parameter, every internal error code, including `/api/internal/auth/*` (adapter-secret-guarded but visible in schema), `/api/admin/*`, `/api/billing/webhook`, and the full shape of request/response models.

## Impact
Info disclosure / attack-surface enumeration. An attacker doing recon can:
- Enumerate every endpoint + parameter shape without any guessing
- Learn internal path conventions (e.g., `/api/internal/*` pattern reveals the adapter-secret-guarded surface)
- Read docstrings that may contain internal notes / security rationale
- Build targeted fuzzers against validated Pydantic schemas

Not a direct exploit, but reduces the cost of every other probe. Industry standard is to disable docs in production or gate them behind an admin guard.

## Repro / Evidence
```
curl https://backend-production-a62e.up.railway.app/openapi.json | jq '.paths | keys'
```
Returns full route list.

## Suggested Fix
Gate behind environment in `main.py`:

```python
app = FastAPI(
    title=f"DocTalk API {get_product_version()}",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
    openapi_url="/openapi.json" if settings.ENV != "production" else None,
)
```

Or, if keeping in prod: gate with `x-health-secret`-style shared header check on a custom `/openapi.json` route, matching the `health?deep=true` pattern already established in this codebase.
