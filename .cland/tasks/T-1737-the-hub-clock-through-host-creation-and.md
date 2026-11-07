---
id: T-1737
kind: task
title: The hub clock through host creation and readiness, and an in-hub create entry
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by: []
topic: topic-1426
branch: t/T-1737-the-hub-clock-through-host-creation-and
created: 2026-11-07T16:01:56.582Z
updated: 2026-11-07T16:19:19.370Z
---

## Summary

`createHost`'s 5-minute provisioning gate and the host registry's tunnel-readiness wait use `Date.now()` and real timers today. Both move onto an injected `Clock`, so the scheduler's fixed timeouts can be tested on fake time. `createHost` also gets an in-hub entry: it takes a pool's settings as an object, tells its caller the new host id at the `creating` checkpoint, and accepts an injected create seam. Later tickets use the seam to drive hosts without the native create fixture.

## What to build

A clock-driven create path that the hub's own scheduler can call, with no change in behaviour for `cland host create`. The gate keeps its 300 000 ms constant (`PROVISION_GATE_MS`) and its existing `gateMs` option; the test-only knob that shortens it is read by T-1750, not here.

## Acceptance criteria

- [x] C1. With a fake clock and a fake machine that never boots, the provisioning gate fails at 300 000 ms of clock time with no real wait, and the machine is released (test).
  - done: impl-1737 · 2026-11-07T16:12:22.186Z
- [x] C2. The registry's tunnel-readiness wait is bounded by the same injected clock (test).
  - done: impl-1737 · 2026-11-07T16:17:11.023Z
- [x] C3. An in-hub caller of the create path receives the host id at the `creating` checkpoint, before the provider's acquire resolves (test).
  - done: impl-1737 · 2026-11-07T16:12:25.243Z
