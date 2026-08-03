# Codex review — P1 hygiene batch (domain_mode gate + paywall coverage)

Security-adjacent batch: a paid-feature gating fix + paywall UX coverage. Try to BREAK the gate and find dead-ends. Range `ba8a141..HEAD` (v0.25.0 → now), excluding the glass-spec docs commit.

```
git log --oneline ba8a141..HEAD
git diff ba8a141..HEAD
```

## What shipped
1. **domain_mode backend gate** (b6da842 chat.py, ef7e798 extractions.py, 1fab067 cleanup): `domain_mode` ("legal"/"academic") was Plus-gated frontend-only; backend accepted it unconditionally → free/anon users got paid domain-rules prompt behavior. Now BOTH input entry points (the only two: `ChatRequest.domain_mode`→chat.py chat_stream, `CreateExtractionRequest.domain_mode`→extractions.py create_extraction) gate with 403 `{"error":"DOMAIN_MODE_REQUIRES_PLUS","required_plan":"plus"}` when `domain_mode is not None AND plan not in {plus,pro}`; omitted → untouched; plus/pro → applies. Continuation endpoint has no domain_mode field and never touches DOMAIN_RULES; chat_stream re-sources domain_mode per-message and CLEARS the persisted session value when omitted (no downgrade-replay vector); collection chat routes through the same gated endpoint.
2. **paywall coverage** (dc18eff docs, 4cd4c8a, 78f660b, 28c0977, 1a2dcc8): surfaced upgrade CTAs/PaywallModal at 5 dead-end limit sites — SHARE_LIMIT_REACHED (ChatPanel), DOCUMENT_LIMIT_REACHED (2 layout-translation paths), DOMAIN_MODE_REQUIRES_PLUS e2e on chat SSE (useChatStream trigger + errorCopy + PaywallModal case + deriveUpgradePlan) and REST extraction (ExtractionPanel). 6 i18n keys ×11.

## Internal review (APPROVED) already verified
Gate has no bypass under adversarial tracing (continuation replay + collection-chat both checked); `.openPaywall` flag removed from the 403 entry (was inert — zero consumers — but contradicted its own invariant: 403s use inline CTA, only 402/MODE_NOT_ALLOWED auto-modal); i18n ×11 parity; palette clean; `npm run build` + targeted pytest + ruff all pass at HEAD.

## Attack surfaces
(1) ANY residual path where a free/anon request gets domain-rules behavior — replay of a persisted value, a service param sourced pre-gate, an unlisted endpoint, the collection path, extraction retry. (2) Gate over-fire — can it block ordinary free chat/extraction with no domain_mode? (3) The `openPaywall` invariant (finding the internal reviewer flagged): confirm removing it is correct and no surface actually needed auto-modal for these 403s. (4) 403 vs 402: does the frontend paywall/CTA path fire on CODE not status on both chat-SSE and REST-extraction routes? (5) Any new dead-end (a surfaced CTA that doesn't route to billing) or injection via the ChatPanel markdown-link CTA. (6) i18n truth.

Evidence to audit (don't repeat): 786 backend pass (gate mutation-tested), build/tsc/lint clean, 403-not-intercepted verified on both paths.

Report: severity-ranked findings with file:line, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.
