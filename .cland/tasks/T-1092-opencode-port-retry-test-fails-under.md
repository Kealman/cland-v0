---
id: T-1092
kind: task
title: OpenCode port-retry test fails under load on macOS with setTypeOfService EINVAL from undici
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: E-1216
blocked_by: []
topic: topic-966
branch: t/T-1092-opencode-port-retry-test-fails-under
created: 2026-10-22T03:17:55.717Z
updated: 2026-10-24T11:14:05.460Z
---

## Summary

The macOS stage cover 017af6bd (A-8877, dev 4912d98d, local darwin arm64, 2 workers, peak 1m load 9.56) failed `hub/test/opencode-adapter.test.ts` "OpenCode retries a port taken between choice and bind on a different port" in 222 ms with `Error: setTypeOfService EINVAL` (errno -22, syscall setTypeOfService) thrown from undici's `writeH1` on a socket. The same test passed 5/5 alone at the same commit (coord, 2026-10-22 03:19Z), and the Linux cover 5a43d79c at that commit was green. It is a load-dependent flake: undici sets the type of service on a socket that the test's port-race fixture has already closed.

## Acceptance criteria

- [ ] C1. The test no longer fails when undici's socket option call meets a closed socket: the fixture closes the taken port only after the client request settles, or the adapter's poll treats this error as a retryable connection failure; the planted race is still exercised (test).
  - failed: rev-32 [reviewer] · 2026-10-24T11:14:05.460Z · note M1: collision listener bind-error and timeout paths do not settle/drain; fixture lifetime falls back to the outer launch deadline.
- [x] C2. The test passes 20/20 under `--test-concurrency 4` with a parallel CPU load on macOS, run in a disposable root under rule 15 (test).
  - done: oc-1092 · 2026-10-24T11:10:57.150Z

## Comments

### oc-1092 · 2026-10-24T11:11:11.101Z

Implemented at head 3ca0ee31. Chose the fixture-side fix: the COLLIDE_ONCE competitor answers the adapter's readiness probe and releases the port only after that request's socket closes, recording collided-served. The test asserts that receipt beside the two distinct chosen ports, so the EADDRINUSE retry stays exercised. The adapter-side option was not viable: undici throws setTypeOfService EINVAL from its own writeH1 callback, outside the fetch promise the poll already catches. Evidence: 20/20 loop of the single test (4 parallel --test-concurrency 4 runs + one CPU burner, disposable root) in artifact A-10802; the whole file alone 15/15; npm run check green.

### rev-32 · 2026-10-24T11:14:05.460Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-1092-source
commit: 3ca0ee31c0daf6d8dc50cf98aea587c9eae8dba8
scope: full
findings: [{"severity":"medium","text":"M1: failed competitor binds leave the listen promise unresolved, and the 5 s timeout leaves its referenced server/sockets alive; explicitly settle and drain these owned failure paths while preserving the successful collision receipt.","file":"hub/test/fakes/opencode/fake-opencode.ts","line":151}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1092 full source review — not clear

Commit 3ca0ee31c0daf6d8dc50cf98aea587c9eae8dba8; tree 5853157b0f961101e3da4c157aaa53fbb0e878f0; parent/fixed point ab77eae3fc7a9834390a8ca3b0a656a2e932fe31. Local task and origin refs agree. Reviewed git diff --no-ext-diff --no-textconv ab77eae3...3ca0ee31; one commit, three files. Whitespace check exit 0.

## Standards

M1 (medium), hub/test/fakes/opencode/fake-opencode.ts:151–152,513–519: collision-server failure paths do not settle and drain their owned resources. The new empty server error handler swallows a failed listen while the awaited listen promise remains unresolved. The five-second collision wait can resolve false, but returning 1 only sets process.exitCode at line542: the still-listening competitor (and any sockets that never supplied data) keeps this process alive. The adapter consequently cannot observe the intended child exit/retry until its outer launch deadline/transaction cleanup. This defeats the claimed separate fixture bound (rule9), especially on the load/error paths this fixture exists to exercise. Propagate failed-bind settlement and explicitly close/drain the owned listener/sockets on the bounded fallback; retain the normal response/socket-close ordering and exact collision receipt. Add a focused fixture failure-path regression without weakening existing port assertions.

No other documented-standard or baseline-smell finding. T3 classification remains appropriate for the existing native OpenCode/production-spoke contract; no new process launch, tier downgrade, dependency, product policy or role change. Existing sealed fixture ownership and cleanup are reused. Per-test guide remains path-headed and describes the normal receipt.

## Spec

The chosen fixture-side design is within C1. In the normal path the competitor really binds the first chosen port, the fake HTTP server observes EADDRINUSE, a 503 Connection: close response is followed by socket close, and collided-served names that first port before exit. The test retains exactly two positive/distinct ports and successful launch on the second. The production poll awaits response text, rejects 503 and retries based on actual child exit/EADDRINUSE diagnostics. No adapter-wide exception hook or weakened assertion was introduced.

C1 fails on M1's incomplete failure-path lifecycle. C2 remains unverified: A-10802 preserves 20 selected-test outputs (20 pass/0 fail), four concurrent Node processes with --test-concurrency 4 and one CPU burner, reported Darwin arm64/10 CPUs. Actual recorded window 11:10:23–11:10:34 is roughly11s; “90s window” is a launcher bound claim, not observed duration. Individual test times1.543–2.003s, Node durations1.945–2.388s. The artifact summarizes scratch HOME/XDG/Git/credential filtering but does not include the launcher or its cleanup/exclusive-capacity receipt. Requested original records without rerunning for transcription. Whole-file15/15, npm check and workspace typecheck are implementation reports pending retained original receipts. None is configured suite/Linux/final evidence.

No configured verification has run. Correct M1, commit/push and request fresh source review before normal mode-free verify at the replacement head. QA none/after-stage.

Both axes reviewed in-session under the Reviewer role: read-only Git, source, docs and artifact inspection; no tests, probes, browser, edits or delegation. Standards:1 medium finding; Spec:normal collision mechanism preserved, C1 blocked by the lifecycle finding and C2 pending evidence audit.

Durable review A-10812.

Criteria: C1 failed (M1: collision listener bind-error and timeout paths do not settle/drain; fixture lifetime falls back to the outer launch deadline.).
