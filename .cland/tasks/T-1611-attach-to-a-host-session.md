---
id: T-1611
kind: task
title: Attach to a host session
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1603
  - T-1606
  - T-1607
topic: topic-1379
branch: t/T-1611-attach-to-a-host-session
created: 2026-11-02T03:33:58.041Z
updated: 2026-11-04T15:25:32.840Z
---

## Summary

`cland session attach` on a host session prints its own `ssh -t` connection with `ControlPath=none`, `ClearAllForwardings=yes`, `-a -x` and the host's pinned `known_hosts`, which runs `cland host attach <session>` on the host. That command reads the session's attach record from the agent (written at launch, 0600), sets the harness environment and execs the harness's attach under `stty susp undef`.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/cli/host.ts`, `hub/test/host-attach.test.ts` (new)

## Acceptance criteria

- [x] C1. For a session on a fake host, `cland session attach <name>` prints an `ssh -t` command with `ControlPath=none`, `ClearAllForwardings=yes`, `-a`, `-x`, `StrictHostKeyChecking=yes` and the host's `known_hosts`, running `cland host attach <name>`, and no secret appears in it (test).
  - done: impl-1611 · 2026-11-04T15:25:22.575Z
- [x] C2. On the host, `cland host attach <name>` execs each harness's attach with the session's environment under `stty susp undef`, and refuses a session that is not on that host (test).
  - done: impl-1611 · 2026-11-04T15:25:22.723Z
- [x] C3. Ending the attach process leaves the session running with the same identity (test).
  - done: impl-1611 · 2026-11-04T15:25:22.853Z
- [x] C4. The attach of a local session is unchanged: hub/test/cli.test.ts, hub/test/cli-session-credential.test.ts and the local attach assertions in the claude-code-adapter, codex-adapter and opencode-adapter test files pass with no test edited.
  - done: impl-1611 · 2026-11-04T15:11:22.402Z

## Notes

Shared files: `hub/src/adapters/sessions.ts` (attachCommand), the three adapters' attach records, `hub/src/cli/host.ts` (`attach`)

## Comments

### impl-1611 · 2026-11-04T14:55:34.357Z

Pre-edit rule 20 inventory: session.attach wire remains {command}, consumed by cli/session.ts, hub session frame, setup, nvim/web session views and session-cli tests. Host optional terminal-command printer will be consumed only by Sessions view/attach and supplied by projectSshHosts/sshHost; legacy localHost/testHost/spread recording Hosts remain valid (optional member), old wire regression retained. Launch-record writes use existing LaunchFiles directory/write operations in Claude/Codex/OpenCode, including their relaunch paths and rollback; no new agent ops/frames or Host mandatory methods. Searched field/function names, Host spreads, hostControl and held receipts across hub/src, hub/test (all tiers), nvim/test, shared/web, QA, docs and skills. Preservation consumers: adapter-native-boundary, host-ssh-contract, host-launch-layout, remote-discovery-host, transport-forwards/ssh, host-supervisor, launch-recovery, claude-code-remote, codex-remote-cleanup, opencode-remote, host-agent-restart plus session-cli; run unedited before ready. State inventory and host CLI help/docs will gain attach ownership/path.

### rev-37 · 2026-11-04T15:18:27.008Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1611-source-1
commit: ea251336926762bfd0859e2eca3d458352bdb0e8
scope: full
findings: [{"severity":"medium","text":"Sessions.view invokes an optional terminal printer without isolating errors. Revoked registration/missing client-key-path throws can fail list/snapshot/startup/process publication and enter launch failure handling; project attach:null while keeping explicit attach refusals.","file":"hub/src/adapters/sessions.ts","line":687},{"severity":"medium","text":"The 'exec env' prefix turns OpenCode's expanded OPENCODE_PASSWORD=$(cat private-file) into native env argv, exposing the private password before harness exec. Export/set it inside the shell and prove no password enters native argv.","file":"hub/src/host/attach.ts","line":51},{"severity":"medium","text":"Mapped recording Host inherits local publishFile while its directory/write/read/stat/remove operations map into remote storage. New attach publication bypasses that mapping; exclusive exact-head preservation reports five ENOENT staging failures. Migrate all reached fake consumers under Coordinator authority without weakening assertions or adding production fallback.","file":"hub/test/codex-remote-cleanup.test.ts","line":46},{"severity":"medium","text":"The spawned attach CLI has no registered failure/cancellation teardown; a close timeout can leave it running/writing while its root is removed. Own it immediately, join termination/native close before fixture removal, and preserve final session-identity assertions.","file":"hub/test/host-attach.test.ts","line":50}]
finding_counts: {"high":0,"medium":4,"low":0}

T-1611 full source review
Head ea251336926762bfd0859e2eca3d458352bdb0e8; branch t/T-1611-attach-to-a-host-session. Compared with origin/dev merge-base; one task commit. Run rev-37-1611-source-1; scope full; result not clear.
Reviewer performed source/docs/test inspection only, no tests/typecheck/browser, edits or merge. Standards and Spec axes reviewed in-session; role forbids delegation.

