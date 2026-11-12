---
id: T-1839
kind: task
title: A native fake-host tunnel drop reaches the hosts.state outage alert, and QA can trigger it
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: topic-1495
branch: t/T-1839-a-native-fake-host-tunnel-drop-reaches
created: 2026-11-12T14:10:23.892Z
updated: 2026-11-12T20:11:23.391Z
closed: 2026-11-12T20:11:23.391Z
---

## Summary

The Hosts row's red state for an unreachable host is proven today only by component tests that drive `HostHealth.transition` directly; no native test drops a fake host's tunnel and reads the pushed `hosts.state` outage alert, and QA has no way to make a fake host unreachable on a CLI-started scratch hub. This item adds that native proof and a QA-usable way to trigger it, so the epic's Definition of done ("the row turning red when a host is made unreachable") can be shown natively.

## What to build

A native fake-host case in which a real tunnel loss (the fake host's agent or its SSH transport going away while the fake provider still reports the machine running) reaches the hub's host-health path and the pushed `hosts.state` frame carries the pool's outage alert for that host within a named bound, and the alert clears when the tunnel returns. A documented, fakes-only way for QA to cause that tunnel loss on a CLI-started scratch hub with the fake host provider (for example a fake-provider or fake-SSH control the QA brief can call by literal path), never a real host, never a signal to a process the scratch project does not own.

## Acceptance criteria

- [x] C1. A native fake-host test drops a running fake host's tunnel and reads a `hosts.state` frame whose pool alert is `{kind: 'outage', host}` for that host within a named bound, then restores the tunnel and reads the alert cleared (test).
  - done: impl-1839 · 2026-11-12T18:17:28.338Z
  - verified: rev-36 [reviewer] · run rev-36-1839-final-1 · 2026-11-12T18:53:04.806Z · commit 6dd2f58c3d6b011541fbbc22f23a82ee832d227d
- [x] C2. A fakes-only control lets a scratch project's QA run make one fake host unreachable and reachable again on a CLI-started hub, documented in the fake host provider's per-test docs with the exact command (test).
  - done: impl-1839 · 2026-11-12T18:17:28.548Z
  - verified: rev-36 [reviewer] · run rev-36-1839-final-1 · 2026-11-12T18:53:04.806Z · commit 6dd2f58c3d6b011541fbbc22f23a82ee832d227d
- [x] C3. The control refuses outside a fake-provider pool and never signals a process the scratch project does not own (test).
  - done: impl-1839 · 2026-11-12T18:24:19.777Z
  - verified: rev-36 [reviewer] · run rev-36-1839-final-1 · 2026-11-12T18:53:04.806Z · commit 6dd2f58c3d6b011541fbbc22f23a82ee832d227d

## Comments

### impl-1839 · 2026-11-12T18:14:41.483Z

Consumer sweep: no wire/connect sequence change. New test-only tunnel-down marker is read by fakeHost; existing gone and membership remain. Shared suite transitive import graph over every tier reaches adapter-generation-forward, claude-code-remote, codex-remote-agent, fake-ssh, fixture-socket-path, host-agent-restart, host-agent, host-clone-integration, host-prepared, host-push-on-ref-move, host-reboot-controller/native, host-records, host-relaunch-native/retry/component, host-revoke-native, host-runtime-join, host-ssh-contract/registry, host-supervisor, host-survival-native, host-tunnel-outage-native, opencode-remote, remote-discovery-host, transport-fake-contract/forwards/ssh-contract/ssh, nvim hosts-native. 16 unresolved graph entries conservatively reached (full list retained for evidence). Existing callers never write the new marker and retain the same behavior. Native host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back use unchanged fake acquisition and gone semantics. No production parser, reply, startup frame, persisted record or client contract changes; no nvim fixture regeneration required.

### impl-1839 · 2026-11-12T18:17:50.871Z

Conservative graph unknowns (reached, no new marker writers): hub/test/executor-safety-load.test.ts, hub/test/init-process.test.ts, hub/test/mod-bridge.test.ts, hub/test/plan-approval.test.ts, hub/test/sqlite-contention.test.ts, hub/test/suite-accounting.test.ts, hub/test/suite-admission-native.test.ts, hub/test/suite-remote-budget.test.ts, hub/test/suite-runner.test.ts, hub/test/suite-task-selection.test.ts, hub/test/task-worktrees.test.ts, hub/test/typecheck.test.ts, hub/test/web-notifications.test.ts, nvim/test/plan-component.test.ts, nvim/test/plan.test.ts, nvim/test/scenarios/workbench.test.ts. The new marker is opt-in only in the new native case; unchanged consumer behavior is covered locally by fake-ssh and nvim hosts-native, with broad native regressions in Linux task/merge/stage occasions.

### rev-36 · 2026-11-12T18:22:29.298Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1839-source-1
commit: ca19d0374a98d76a06b954401ffb1af91c82d34f
scope: full
findings: [{"severity":"medium","text":"Validate the complete scratch-project ownership boundary before filesystem/control effects. readFakeMachine's project/pool are ignored and the canonical per-host path is not checked against this project's storage. A foreign machine row plus a cross-project host-directory symlink therefore passes hostOwner/sameOwner (both read the foreign directory) and can write the foreign outage marker and terminate its master. Also prevent an existing marker symlink from redirecting writeFile outside owned storage. Add foreign-directory, foreign-project/pool and marker-alias refusal controls before any mutation or endpoint request.","file":"hub/test/fakes/host-tunnel-control.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review not clear: one medium C3 ownership-admission finding, no other source issue. A-19098 records canonical/project/pool and marker-alias gaps, source rationale and author confirmation/socket-only red controls. Pinned audit complete; working-tree repair is not included. Commit repair and request fresh source review before mode-free verification. Supporting native A-19094 retains original source/platform/capture/inventory limits; no reviewer execution. Full remaining T3/T4 and after-stage QA separate.

Criteria: C3 failed (Foreign canonical directory/project/pool can satisfy matching owner receipts and reach a different scratch master's control; marker writes also follow leaf aliases.).

### impl-1839 · 2026-11-12T18:23:32.826Z

Review repair at 6dd2f58c3 adds four T2 control consumers: foreign-directory, foreign-project, foreign-pool and marker-alias. Canonical storage and provider project/pool admission is shared by down/up and runs before effects. Three ownership cases were shown red against ca19d037 (Missing expected rejection); all four green after repair. No wire/connect or production command change. Existing native consumers remain unaffected outside opt-in tunnel-down marker. Exact final-head native evidence and clean per-file inventory follow in artifact.

### rev-36 · 2026-11-12T18:24:12.256Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1839-source-2
commit: 6dd2f58c3d6b011541fbbc22f23a82ee832d227d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Repaired source clear: Standards/Spec zero findings. A-19100 records canonical storage/host containment, provider project/pool admission and exclusive marker creation before effects, plus four T2 refusal/no-contact controls. Prior C3 source finding resolved; final C1–C3 current-head verification awaits configured named outcomes and consumer accounting. A-19099 native refresh remains supporting evidence pending final assessment. No reviewer execution. Proceed mode-free at this exact head after admitted preservation; full remaining T3/T4 and after-stage QA separate.

### rev-36 · 2026-11-12T18:53:04.806Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1839-final-1
commit: 6dd2f58c3d6b011541fbbc22f23a82ee832d227d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C3 verified. A-19114 records Standards/Spec conclusions; A-19112 independently reconciles A-19107 named native outage/recovery, four ownership refusals base+5 each, 6217 base passes/689 file passes and separate load outcomes. Conservative55-file union:19 positive configured finishes,35 T3+1 T4 deferred, no missing lower-tier receipt. A-19110/A-19099 retain honest local execution/source/inventory limits and known T-1806 residue. Current Linux provenance and browser attested; lifetime/cost unknown. Report-only budget/lint advisories remain. Full remaining T3/T4 and affected after-stage QA separate. No reviewer execution or source change; no further item run requested.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-12T20:11:23.391Z

Merged d65cf0bc7337ea22a64337a2fe64fb699dd2e586 onto dev.
