---
id: T-1611
kind: task
title: Attach to a host session
state: open
status: in progress
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
updated: 2026-11-04T16:11:24.055Z
---

## Summary

`cland session attach` on a host session prints its own `ssh -t` connection with `ControlPath=none`, `ClearAllForwardings=yes`, `-a -x` and the host's pinned `known_hosts`, which runs `cland host attach <session>` on the host. That command reads the session's attach record from the agent (written at launch, 0600), sets the harness environment and execs the harness's attach under `stty susp undef`.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/cli/host.ts`, `hub/test/host-attach.test.ts` (new)

## Acceptance criteria

- [x] C1. For a session on a fake host, `cland session attach <name>` prints an `ssh -t` command with `ControlPath=none`, `ClearAllForwardings=yes`, `-a`, `-x`, `StrictHostKeyChecking=yes` and the host's `known_hosts`, running `cland host attach <name>`, and no secret appears in it (test).
  - done: impl-1611 · 2026-11-04T15:43:31.263Z
- [ ] C2. On the host, `cland host attach <name>` execs each harness's attach with the session's environment under `stty susp undef`, and refuses a session that is not on that host (test).
  - failed: rev-37 [reviewer] · 2026-11-04T16:11:24.055Z · note Remote relaunch record read hits an inconsistent recording Host, and its fake completion receipt never settles; configured preservation is cancelled/incomplete.
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

### rev-37 · 2026-11-04T15:28:11.591Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1611-source-2
commit: 7c58360aa6703b161e8434f43528902dc25d9cce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1611 corrected source review
Head7c58360aa6703b161e8434f43528902dc25d9cce; comparison ea251336926762bfd0859e2eca3d458352bdb0e8.
Runrev-37-1611-source-2; scopefull; clear; findings[].
Retains original full-source audit A-16591, with all four findings addressed. Reviewer read source/tests/docs/item and Coordinator72bfa80d; no tests/typecheck/browser, edits or merge performed. No dev merge or changed C4 preservation file.

Standards:0 findings.
- Coordinator-authorized forced preservation edits are only file-operation delegates: Codex maps publishFile/appendFile into its existing remote scratch storage (stat was already mapped); Claude remote polling Host adds its existing scratch fileHost publish/append/stat delegates. Diff preserves all original test titles, assertions and ordering. Item's resweep dispositions cover other inline/remapped launch Hosts, shared mocks, agent and frame-only consumers. The original failed preservation evidence A-16590 remains failed, not reclassified green.
- Both native session and attach CLI are registered immediately with shared exact-identity ownProcess and beforeDirectories native-close joins. The held-client variant observes its written receipt, forces failure and joins termination/close before final original-session birth/liveness assertions; cleanup remains registered for earlier failure/timeout too.
- Changed test/subsystem guides describe printer unavailability, direct builtin export/exec, positive native env trap and held-client teardown. Existing C4 CLI/adapters have no changes. No copied duration baseline or new allowance in this correction.

Spec:0 findings.
C1 source: Sessions.view catches only optional remote printer errors and leaves attach:null; local attach behavior stays unchanged. Explicit session.attach still propagates refusal. New in-process real frame controls inject revoked and missing-key printer errors during launch/list/snapshot, retain an unrelated local row, assert nullable attach and preserve explicit refusal text.
C2 source: terminalAccountPrefix validates environment names and uses shell export/unset builtins. Each terminal command directly execs its harness. OpenCode reads the existing private password file into a shell assignment, exports it and execs directly, so expanded password is not an argv operand to native env. A planted native env trap has an executed positive control, then must remain absent after actual CLI attach; the fake OpenCode client asserts the expected password in its environment while record/argv receipt scans exclude it. Existing admission credential filter and private record checks remain.
C3 source: held attach-client failure now exercises joined ownProcess/native close while the separately owned durable session retains the exact native birth and liveness; ordinary attach exit still checks0/null exit and stty receipt before final identity.
C4 source: default local attach strings and wire shape remain unchanged; all named local CLI/adapters preservation files remain unedited.

