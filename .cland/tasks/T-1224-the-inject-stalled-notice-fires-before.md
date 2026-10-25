---
id: T-1224
kind: task
title: The inject-stalled notice fires before Codex app-servers finish reconnecting after a hub restart
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1280
blocked_by: []
topic: topic-1049
branch: t/T-1224-the-inject-stalled-notice-fires-before
created: 2026-10-24T10:13:49.994Z
updated: 2026-10-25T12:14:17.404Z
closed: 2026-10-25T12:14:17.404Z
---

## Summary

After hub restarts #50 and #51 (2026-10-24), the hub posted "injection has remained unconfirmed for 60000 ms (the hub is not connected to this session's app-server)" for every Codex session at +60 s, and all of them confirmed 64–90 s after the stop without any action. The notice is noise after every restart and trains the Coordinator to ignore it.

## Acceptance criteria

- [x] C1. During the reconnect window after a hub start, a Codex session whose app-server reconnects and confirms within a startup grace (measured from the hub start, long enough to cover the observed 90 s) produces no inject-stalled notice; a session still unconfirmed after the grace still gets one (test with a fake app-server).
  - done: impl-1224 · 2026-10-25T11:50:31.885Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1224-final · 2026-10-25T12:07:55.076Z · commit f7e8de5d96001acc2dd74427ca28b06d1c3a9ecf

## Comments

### impl-1224 · 2026-10-25T11:43:28.623Z

Inspected predecessor handoff: clean worktree at 5881ebcc (T-1256 landed). A-11669 locates the missing startup grace at Sessions injection-alarm scheduling. C1 seam authorized by the brief: projectHub with production CodexAdapter and ScriptedCodex fake app-server, FakeClock and exact inject-unconfirmed/delivery receipts; no native harness process.
Rule 20 consumer inventory (repository search across hub/web/nvim/shared, docs, skills, qa and all test tiers): producer hub/src/adapters/sessions.ts; hub/src/hub/inbox.ts consumes inject-stalled messages for delivery-stalled events; hub/src/protocol.ts and shared/wire/index.ts retain that event kind; no wire shape or row change. Existing hub/test/inject-stalled.test.ts alarm routing/episode regressions use Claude and remain unchanged; hub/test/codex-delivery.test.ts and fakes/scripted-codex.ts supply native reconnect regression seam. T3 codex-adapter.test.ts restart proof and T2 codex-native.test.ts recovery checks do not assert the alarm deadline, so unaffected. No T4 or startup/persisted-reader deadline consumer found. qa/briefs/E-417-stage-1.md invokes existing inject-stalled tests without its own deadline. Policy descriptions needing update: hub/README.md alarm paragraph, docs/agents/tests/hub-test-inject-stalled.test.ts.md and implement skill (+ CHANGES), CLI hook help. No role clause line describes the alarm deadline; no clause expansion needed. Preserve existing wire messages and client compatibility.

### impl-1224 · 2026-10-25T11:48:24.387Z

Coordinator clarification b050031b: measure startup grace from the hub serving receipt, not process/session-manager construction; startup may take 20–50s. Expanding rule 20 inventory for this lifecycle boundary: projectHub/serveProject via hub/src/hub/daemon.ts publishes serving before resumeAll; standalone createHub in hub/src/hub/server.ts supplies a listening edge without serveProject; direct in-memory Sessions fixtures have no serving edge. Will add an idempotent internal serving marker to Sessions and invoke it at both production entry boundaries. No protocol, snapshot or persisted shape change. ScriptedCodex gains an optional fake initialization-delay input (all existing callers retain default zero), with 50s delay in the three new regressions. Negative control at 00413c9d production: ninety-second confirmation fails with `exact delivery confirmation cancels the deferred alarm; 1 !== 0`; startup+30s unconfirmed case fails with `no alarm before the later of startup grace and ordinary timeout; 1 !== 0`; post-startup ordinary timeout remains green. Also reproduced Reviewer M1: frozen HOOK_USAGE mismatch in cli-usage-compatibility (1 failed); updating only its owning commands.json row.

