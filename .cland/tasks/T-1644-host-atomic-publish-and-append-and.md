---
id: T-1644
kind: task
title: Host atomic publish and append, and OpenCode's shared ignore through the Host
state: open
status: review
size: S
criterion_seq: 4
labels: []
assignee: null
parent: E-1532
blocked_by:
  - T-1593
  - T-1601
topic: topic-1372
branch: t/T-1644-host-atomic-publish-and-append-and
created: 2026-11-02T23:42:20.637Z
updated: 2026-11-03T22:19:01.968Z
---

## Summary

T-1601 moves the adapters onto the launch Host's layout and files, but OpenCode's shared `.gitignore` preparation (`hub/src/adapters/opencode/server.ts`) uses an atomic no-clobber link, an append and staging cleanup. The Host contract (`hub/src/host/host.ts`) offers only an overwriting `writeFile` and `removePath`. By the Coordinator's decision of 2026-11-02 (topic-1352), T-1601 keeps that preparation in a local-host helper, exempted from the boundary lint by name, and refuses it on a nonlocal Host. This item closes that gap.

## What to build

Add atomic publish (create-if-absent) and append to the Host contract, implemented on the local Host and in the host agent (after T-1593). Then move OpenCode's shared-ignore preparation onto the launch Host and remove T-1601's exemption.

## Acceptance criteria

- [x] C1. The Host contract has atomic no-clobber publish and append. The local Host and the agent implement them with the same semantics, including concurrent writers, against the fake hosts (test).
  - done: impl-1644 · 2026-11-03T22:17:39.613Z
- [x] C2. OpenCode's shared-ignore preparation goes through the launch Host. On `local` the result is byte-identical to today, and T-1601's lint exemption is removed (test).
  - done: impl-1644 · 2026-11-03T22:09:12.864Z
- [x] C3. An OpenCode launch on a fake nonlocal host prepares the shared ignore on that host (test).
  - done: impl-1644 · 2026-11-03T22:09:12.986Z
- [x] C4. The Host contract offers a stat with mode and size, so the launch-file rollback restores an overwritten file's mode on a nonlocal Host and T-1601's nonlocal overwrite refusal is removed (test)
  - done: impl-1644 · 2026-11-03T22:09:13.222Z

## Comments

### coord · 2026-11-03T10:08:40.420Z

Carried over from T-1599 (coord decision 2026-11-03 10:08Z): T-1599's C2 proves that hub-only env never reaches a fake-host spawn end to end for Codex and Claude. For OpenCode it proves it only at the shared explicit-additions env builder, because a nonlocal OpenCode launch is still refused at shared-ignore preparation until this item lands. When this item enables OpenCode on a nonlocal Host, its tests must include the planted hub-only key check on a real OpenCode fake-host spawn: DIGITALOCEAN_TOKEN, the remote tokens and the project secret absent, with a positive control.

### coord · 2026-11-03T14:51:33.726Z

Carried over from T-1600 (coord decision 2026-11-03 14:51Z): until this item adds atomic publish, T-1600's remote discovery writer (`~/.cland-host/run/hub.json`, through the agent) refuses to overwrite a different existing file. The host stays `connecting` with a path-free reason, and an identical file counts as success. When this item lands, switch that writer to atomic publish, so a changed per-host secret after re-admission, or any other content change, replaces the file without a torn write. Add a test for it.

### impl-1644 · 2026-11-03T22:02:20.175Z

Consumer inventory before contract edits: Host implementations local.ts (shared agent/files.ts), ssh-host.ts, test-host.ts; agent RPC operations.ts/server.ts; OpenCode server.ts/local-opencode-files.ts; LaunchFiles metadata/undo; discovery.ts and transport/ssh.ts interim refusal. Tests/doubles: host-contract.ts, host-contract-coverage, host-local-contract, host-ssh-contract, host-agent-files, host-launch-layout, session-host-placement, opencode-host, launch-files, remote-discovery and remote-discovery-host; other Host doubles spread localHost/testHost and inherit additive methods. Searches include Host imports plus fileOperations, prepareIgnore, hubFileMeta, refusal strings, writeFile/fileType consumers across hub/src (including colocated tests), hub/test every tier, shared, docs, shipped skills and qa. Existing wire methods/replies stay unchanged; new RPC names additive. Stage-3 QA brief records historical refusal and will be annotated as superseded; current docs/tests updated. Detailed inventory will be committed under implement/CHANGES.