- [x] C4. The existing host create, destroy and provision-records test files pass with no test edited.
  - done: impl-1737 · 2026-11-07T16:12:25.983Z

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/provision-host.ts`, `hub/src/host/registry.ts` (readiness wait), `hub/test/host-provision-gate.test.ts` (new).
- Tests: the new gate test is T3, because `createHost` runs `ssh-keygen` (T2 if key generation becomes injectable). `host-create-ready.test.ts` (T3) and `host-destroy.test.ts` (T2) pass unchanged.
- Serves epic C6 (fixed timeouts on the hub clock); prefactor for C4 and C5.

## Comments

### impl-1737 · 2026-11-07T16:04:00.716Z

Consumer sweep before additive create options: createHost production caller hub/src/hub/dispatch.ts; projectSshHosts production daemon.ts and adapters/index.ts export. Direct tests: host-create-ready, host-destroy, host-destroy-native, host-provision-recovery, host-runtime-owner, host-ssh-contract, host-ssh-registry, host-clone-integration, host-records, remote-discovery-host. host-provision-records also required unchanged by C4. No wire/record shape changes planned; optional clock/settings/onCreating options retain old callers. Searches cover createHost/projectSshHosts plus readiness/PROVISION_GATE_MS, docs and shipped skills. Test seams authorized by ticket: createHost failed/released durable result, registry ready rejection, creating callback before acquire completion.

### impl-1737 · 2026-11-07T16:10:12.194Z

Consumer sweep refinement: host-reboot-native and host-survival-native reference HostConfiguration only (type erased; no contract changed). host-agent-closure source-graph scan and host-agent-restart runtime import also included in targeted run. serveProject/server/Dispatcher only forward additive optional create injection and clock; new host-create-entry exercises that complete path. No protocol, authorization, native process owner, persisted record or provider wire changes. All normal daemon callers retain the default create function.

### rev-37 · 2026-11-07T16:16:17.421Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1737-source-1
commit: fc2d46b241bd250d1f757c6b4e07040369754d34
scope: full
findings: [{"severity":"medium","text":"Readiness polling uses only a caller signal; close/remove abort clone work but neither abort nor join active readiness. With a frozen clock and down carrier, ready(id) can remain pending forever after close reports done. Bind internal owner cancellation and join readiness; prove close/remove without clock advance or caller abort.","file":"hub/src/host/registry.ts","line":83}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1737 full source review

Head fc2d46b241bd250d1f757c6b4e07040369754d34; base79b350ec536cda3404c346fec0e9f8318e14369d.
Run rev-37-1737-source-1; scope full; result not clear.
Standards and Spec reviewed in-session under the Reviewer no-delegation clause. Read-only source/docs/tracker/evidence checks; no Reviewer tests/typecheck/browser or mutation.

## Standards

Medium — hub/src/host/registry.ts:83 (lifecycle owners :38-39 and :103-105).
Polling now waits on the injected Clock using only the optional caller's signal. The owner quiesces cloneAbort and closes Host/carrier/Git, but does not abort or join its active readiness promises. With a frozen FakeClock, carrier down and ready(id) called without a signal, owner.close() can report completion while readiness remains suspended forever on its fake timer. remove has the same unowned-wait problem. Even caller-supplied signals are not necessarily aborted by an owner lifecycle change. This violates rule12: the owner must join in-flight work before reporting stopped and before storage closes. The new timeout test manually aborts its caller signal during fixture cleanup, masking this ownership case.
Bind readiness to internal owner cancellation, track active readiness work, and join it on close/remove. Keep correct cleanup ordering so an in-flight native Host operation can settle; do not simply wait forever before closing the operation's owner. Add typed-carrier T2 controls: observe the down poll first, then close/remove with no fake-clock advance and no caller abort, require ready rejection/drain before lifecycle completion, and retain timer cleanup checks. Lead confirmed the path in7ddb4102.
C2 fails for the clock-driven readiness lifecycle until owned cancellation/drain is established.

No other independent standards finding. Applicable docs/rules: AGENTS.md, docs/agents/tests.md, shared Clock contract (real I/O deadlines explicitly separate), rules9/12/15/16/20/24/28 and code-review skill. New native ssh-keygen controls are T3, hub injection case T2, isolated environments use fixtureEnvironment and owned roots; file-specific guides/index/tiers are present. Existing host-create-ready, host-destroy and host-provision-records tests are unchanged.

## Spec

No separate source finding beyond the lifecycle defect above.
- Creation deadline/polling and creation timestamp use optional Clock defaulting to realClock; PROVISION_GATE_MS remains300000 and explicit gateMs remains. Native command/transport I/O deadlines remain real and are documented; no test-only shortening knob is added.
- Parsed settings override disk pool selection for the supplied pool; shared pool-name validation remains. Prepared image key still reads project recipe/harness pins. Manual CLI selection defaults remain unchanged.
- Provision record is saved, then the cancellation/completion owner enters creations, then onCreating(id) runs before ssh-keygen/provider acquire. A thrown synchronous callback follows the existing failed-create path. New callback's declared contract is synchronous notification, not an awaited admission transaction.
- Optional create injection forwards from serveProject through server to Dispatcher, retaining the existing local human transport/identity authorization path, work ownership and shutdown signal. Dispatcher passes core.clock and the runtime owner; daemon passes the clock to projectSshHosts.
- No wire or persisted record shape changes. Consumer sweep covers production Dispatcher/daemon/adapter export and direct native/typed tests; erased HostConfiguration references are explicitly distinguished.

## Criteria and evidence

Failed C2: registry can finish close/remove with an indefinitely pending readiness wait on a stopped fake clock.
C1/C3/C4 remain runtime-unverified in this source pass.

New C1 source retains separate setup receipt (observed never-ready provider status), 299999 ms pending assertion, final1ms advancement, failed durable record, released checkpoint and provider gone assertion. C2 retains observed down status and exact clock boundary timeout, but lacks the ownership path noted above. C3's held acquire checks durable creating id/pool/timestamp before provider resolution. T2 entry checks clock/owner/root/pool through the complete in-process hub entry.

A-17488 reports partial local macOS arm64 Node24.21.0 native/importer checks:131/131 across14files plus separate entry1/1; no browser/provider-network/full-suite/Linux receipt. New-case samples under3s are targeted observations, not duration-gate evidence. Root typechecks/build and final committed T0/test lint exit0 are lead-reported; known notices remain report-only. Original C1 red text was 'failed creation persisted and returned: not within15000ms' after fake-clock advance; early fixture setup failures were not behavioral proof. One early native attempt lacked preservation lock, was reported to Coordinator and acknowledged4aca8e75; subsequent native runs used the owner lock. No run was performed by Reviewer.

Correct owner-bound readiness cancellation/join, retain red/green original producer outputs and source linkage, push a fresh head and request source review before mode-free verification. Because registry runtime bytes change, obtain fresh applicable native preservation after source clear in the assigned serial slot; do not relabel predecessor execution as current. After-stage affected QA remains separate.

Standards: one medium finding. Spec: no additional finding.


A-17498: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17498-t-1737-source-review-readiness-wait-ownership.md

Criteria: C2 failed (Owner close/remove can finish while the injected-clock readiness wait remains indefinitely pending and unjoined.).

### rev-36 · 2026-11-07T16:19:19.370Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1737-source-2
commit: 5d6e8a3ab7ad9b391f179cb44b8e125f8e3ae1a8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17504: corrected source clear. Prior A-17498 readiness owner cancellation/drain finding resolved: owner signal combined with caller, readiness tracked and joined after Host close; typed close/remove controls retain frozen clock and exact rejection-before-return/timer cleanup assertions. Clock/create/in-hub wiring source rechecked; existing required preservation files unchanged. C1–C4 remain unverified pending fresh current-head native preservation and mode-free configured receipt; predecessor runtime receipts cannot be relabeled. No Reviewer tests run; after-stage affected QA separate.
