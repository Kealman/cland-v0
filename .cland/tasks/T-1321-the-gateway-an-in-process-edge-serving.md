---
id: T-1321
kind: task
title: "The gateway: an in-process edge serving remotes as the human, with its authority table and a test messenger"
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by: []
topic: topic-1075
branch: t/T-1321-the-gateway-an-in-process-edge-serving
created: 2026-10-26T02:28:46.408Z
updated: 2026-10-26T02:45:10.689Z
---

## Summary

The hub gains the gateway: an in-process edge that serves remotes over one dispatcher conversation as the identity `human`, with a deny-by-default authority table checked before dispatch. A test messenger in the suite stands in for a messenger platform. This is the seam every later v0.3 epic builds on.

## What to build

A gateway module inside the hub process that starts and stops with the hub and runs one remote per active messenger. It receives the frames a client receives (messages, inbox, asks, approvals, delivery stages) and sends a client's requests through the dispatcher as `human`: no new protocol, socket, listener or hub secret. Its authority table allows only `topic.send` into General, or as a reply into the replied-to message's topic, plus `topic.answer`, `approval.answer`, `hub.status`, `task.list` and `inbox.list`. Every other request is refused with a reason naming it, including session launch or stop, release, push, sync, configuration, artifact actions and pairing approval. Model the table on `hub/src/hub/web-authority.ts`. A test messenger fake lives under `hub/test/fakes/` and drives the gateway through the frame protocol (`hub/test/harness.ts`). Spec §3.1. The prototype `prototype/telegram-remote` at 33bf2b2e (`hub/src/remote/authority.ts`, `PROTOTYPE (Q-1292)` marks) may be read but is never merged.

## Acceptance criteria

- [ ] C1. A test messenger behind the gateway receives a General message an agent posts, and its reply reaches the Coordinator as the human's message, with no new socket, listener or hub secret, and the gateway stops with the hub (test).
  - failed: rev-26 [reviewer] · 2026-10-26T02:45:10.689Z · note Held remote startup can continue and reopen admission after stop completed; startup ownership/stop fencing needs M3.
- [ ] C2. Each allowed request (General send, reply into the replied-to topic, answer, approval, hub.status, task.list, inbox.list) succeeds through the test messenger, and every other request, pairing approval included, is refused before dispatch with a reason naming it (test).
  - failed: rev-26 [reviewer] · 2026-10-26T02:45:10.689Z · note Candidate help compatibility and per-test docs guards fail until owning frozen HUB_USAGE row and exact-path guide heading are corrected.

## Comments

### impl-1321 · 2026-10-26T02:31:44.633Z

Rule 20 consumer inventory before adding edge admission: production Dispatcher.open consumers are hub/src/hub/server.ts (spoke WebSocket), socket.ts (Unix), stdio.ts and web-edge.ts; daemon.ts owns edge lifecycle. Frame consumers include hub/bin CLI/client, hub/src/spoke/client.ts, shared/wire, web/src/client.ts and nvim/lua/cland client/model; QA briefs/fixtures, startup probes and all-tier tests use the same existing frames. Search: dispatcher.open / edge: web / webAuthorityRefusal / WEB_AUTHORITY across hub/src, hub/test, web, nvim, qa, .agents, docs. Existing web policy and frame shapes remain unchanged, so these consumers need no migration or new refusal parsing. New gateway admission applies only to an internally opened gateway conversation, using existing result ok:false/code:forbidden. New consumers: gateway module, injected messenger port and test fake. Previous-wire compatibility remains the unchanged local/web/spoke suites. C1/C2 test seam is the E-1307-approved projectHub + frame protocol + hub/test/fakes messenger, with no platform credentials.

### impl-1321 · 2026-10-26T02:39:50.118Z

Consumer inventory clarification (no wire migration): the concrete existing clients are hub/src/cli/socket-client.ts + hub.ts/inbox.ts/task.ts, hub/src/spoke/hub-client.ts + tools.ts/task-tools.ts, web/src/connection.ts + Composer.tsx/QuickMessage.tsx/ApprovalCard.tsx/InboxArchive.tsx/ItemsPlan.tsx, and nvim/lua/cland/hub.lua + init.lua/topic_view.lua/inbox.lua/state.lua and the item/thread renderers. Existing Dispatcher.open fixture consumers include account-coalescing, connection-resync/snapshot, executor-droplet-component, heartbeat, hub-status-component, journal-async/flush, launch-admission, lifecycle-serialization, project-hub-lifecycle, roles-session-refresh/snapshot, session-async-processes/events, validation-support and verify-submission. T1 web-authority-unit and wire-conformance, T2 web-authority, QA E-412-stage-2/3 retain their policy/previous-wire shape; startup discovery/probes and persisted message/approval readers receive no changed field or row membership. The new test uses old hello shape on the local client as an explicit compatibility regression. No role-clause lines added, per the Coordinator's reserve instruction.

### rev-26 · 2026-10-26T02:45:10.689Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1321-source-1
commit: 28e72103fdeac53903f0193110d2675e998a3be5
scope: full
findings: [{"severity":"medium","text":"M1: HUB_USAGE adds the in-process remote line without updating its owning frozen commands.json row. Existing cli-usage-compatibility and cli-help byte assertions fail. Update only that frozen row and retain original guard red/green; do not change template/order/assertions.","file":"hub/src/cli/usage.ts","line":5},{"severity":"medium","text":"M2: '# Gateway frame seam' violates the exact-path heading required by test-docs.test.ts. Use '# hub/test/gateway.test.ts', retain the index/guide/guard, and preserve the original docs guard red/green.","file":"docs/agents/tests/hub-test-gateway.test.ts.md","line":1},{"severity":"medium","text":"M3: start awaits remote.start without fencing or tracking shutdown, then unconditionally starts later remotes and sets #open=true. stop can close/drain existing remotes and finish while a start is held; releasing start afterward reacquires remotes and reopens admission over a closed conversation. The already-armed dispatcher hello timeout can also trigger stop during startup. Fence/own startup so stop drains or cancels it and no later remote/hello/admission appears, with a held-start/stop regression and final stopped/admission assertions. Static source-path finding, no reviewer execution.","file":"hub/src/remote/gateway.ts","line":45}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source NOT CLEAR; consolidated A-12246 at tree 3dd669ede880de217dd90b6c339ee7a58be3a9a0. Standards M1 frozen HUB_USAGE mismatch, M2 per-test heading; Spec M3 held startup can continue after stop and reacquire later remotes/reopen admission. No further findings. Pre-replay/actor deny-by-default table, stored same-topic reply validation, human identity and per-remote result isolation otherwise match spec; local/web/spoke contracts remain intact. Six T2 local cases/A-12245 are supplementary, not configured/Linux/load evidence. Preserve original guard and lifecycle correction red/green outputs/exits/capture limits. Correct M1–M3, restore claimant done and request fresh pushed-head full source review before ordinary mode-free verification; no dev merge or assertion/authority relaxation. Coordinator's additional routing cover remains separate. Reviewer read-only, no execution.

Criteria: C1 failed (Held remote startup can continue and reopen admission after stop completed; startup ownership/stop fencing needs M3.), C2 failed (Candidate help compatibility and per-test docs guards fail until owning frozen HUB_USAGE row and exact-path guide heading are corrected.).
