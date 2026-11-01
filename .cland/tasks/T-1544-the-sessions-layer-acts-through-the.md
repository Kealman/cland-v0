---
id: T-1544
kind: task
title: The sessions layer acts through the session's Host
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1543
topic: topic-1290
branch: t/T-1544-the-sessions-layer-acts-through-the
created: 2026-10-31T23:47:40.914Z
updated: 2026-11-01T03:48:54.442Z
closed: 2026-11-01T03:48:54.442Z
---

## Summary

Give the sessions layer a host registry that holds only `local`, and add to `AdapterHost` a lookup of the Host for a process row and for a launch, which the adapters use from ticket 04 onwards. Route the launch and relaunch cwd checks, the crew-pool restart's stat, the launch's identity reads, the deaf-episode liveness, the legacy identity upgrade, durable pending-stop recovery and `LaunchFiles` rollback through it.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/contract.ts` (`AdapterHost`), `hub/src/adapters/index.ts`, `hub/src/adapters/launch-files.ts`, `hub/src/adapters/session-cwd.ts`

## Acceptance criteria

- [x] C1. `AdapterHost` exposes the Host of a process row and of a launch, and every lookup resolves to the `local` host (test).
  - done: impl-1544 · 2026-11-01T01:13:14.754Z
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680
- [x] C2. The launch cwd check, the crew-pool restart check and the relaunch cwd refusal call the Host's statDirectory, with refusal texts unchanged (test).
  - done: impl-1544 · 2026-11-01T01:13:14.857Z
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680
- [x] C3. Launch identity reads, deaf-episode liveness at startup and on its timer, the legacy identity upgrade and pending-stop recovery go through the Host's identity, alive and processes operations (test with a recording Host).
  - done: impl-1544 · 2026-11-01T01:30:48.713Z
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680
- [x] C4. `LaunchFiles` rollback ends a failed launch's children through the Host's stop, and a pending-stop record written before this change is still recovered after a hub restart (test).
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - done: impl-1544 · 2026-11-01T02:26:38.777Z
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680
- [x] C5. `sessions.ts` and `launch-files.ts` no longer import `pidAlive`, `processIdentityAsync`, `systemProcesses` or `endProcess`, apart from the hub's own `CLAND_TEST_CRASH_AT` self-kills; the only `stat` left is the hub-side launch-file metadata read for rollback, behind one named hub-local helper (hub-side launch files belong to E-1532, A-15078).
  - done: impl-1544 · 2026-11-01T01:13:15.368Z
  - verified: rev-35 [reviewer] · run rev-35-1544-source-2 · 2026-11-01T01:16:11.580Z · commit 14ea89f00080fd7dd736bf3cc8ade96f2b4ea481
  - verified: rev-35 [reviewer] · run rev-35-1544-source-3 · 2026-11-01T01:31:01.670Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-source-4 · 2026-11-01T02:26:57.633Z · commit 1be4d4687e420613f46ed695836362b4431bf680
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680
- [x] C6. The session-launch, session-resume, session-stop-races, session-async-processes and session-cwd test files pass with no test edited.
  - done: impl-1544 · 2026-11-01T01:13:15.472Z
  - verified: rev-35 [reviewer] · run rev-35-1544-final-1 · 2026-11-01T01:47:34.681Z · commit 4b6610937688172294f138257f3d604de31cda93
  - verified: rev-35 [reviewer] · run rev-35-1544-final-2 · 2026-11-01T02:44:06.292Z · commit 1be4d4687e420613f46ed695836362b4431bf680

## Comments

### impl-1544 · 2026-11-01T01:08:10.217Z

Consumer inventory: AdapterHost constructed by Sessions.host plus standalone native adapter/test literals; consumers claude-code.ts, codex.ts, opencode.ts, index.ts and fakes/harness.ts (new lookup callbacks optional for previous standalone shape). LaunchFiles constructed in all three native adapters; restore consumed by Sessions durable pending-stop. Session process probe options consumed by session-process-probe-lifecycle.test.ts, session-stop-pending-recovery.test.ts, session-lifecycle.test.ts and native recovery fixtures. Wire/process row/pending-stop serialized shapes remain unchanged. Searches cover AdapterHost, LaunchFiles, processRows/processStarted/processIdentity, statDirectory, sessionCwdRefusal, pidAlive/systemProcesses/endProcess across repository including T3/T4; remaining native adapter consumers migrate in following epic items.

### impl-1544 · 2026-11-01T01:11:58.132Z

Implementation: local-only Sessions Host registry and optional AdapterHost hostForProcess/hostForLaunch; all cwd checks, launch/resume identity, legacy upgrade, deaf checks and durable recovery routed. LaunchFiles records Host identity and stops via Host; named hubFileMeta retains hub-side undo stats. Host.stop gains optional graceMs/allowReused preserving rollback's previous endProcess options; other Host clients retain defaults. Migrated the only separate Sessions probe fixtures (name-reservation and lifecycle-serialization) to Host injection; all five C6 files unchanged. Local macOS Node v24.21.0: session-launch 2/2, session-resume 2/2, session-stop-races 6/6, session-async-processes 3/3, session-cwd 2/2, name-reservation 75/75, lifecycle-serialization 9/9, host-local-contract 6/6, recording Host 6/6. Typecheck passed. Full suite has not run; source review precedes mode-free verification and final evidence review; Coordinator owns full pre-merge suite.

### rev-35 · 2026-11-01T01:14:29.275Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1544-source-1
commit: 132c657ad5a2f0d402b332c35847b500b48b83ae
scope: full
findings: [{"severity":"medium","text":"The timer test labels checks>=2 as 'liveness completed', but the stub increments before its async result returns; this is an attempt receipt, forbidden by rule 9. The following negative assertions can run before the timer's post-await decision. Arm a bounded completion receipt for the processed liveness decision before advancing time, retain the no-deaf assertions, and cover the live path with its durable episode/notice receipt.","file":"hub/test/session-host.test.ts","line":111}]
finding_counts: {"high":0,"medium":1,"low":0}

Source review not clear: medium hub/test/session-host.test.ts:111 waits for checks>=2 before negative notice/checkpoint assertions. The count increments on entry to async alive, so it is not the processed decision receipt required by rule 9. Arm a bounded completion receipt before trigger, await it and retain final negative assertions; prove live path with its durable episode/notice receipt. Other routing, ownership checks, shape compatibility and scoped hub-local file metadata match source expectations; C6 run evidence pending. No Reviewer runtime/browser execution.

Criteria: C3 failed (Deaf-timer recording test waits for an attempt count rather than completion of the async liveness decision; no durable positive live-path control.).

### rev-35 · 2026-11-01T01:16:11.580Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1544-source-2
commit: 14ea89f00080fd7dd736bf3cc8ade96f2b4ea481
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards: no findings. Spec: no findings. Test-only fix resolves C3 gap: timer observer armed before held input, bounded wait for durable episode, exact notice/message ids and deaf projection asserted. Startup waits durable clear with undefined pending sentinel; checks count supplemental only. Complete production review A-15152 carries forward unchanged. C5 source verified. C1–C4/C6 final runtime evidence pending same-head mode-free verify, with unchanged five C6 files and named deferred native receipts as needed. No Reviewer runtime/browser execution; QA none.

Criteria: C5 verified.

### rev-35 · 2026-11-01T01:27:45.430Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1544-evidence-1
commit: 14ea89f00080fd7dd736bf3cc8ade96f2b4ea481
scope: evidence
findings: [{"severity":"medium","text":"Same-head T2 run fails 'upgrade restart adopts persisted legacy Claude rows without generation on spoke hook and bridge' with 'Error: executor operation deadline reached' at 5098.8 ms. Legacy-restart preservation is not established; diagnose the missing receipt before retrying or changing a bound.","file":"hub/test/claude-code-schedule.test.ts","line":1023}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Actual failure: 'Error: executor operation deadline reached', claude-code-schedule.test.ts:1023 case 'upgrade restart adopts persisted legacy Claude rows without generation on spoke hook and bridge' (5098.801197 ms). No root-cause or flake classification yet. Durable run ec259de4 / A-15157 matches reviewed 14ea89f00080fd7dd736bf3cc8ade96f2b4ea481, runner tree 8dbff78dd3745e53ebc227d9e6645c5d35ae99fe, cached null. T0/T1 exit 0; T2 exit 1. Selected native T3/T4 and Web unexecuted; browser binary/version null. Linux x64 6.8.0-142-generic droplet, Node 24.21.0, Neovim 0.12.5. Budget/test-lint/tier-mismatch/ratchet/skip-reason notices report-only, distinct from actual test timeout. No Reviewer runtime/browser execution. Diagnosis/fix needs fresh source review before another changed-head verification.

Criteria: C3 failed (Same-head legacy Claude upgrade/restart regression timed out with executor operation deadline reached; required legacy routing preservation not established.).

### impl-1544 · 2026-11-01T01:30:24.197Z

Verification failure ec259de4 / A-15157 at 14ea89f: T0/T1 green, T2 failed claude-code-schedule.test.ts::upgrade restart adopts persisted legacy Claude rows without generation on spoke hook and bridge with 'Error: executor operation deadline reached' (5098.8 ms); later phases/Web unexecuted. Reproduced locally at ~5.13s twice. Disposable archived pre-task source 06e968e60 with sealed HOME/Git environment passes in 133ms. Step diagnostics located blocked spoke presence after restart. Claude resume had three module-native pidAlive reads bypassing injected #pidAlive; the fixture invents PID 91001 and supplies pidAlive=>true. Faster Host identity observation exposes the existing race. One-variable fix uses this.#pidAlive in those same three resume branches, exact existing test passes in 135ms with assertions/deadlines unchanged. Coordinator authorized this narrow correction in T-1544 (1021bedd); Claude Host migration stays in T-1547. All temporary diagnostics removed. Fresh source review and verification required at new head.

### rev-35 · 2026-11-01T01:31:01.670Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1544-source-3
commit: 4b6610937688172294f138257f3d604de31cda93
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards: no findings. Spec: no findings. Entire delta from 14ea89f is three Claude resume liveness reads routed through existing #pidAlive. Constructor default is the same native pidAlive function; identity/birth guards, production default behavior and test assertions/bounds remain intact. A-15160 records original failure output, isolated baseline/control diagnosis, exact-case red/green and unchanged local 46-case schedule pass; these are targeted pre-verdict evidence, not a new verification receipt. Prior complete production/source review A-15153 carries forward. C5 source verified; C1–C4/C6 and final evidence await new same-head verify with exact recording Host/native preservation case receipts. No Reviewer runtime/browser execution.

Criteria: C5 verified.

### rev-35 · 2026-11-01T01:47:34.681Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1544-final-1
commit: 4b6610937688172294f138257f3d604de31cda93
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final review clear. Standards/Spec: no findings. All C1–C6 verified. A-15166 durable passed 09e58dfc matches reviewed head, runner tree 0ec4f655803370bf90dbf4b1b99d9f684c4b6c1a (not cached). T0/T1/T2/selected T4/Web exit 0, reported 4541 passes, zero fail/cancelled/skipped/todo. Confirmed actual six recording Host cases, prior failing legacy Claude restart, launch 2/resume 2/async-processes 3/cwd 2 and mapped T4 1. Linux x64 droplet Node 24.21.0, Neovim 0.12.5, isolated Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. C6 missing native stop-races supplied by A-15167: six named local passes, native exit 0/no signal, clean same head/Git tree 9fcd0c80a0b0de49e5616c0fc7313f4616decea7, Darwin 27.0.0 arm64 Node 24.21.0, no browser. All five C6 files unedited. Selected T4 once/no repetitions; remaining T3/T4 deferred, not full pre-merge verification. Advisory budget/lint/ratchet/tier/skip checks report-only. No Reviewer execution. Coordinator owns required full pre-merge run; QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1544 · 2026-11-01T02:26:26.185Z

Full pre-merge failure A-15172 / 58a4530c is item-caused dropped logger, now corrected. Actual failure: 'OS confirms the owned child ended: not within 15000 ms' at adapter-native-boundary.test.ts:265. Requested controls: 4b661093 full native boundary file 66/67, dev bda184aa in isolated archived source 67/67; exact case 1340ms on dev. Corrected working tree full file 67/67 and exact case 1248ms with test unchanged. A-15173 carries raw red/dev/green outputs and provenance. Fix retains localHost's optional owner logger and forwards it to endProcess; Sessions configures its log before registry construction; default/restored LaunchFiles preserves child/explicit rollback log. Host interface and serialized shapes unchanged; birth/group/grace/allowReused termination and libuv child-exit await unchanged. Consumer search for harness-ended: hub/journal.ts event catalogue and lifecycle reader; claude-code-sessions-lifecycle, adapter-native-boundary, system-processes, session-async-processes, orphan-servers and termination-ownership tests; orphans.ts uses a completion callback. All retain existing event shape and semantics. Factory clients: Sessions and LaunchFiles updated; AccountPoller uses limitPolls only; Host contract/tests retain optional old call shape. No diagnostics or test edits remain.

### rev-35 · 2026-11-01T02:26:57.633Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1544-source-4
commit: 1be4d4687e420613f46ed695836362b4431bf680
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear. Standards/Spec: no findings. Entire delta from prior clear head forwards an optional owner logger through localHost to endProcess; Sessions initializes/provides its logger, and default LaunchFiles forwards the current child/rollback logger through resumed scope. Host interface and serialized shapes unchanged. Native identity, descendant/group ownership, grace/allowReused escalation and separate libuv child-exit await remain intact. Docs explain distinct OS/log and child-exit receipts. A-15173 retains actual failed full-suite output and isolated head/dev/green controls; those local corrected-working-tree controls are not new post-verdict suite evidence. Prior full source review carries forward. C5 source verified; remaining criteria/final review await exact-head verify plus named native adapter-native-boundary rollback and five C6 preservation receipts. No Reviewer runtime/browser execution.

Criteria: C5 verified.

### rev-35 · 2026-11-01T02:44:06.292Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1544-final-2
commit: 1be4d4687e420613f46ed695836362b4431bf680
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final review clear. Standards/Spec: no findings; all C1–C6 verified. Passed durable 7a694056 / A-15175 matches reviewed head, runner tree fc4e185ca9e42a5e38d73e6bb80e3f2db561afb4 (not cached). Actual six recording Host cases, prior legacy Claude upgrade, launch 2/resume 2/async 3/cwd 2 and mapped T4 pass. T0/T1/T2/selected T4/Web exit 0, reported 4541 passes, zero fail/cancelled/skipped/todo; Linux x64 droplet Node 24.21.0 Neovim 0.12.5, isolated Chrome Headless Shell 1248 / Chrome for Testing 156.0.8078.4. Same-head A-15174 raw native adapter-boundary 67/67 (including former OpenCode rollback failure) and stop-races 6/6, native exits 0/no signal, clean Git tree 5e77cdaf396f670aa7b0545b4978e26568099c5f, Darwin 27.0.0 arm64 Node 24.21.0. Native/C6 files unchanged. Local/runner provenance separate. Selected T4 once/no repetitions; other T3/T4 deferred. Advisory budget/lint/ratchet/Web/skip checks report-only. No Reviewer execution. Prior full-run failure requires Coordinator full pre-merge rerun; this task receipt is not that full pass.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1544 · 2026-11-01T03:42:22.192Z

Coordinator full pre-merge receipt now green: 16414c39 / A-15183 at unchanged 1be4d4687e420613f46ed695836362b4431bf680, runner tree fc4e185ca9e42a5e38d73e6bb80e3f2db561afb4, cached null. Exit0; 6181 passed, 8 skipped, 0 failed; T0/T1/T2/T3/Web completed (ordinary all, no integrated-occasion T4). Linux x64 6.8.0-142-generic droplet c-8 lon1, Node24.21.0 Neovim0.12.5, Chrome for Testing Headless Shell156.0.8078.4 at chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. Eight skips have recorded platform/native-binary reasons (macOS sandbox/caffeinate and absent real OpenCode); skip-reason check report mode has missing0. Lint/budget/ratchet notices report-only. Lifetime2291s cost$0.1591; no timing comparison claimed. Source unchanged; claim retained for Coordinator merge.

### coord · 2026-11-01T03:48:54.442Z

Merged 6f66b685ce181e68be5ccb76cc833e154b5bbaba onto dev.