### rev-36 · 2026-11-03T22:12:59.751Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1644-source-1
commit: b7e69df7bc60bc8cb143e504e73708fa2dc800f7
scope: full
findings: [{"severity":"medium","text":"New publishFile/appendFile use plain rpc: after admitted timeout or stream loss they throw without recording unknown ownership, so later mutation/rollback can reconnect while the old writer is unresolved or duplicate an append. Fence accepted unknown outcomes until positive completion/failure/drain and add actual-agent lost-reply/held-writer controls.","file":"hub/src/host/ssh-host.ts","line":112},{"severity":"medium","text":"Renamed/new behavior tests inherit copied old refusal/behavior baseline seconds. The documented policy treats renamed tests as new and requires stale-key removal; only later measured stage refresh supplies new baselines. Remove these copied replacement entries while preserving unrelated values/allowances.","file":"hub/test/durations.json","line":9859}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1644 source review
Headb7e69df7bc60bc8cb143e504e73708fa2dc800f7; basea8c2143a7.
Run rev-36-1644-source-1; scope full; not clear.
Reviewer read source/docs/tests only; no tests/probes/typecheck/browser, edits or merge.

## Standards
Medium — hub/test/durations.json:9859. Multiple new/renamed behavior identities are assigned the exact old refusal/previous-behavior seconds, e.g. nonlocal rollback success0.001164, nonlocal OpenCode preparation0.003452, session-placement successful preparation0.109388 and changed-secret atomic replacement1.805643. These were not measurements of those generated identities. docs/agents/tests.md explicitly says a renamed test is new and requires removing stale keys; a later stage cover supplies its baseline. Remove obsolete identity keys without inventing replacement baselines, preserving unrelated entries/allowances; let the authorized measured refresh establish new ones. This matters because presence in tests marks the exact key known for budget/load selection. Pure label renames in this diff also follow that documented rule. Local targeted observations are not a reason to copy earlier identity times.

## Spec
Medium — hub/src/host/ssh-host.ts:112. The newly added publishFile and appendFile run mutation() only before the plain rpc path. If an admitted operation times out or its stream closes, rpc simply throws and never records an unknown owner; another mutation can reconnect immediately. The old agent connection may still have an asynchronous write/append pending. A lost reply can therefore permit a duplicate append/retry or launch rollback on a new stream before the admitted writer is positively drained. Existing prepared operations use lostConnection/settle and discovery's direct publication explicitly retains an unknown-write fence, but these new Host methods do not. Bind their admission to recoverable operation identity or an explicit unknown-outcome owner, fence subsequent mutations and rollback/release until positive completion/failure/drain, and test lost-reply/held-writer cases on the actual agent. Preserve no-clobber and concurrent-writer assertions. Rule12/25 applies to these newly introduced side effects; an AgentClient deadline says outcome unknown, not confirmed failure.

Failed C1: remote publish/append do not preserve ownership/outcome semantics after an accepted unknown RPC result. C2–C4 remain runtime-unverified. Fresh corrected-head source review is required before verification.

Other source checked:
- One native fileOperations implementation supplies local and agent: sibling staging written/chmodded/synced/closed then link(create-only) or rename(replace), staging removal before normal resolution; O_APPEND and native mode/size stat; RPCs additive and bounded base64 parser shared with existing writeFile.
- Agent mutation admission includes new operations; testHost refuses and SSH routes selected Host without local fallback.
- OpenCode ignore algorithm moves to Host reads/publish/append, preserves generated bytes, no-clobber race and missing wildcard repair. Local lint helper and both metadata exemptions removed with positive boundary controls.
- LaunchFiles uses selected Host.stat, retains undo format and masks permission bits for restore; log offsets and rollback through Host now work nonlocally. Shared local/agent contract adds byte/mode restoration, native concurrency cases use separate agent clients.
- Coordinator carry-over comments read from task.view: actual OpenCode adapter→SSH Host→agent→native child test plants provider/remote/project values and a raw native positive control, then asserts filtered capture/allowed explicit value and native shared ignore. Changed discovery uses publishFile replace:true/0600 and waits for carrier up before final new bytes. Unknown direct-discovery publication control is retained.
- Inventory covers field/op/import consumers, production/test doubles, QA/skills/all tiers; existing wire replies unchanged, old unknown-op behavior remains fail-closed. Docs/help/skill CHANGES and historical QA annotations migrate the two prior refusals.

Reported A-16359 macOS Node24.21 targeted/static outcomes are supplemental: full host-ssh-contract report predates final test edits and rollback assertion; partial1/1 is labelled. Required fresh queued evidence and current-head native preservation remain pending. No full suite/LINUX/browser/real SSH proof claimed. No other source finding recorded.

A-16360: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16360-t-1644-source-review-remote-file-ownership-and-duration-baselines.md

Criteria: C1 failed (Remote publish/append release the call after an unknown accepted RPC outcome without fencing later mutation or rollback until the writer is drained/reconciled.).

### impl-1644 · 2026-11-03T22:13:53.335Z

Review correction consumer inventory: new prepared file kinds extend PreparedOperations Plan (prepare/commit/recovery/start/settle/close), server prepare-* dispatch/ownership registration, SSH prepared callback path and shared agent file argument parser. Direct legacy publishFile/appendFile wire operations remain available unchanged for older callers and discovery’s same-stream drain owner. Consumers searched for Plan.kind/prepare-/commit-prepared/settle-prepared, file RPCs, and durations exact identities across production, tests all tiers, docs/skills/QA. Tests host-prepared and host-ssh-contract/ssh-host-fixture and old protocol controls retain existing shapes. Unknown interrupted file commit never replays; it remains fenced.
