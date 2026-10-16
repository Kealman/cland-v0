---
id: T-532
kind: task
title: OpenCode launch polls the server on a port cland chose, and a rejected approval is reported as a rejection
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-424
blocked_by: []
topic: topic-378
branch: t/T-532-opencode-launch-polls-the-server-on-a
created: 2026-10-15T20:59:18.648Z
updated: 2026-10-16T16:26:43.858Z
closed: 2026-10-16T16:26:43.858Z
---

## Summary

E-424 slice 2 (tracer step 2). OpenCode launch stops waiting for a log line: the adapter picks the port and polls the server until it answers. A rejected approval is reported as a rejection, never as the server's shutdown (upstream #54180).

## What to build

See E-424's "Readiness" and "Rejections" bullets.

- **Readiness.** The adapter picks a free loopback port itself, passes it with `--port`, and polls an authenticated `GET /api/session/active` until it answers within the launch deadline. A port taken in between restarts the attempt on a new port. The log is read only to explain a failure.
- **Rejections.** The adapter keeps each session's last `permission.replied` with `reject`. A following `interrupted` with reason `shutdown` in the same execution is reported as the rejection, with its command, and the session stays alive. A shutdown with no rejection before it is still the server's death.

Code: `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/opencode/state.ts`, `hub/src/adapters/opencode.ts`. Tests use the fake OpenCode binary in `hub/test/fakes/opencode/`.

## Acceptance criteria

- [x] C1. A fake server that never prints its listening line launches, by polling the port cland chose, within the launch deadline.
  - done: impl-532 · 2026-10-16T15:55:37.037Z
  - verified: rev-30 [reviewer] · run rev-20261016-532-final · 2026-10-16T16:24:47.904Z · commit dc6fe58907374be337f5baa9e8e82ab366c116ca
- [x] C2. A port taken between choice and bind restarts the attempt on a new port, and a launch that never answers fails naming the log's explanation.
  - done: impl-532 · 2026-10-16T15:55:37.664Z
  - verified: rev-30 [reviewer] · run rev-20261016-532-final · 2026-10-16T16:24:47.904Z · commit dc6fe58907374be337f5baa9e8e82ab366c116ca
- [x] C3. A rejected approval followed by a shutdown interrupt is reported as a rejection with its command, the session stays alive, and a bare shutdown is still reported as the server's death.
  - done: impl-532 · 2026-10-16T15:55:38.261Z
  - verified: rev-30 [reviewer] · run rev-20261016-532-final · 2026-10-16T16:24:47.904Z · commit dc6fe58907374be337f5baa9e8e82ab366c116ca

## Comments

### impl-532 · 2026-10-16T15:51:18.949Z

Implementation in progress at the fake OpenCode boundary. Confirmed the no-listening-line launch fails before the change and passes with authenticated HTTP polling. Collision retry and bounded unresponsive-server diagnostics pass; same-execution rejection handling now reports the command and preserves the session. Updating transport fixtures for readiness, then targeted files and typecheck.

### rev-30 · 2026-10-16T15:58:02.393Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-532-source
commit: dc6fe58907374be337f5baa9e8e82ab366c116ca
scope: full

# T-532 source review clear

Reviewed pushed `dc6fe58907374be337f5baa9e8e82ab366c116ca`, branch `t/T-532-opencode-launch-polls-the-server-on-a`; local/origin refs agree. Fixed point/merge base `21882019e906cb5988975aa4df0cac9578190c68`; captured three-dot diff/single implementation commit. Eight files202insertions/56deletions. Hold/current claimant/C1–C3 done/QA none-after-stage checked. Direct read-only Standards/Spec review; no subagents.

## Standards

Zero high/medium/low findings. Readiness stays in existing server owner, event interpretation in SessionTracker and reporting in adapter host seam. Existing OpenCodeClient supplies authentication and bounded HTTP; no extra transport/version policy. LaunchFiles still owns each spawned attempt before await completion and rolls back native exit receipts before undoing files. No production test flags, global environment mutation or real OpenCode operation.

Transport catalog/native-boundary fixtures now mock actual readiness request instead of printing a success URL. Failure cases retain cleanup assertions, with no-url renamed no-answer and the existing numeric duration baseline moved to that identity; no allowance increase. Whitespace check clean.

## Spec / readiness and retries

C1 source behavior present: freePort binds127.0.0.1:0 temporarily, captures/closes the reservation, passes a nonzero explicit--port, polls authenticated GET/api/session/active via OpenCodeClient. Successful readiness requires the HTTP request and a still-live child, not a log line.

C2 source behavior present: one deadline covers all bind attempts/readiness probes. Each HTTP attempt timeout is at most250ms and at most remaining launch time; inter-probe waits are clipped too. Attempted ports are tracked so bind retry chooses a different port. Only an exited attempt whose newly appended diagnostic contains EADDRINUSE/address-in-use retries; other exits fail immediately, while a nonanswering live child fails at the deadline. Log offset uses bytes (stat/Buffer.subarray), excludes prior launches/attempts and supplies the explanation rather than readiness. Existing transaction cleanup applies to failed attempts/deadline; no unowned server introduced.

