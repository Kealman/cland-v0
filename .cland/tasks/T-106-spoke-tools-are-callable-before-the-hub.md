---
id: T-106
kind: task
title: "Spoke tools are callable before the hub's welcome and fail with \"not
  connected yet\": queue or wait for readiness"
state: closed
status: done
labels:
  - hub
  - ready-for-agent
assignee: null
parent: E-19
blocked_by: []
topic: topic-39
branch: t/T-106-spoke-tools-are-callable-before-the-hub
created: 2026-10-09T20:55:16.129Z
updated: 2026-10-10T00:58:17.926Z
closed: 2026-10-09T21:39:24.511Z
---

## Parent

Part of T-19. Found by impl-105 on T-105 on 2026-10-09 at 20:49Z. rev-65 recommended it as its own item in rev-65-105-1 (A-195).

## What happened

A session's MCP tools, such as `rename`, can be called before the hub has sent the spoke's welcome. They then return `{ok:false, error:'the hub is not connected yet (connecting)'}`. T-105's flaky test ignored that result. An agent that calls a tool in its first moments gets the same failure and must retry by hand. rev-65 notes that a sibling presence test makes the same readiness assumption about another client.

## What to build

- While the spoke is connecting, tool calls wait for readiness up to a bounded deadline, then run, or fail with a clear message if the deadline passes. They do not fail at once.
- Check the other tests that call spoke tools right after launch, including the presence test rev-65 named, for the same unstated readiness assumption.

## Acceptance criteria

- [ ] A tool called during connecting succeeds once the welcome arrives, which a deferred test proves; one past the deadline fails with a clear message.
- [ ] The presence test and its siblings wait for readiness explicitly.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex.

## Comments

### impl-106 · 2026-10-09T21:09:45.488Z

Claim confirmed. Starting with a deterministic held-welcome reproduction, then a bounded readiness wait and explicit readiness sweep of spoke tests.

### impl-106 · 2026-10-09T21:16:07.881Z

Implementation committed as c595ac0 (task branch pushed to local origin). Held-welcome rename regression went red before fix and passes after it. Seven controlled readiness tests pass, including timeout/removal, concurrent calls, close/refusal/stop and fresh welcome identity/role after reconnect. npm run typecheck passes. Added explicit own-spoke readiness to ordinary fixture helpers and first callers, including the session-events presence sibling. READINESS_TIMEOUT_MS and WELCOME_TIMEOUT_MS are 20 s; reply timeout remains 10 s and silent-welcome test keeps its 300 ms override via CLAND_HUB_WELCOME_TIMEOUT_MS. Final full npm test is running through the suite lock.

### rev-6 · 2026-10-09T21:22:01.859Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-106-1
commit: c595ac080f91143aacbdf6446e291b0250455ab1

No high or medium findings. Connecting requests wait with a bounded readiness deadline, reread live state/socket after waiting, and carry no cached actor identity. Refusal, disconnect and stop settle waiters; expired/abandoned calls are not replayed on a later welcome. Fake-socket probes cover concurrency, fresh reconnect identity, timeout, refusal, stop, stop-at-welcome, ordinary reply deadline and timer cleanup.
Low — hub/test/tracer.test.ts:9 / hub/test/routing.test.ts:12: new readiness waits precede try/finally; a rejected wait skips fixture cleanup and may leave the test worker alive. Protect these waits with cleanup ownership.

The 20 s silent-welcome cost is acceptable as a bounded asynchronous startup allowance and documented; request reply deadlines remain 10 s, handshake remains 10 s, and reconnect/backoff/name fallback are unchanged. The hub RequestGuard scope rule does not require wrapping spoke-client continuations. Both typechecks and diff check pass; no full suite run.

Separate Standards/Spec reports and reproducible probe: A-205, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-205-t-106-review-rev-6-106-1-at-c595ac0.md.

### impl-106 · 2026-10-09T21:26:51.079Z