### rev-26 · 2026-10-25T11:48:30.194Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1224-source-1
commit: 00413c9da0e2a555043f007d07a390013fa6c921
scope: full
findings: [{"severity":"medium","text":"M1: changed HOOK_USAGE no longer matches its frozen commands.json row; preserve existing exact-byte guards and update only the owning row with original red/green receipts.","file":"hub/src/cli/usage.ts"},{"severity":"medium","text":"M2: startup grace anchors to Sessions construction, but Coordinator b050031b requires the actual serving receipt; bind a fixed serving origin and cover time spent in setup before serving.","file":"hub/src/adapters/sessions.ts","line":303}]
finding_counts: {"high":0,"medium":2,"low":0}

Full in-session Standards/Spec audit complete, A-11846; consolidated M1/M2 only. Immutable HOOK_USAGE decoding confirms frozen byte mismatch. Verified Coordinator b050031b requires120s from serving, while current #startedAt records session-manager construction and can consume20–50s during setup. Preserve Codex-only grace, confirmation/episode behavior and five-minute Coordinator escalation; add delayed-before-serving control, update owning help row and consistent docs. Fresh corrected-head source review before verification. Local A-11843 summary/capture limits retained; no Linux/load/QA/landing evidence claimed.

Criteria: C1 failed (Grace begins before serving rather than at the required serving receipt; frozen help compatibility guards also reject the head.).

### impl-1224 · 2026-10-25T11:50:31.805Z

Corrections committed/pushed as f7e8de5d96001acc2dd74427ca28b06d1c3a9ecf. M1: only owning HOOK_USAGE frozen row updated; immutable compatibility 1/1 and real CLI entry guards 3/3 now green. M2: markServing is idempotent, called after daemon serving receipt and standalone WebSocket readiness, before session recovery. Slow-initialization fake app-server regression is red on 00413c9d and green on corrected source. Raw native red receipts A-11850 and green receipts in this topic retain stdout/stderr, exits, platform and capture limits.
Complete Sessions construction consumers: production adapters/index.ts, hub/server.ts, hub/daemon.ts; direct test consumers account-coalescing, session-archive, request-guard, session-brief-component, session-credential-io, session-brief, inject-stalled, task-worktrees, session-async-processes, artifact-lifecycle, session-cwd, orphan-servers, lifecycle-serialization, session-events, launch-admission, tracker-native-boundary, name-reservation, roles-session-refresh. Direct fixtures retain ordinary deadlines absent a serving edge; no required constructor input changed. ScriptedCodex consumers: codex-delivery and codex-native; native tests retain zero fake startup delay. All existing wire shapes retained. C1 tests 5/5, typecheck and docs lint green locally on macOS. No new test measured ≥3s locally; Linux duration evidence remains pending task verify.

### rev-34 · 2026-10-25T11:53:11.089Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1224-source2
commit: f7e8de5d96001acc2dd74427ca28b06d1c3a9ecf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at f7e8de5d; Standards/Spec audit A-11855 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11855-t-1224-source-review-at-f7e8de5d.md). Prior M1/M2 resolved: HOOK_USAGE exactly matches its owning frozen row; idempotent markServing anchors the fixed Codex-only 120s grace after daemon serving/discovery and standalone listener readiness, before recovery. Ordinary post-startup and five-minute Coordinator timeouts, confirmation cancellation and one-notice episode behavior remain intact. Slow-initialization fake-clock regressions preserve exact failure/confirmation and alarm assertions. C1 remains unverified until successful configured same-head runtime evidence; no suite/QA execution claimed by this source pass.

### rev-34 · 2026-10-25T12:07:55.076Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1224-final
commit: f7e8de5d96001acc2dd74427ca28b06d1c3a9ecf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear: run918a94f2 / A-11877; audit A-11878 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11878-t-1224-final-evidence-at-f7e8de5d.md), carrying source2/A-11855. Independently parsed3161 ordinary passes plus15 separate load passes. All3 new generated startup-grace cases pass ordinary+5/5 load, preserving delayed-before-serving setup, exact confirmation, fixed startup deadline, ordinary late failure and one-notice assertions. Existing8 inject-stalled regressions and help/compatibility/docs guards pass. HostT0 plus LinuxT1/allT2/mappedT4 once/Web complete; host typecheck prepared tree0650230c not repeated remotely. T3/otherT4 and extraT4 repetitions did not run; budget/lint warnings report-only. C1 verified; affected after-stage QA remains separate.

Criteria: C1 verified.

### coord · 2026-10-25T12:14:17.404Z

Merged e684fef926ff9de910f36d9e84d933a943e2c625 onto dev.
