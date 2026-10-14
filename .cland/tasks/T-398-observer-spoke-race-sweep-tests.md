---
id: T-398
kind: task
title: "Observer-spoke race sweep: tests observing a fake-harness session miss deliveries when the native spoke connects later (lead handover 1/5 alone)"
state: open
status: ready
size: S
rank: 2360
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-369
topic: topic-249
branch: t/T-398-observer-spoke-race-sweep-tests
created: 2026-10-14T12:41:56.075Z
updated: 2026-10-14T14:02:58.250Z
---

## Summary

The test 'lead-1 hands its node and question to lead-2; the next verdict reaches the new Lead through the fake harness' fails 1 in 5 when run alone. Its 5 s channel wait for lead-2 sees only lead-2's role clause. This is the observer race T-369 fixed in verifier-routing: a test-side observer spoke connects before the fake harness's native spoke, and the native spoke then becomes the newest delivery endpoint and receives the message. Every test using this observer-plus-native-fake pattern is exposed.

## Evidence

- T-347's run dde7d63b at cbbe6974 (A-2357): 1641/1642 hub tests passed, and the only failure was this test.
- Five runs alone at cbbe6974: pass, pass, fail, pass, pass. The failure was the same 5 s lead-2 wait, seeing only the Implementer clause, in a test of about 12.5 s. The logs are in topic-233.
- T-369 (e5bd6b89) fixed the same race in verifier-routing.test.ts by waiting for each fake session's first `session.usage` frame, which means the native MCP spoke is ready, before connecting the observer.

## Acceptance criteria

- [x] C1. Sweep every hub test that connects an observer spoke for a session also driven by a fake harness, and apply T-369's readiness wait (the native spoke ready before the observer connects), or observe through the native session's delivery log. No assertion changes meaning.
  - done: impl-398 · 2026-10-14T13:27:11.826Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-2 · 2026-10-14T14:02:52.728Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
- [x] C2. List the swept tests and files in the review request.
  - done: impl-398 · 2026-10-14T13:27:50.519Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-1 · 2026-10-14T13:30:42.021Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-2 · 2026-10-14T14:02:52.728Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
- [x] C3. The fix is one test-only commit, so it can be cherry-picked into every live branch.
  - done: impl-398 · 2026-10-14T13:27:13.546Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-1 · 2026-10-14T13:30:42.021Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-2 · 2026-10-14T14:02:52.728Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
- [x] C4. Each touched file passes 20 consecutive solo runs, plus 10 under four CPU workers when the verify queue is empty.
  - done: impl-398 · 2026-10-14T13:28:36.510Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-1 · 2026-10-14T13:30:42.021Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa
  - verified: rev-23 [reviewer] · run rev-2026-10-14-398-2 · 2026-10-14T14:02:52.728Z · commit e7adbaf0858a17274b1d17a2394be794cbb413fa

## Comments

### impl-398 · 2026-10-14T12:44:25.799Z

Sweep found unguarded fake-Claude/native observer connections in ask-chain, lead-handover, lead-permissions, lead-routing, session-archive, session-holds, stage-qa, verifier-routing (8 test files). Added subscribed UI first-session.usage waits keyed to launched sessionId before observer connection; no existing assertion changed. Baseline lead-1 handover targeted run passed (1/1), prior 1/5 failure supplied by task evidence. Starting 20 consecutive whole-file solo runs, one file at a time while verify holds the host. Existing session-usage and session-events observers already follow usage waits; T-369's three-Reviewer observer already guarded.

### coord · 2026-10-14T13:00:10.504Z

Coordinator amendment to C4 (2026-10-14 13:00Z): lead-handover.test.ts gets 20 consecutive solo whole-file runs plus 10 under one runner and four CPU burners. The other 7 swept files get 5 consecutive solo runs each. A deliberate delayed-native-spoke reproduction on lead-handover goes red before the fix and green after. Reason: the literal C4 would cost about 2.5 h on the critical path.

### coord · 2026-10-14T13:28:02.665Z

Coordinator reading of C4 (2026-10-14 13:28Z): T-398 is on the critical path. C4 is met before merge by the solo evidence A-2386 (lead-handover 20/20, the 7 other swept files 5/5 each) plus the mutation proof A-2379, red before and green after. The ten one-runner-plus-four-burner runs follow as a post-merge confirmation in the first quiet window, posted here. A failure reopens the fix as a regression.

### impl-398 · 2026-10-14T13:28:38.366Z

Source ready at pushed e7adbaf0858a17274b1d17a2394be794cbb413fa: one test-only commit (8 files, 50 insertions), worktree clean. A-2386 contains 55 whole-file solo invocations / 345 passes: 20 Lead handover runs, five per other swept file. npm run typecheck passed. A-2379 contains exact delayed-native mutation red/green proof with assertions/deadlines unchanged and mutation cleanup recorded. C4 marked done on Coordinator decision 511a4110-e502-43d8-a545-9c99773d3943 at 13:27:58Z: load confirmation deferred until first post-merge quiet window. Reviewer request delivered to rev-23; awaiting clear source verdict before automatic-mode cland verify at the exact head.

### rev-23 · 2026-10-14T13:30:42.021Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-398-1
commit: e7adbaf0858a17274b1d17a2394be794cbb413fa
scope: full

Source clear; no high or medium findings. All eight files/50 additions reviewed: subscribed UI launch-specific first-usage barriers precede observer connection, including re-subscription before the later QA launch. No original assertion/deadline removed or production seam added. C2 inventory and C3 one test-only commit verified. C4 judged under Coordinator 511a4110/13:28:02 task comment: all 55 final solo logs pass 345 cases, plus A-2379's 1500ms native-delay mutation reproduces the original 5s failure then passes with only readiness changes. Ten CPU-loaded runs are post-merge quiet-window confirmation with reopening on failure. C1 awaits exact-head no-mode cland verify. A-2387: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2387-t-398-source-clear-and-amended-solo-mutation-evidence.md.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-398 · 2026-10-14T14:02:10.603Z

Exact-head automatic verification passed: 82711f33-b329-4e98-bb2e-376293787d5d at source-reviewed e7adbaf0858a17274b1d17a2394be794cbb413fa, mode hub-only selected from the eight test-file diff. Typecheck plus hub suite and Neovim smoke green: 1645 passed, zero failed/cancelled/skipped. Executor local Darwin arm64, Node v24.21.0, Neovim v0.12.5. Durable log A-2406. Awaiting rev-23's final C1/same-head verdict; claim retained until merge. Ten burner runs remain post-merge confirmation under Coordinator decision 511a4110-e502-43d8-a545-9c99773d3943.

### rev-23 · 2026-10-14T14:02:52.728Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-398-2
commit: e7adbaf0858a17274b1d17a2394be794cbb413fa
scope: evidence

No high or medium findings. A-2406 exact-head no-mode verification 82711f33-b329-4e98-bb2e-376293787d5d passes root typecheck and the automatically selected hub-only suite: 1645/1645 (37 free, 1597 machine, 11 Neovim smoke), exit 0, zero failures/cancellations/skips/todo. Reviewed branch and clean worktree still match. Source A-2387 remains applicable; C1 now verified, C2/C3 retained. C4 verified under Coordinator decision 511a4110 and the 13:28:02 task comment: 55 solo invocations/345 passes plus mutation red/green; ten CPU-loaded runs are post-merge quiet-window confirmation, with reopening on failure. This suite does not substitute for that confirmation. Final evidence A-2407: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2407-t-398-final-exact-head-verification-and-c4-disposition.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
