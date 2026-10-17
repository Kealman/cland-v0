---
id: T-687
kind: task
title: "An in-process spoke: the real spoke code over an in-memory MCP transport, connected to projectHub's real socket"
state: open
status: review
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-414
branch: t/T-687-an-in-process-spoke-the-real-spoke-code
created: 2026-10-16T19:59:28.543Z
updated: 2026-10-16T23:41:00.498Z
---

## Summary

`spawnSpoke` (`hub/test/harness.ts`) is a child process (`StdioClientTransport` on `bin/cland-spoke.ts`), called 614 times, mostly to obtain a role-bearing caller or an observer (memo §2.3 anti-pattern 6; report-slice1 opening finding; report-slice3 anti-pattern 2). T2 forbids spawned spokes, so T2 needs a spoke that runs in the test process and keeps the spoke's tool surface.

## What to build

- **A seam in `runSpoke`** (`hub/src/spoke/spoke.ts`): it accepts the MCP server transport and an exit callback, defaulting to stdio and `process.exit`, so an in-process caller supplies an in-memory transport and an exit that ends only that spoke.
- **`inProcessSpoke(t, options)`** in the harness, with the same options and the same returned `Session` shape as `spawnSpoke` (tool calls, channel events, waits). Its hub side is the real `HubClient` connecting to `projectHub`'s Unix socket or WebSocket as a spawned spoke does; teardown closes both sides and passes `projectHub`'s resource check.
- **First consumer.** `routing.test.ts` (3 tests, 4.3 s, three spoke children per test) moves to `inProcessSpoke`.

## Acceptance criteria

- [x] C1. `inProcessSpoke` returns the `Session` API of `spawnSpoke`, and a T2 test calls `send` and `task.view` and receives channel events with no child process, proved by the test and the tier lint.
  - done: impl-687 · 2026-10-16T23:39:35.813Z
- [x] C2. The in-process spoke's tool list and instructions equal a spawned spoke's, proved by a surface test.
  - done: impl-687 · 2026-10-16T23:39:36.079Z
- [x] C3. Ending an in-process session never calls `process.exit` and leaves no handle behind `projectHub`'s resource check, proved by a test.
  - done: impl-687 · 2026-10-16T23:39:36.469Z
- [x] C4. `routing.test.ts` runs on `inProcessSpoke`, is tagged T2, keeps its assertions' meaning (audit), and its manifest seconds fall from 4.3 s to under 2 s.
  - done: impl-687 · 2026-10-16T23:39:36.701Z

## Comments

### impl-687 · 2026-10-16T23:38:11.211Z

Implemented transport/exit/cwd/log injection in runSpoke and inProcessSpoke(t, options) using the SDK's linked in-memory MCP transport plus the real HubClient WebSocket. Shared Session behavior, awaitable HubClient socket teardown, projectHub resource checks, no host exit, and exact MCP tool/instruction/capability parity pass. Routing's three assertions are unchanged; it is now T2, uses FakeClock for TTL, and measured 0.125s test-time versus the 4.320s manifest baseline. Typecheck and tier lint pass. Preparing source review.

### rev-30 · 2026-10-16T23:41:00.498Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-687-source
commit: 297889645d0c3d80e292dce042335558eb5a8fc8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-687 full source review clear at 297889645d0c3d80e292dce042335558eb5a8fc8 on t/T-687-an-in-process-spoke-the-real-spoke-code. Fixed point 8c0a2b8fc959f13f7c915be39f08ebc6eb515783; pinned comparison git diff 8c0a2b8f...29788964, one implementation commit. Origin tip matches. Hold/task criteria read. Both review axes conducted in-session under the role's no-delegation requirement.

## Standards

No findings. T2 component and routing headers state their in-process boundaries; both are registered T2 in sorted tiers. The component serves projectHub with FakeClock and fake harness adapters, uses real protocol edges, and starts no child. Routing retains the lower-level permissive in-process startHub specifically to preserve the unknown-role contract. Its TTL advances FakeClock rather than waiting for real time. No new literal sleep or elapsed-time assertion is added. Existing bounded presence/absence I/O observation helpers are retained, not used as timer assertions.

Surface remains T3 and explicitly names the real stdio binary contract. The existing spawned contract is retained rather than duplicated through a fake binary. Shared Session parsing, notification buffering and waits remove duplicate transport-specific logic. Timeout and close paths remove/reject waiters and clear their timers. Socket-close completion is observed before the owned-resource check; fixture onCleanup runs spokes before projectHub's beforeDirectories teardown. Existing process-global cwd/environment are not mutated by an in-process spoke.

## Spec

No findings. runSpoke accepts an injected SDK transport and exit callback, while defaulting to StdioServerTransport/process.exit. The small cwd/log seams keep discovery, hello and diagnostics isolated without changing the host cwd. Only stdio installs stdin end/close listeners; close is guarded and removes them. The existing production stdin-EOF contract remains covered by resilience evidence.

inProcessSpoke uses the linked in-memory MCP pair and the real runSpoke handlers; HubClient still connects through the discovered real WebSocket. Shared environment construction preserves all prior spawnSpoke options, including human role assignment through the project's Unix socket. The returned Session API is shared, with documented pid 0 because no child exists. Idempotent cleanup closes client/server, awaits HubClient.stop's socket-close receipt and checks scoped resources. stop still cancels retries/readiness immediately; existing callers can ignore its new receipt.

The T2 component proof calls task.create/task.view/send, receives role and delivery notifications with caller metadata, observes disappearance after close, and confirms another spoke remains callable. Connecting, connected and unconfigured teardown cases reject a pending channel waiter, check no process.exit and unchanged stdin listeners, and retain automatic resource checks.

Surface compares the full tool list/schema results, instructions and capabilities to the existing spawned spoke; original surface assertions remain. Routing's original three titles and assertion bodies are preserved: glob/all addressing and sender exclusion, queue TTL, live/offline role delivery and unknown/unheld roles. Only construction and TTL clock control change. Duration manifest changes exactly its file seconds and three existing identity values; 0.0336 + 0.014655291 + 0.037366833 = 0.085622124 seconds, matching raw A-4251, below the 2-second requested bound versus 4.320149 before.

A-4252 reports serial below-load-15 touched files: component 2/2 (0.135 test-seconds, 0.383 total), routing 3/3 (0.086 test-seconds, 0.331 total), surface 3/3 (0.486 test-seconds, 0.732 total); readiness 7/7 and resilience 11/11 including stdin EOF. Typecheck/tier lint pass recorded; independent whitespace check passes. These are claimant execution receipts inspected read-only; Reviewer executed no tests/compiler/provider.

C1-C4 each include runtime proof, so no criterion is verified on this source pass. Their targeted evidence and source audit stand, with final verification pending the accepted exact reviewed-head task receipt. Submit normal mode-free droplet verification only after Coordinator explicitly lifts the daily-spend hold. No per-item QA criteria. Standards 0 findings; Spec 0 findings.
Review artifact A-4255.
