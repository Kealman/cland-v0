---
id: T-1603
kind: task
title: OpenCode sessions on a host, end to end
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
  - T-1644
topic: topic-1377
branch: t/T-1603-opencode-sessions-on-a-host-end-to-end
created: 2026-11-02T03:33:56.105Z
updated: 2026-11-04T04:32:15.915Z
---

## Summary

An OpenCode session launched with `host` naming a fake host starts `opencode serve` through that host's agent on a host loopback port. The hub's OpenCode client reaches it through the session's per-session forward on a hub-side Unix socket. Deliveries, state and stop work as on the local host, and the stop cancels the forward.

Hot files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/opencode/client.ts`, `hub/test/opencode-remote.test.ts` (new)

## Acceptance criteria

- [x] C1. Through the frame protocol, an OpenCode session launched on a fake host with the scripted OpenCode fake receives a delivery and reports `idle` after its turn (test).
  - done: impl-1603 · 2026-11-04T04:28:57.985Z
- [x] C2. The OpenCode client talks to the server only through the per-session forward's hub-side Unix socket, and no hub-side TCP connection to a host port exists (test).
  - done: impl-1603 · 2026-11-04T04:19:22.199Z
- [x] C3. The session's spoke runs on the fake host and connects through `spoke.sock` with the host's secret (test).
  - done: impl-1603 · 2026-11-04T04:19:22.713Z
- [x] C4. Stopping the session stops its server through the agent by identity and cancels its forward, and nothing on the hub's machine is signalled (test).
  - done: impl-1603 · 2026-11-04T04:28:58.176Z
- [x] C5. The opencode-adapter and opencode-native test files pass with no test edited.
  - done: impl-1603 · 2026-11-04T04:19:23.726Z

## Notes

Shared files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`

## Comments

### impl-1603 · 2026-11-04T04:11:41.249Z

Pre-change consumer inventory: OpenCodeClient used by adapter launch/client/watch/resume, server readiness, models and doctor smoke, plus launch-policy/approval-restart/client-membership/scripted fixtures. Add optional Unix socket constructor input, preserving two-argument/local fetch shape. startServer gets optional client factory; default remains local for models/doctor/direct tests. Host shape unchanged. Observer/double consumers include adapter-native-boundary, host-ssh-contract, host-launch-layout, session-host-placement/routing, opencode-host, host-orphans. FailedLaunches/LaunchRecoveryPending callback migrates only OpenCode to shared async LaunchSettled. Search includes production, all hub test tiers, QA/docs/shipped skills; full path inventory published in item topic. Existing wire fields and native host URL remain unchanged.

### impl-1603 · 2026-11-04T04:19:37.508Z

Implemented and pushed 3411648822dc4022110fdfb800209b74d8916cb1; fetched/merged origin/dev before first review (already up to date). A-16495 records scope, local targeted provenance and limitations. All criteria done. Full root typecheck exit0; final npm run test:lint exit0, zero refusals, 122 known report-only findings/59 files and known prerequisite/build reports. Required unedited preservation batch167 + SSH contract38 pass; final focused Host/remote/cleanup11 pass. macOS arm64 Node24.21 local, no browser; these are working-tree targeted receipts, not queued same-head/Linux/full-tier proof. Remote rename found aside reported to lead; restart settlement T-1671 per decision. QA policy affected/after-stage, no per-item QA brief required; requesting source review now, then exact reviewed-head mode-free verify.

### rev-35 · 2026-11-04T04:25:34.275Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1603-source-1
commit: 3411648822dc4022110fdfb800209b74d8916cb1
scope: full
findings: [{"severity":"medium","text":"Settle the new per-session forward before publishing normal terminal exit: #gone and #pollPids currently unwatch/retire the session while #forwards/#connections remain owned until adapter.close or another explicit action.","file":"hub/src/adapters/opencode.ts","line":785},{"severity":"medium","text":"Join remote client and per-watch HTTP/SSE work before unforward/stop completion: #connections.work only constructs the client, #unwatch merely aborts, and snapshot requests/native socket closes have no joined receipt.","file":"hub/src/adapters/opencode.ts","line":825},{"severity":"medium","text":"Correlate idle with this turn's completion: the fake publishes pong before execution-succeeded, so waiting for pong then any already-idle row can accept the prior idle state without exercising the completion SSE.","file":"hub/test/opencode-remote.test.ts","line":59},{"severity":"low","text":"Preserve earlier allocated-port routes when updating ports.json: every freePort call currently replaces the map with 12345 and the latest port, so a second allocation removes the first route; serialize/atomically publish the accumulated map.","file":"hub/test/ssh-host-fixture.ts","line":65}]
finding_counts: {"high":0,"medium":3,"low":1}

Full source not clear:3 medium+1 low. Add current-hub terminal owner for #gone/#pollPids; own/join native Unix client request/socket closure plus per-watch subscriptions/snapshots before unforward; correlate idle with this turn's positive completion (pong precedes fake execution-succeeded); preserve/serialize earlier fixture port mappings. Implementer confirmed first two gaps. Detail A-16497 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16497-t-1603-source-review-terminal-ownership-client-drain-and-idle-receipt.md. C1/C4 failed; C2/C3/C5 unverified. Approved T-1671 post-restart callback limitation and filed T-1672 remote rename are not findings and do not cover normal in-memory gaps. A-16490/A-16495 read; reported local macOS Node24.21 working-tree focused11/preservation167+38/typecheck/lint0 are supplements, not queued Linux/browser/full-tier proof. No Reviewer execution/probes/browser/edits/Git mutations/delegation. Fresh source review of fixes required before configured verify; affected after-stage QA separate.

Criteria: C1 failed (Idle assertion may accept the prior idle state after pong but before this execution's completion SSE.), C4 failed (Normal terminal paths do not settle forward ownership, and explicit stop/close lack joined remote client/watch request/socket closure receipts.).

### rev-35 · 2026-11-04T04:32:15.915Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1603-source-2
commit: a193fbe9bef527004b8952ad9e19db2876acc5ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; all A-16497 findings resolved. Captured retryable terminal settlement fences acquisition; native request/socket closure and watch subscription/snapshot drain precede unforward/exit. C1 now withholds native success after pong and retains correlated busy/success/final-idle assertions. Fixture mappings serialize accumulated atomic publication. Standards/spec detail A-16499 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16499-t-1603-source-clear-terminal-settlement-and-native-client-drain.md. C1–C5 remain run-dependent and unverified here. A-16498 supplemental local macOS arm64 Node24.21 working-tree focused7/preservation221/static evidence is not configured exact-head Linux/browser/full-tier proof. No Reviewer execution, edits or Git mutations. Exact-head configured verification may proceed. Approved T-1671/T-1672 limitations unchanged; after-stage QA separate.