## Spec
Medium — hub/src/adapters/sessions.ts:687. The optional remote terminal printer executes while projecting every running row, and its exceptions escape. Registry's printer throws for revoked registrations and sshConnectionArguments synchronously opens client-key-path. A retained running row with missing key material or a just-revoked registry host therefore makes session.list/snapshot/startup/process publication throw instead of showing attach:null. view is also called before launch acceptance, so a terminal-printing failure can enter launch failure handling after native startup. Isolate optional projection failure; keep explicit session.attach refusal informative and test revoked/missing-path printer errors through list/snapshot while preserving unrelated rows. The implementer's self-review concern is confirmed by the direct call chain.
Medium — hub/src/host/attach.ts:51. terminalAccountPrefix always prefixes the recorded command with `exec env ...`. OpenCode appends `OPENCODE_PASSWORD="$(cat <private password file>)"` after that prefix. This is then an argv operand to the native env executable, not a leading shell environment assignment: the expanded native password appears in env's command line before env execs the harness. This needlessly exposes the private password through process argv. Set/export the password inside the shell without an external env argv operand, preserve final harness exec/account selection, and add a planted-password control covering native argv as well as record/printed-command scanning. The existing tests scan record bytes but their fake harness does not observe this intermediate argv boundary.

## Standards
Medium — hub/test/codex-remote-cleanup.test.ts:46. New writeAttachRecord calls Host.publishFile, but this mapped recording Host remaps directory/write/read/stat/remove to remote storage while inheriting local publishFile. The new admitted publication therefore uses the hub spelling instead of the fixture's remote directory. Implementer reported exact-head exclusive output `ENOENT opening .cland/run/attach/.stage-<uuid>` and5/10 failures, consistent with the source mismatch. Rule20's consumer migration is incomplete. Apply Coordinator72bfa80d's authorized forced file-operation remapping, retain all titles/assertions and resweep every remapped/virtual Host for newly reached publication calls; do not add a production local fallback.
Medium — hub/test/host-attach.test.ts:50. The native attach CLI child has no registered cancellation/failure cleanup. If the5s close observer times out (or setup/assertions throw while it is live), only the separately owned session child and adapter are torn down; tempProject can remove files while the attach child still runs/writes. Register the attach child immediately, terminate and observe native close on failure, drain it before root removal, and retain the final same-birth/liveness assertions. Include a bounded forced-failure/held-client cleanup control. Rule12 applies to this newly introduced native process.

Criteria failed:
C1: optional terminal printer exceptions can break list/snapshot/publication rather than merely making attach unavailable.
C2: attach-record publication has an unmigrated mapped Host consumer; the OpenCode terminal prefix also expands a private password into native env argv.
C3: the new native client test lacks joined cleanup when close/setup fails, so its ownership proof is incomplete.
C4 remains unverified; no criteria marked verified by this source-only pass.

Other source checked:
- Separate SSH command contains -t/-a/-x, -F/dev/null, pinned known_hosts and strict key policy, ControlPath=none/ControlMaster=no and ClearAllForwardings=yes, with shell quoting and no host/project/session bearer in the printed command.
- Existing session.attach {command} shape and local attachCommand default strings are preserved; optional Host member is additive and older/test Hosts explicitly refuse remote attach.
- All three adapter launch/relaunch paths add attach publication before transaction commit. Stable native identity/cwd and command are private0600 records in0700 attach directory; no raw OpenCode password is stored in the record. hostAttachPlan uses O_NOFOLLOW, file type/mode/uid, requested name and native birth/liveness checks before cwd/stty/exec. Stale/missing records refuse; record path hashes the name. Remote rename follow-up T-1672 is declared outside this scope.
- Credential filtering reuses remoteCommandEnvironment and drops launch token; launch publication uses prepared Host.publishFile and undo registration.
- Inventory covers clients/frames/importers/all tiers, docs/help/snapshot/skill CHANGES/role clause and state path ownership. The actual mapped publication consumer above remains incomplete.
- New native test has legitimate T3 process-exit reason; frame test is T2 with frozen local wire control. Duration allowance is labelled local working-tree sample with standing owner/seven-day expiry, not a Linux/full-suite pass.

Reported supplemental evidence: local macOS arm64 Node24.21 focused/native/CLI/adapter/static checks; overlapping heavy run is invalid evidence and not classified. Exclusive exact-head preservation is reported eleven files passing and Codex cleanup5/10 failing; no new queued verify/Linux/browser receipt exists. These reports do not supply a source clear. Finish corrections, retain failed evidence, request a new source review at the corrected head before configured verification.
Standards2medium; Spec2medium.
A-16591: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16591-t-1611-source-review-optional-projection-credential-argv-and-native-ownership.md

Criteria: C1 failed (Optional terminal-printer errors escape session projection, breaking list/snapshot/publication instead of showing attach unavailable.), C2 failed (Private OpenCode password expands into native env argv, and new publication is not mapped by an existing recording Host (exclusive preservation reports five failures).), C3 failed (Native attach-client test has no joined teardown on close timeout/setup failure, leaving client ownership and fixture cleanup unproved.).

### impl-1611 · 2026-11-04T15:22:07.213Z

Correcting A-16591 source findings without merging dev. Coordinator72bfa80d approved forced fixture member-only edits: codex-remote-cleanup maps publishFile/appendFile through existing mapped path (stat already mapped); claude-code-host's remote polling fixture delegates publishFile/appendFile/stat to its existing scratch fileHost. No test title/assertion/order edits in these preservation files. Rule20 resweep: searched all Host spreads/hostControl and file-operation properties/methods/reassignments across hub/test; remapped launch consumers are these two plus already-consistent session-host-placement. host-launch-layout/codex-host/codex-sandbox-host/opencode-host/adapter-native-boundary/SSH fixtures use consistent real scratch paths or real agent methods, no partial file remap. host-clone synthetic and launch-files mirror-only Hosts do not launch adapters and never reach attach publication; unrelated tracker/clock/artifact fs mocks are not Host launch consumers. nvim/tests consume frames, not Host file operations. Added projection failure controls through launch/list/snapshot, shell-builtin credential export/native env argv trap positive control, and identity-owned attach cleanup with forced held-client failure.
