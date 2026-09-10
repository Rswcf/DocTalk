# Session-limit repair — adversarial review, round 1

Branch `fix/session-limit-copy`, HEAD `30f7f1e`, off `main` @ `a0a446f`. **Frontend only.**
Review `git diff a0a446f..30f7f1e`. Design authority: `.collab/plans/2026-09-03-backlog-decision.md`
§9.18 and §9.19. Read `CLAUDE.md` and `.claude/rules/frontend.md` first — the demo counter contract
was won over six adversarial rounds and must not be re-litigated.

## Severity bar

**BLOCK only for:** money loss, a paid-feature leak, or breaking behaviour that previously worked.
Everything else is a note. **If it is sound, say SHIP plainly.** Do not manufacture findings.

## What changed

1. `isDemo` added to the Zustand store (`store/index.ts`), set from `useDocumentLoader`, reset on
   document change. Needed because `SessionDropdown` takes no props and reads only the store.
2. `errorCopy.ts:74-83` — a pre-dispatch branch: `SESSION_LIMIT_REACHED` **with `context.isDemo`**
   returns upload copy with `cta: {label, href:'/'}` and **no `plan`**.
3. `errorCopy.ts:392-400` — the own-document string now names both exits and carries a new
   `secondaryAction: {label, action:'delete_session'}`.
4. `SessionDropdown.tsx:335-347` renders that secondary action, deleting a **non-active** session.
5. `SessionDropdown.tsx:83-97` — "New chat" reuses the current session when it holds no user message.

## Attack these specifically

1. **Can the demo path still reach checkout?** The claim is structural: the demo CTA has no `plan`,
   and the upgrade button branch at `:349` requires `status === 'authenticated' && cta.plan`, so it
   renders a `<Link>` instead. Find any path — a different error code, a race where `isDemo` is stale
   or unset, an anonymous user, a collection session — where a demo-surface session limit still
   produces a Stripe redirect or an `upgrade_click`.
2. **Is `isDemo` ever wrong at the moment the error renders?** It resets to `false` when
   `documentId` changes (`store/index.ts:185`) and is set by the loader. Consider: fast document
   switches, the reader mounting before the loader resolves, a demo document opened directly by URL,
   and the store being read by a component mounted in `AppHeaderShell` (outside the reader tree).
   A false negative sends a demo user to Stripe again; a false positive tells a paying-capable user
   to upload instead of upgrade.
3. **Demo counter contract — the highest-value target.** The reuse path performs *no* accounting
   mutation and the create path is unchanged. Verify that: find a sequence where reusing rather than
   creating leaves `demoMessagesUsed`, `demoRestoredUserMsgCount`, `demoAccountingEpoch` or the
   `sessionStorage` pointer in a state the old code would not have produced — especially for an
   anonymous demo user pressing "New chat" on a session with assistant-only content, and for a late
   `reanchorDemoCounter` resolving across the reuse.
4. **The emptiness judgement.** Reuse triggers on `!live.messages.some(m => m.role === 'user')`,
   guarded by `messagesSessionId === sessionId`. Can the store hold an empty/foreign transcript at
   that moment such that a session with real user messages is silently reused and its content
   discarded? That would be data loss and is the worst outcome in this diff.
5. **The delete affordance** picks `sessions.find(s => s.session_id !== sessionId)`. Can it delete
   the wrong session, the only session, or a session the user is mid-stream in? Is `isStreaming`
   sufficient?
6. **`limit_hit` accounting.** It fires when `copy.cta` exists (`SessionDropdown.tsx:101`). The demo
   branch still has a `cta`, so demo limit hits still emit — intended, since §9.18 requires the
   demo/own split downstream. Confirm the emitted metadata still lets that split be made.

## Out of scope

- The cap value (3) and any backend counting change — ruled three times; the number stays.
- Excluding empty sessions from the backend count — explicitly rejected as unsafe (row-spam vector).
- Anything in `chat.py`, the caps, or `FREE_MAX_SESSIONS_PER_DOC`.
- The `DEMO_SESSION_LIMIT_REACHED` code (`errorCopy.ts:410`), which serves the anonymous cap.
- Re-opening the demo counter design.

## Gates Claude ran on `30f7f1e`

| Gate | Result |
|---|---|
| `npm run build` | compiles |
| `npm run test:unit` | 37 passed (+15) |
| `ruff check app/ tests/` | clean (backend untouched) |
| i18n | 4 new keys, identical set across all 11 locales, all flat |
| palette | no `gray/indigo/violet/purple`, no `transition-all` |

Your sandbox cannot run git. Do not report a gate you did not execute.

Write `.collab/dialogue/2026-09-10-session-copy-codex-r1.md`: verdict (BLOCK / REVISE / SHIP), then
each finding with severity, exact `file:line`, the concrete failing sequence, and a suggested fix.
