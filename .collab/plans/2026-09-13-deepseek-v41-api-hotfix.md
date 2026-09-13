# DeepSeek V4.1 API hotfix plan (0.30.2)

## Objective

Move every active Flash path to DeepSeek's canonical `deepseek-flash` model,
keep the legacy `deepseek-v4-flash` identifier safe for old records and staged
rollbacks, and make every direct DeepSeek request deterministic under the
provider's new default-thinking behavior.

## Product risks addressed

| Risk | User impact | Acceptance criterion |
|---|---|---|
| Legacy Flash name remains the active default | Future removal can break chat and translation | All active defaults use `deepseek-flash`; legacy remains recognized |
| Action Planner inherits thinking-on | Planner can spend all 220 tokens reasoning and silently fall back | DeepSeek planner request disables thinking and requires JSON output |
| Provider behavior is copied between services | A future API change can leave one workflow inconsistent | DeepSeek detection, client construction, request options, anonymized user ID, and telemetry live in one module |
| Requested model hides provider routing | Operators cannot confirm which model served a call | Structured logs include operation, requested/actual model, latency, finish reason, cache tokens, and errors |
| Production environment overrides code defaults | A correct build can still call stale models | Railway effective settings show canonical Flash and Pro after rollout |

## Test strategy

1. Contract unit tests: canonical and legacy routing, non-thinking options,
   JSON mode, HMAC pseudonym stability, client retry configuration, response
   telemetry, model profiles, and credit rates.
2. Targeted regressions: Action Planner, extraction JSON retry, configuration,
   chat provider options, layout translation configuration, and version checks.
3. Repository gates: Ruff, parse-service tests, integration suite, and frontend
   production build.
4. Independent adversarial review for the cross-service change.
5. Live canary against the official DeepSeek endpoint for canonical Flash,
   Pro, JSON output, and legacy alias compatibility. Use synthetic prompts only.
6. Backend-first production rollout from `stable`; verify health, version,
   migration head, `RAILWAY_REPLICA_REGION=us-west2`, effective non-secret model
   settings, then push `stable` and wait for Vercel Ready.
7. Production smoke: API health plus authenticated/product browser golden path
   where existing session access permits. Confirm logs show the actual model and
   no planner `finish_reason=length` regression.

## Exit criteria

- Every automated gate passes.
- Independent review has no unresolved blocking or high-severity finding.
- Production backend reports 0.30.2 in us-west2 with migration 0046.
- Production model settings are canonical and live canaries succeed.
- Frontend production deployment sourced from the same `stable` commit is Ready.
