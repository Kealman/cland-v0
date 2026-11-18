---
id: T-1672
kind: task
title: Renaming a remote OpenCode session moves its config and password directory on the hub's machine, not on the host
state: open
status: review
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1884
blocked_by:
  - T-1603
topic: topic-1622
branch: t/T-1672-renaming-a-remote-opencode-session-moves
created: 2026-11-04T04:18:17.821Z
updated: 2026-11-18T11:37:50.040Z
---

## Summary

impl-1603 found during T-1603 (2026-11-04) that `OpenCodeAdapter.renamed` still uses `existsSync`/`renameSync` on Host-derived paths. Renaming an OpenCode session on a remote host therefore cannot move its per-session config and password directory on that host: it operates on the hub's file system. T-1603 keeps the existing rename contract and leaves this open.

## What to build

The OpenCode session rename goes through the session's Host as an asynchronous, Host-owned move: atomic, with refusal on an existing target. The watcher and client identity then migrate to the new name. A remote rename never touches a hub-side path.

## Acceptance criteria

- [x] C1. Renaming an OpenCode session on a fake host moves its config and password directory on the host, and the session keeps receiving deliveries under its new name (test).
  - done: impl-1672 · 2026-11-18T11:36:31.514Z
- [x] C2. The rename never reads or writes a hub-side path of the same name: a planted mirror stays untouched (test).
  - done: impl-1672 · 2026-11-18T11:36:32.814Z
- [x] C3. A local OpenCode rename behaves as before, and its existing tests pass unedited.
  - done: impl-1672 · 2026-11-18T11:36:34.630Z

## Comments

### coord · 2026-11-04T16:20:31.608Z

More evidence (impl-1666, 2026-11-04): `OpenCodeAdapter.renamed` (hub/src/adapters/opencode.ts ~390) can update the display and watch name while leaving the config and password at the previous host path. A later resume or retirement then derives the new name and misses those files. C1 and C2 should cover resume and retirement after a remote rename.

### impl-1672 · 2026-11-18T11:18:56.722Z

Consumer map before edits: HarnessAdapter.renamed is called only by Sessions' Core.onRenamed listener (sessions.ts:1039), through generationAdapter's generic process dispatch; fake harness has its own synchronous implementation and capability test. Core rename listeners are synchronous, so Sessions must explicitly observe async adapter rejection. Directory readers: OpenCodeAdapter #files -> launch/prepareFiles, attachCommand, #client/inject, #watch, resume, releaseHostGeneration; privateDirectory adapterState persists path+canonical+inode and must migrate. server.ts owns serverFiles/readPassword/privateServerPaths/retainedPrivateServerFiles; Sessions retirement inventory reads serverFiles layout. Consumers/tests found by renamed, serverFiles, privateDirectory, .cland/opencode and password searches: opencode-{host,adapter,native,remote,remote-cleanup,launch-policy}, adapter-{generation,native-boundary}, host-{attach,orphans,launch-layout,ssh-contract}, approval-restart, session-host-placement, fakes/{scripted-opencode,remote-approval-harness}, fixtures/host-launch-opencode.json; QA E-1536-stage-2,E-414 and stages 2/3,T-229,E-1532-stage-4; docs/adapters-and-sessions and opencode harness docs. Existing directory layout/bytes remain unchanged; those readers need no migration. New optional Host move operation must be implemented by local fileOperations and agentOperations/sshHost, with explicit absence refusal for older hosts. No CLI/help/wire reply fields change.

### impl-1672 · 2026-11-18T11:24:10.529Z

Capability/receipt consumer extension: move-directory-v1 is additive AgentHello.capabilities metadata; old-agent fake preserves the prior capabilities shape and refuses with code CLAND_HOST_CAPABILITY_MISSING, capability move-directory-v1, message 'host agent lacks moveDirectory'. AgentClient accepts additive hello fields. Agent server advertises capability and admits prepare-moveDirectory; PreparedOperations validates one shared parser, checkpoints plan/outcome, joins file operations and fences unknown interrupted commits. SSH uses the existing prepared settlement path; no direct unowned move RPC. Existing prepared-file tests and host hello/client/registry/settlement tests retain original shapes. Agent source in T-1672 is destined for v0.4.1: paired hosts receive via versioned agent update, newly prepared images include it; older images refuse until updated. Coordinator approved capability travelling in this item; no live host changed. Hub-side code requires restart after integrated cover. Initial red on macOS Node 24.21.0: ENOENT opening remote/new/password after current adapter moved the hub mirror. New 3 tests and all 14 pre-existing opencode-host T2 tests pass locally; no suite/remote/browser evidence yet.

### impl-1672 · 2026-11-18T11:34:20.224Z

Additional consumer obligations discovered by the exhaustive reachable T1 batch: agent/closure.json pins source hashes and host-contract.ts is the reusable Host member inventory. Both migrated; host-agent-closure.test.ts and host-contract-coverage.test.ts now pass 15/15 on local macOS. Original T1 batch retained as 861/863, not relabelled green. New direct Host/local regression and existing opencode-host cases passed 18/18 after those fixes. Coordinator explicitly keeps synchronous Core/socket rename; T-1967 owns pre-admission async name reservation and wire failure propagation. T-1672 persists structured host rename phase/cause, blocks delivery/resume/retirement across restart, and exposes the existing stateReason field in CLI/web. Commit bdbcf60ed; fetched and merged origin/dev before first review (already up to date). Native slot still queued for unchanged OpenCode adapter and shared local/SSH Host contract cases; no native run or verify submitted yet.
