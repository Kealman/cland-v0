---
id: T-1587
kind: task
title: Host file writes, ports, forwards and the launch layout on the local host
state: closed
status: done
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
updated: 2026-11-02T09:32:08.817Z
closed: 2026-11-02T09:32:08.817Z
---

## Summary

Add to the Host the members a remote launch needs: write a file with a mode, make a directory, remove a path, reserve a loopback port, forward a session's endpoint to the hub and cancel it, and a launch layout (the session run and log directories, the discovery file, node, the CLI and spoke entries). The `local` host implements each as today, with forwarding as the identity. `LaunchFiles` writes and undoes session-side files through its Host.

Hot files: `hub/src/host/host.ts`, `hub/src/host/local.ts`, `hub/src/host/test-host.ts`, `hub/test/host-contract.ts`, `hub/test/host-local-contract.test.ts`, `hub/src/adapters/launch-files.ts`

## Acceptance criteria

- [x] C1. The `Host` interface gains writeFile (bytes and mode), makeDirectory, removePath, freePort, forward, unforward and a read-only `layout`, and the `local` and test hosts implement each; the test host refuses the writes and forwards by name.
  - done: impl-1587 · 2026-11-02T05:50:20.652Z
  - verified: rev-35 [reviewer] · run rev-35-1587-source-1 · 2026-11-02T05:52:31.208Z · commit 349acbde09402e20eba782490e8a379627a27158
  - verified: rev-37 [reviewer] · run rev-37-1587-source-1 · 2026-11-02T06:16:20.046Z · commit 3efc33afb22d16d518b2a51151320676c651b773
  - verified: rev-37 [reviewer] · run rev-37-1587-evidence-1 · 2026-11-02T06:41:05.964Z · commit 3efc33afb22d16d518b2a51151320676c651b773
- [x] C2. The contract suite has a case per new member, and the `local` host passes it: a written file has its exact bytes and mode, removePath never follows a symlink out of the given path, and freePort returns a free loopback port (test).
  - done: impl-1587 · 2026-11-02T05:50:22.792Z
  - verified: rev-37 [reviewer] · run rev-37-1587-evidence-1 · 2026-11-02T06:41:05.964Z · commit 3efc33afb22d16d518b2a51151320676c651b773
- [x] C3. On the `local` host forward returns the endpoint it was given (a Unix socket path or a loopback port) and unforward is a no-op, and its `layout` returns today's paths derived from the discovery file, node, CLI and spoke entries (test).
  - done: impl-1587 · 2026-11-02T05:50:32.411Z
  - verified: rev-37 [reviewer] · run rev-37-1587-evidence-1 · 2026-11-02T06:41:05.964Z · commit 3efc33afb22d16d518b2a51151320676c651b773
- [x] C4. `LaunchFiles` creates, writes and rolls back session-side files and directories only through its Host, while its undo metadata stays a hub-local read, and a pending-stop record written before this change is still recovered (test).
  - done: impl-1587 · 2026-11-02T06:13:26.562Z
  - verified: rev-37 [reviewer] · run rev-37-1587-evidence-1 · 2026-11-02T06:41:05.964Z · commit 3efc33afb22d16d518b2a51151320676c651b773
- [x] C5. `host-contract-coverage.test.ts` fails for a new member without a case, and the launch-files, session-launch and session-stop-races test files pass with no test edited.
  - done: impl-1587 · 2026-11-02T05:50:38.480Z
  - verified: rev-37 [reviewer] · run rev-37-1587-evidence-1 · 2026-11-02T06:41:05.964Z · commit 3efc33afb22d16d518b2a51151320676c651b773

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

### rev-35 · 2026-11-02T06:11:18.161Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1587-evidence-1
commit: 349acbde09402e20eba782490e8a379627a27158
scope: evidence
findings: [{"severity":"medium","text":"Recording fixtures here and session-host-placement.test.ts:168 spread refusing testHost without new file/port primitives. Queued run fails nine Claude cases with 'test host t1 refuses makeDirectory'; OpenCode placement expects spawn refusal but gets that preparation refusal. Migrate sealed scratch operations and keep original behavioral assertions/refusals.","file":"hub/test/claude-code-host.test.ts","line":198}]
finding_counts: {"high":0,"medium":1,"low":0}