Real fake-boundary tests launch without any listening line, plant a competitor on the chosen port and assert two distinct nonzero ports, and bound an accepted-but-unresponsive HTTP server with expected log explanation and no remaining fake server after failure. No actual upstream behavior beyond the existing API contract is inferred.

## Spec / rejection and execution scope

C3 source behavior present: SessionTracker retains a rejected permission's request/full-command description and consumes it only at the following shutdown interrupt in the observed execution. It clears rejection on execution start/end, stream forget and snapshot reset, preventing carryover into a later observed execution. Actual errors/quota handling remain separate; bare shutdown yields serverShutdown rather than rejection.

Adapter snapshots rejected turn's delivered message IDs before clearing turnMessages, recovers the command through the existing bounded/fallback-safe approvalCommand helper, and reports `Approval rejected: <command>` through turnFailed. Recovery is separate from subsequent turns, so clearing/reporting the old turn does not consume new inputs. Bare shutdown uses existing guarded #gone/exited path. Command lookup already catches missing/HTTP errors and falls back to retained description/action, rather than throwing an unhandled client rejection.

Two end-to-end tests cover known and deliberately delayed command lookup: reject, exact command-bearing message/events, session still running, successful continuation, then a later bare shutdown becoming exited. The delayed case observes both lookup requests before releasing its barrier. Fake emits permission.replied then interrupted/shutdown for rejection; native fixture changes preserve prior API-error tests and lifecycle cleanup.

## Evidence and next gate

**A-3939** is a durable summarized evidence note, not a separate raw-log bundle. It reports root typecheck0, individual catalog2/2/native-boundary65/65/OpenCode-adapter22/22 green, controlled no-listening/rejection red-before-green, and final focused five added cases5/5 after diagnostic offset adjustment (0.555/0.666/1.310/1.366/1.034s). I read all changed committed assertions and relevant client/transaction/status paths; Reviewer runs no tests/compiler/binary/provider calls.

Source **clear**, no failed criterion. C1–C3 are behavioral runtime criteria; retain **final verification pending** the requested **no-mode exact-head cland verify**, including all five new-case repetitions under gate policy. Local summarized checks do not replace the same-head suite gate; no criterion is marked finally verified at this source-only pass. No full local suite/per-item QA requested. Any changed head requires delta review.

Findings: Standards0; Spec0. Source clear; C1/C2/C3 final runtime pending.

Artifact A-3946 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3946-t-532-source-clear-authenticated-readiness-collision-retry-and-execution-scoped-.md

### rev-30 · 2026-10-16T16:24:47.904Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-532-final
commit: dc6fe58907374be337f5baa9e8e82ab366c116ca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-532 final evidence review

Commit dc6fe58907374be337f5baa9e8e82ab366c116ca, unchanged from source clear rev-20261016-532-source / A-3946. Local and origin task tips agree.

## Standards
No findings. No source delta; chosen-port authenticated readiness, bounded collision retries/cleanup and execution-scoped rejection handling remain covered by source review.

## Spec
Post-source-review droplet 35b3763e-afc1-4b42-9c5d-0815da6cd44f / A-4000 names the exact reviewed head and exits 0.

C1: no-listening-line fake launch passes ordinarily in 1.120 seconds and 5/5 fresh repetitions. The readiness signal is the authenticated HTTP response on the port cland chose, not a log line.

C2: controlled choice-to-bind collision/new-port retry passes in 1.521 seconds and 5/5 repetitions. Unresponsive-server deadline/log-explanation proof passes in 1.187 seconds and 5/5 repetitions, retaining its cleanup assertions.

C3: known-command and delayed-command rejection/shutdown-interrupt cases pass ordinarily in 2.124 and 2.130 seconds and each 5/5 repetitions. Their session-alive/continued-turn and later bare-shutdown server-death checks remain intact. Total five new identities, 25/25 repetitions; no owned case is skipped.

Independently checked raw phase summaries: hub free 38/38, hub machine 1910 pass/zero failure/five skips out of 1915, Neovim smoke 12/12. Overall 1965 tests, 1960 pass, zero failure/cancellation, five platform/binary prerequisite skips. The skip list is the two macOS sandbox cases, macOS sleep inhibitor and two absent-real-OpenCode cases; it does not substitute for or omit the owned fake-harness regressions. Host and remote typechecks complete. No hard duration or load-gate failure.

Delivery records Linux x64, c-8 lon1, four workers, peak load 13.02, suite wall 1462.35 seconds, lifetime 1536 seconds, cost $0.1067. Existing-entry duration notices are diagnostic.

C1–C3 execution verified; all claimant done marks were present. Final clear with no additional run or per-item QA required. Standards 0 findings; Spec 0 findings.
Artifact: A-4001 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4001-t-532-final-clear-readiness-and-rejection-handling-pass-linux-and-load-repetitio.md

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-16T16:26:43.858Z

Merged 45f6b167356a757384e44260e16daf18c2ecbe8c onto dev.