Other original features remain as audited: separate pinned-key no-sharing/no-forward SSH printer, optional Host member, private0600 record/0700 directory, exact native birth check, foreign/stale refusal, launch/relaunch transaction publication/rollback and declared rename follow-up T-1672.

Reported current correction-tree supplement is local macOS arm64 Node24.21 focused8pass plus typecheck/lint (zero refusals/122 existing report findings); no Linux/configured/full-tier/browser receipt claimed. Exclusive sequential preservation at corrected head is still pending the Coordinator's machine lock. Those receipts and same-head configured verification remain needed before final verification/ready; previous overlapping heavy outcomes remain invalid evidence. All C1–C4 are run-dependent and remain unverified at this source-only pass. Fresh configured verification may use only7c58360aa6703b161e8434f43528902dc25d9cce; any fix/head change requires new source review. QA policy is none.
Standards0 findings; Spec0 findings.
A-16594: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16594-t-1611-corrected-source-review-at-7c58360aa.md

### impl-1611 · 2026-11-04T15:32:40.204Z

Source-clear A-16594 at7c58360aa. Exact-head exclusive sequential preservation:213 pass, zero failure/cancel/skip across13files; raw case names/native completion/provenance A-16596 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16596-t-1611-corrected-head-targeted-receipts. Local macOS arm64 Node24.21, no browser; supplemental targeted evidence, not Linux/full tiers. Corrected-source focused8/root typecheck/T0lint passed, zero lint refusals and122 known report-only findings59files. Mode-free configured verify admitted0878f347-e509-409a-a5e3-d37f9db598d4 (position1), reports to assigned Reviewer and claimant in item topic. No source changes/dev merge after review; waiting hub result and final evidence verdict.