Queued evidence NOT clear. Exact unchanged head run 0a8b1194-7cc0-4a1f-a424-db160aacad2b / A-15626 exit1: T0/T1 green, T2 ten completed failures; T3/T4/Web unexecuted. Actual output: 'Error: test host t1 refuses makeDirectory' via LaunchFiles.directory → Claude #sessionFlags; OpenCode assertion expected /test host t1 refuses spawn/ but got the same makeDirectory refusal. Medium fixture-consumer migration gap missed by source review. A-15628 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15628-t-1587-failed-queued-evidence-at-349acbde0.md) records diagnosis/provenance. Linux x64 6.8.0-142-generic droplet Node24.21.0 Neovim0.12.5 tree a0dc9bfbd9af559029ce98f4edfac69505fb4a7d, uncached, no browser executed; advisories report-only. C4 failed, no new criterion verified. Retain assertions/testHost refusals and original named lifecycle controls; corrected head requires fresh source review before verification.

Criteria: C4 failed (Existing nonlocal launch consumers fail new Host session-file preparation before reaching their intended native/discovery boundary.).

### impl-1587 · 2026-11-02T06:12:38.779Z

A-15626 queued Linux run exposed ten missed fixture consumers, quoted output: `Error: test host t1 refuses makeDirectory` (nine Claude tests) and OpenCode expected `/test host t1 refuses spawn/` but received that directory refusal. Reproduced both paths locally before fix. Migrated only recording fixture setup: Claude remoteFixture now explicitly supplies scratch-local makeDirectory/writeFile/removePath/statDirectory; OpenCode placement recording Host supplies scratch-local mutations/freePort. Synthetic process commands/identities and all behavioral assertions unchanged, production testHost still refuses every new operation. Full affected files now pass locally: claude-code-host 18/18, session-host-placement 11/11. Searched every testHost call in hub/src and hub/test; remaining users exercise fake adapters, process-only or refusal paths and passed the queued T2 run. No production source change or dev merge after source review.

### rev-37 · 2026-11-02T06:16:20.046Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1587-source-1
commit: 3efc33afb22d16d518b2a51151320676c651b773
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear for requested fixture-only migration, carrying prior rev-35 full source349acbde0. Standards/Spec no findings. Delta4files supplies explicit sealed disposable local file/stat operations to Claude recording Host and file/port operations to OpenCode recording Host; scripted processes and all original boundary assertions retained. Production testHost named refusals unchanged, no production code change. Existing held-owner cleanup preserved. C1 source reverified; C2–C5 await new exact-head mode-free verify and named preservation outcomes. A-15634 local macOS18+11/typecheck/lint supplemental only; prior A-15626 remains failed. No Reviewer execution/browser.

Criteria: C1 verified.

### rev-37 · 2026-11-02T06:41:05.964Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1587-evidence-1
commit: 3efc33afb22d16d518b2a51151320676c651b773
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. A-15666 exact-head run dd250def-4e1e-480c-a38b-d49650d3864e exits0,4702/4702; named finish records independently checked: coverage4/launch-files3/session-host8/session-launch2/Claude18/placement11 all pass. Required exact-head local macOS supplements: A-15638 Host native contract14/14 for C2/C3; A-15669 unchanged session-stop-races6/6 for C5. C1–C5 verified across source and these receipts. Linux x64 droplet Node24.21.0 Neovim0.12.5 Headless Shell156.0.8078.4r1248, T0/T1/all-T2/Web complete, uncached; queued T3 deferred merge batch/T4 unexecuted; local supplements are not Linux T3 completion. Budgets/ratchets/lint122/59files report-only. Canonical suite treefb25b0e39f1a4400b7c0e907dc707149d65557fb independently matches pinned commit after production exclusions .cland/tasks and .cland/RULES.md; raw commit tree162c3c1c… correctly differs. A-15673 details criterion receipts/provenance. No Reviewer execution or edits; predecessor A-15626 remains failed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-02T09:32:08.817Z

Merged 4aeb03c607beb425a6a5a6e745d1bda2bf1b7292 onto dev.
