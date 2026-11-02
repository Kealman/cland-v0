---
id: T-1587
kind: task
title: Host file writes, ports, forwards and the launch layout on the local host
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1324
branch: t/T-1587-host-file-writes-ports-forwards-and-the
created: 2026-11-02T03:33:51.984Z
updated: 2026-11-02T05:52:31.208Z
---

## Summary

Add to the Host the members a remote launch needs: write a file with a mode, make a directory, remove a path, reserve a loopback port, forward a session's endpoint to the hub and cancel it, and a launch layout (the session run and log directories, the discovery file, node, the CLI and spoke entries). The `local` host implements each as today, with forwarding as the identity. `LaunchFiles` writes and undoes session-side files through its Host.

Hot files: `hub/src/host/host.ts`, `hub/src/host/local.ts`, `hub/src/host/test-host.ts`, `hub/test/host-contract.ts`, `hub/test/host-local-contract.test.ts`, `hub/src/adapters/launch-files.ts`

## Acceptance criteria

- [x] C1. The `Host` interface gains writeFile (bytes and mode), makeDirectory, removePath, freePort, forward, unforward and a read-only `layout`, and the `local` and test hosts implement each; the test host refuses the writes and forwards by name.
  - done: impl-1587 · 2026-11-02T05:50:20.652Z
  - verified: rev-35 [reviewer] · run rev-35-1587-source-1 · 2026-11-02T05:52:31.208Z · commit 349acbde09402e20eba782490e8a379627a27158
- [x] C2. The contract suite has a case per new member, and the `local` host passes it: a written file has its exact bytes and mode, removePath never follows a symlink out of the given path, and freePort returns a free loopback port (test).
  - done: impl-1587 · 2026-11-02T05:50:22.792Z
- [x] C3. On the `local` host forward returns the endpoint it was given (a Unix socket path or a loopback port) and unforward is a no-op, and its `layout` returns today's paths derived from the discovery file, node, CLI and spoke entries (test).
  - done: impl-1587 · 2026-11-02T05:50:32.411Z
- [x] C4. `LaunchFiles` creates, writes and rolls back session-side files and directories only through its Host, while its undo metadata stays a hub-local read, and a pending-stop record written before this change is still recovered (test).
  - done: impl-1587 · 2026-11-02T05:50:36.465Z
- [x] C5. `host-contract-coverage.test.ts` fails for a new member without a case, and the launch-files, session-launch and session-stop-races test files pass with no test edited.
  - done: impl-1587 · 2026-11-02T05:50:38.480Z

## Notes

Shared files: the Host interface and its contract suite (sole owner in E-1532); `launch-files.ts`

## Comments

### impl-1587 · 2026-11-02T05:43:44.619Z

Rule 20 inventory before implementation: searched Host, LaunchFiles/LaunchFilesState, sessionRunDirectory, freePort and launch path fields across hub/src (including colocated tests), hub/test (all tiers), shared, web, nvim, QA briefs, docs and shipped skills. Direct implementations: host/local.ts, host/test-host.ts; wrappers mostly spread local (claude-code-local, legacy-worktree-git, recording fixtures in session/worktree/artifact/*-host tests); registry/process-host consume unchanged methods. LaunchFiles consumers: adapters codex, claude-code, opencode/server, sessions recovery; launch-files, session-launch, session-stop-races and credential/lifecycle fixtures preserve old journal shape. AdapterHost/index path inputs remain unchanged until ticket 15. No wire/persisted schema changes; old pending-stop shape retained. Host boundary lint exception for hubFileMeta remains. Contract/coverage/local wrapper and their docs migrate. Other account-poller/worktree/artifact/client/QA consumers unchanged: additive members, existing semantics preserved.
Exact additions: HostEndpoint = {socket: string} | {port: number}; HostLaunchLayoutInput = {discoveryFile:string; node:string; cli:string; spoke:string}; HostLaunchLayout = Readonly<HostLaunchLayoutInput & {runDirectory:string; logDirectory:string}>. readonly layout: (input: HostLaunchLayoutInput) => HostLaunchLayout (local derives run/log from dirname(discoveryFile); remote implementations may ignore hub inputs). writeFile(path:string, bytes:Uint8Array, options?:{mode?:number; truncate?:number}):Promise<void> (truncate uses empty bytes and changes only size, for legacy append rollback). makeDirectory(path:string,mode?:number):Promise<void> (one directory, nonrecursive). removePath(path:string,options?:{directory?:boolean}):Promise<void> (directory is empty-only; no recursive deletion or symlink following). freePort():Promise<number> (probe and release IPv4 loopback port, same as current OpenCode helper). forward(sessionId:string, endpoint:HostEndpoint):Promise<HostEndpoint>; unforward(sessionId:string):Promise<void> (session owns cancellation; local identity/no-op). LaunchFiles adds write(path,bytes,mode?) to journal then use Host; hub-local undo metadata reads remain, while undo operations route Host. No later epic ticket should add members; gaps return to Coordinator.

### impl-1587 · 2026-11-02T05:48:27.287Z

Consumer migration refinement: OpenCode server's existing private freePort helper is removed and startServer calls its captured Host.freePort. This keeps one production port policy (rule 24), with unchanged local probe/release behavior; no adapter layout/forward migration. A-15590 preserves the complete consumer search. Added hub/test/launch-files.test.ts because no launch-files test file existed at the starting head; session-launch/session-stop-races/session-host remain unedited controls.

### rev-35 · 2026-11-02T05:52:31.208Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1587-source-1
commit: 349acbde09402e20eba782490e8a379627a27158
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. No findings on standards or spec. C1 verified from interface/local/test-host source, including named refusals. C2–C5 remain unverified pending exact-head queued named outcomes. Host contract covers added members and existing positive omission control remains; LaunchFiles mutations/backup-byte reads route through Host while the authorized metadata read stays hub-local. Old undo format and process-exit-before-undo ordering are unchanged. OpenCode uses captured Host.freePort. Existing session-launch/session-stop-races/session-host files are unedited; launch-files.test.ts is new because none existed at base. Documentation/skill/tier/index updated. Review A-15596 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15596-t-1587-source-review-at-349acbde0.md). Reviewer ran no tests/browser; reported local 126 targeted/typecheck/lint results in A-15595 are not a queued receipt. No SSH/remote-adapter layout or full-suite claim.

Criteria: C1 verified.