### rev-37 · 2026-11-04T15:40:59.007Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1611-evidence-1
commit: 7c58360aa6703b161e8434f43528902dc25d9cce
scope: evidence
findings: [{"severity":"medium","text":"New optional terminalAttachCommand is absent from the reusable Host contract; unchanged inventory guard reports it uncovered. Add meaningful optional-capability coverage while preserving the uncovered-member sentinel.","file":"hub/src/host/host.ts","line":35},{"severity":"medium","text":"Added attach guidance grows rendered default Implementer clause to6714bytes, above the existing6528 growth-reserve ceiling. Shorten/pointer the guidance without relaxing limits or assertions.","file":"hub/src/roles/default-roles.ts","line":174}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1611 failed configured verification
Head7c58360aa6703b161e8434f43528902dc25d9cce.
Runrev-37-1611-evidence-1; scopeevidence; not clear.
Configured run0878f347-e509-409a-a5e3-d37f9db598d4 / A-16600 exited1. Linuxx64 6.8.0-142-generic droplet c-8 sfo2, Node24.21.0, Neovim0.12.5, uncached. Provenance head matches source clear, canonical treeaeb6b0010ae6986404b46c73bfddce75f6576b1b. Browser binary/version null because Web did not run.

Actual output before classification:
1. `Host contract exercises every interface member and detects an uncovered addition`
`actual: [ 'uncovered', 'terminalAttachCommand' ], expected: [ 'uncovered' ]`
2. `defaults implementer: clause reply is 6714 bytes; 15% growth headroom requires at most 6528 of 7680 bytes`

Medium — hub/src/host/host.ts:35. The new optional terminalAttachCommand member has not been represented in hub/test/host-contract.ts's reusable contract. The unchanged coverage sentinel detects it as an uncovered addition. Migrate that consumer with meaningful optional-capability assertions while preserving the planted uncovered-member failure; do not weaken or exempt the guard.
Medium — hub/src/roles/default-roles.ts:174. Added terminal-attach guidance grows the rendered default Implementer clause to6714bytes, exceeding the existing6528growth-reserve ceiling. Keep the guidance through a shorter pointer/wording and preserve the original reserve/limits/assertions. This is an assertion failure, not a report-only duration advisory.

T0pass, T1fail:1406completed cases/1404pass/2fail,0cancel/skip/todo. T2, changedT3, mappedT4 and Web did not execute; no attach/native/current-frame passing receipt comes from this interrupted configured run. Budget/lint/ratchet notices remain report-only and do not explain either functional guard failure.
A-16596 separately retains reported exclusive macOS targeted213passing cases/13files at this head, including forced mapped consumers. That is supplemental preservation evidence, not a substitute for the failed configured run and not a Linux/full-tier claim; no criteria are verified here.

Failed C1: the new Host terminal capability's reusable contract consumer is uncovered and fails verification. C2–C4 remain unverified; no claim that their unexecuted attach behavior or existing local strings failed. The clause byte-reserve finding is a separate shared gate blocker for the current implementation.
Fix at a new head, get fresh source review, then configured verification. No dev merge needed. Reviewer read source/logs only, ran no tests/typecheck/browser and made no edits.
A-16602: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16602-t-1611-t1-failure-host-inventory-and-clause-byte-reserve.md

Criteria: C1 failed (Reusable Host contract does not exercise terminalAttachCommand; same-head configured verification stops in T1 on this and the clause reserve guard.).

### rev-37 · 2026-11-04T15:44:43.161Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1611-source-3
commit: 37c41b7712f26632eabfb18a84e87d303fc461cd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1611 source correction for T1 guards
Head37c41b7712f26632eabfb18a84e87d303fc461cd; runrev-37-1611-source-3; scopefull; clear; findings[].
Compared with source-cleared7c58360aa6703b161e8434f43528902dc25d9cce: exactly three files change (default role text, reusable Host contract, its coverage test), no dev merge. Full source audit A-16594 remains applicable; failed run0878f347/A-16600 remains failed.

Standards0 findings:
- Reusable optionalTerminalHostContract asserts absence on an older/local Host and a function plus the exact requested worker command when supplied. New T1 coverage runs both branches, asserts the printer receives worker and positively proves a wrong expected command fails. Original missing-member inventory and planted uncovered sentinel remain unchanged.
- Clause reply reserve assertions/ceiling are untouched. Coordinator3cc00636 permits a docs pointer and requires retaining verifier-routing obligations. Before/after text is included in the request: inspect outcomes, wait for queued assignment, no resending, report missing verifiers to the lead, consult implement for fields/refusal retry rules all remain. Terminal-attach details stay in existing full docs behind the one-line pointer. No permission or rule meaning is removed.
Spec0 findings:
- No change to SSH printer, Host record/liveness/credential handling, native exec, adapter publication, optional view handling, forced fixture mappings or local attach behavior.
- Reported rendered default Implementer reply6528bytes is at the unchanged6528ceiling (formerly6714); pure targeted T1 red->green45tests, root typecheck and lint0refusals/122known advisory findings are supplemental macOS arm64 Node24.21 reports, not current configured/Linux evidence. Reviewer did not run tests or recompute runtime bytes.

A-16596's213case preservation is explicitly ancestor-head evidence at7c58360aa; native source/test bodies remain unchanged but it is not relabelled as current-head execution. All C1–C4 remain runtime-unverified here. Fresh mode-free configured verification must pin37c41b7712f26632eabfb18a84e87d303fc461cd and record named guard/attach/local compatibility outcomes. A fix/head change requires a fresh source review. QA policy none. Reviewer read only; no edits/tests/typecheck/browser.
Standards0 findings; Spec0 findings.
A-16605: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16605-t-1611-source-review-optional-contract-and-clause-reserve-correction.md

### impl-1611 · 2026-11-04T15:51:35.318Z

T1 failures in0878f347 corrected at37c41b771 (source-clear A-16605). Same-head final native/C4 sweep:285pass/0fail/cancel/skip,19files sequential under Coordinator lock; raw names/native exits/provenance A-16609 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16609-t-1611-reviewed-head-preservation-and-c4-receipts. Both native reusable Host wrappers, required stage files/forced mappings and all unchanged C4 CLI/adapter files pass. Local macOS arm64 Node24.21, no browser; targeted supplements, not configured/Linux/full-tier proof. Targeted T1green45/root typecheck/test:lint0 with122known report findings59files. Exact-head mode-free verify admitted8cdc1471-8cb5-4470-81dc-5190be5fa643. Prior0878 remains failed; later tiers were unexecuted. Awaiting new hub result and assigned Reviewer final evidence verdict.

### rev-37 · 2026-11-04T16:11:24.055Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1611-evidence-2
commit: 37c41b7712f26632eabfb18a84e87d303fc461cd
scope: evidence
findings: [{"severity":"medium","text":"Remote fixture blanket readFile refusal intercepts existing attach-record snapshot during relaunch; its fake stop returns true but never settles exited, so rollback hangs. Scope the .git stub/delegate record reads and publish the matching synthetic exit receipt without weakening policy assertions or timeouts.","file":"hub/test/codex-sandbox-host.test.ts","line":101}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1611 failed configured verification at37c41b771
Head37c41b7712f26632eabfb18a84e87d303fc461cd; runrev-37-1611-evidence-2; scopeevidence; not clear.
Run8cdc1471-8cb5-4470-81dc-5190be5fa643 / A-16613 exits1. Same source-reviewed head, canonical tree678e38f94ff6e3d93563b18477df0c12811e4737. Linuxx64 6.8.0-142-generic droplet c-8 sfo2, Node24.21.0, Neovim0.12.5, uncached. Browser binary/versionnull; Web unexecuted.

Actual output:
`spawn and relaunch serialize the captured session Host policy`
`'test timed out after120000ms'`
Finish record: timedOut:true, outcome:cancelled, seconds240.029481615.
The hub's separate hung notice reports616s; these measure different observations and must not be equated. This is a cancelled/incomplete behavior receipt, not a passing test with a report-only duration advisory.

Medium — hub/test/codex-sandbox-host.test.ts:101. Its remote launch Host overrides readFile to unconditionally throw `no linked worktree`. Relaunch now snapshots an existing attach record through writeAttachRecord -> LaunchFiles.file -> Host.readFile, so this unrelated stub rejects newly reached record bytes. The fixture also returns a never-resolving exited promise at103 while stop at106 returns true without publishing a matching synthetic exit; failed-launch rollback waits on that receipt. This is another unmigrated recording Host consumer. Lead72a20d93 confirms the source trace. Scope the fault stub to its original .git boundary, delegate attach-record reads consistently and supply the fake native exit receipt when fake stop succeeds. Preserve policy/command assertions, names and timeouts; resweep specialized read/stop/exit doubles as well as write mappings.

T0/T1pass, T2exit1; changedT3, mappedT4 and Web unexecuted. The hub reports4341completed-before-interruption, all4341pass, while phase aggregate4322/4321pass/1cancelled reflects the interrupted case; distinct aggregates are not summed. T1 now establishes the previous contract-inventory and clause-reserve guards pass, but no end-to-end criterion is marked verified on a failed configured run.
Reported local A-16609 preservation285cases/19files is supplemental macOS head-specific evidence. It did not prevent this newly observed queued T2 cancellation and cannot replace configured verification.

Failed C2: remote relaunch attach-record snapshot hits an inconsistent recording Host and the preservation case cannot settle; current configured proof is incomplete. C1/C3/C4 remain unverified; no claim their unexecuted native attach behavior or local strings failed.
Prior run0878f347/A-16600 remains failed; do not reclassify either run as green or load-only. Corrected head needs source review before another configured run. No dev merge required. Reviewer inspected source/logs only, no tests/typecheck/browser or edits.
A-16614: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16614-t-1611-cancelled-codex-policy-preservation-record-read-and-exit-receipt.md

Criteria: C2 failed (Remote relaunch record read hits an inconsistent recording Host, and its fake completion receipt never settles; configured preservation is cancelled/incomplete.).
