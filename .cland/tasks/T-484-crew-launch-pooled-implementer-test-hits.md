---
id: T-484
kind: task
title: crew-launch pooled Implementer test hits 'pool size 1 reached' before the previous member is idle (Linux)
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-287
branch: t/T-484-crew-launch-pooled-implementer-test-hits
created: 2026-10-15T09:54:30.252Z
updated: 2026-10-15T10:26:56.735Z
closed: 2026-10-15T10:26:56.735Z
---

## Summary

`hub/test/crew-launch.test.ts:145` ('an Implementer pool moves to the next task worktree after merge (opencode, keep_context=true)') expected /unknown or unavailable brief/ and got 'crew.implementer: pool size 1 reached (pooled-impl)'. This was in T-461's Linux run a506e23a (A-2843), 2026-10-15. The next launch arrives before the pool member is observed idle, which is the same class T-434 fixed for accounts. Wait for the member's idle or release before the next launch.

## Acceptance criteria

- [x] C1. The test waits on the pool member's observed release before the next launch, keeps its assertions, and the file passes 5/5 beside a local full run and once on a droplet.
  - done: impl-484 · 2026-10-15T10:26:03.375Z
  - verified: rev-30 [reviewer] · run rev-20261015-484-final · 2026-10-15T10:26:24.295Z · commit 3a5736b599776b7302811ed42eb948c05c120208

## Comments

### impl-484 · 2026-10-15T09:55:32.821Z

Baseline targeted repro command: node --test --test-name-pattern='an Implementer pool moves.*opencode, keep_context=true' hub/test/crew-launch.test.ts passed locally (1/1, 5.56 s test). Existing wait checks idle only; T-434's accounts fixture additionally requires completed first-turn usage and released holds. Investigating the same initial-idle-before-spoke/clause boundary here; no production changes intended.

### impl-484 · 2026-10-15T09:59:50.237Z

Confirmed exact symptom by temporarily delaying fake OpenCode spoke connection 2 s: the original wait accepted startup idle and the invalid-brief assertion got 'crew.implementer: pool size 1 reached'. The changed wait passed the identical delayed-startup command; probe removed. Final change waits for the same session id, idle, zero holds and OpenCode first-turn usage, retaining Claude's Stop-hook guard and every existing assertion/timeout. npm run typecheck passed. Loaded full-file repetitions 1–3 passed 10/10 each (49.03 s, 62.38 s, 65.54 s) beside local impl-461. Initial evidence: A-2855.

### impl-484 · 2026-10-15T10:02:22.161Z

Source ready at 3a5736b599776b7302811ed42eb948c05c120208, pushed to origin. Fetched and merged origin/dev immediately before commit (tracker-only). Five serial loaded full-file repetitions all passed 10/10 beside local impl-461: 49.026 s, 62.383 s, 65.541 s, 57.148 s, 62.424 s. Complete logs and diagnosis: A-2858, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2858-t-484-five-loaded-crew-launch-repetitions-and-diagnosis. Typecheck and diff check passed. C1 still awaits post-review Linux droplet evidence; not marked done prematurely.

### rev-30 · 2026-10-15T10:03:24.658Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-484-source
commit: 3a5736b599776b7302811ed42eb948c05c120208
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings; matches existing account-pool release guard and repo test guidance.
Spec: hub/test/crew-launch.test.ts:138–145 matches the original session identity, idle state and zero holds; OpenCode's nonzero first-turn usage distinguishes completed work from startup idle. Existing Claude Stop-hook guard and eventually deadline remain, as do every invalid-brief, handoff/context, claim, cwd, cleanup and pool-cap assertion.

A-2855 records exact delayed-spoke red/green reproduction with the temporary probe removed. A-2858's five serial loaded file logs all pass 10/10 with zero skips, beside local impl-461 per its evidence note. C1 remains unverified in this source pass pending same-head post-source Linux verification.

### rev-30 · 2026-10-15T10:26:24.295Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-484-final
commit: 3a5736b599776b7302811ed42eb948c05c120208
scope: evidence

Final review clear; no high, medium or low findings. Current branch head, reviewed source and gate all match 3a5736b599776b7302811ed42eb948c05c120208.

Standards: source review rev-20261015-484-source stands, no findings.
Spec: C1 verified. Source establishes release before next launch with identity, idle, holds and first-turn evidence while preserving assertions. A-2855 supplies exact delayed-spoke red/green; A-2858 supplies 5/5 serial loaded file passes (10/10 each beside local impl-461). A-2872:4150–4159 confirms all ten crew-launch cases pass on Linux, including OpenCode keep_context true 4.555 s and false 4.263 s; no affected-case skips.

Same-head dc5e877a/A-2872 gate exits 0: host/remote typecheck green; hub-only + Neovim smoke; 1732 tests, 1729 pass, 0 fail/cancelled, 3 platform skips. Linux x64 c-8, Node v24.21.0, Neovim v0.12.5. Skips are unrelated macOS sandbox-exec/idle-sleep cases.

Criteria: C1 verified.

### coord · 2026-10-15T10:26:56.735Z

Merged 5728fa6c4ab927235d108a941c9651a091c41138 onto dev.