c595ac0 full suite completed 636/637 hub tests passing; failed before Neovim (A-207). Cause: the newly ready topic-model helper awaited a roleless fixture that is intentionally refused until the test assigns its Coordinator role. Fixed in test-only commit ad6641e: ready helper requires a role, intentional roleless case uses a direct spawn and awaits own readiness after role.set. Also moved tracer/routing readiness waits inside try/finally per review A-205; audited other added waits for cleanup ordering. Targeted files pass 14/14, typecheck passes, and the complete locked acceptance suite is rerunning on ad6641e as requested by the Coordinator.

### rev-6 · 2026-10-09T21:30:34.048Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-106-2
commit: ad6641e513d02cf7d8c2541ce70e26a14677015d

No high or medium findings. The intentional roleless fixture remains roleless before assignment, retains its no-coordinator and queued-delivery/status assertions, and waits for own readiness only after role.set; ordinary helper callers all supply a role. Tracer cleanup is fixed.
Low — hub/test/routing.test.ts:26: finally still omits impl2.close(); a rejected readiness wait skips its success-path close and can leave the spoke/transport alive. Add unconditional cleanup for impl2.

This delta is tests only; production review/probes in A-205 remain applicable. Hub typecheck and diff check pass; no tests or full suite run here. Targeted 14/14 is implementer-reported; final full acceptance suite remains pending. Separate Standards/Spec reports: A-209, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-209-t-106-resolution-review-rev-6-106-2-at-ad6641e.md.

### impl-106 · 2026-10-09T21:38:34.819Z

Complete at 375d2970b90332566fecb3fcc52e7592321f613a (pushed to local origin; worktree clean). Full locked npm test on ad6641e passed 741/741: 637 hub + 104 Neovim, exit 0 (A-212). Final one-line commit adds unconditional impl2.close() in routing cleanup; final routing tests pass 3/3 and npm run typecheck passes, with no further full suite per Coordinator instruction. Readiness/timeout/reconnect behavior and final evidence are in the completion artifact; A-203 contains the await checklist. All requested behavior and validation are complete; awaiting the Coordinator's merge gate.

### rev-6 · 2026-10-09T21:39:11.558Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-106-3
commit: 375d2970b90332566fecb3fcc52e7592321f613a

No high, medium or low findings. hub/test/routing.test.ts:29 now closes impl2 unconditionally on readiness failure; repeated close after the existing success-path close is safe under the SDK and harness cleanup semantics. Assertions and production behavior are unchanged.

Hub typecheck and diff check pass; clean requested head. Read A-212 confirming the parent ad6641e full suite passed 741/741 (637 hub, 104 Neovim); no tests/full suite run by reviewer. Separate Standards/Spec reports: A-214, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-214-t-106-final-cleanup-review-rev-6-106-3-at-375d297.md. Earlier production review/probe A-205 and roleless correction review A-209 remain applicable.

### coord · 2026-10-09T21:39:24.489Z

Merged b55dc01beabfe436a5caa16f4628c1b2dc2c0c03 onto dev.

### coord · 2026-10-09T21:39:31.785Z

Merged by the Coordinator through `cland merge T-106`: squash b55dc01 on dev. Gate: review rev-6-106-3 clear on 375d297, after rev-6-106-1 (clear on c595ac0, one cleanup-order low) and rev-6-106-2 (clear on ad6641e, one more cleanup low). Spoke tool calls wait for the welcome up to READINESS_TIMEOUT_MS = 20 s. Close, refusal and stop fail waiters at once, and the identity and socket are re-checked after the wait. WELCOME_TIMEOUT_MS = 20 s is separate from the 10 s request timeout; detecting a silent hub now costs up to 20 s. Full acceptance suite on ad6641e: 741 of 741 (A-212). The final one-line test cleanup, 375d297, passed routing.test.ts and typecheck (A-213). Dev was pushed with `cland push` before the merge; it included the human's other session's unpushed 44a6205. impl-106 stopped.
