---
id: T-500
kind: task
title: remote-fixture test hub outlives a dead or timed-out test (orphan hub serve in remote-run-* dirs)
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-343
branch: t/T-500-remote-fixture-test-hub-outlives-a-dead
created: 2026-10-15T14:10:39.101Z
updated: 2026-10-16T02:50:44.036Z
---

## Problem

`hub/test/remote-fixture.ts` starts a `hub serve` in a `remote-run-*` temp directory. When the test's parent dies or times out without teardown, that hub outlives it. On 2026-10-15 pid 76123 ran orphaned (ppid 1) from 13:33Z until the stand-in reaped it at 14:12Z; it came from the T-459 worktree, and a second stale remote-run-ZYtvuT dir was left behind. Leaked hubs add load and can hold sockets and databases that later tests touch.

## Acceptance criteria

- [x] C1. The remote fixture's hub is stopped, and its temp dir removed, on normal teardown, on test timeout and on the test process's exit (including SIGTERM/SIGINT). A spawned child that loses its parent exits by itself within a bounded time.
  - done: impl-500 · 2026-10-16T01:04:43.964Z
  - verified: rev-30 [reviewer] · run rev-20261016-500-source-correction · 2026-10-16T01:05:45.833Z · commit 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9
  - verified: rev-30 [reviewer] · run rev-20261016-500-manifest-delta · 2026-10-16T01:25:54.134Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-manifest-delta · 2026-10-16T01:29:31.092Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-final · 2026-10-16T02:46:50.596Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-merge-final · 2026-10-16T02:50:33.335Z · commit 65cedd22d3f54491b0bd3cd81b8d6911c10ee376
- [x] C2. A test kills a fixture's parent abruptly and observes the fixture hub gone within the bound. remote-fixture users pass 5/5 serially on the Mac.
  - done: impl-500 · 2026-10-16T02:45:42.586Z
  - verified: rev-30 [reviewer] · run rev-20261016-500-final · 2026-10-16T02:46:50.596Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-merge-final · 2026-10-16T02:50:33.335Z · commit 65cedd22d3f54491b0bd3cd81b8d6911c10ee376
- [x] C3. A test fixture that starts a hub with a fake provider leaves no droplet watchdog behind: its teardown stops and awaits the fixture watchdogs, or a fixture watchdog exits when its fake provider state disappears. Seen 2026-10-15 23:00Z: pids 50008 and 50071 outlived fixture hub 36962. Production watchdogs keep their independence from the hub (guaranteed destruction, v0.1.2 §3.14, executor-droplet.test.ts:169) unchanged.
  - done: impl-500 · 2026-10-16T00:54:02.131Z
  - verified: rev-30 [reviewer] · run rev-20261016-500-source-correction · 2026-10-16T01:05:45.833Z · commit 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9
  - verified: rev-30 [reviewer] · run rev-20261016-500-manifest-delta · 2026-10-16T01:25:54.134Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-manifest-delta · 2026-10-16T01:29:31.092Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-final · 2026-10-16T02:46:50.596Z · commit 2c0daf88c0357f8ee90174cb0220106f40afbe1c
  - verified: rev-30 [reviewer] · run rev-20261016-500-merge-final · 2026-10-16T02:50:33.335Z · commit 65cedd22d3f54491b0bd3cd81b8d6911c10ee376

## Comments

### coord · 2026-10-15T14:11:01.863Z

Likely trigger, from impl-459: at 13:33Z an interrupted targeted run of hub/test/executor-run.test.ts was cancelled during the fake remote lifecycle case. The fixture teardown didn't run, which left the orphan. For C2, reproduce it by interrupting that file mid-case.

### coord · 2026-10-15T17:48:59.506Z

A second leak pattern, from the stand-in at 17:49Z: a `node -e` fake child (pid 26723, almost 4 days old) was polling every 50 ms for a "finish" file in a deleted cland-suite-cli temp dir, with no owner, until it was reaped. Fake children that poll for a file outlive tests that exit without writing it. C1 should also make such fakes exit on their own when the parent or the poll directory disappears.

### human · 2026-10-15T23:02:15.811Z

Orphan reaped by cland-impl, 2026-10-15 23:00Z, at coord's request: a fixture hub serve from the T-469 worktree (pid 36962, ppid 1, age 1h40m, cwd $TMPDIR/remote-run-YP1j6b) running since ~21:21Z, when impl-469 interrupted its targeted stage-cover run. SIGTERM to 36962 ended the hub, but its two droplet watchdog children (hub/src/executor/droplet/watchdog.ts, pids 50008 and 50071, same cwd) were reparented to launchd and kept running; they needed their own SIGTERM. Same pattern as the 14:12Z reap (pid 76123, remote-run-QRokzy). Dirs remote-run-QRokzy, -YP1j6b and -ZYtvuT remain in $TMPDIR for the cleanup this ticket adds. Note for the fix: the watchdogs must die with their parent (process group or a parent-death watch).

### impl-500 · 2026-10-16T00:26:03.564Z

Red reproduction: node --test --test-name-pattern='owner SIGKILL' hub/test/remote-fixture-lifecycle.test.ts failed because the actual remote-fixture hub remained alive past the 5s bound. Implementing a test-only IPC reaper and explicit detached writer/watchdog cleanup; production watchdog behavior remains unchanged per Coordinator decision.

### rev-30 · 2026-10-16T00:56:38.871Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-500-source
commit: bc560070a3a11a79ec9590106aa17ec737d32124
scope: full

Source review T-500 not clear at bc560070a3a11a79ec9590106aa17ec737d32124, fixed comparison ca09b03c056fcc77015b698bc95f9bee9655df13. Standards and Spec reviewed directly. One medium finding; no separate high or low findings.

Medium — hub/test/remote-fixture.ts:23 and hub/test/fixture-guard.ts:49: new detached-writer discovery only runs in beforeDirectories on ordinary test teardown. ownDirectory installs the existing process-cleanup.ts:386–390 SIGTERM/SIGINT handler, which first cleans recorded identities and then recursively removes registered roots. A production watchdog launched by the fixture hub is detached and is not a captured identity in the owning test process. Signal cleanup bypasses beforeDirectories; it can therefore remove the lease/root while the watchdog is alive. On owner disconnect the guardian skips a missing root, so it cannot establish stop-before-delete retroactively. Watchdog's existing missing-lease exit is not an observed stop before removal. This leaves the signal path racing writers and violates rule12 within C1's explicit SIGTERM/SIGINT scope.

Make the fixture writer-stop cleanup participate in signal cleanup before rm, and add live-watchdog SIGTERM/SIGINT regression modes that preserve production independence while observing writer exit before directory removal. Do not change the production watchdog's independent guaranteed-destruction contract. Implementer cd0bf00f confirms the gap and is preparing this correction/new head before verify. C1 failed; C2 remains incomplete rather than failed for missing repetition evidence.

Otherwise the test-only guardian's IPC closure covers abrupt owner death, captures device/inode before acknowledging each root, checks root identity before discovery, and invokes existing PID/start/cwd ownership proof rather than broad signalling. Normal teardown stops the embedded hub and discovers/awaits detached writers before provider/root disposal. The file barrier exits on owner reparenting, working-directory loss or finish without keeping a polling timer alive. Task diff contains no production watchdog change. Machine shard entry is present and four measured lifecycle duration exceptions have specific startup/timeout rationale. Existing suite finish barriers keep their assertions.

A-3497 documents the pre-fix SIGKILL red (hub alive beyond5s). A-3513 raw log inspected: corrected lifecycle10/10, zero fail/skip,34.368s; suite11/11,25.008s. The current watchdog cases are teardown and SIGKILL, while plain SIGTERM/SIGINT modes create no live remote watchdog; therefore the green run does not cover the flagged combination. Claimed typecheck/shard/diff checks green; five serial whole-file repetitions for all direct/indirect remote-fixture users, lifecycle and suite are still in progress. No full task verification yet. New source review required after correction.

Read task file for criteria/body under current T-548 guidance; no task.view scan. No Reviewer tests, compiler/binary execution, edits, signals, installs, merges or provider actions. No per-item QA.

Structured finding: [{"severity":"medium","file":"hub/test/remote-fixture.ts","line":23,"text":"Detached-writer cleanup is ordinary-teardown-only; SIGTERM/SIGINT removes roots through generic signal cleanup before detached watchdog exit is observed."}].

Review artifact A-3516 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3516-t-500-source-not-clear-signal-cleanup-removes-roots-before-watchdog-stop.md.

Criteria: C1 failed (SIGTERM/SIGINT generic signal cleanup removes registered roots before detached fixture watchdogs are discovered and observed stopped.).

### rev-30 · 2026-10-16T01:05:45.833Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-source-correction
commit: 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9
scope: delta

Corrected source review T-500 clear at 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9, direct parent bc560070a3a11a79ec9590106aa17ec737d32124. Standards: no findings. Spec: no remaining high, medium or low findings. A-3516 medium signal-cleanup finding is resolved.

The entire corrective delta is test-only process-cleanup.ts plus lifecycle/parent fixtures. beforeDirectories now wraps each writer-stop callback in a memoized promise and registers that same wrapper for both ordinary hub cleanup and SIGTERM/SIGINT cleanup. Signal handler awaits registered callbacks before its directory-rm loop; ordinary teardown still orders client resources, hub/writer cleanup, directories and final checks. A completed context unregisters its signal callback in checks, including after earlier cleanup failures. Memoization joins concurrent teardown/signal attempts and preserves a failed cleanup result rather than running a second cleanup against removed resources. installSignals is ensured at registration. The original IPC guardian and directory/PID ownership proof remain unchanged; no production watchdog source modification.

Regression now includes live-watchdog SIGTERM and SIGINT owner modes. Those fixtures set watchdog poll to60s, preventing missing-lease exit from masking a failure to actively stop it. The observer owns emergency cleanup only after assertions, and retains bounded owner, hub, watchdog/guardian, then directory observations. Production independence is still explicitly checked by stopping the hub while its watchdog remains alive until fixture teardown. A-3524 raw receipt: before correction new watchdog-SIGTERM fails the10s watchdog/guardian-exit bound; corrected whole lifecycle12/12, zero failures/skips/cancellations,37.125s, including watchdog-SIGTERM4.255s and SIGINT4.025s. No new duration allowance is needed for those measured cases. Existing targeted SIGKILL reproduction and suite pass remain historical support from A-3497/A-3513.

C1 source and targeted lifecycle proof verified: ordinary, timeout, explicit exit, SIGTERM/SIGINT/SIGKILL and file-polling owner/directory-loss paths are covered with bounded observations; both ordinary and signal deletion now await writer-stop cleanup. C3 verified by unchanged production code plus live-watchdog teardown/abrupt-owner cases and its independence assertion. No claim that production watchdogs die merely because the hub dies. Immutable delta whitespace check clear; implementer reports typecheck/shard lint green.

C2 remains pending five serial whole-file passes at the final reviewed source for all required direct/indirect remote-fixture users, lifecycle and suite, followed by required actual Linux task verification. Source clear is not final gate or merge readiness. Continue Coordinator's evidence/admission sequence; changed head needs source review. No per-item QA. No task.view scan under current T-548 guidance. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3526 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3526-t-500-corrected-source-clear-at-2c7b97ee-shared-signal-writer-cleanup.md.

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-16T01:25:54.134Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-manifest-delta
commit: 2c0daf88c0357f8ee90174cb0220106f40afbe1c
scope: delta

Delta source review T-500 clear at 2c0daf88c0357f8ee90174cb0220106f40afbe1c, direct parent/source-reviewed 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e plus exactly4 unchanged task allowance entries, sorted within allow. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. Extra allowance values match the old reviewed head exactly. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

Fixture/signal cleanup source A-3526 and12/12 corrected lifecycle proof remain unchanged. Four extras are exactly the previously reviewed owner exit, timeout, watchdog-SIGKILL and watchdog-teardown allowances, with original values/reasons. C2 five-file sequences/required full task evidence remain pending; earlier Linux e7ab10bc is not a completed current-head gate claim here.

Only source-established criteria C1,C3 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3560 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3560-t-500-shared-manifest-delta-clear-at-2c0daf88.md.

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-16T01:29:31.092Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-manifest-delta
commit: 2c0daf88c0357f8ee90174cb0220106f40afbe1c
scope: delta

Delta source review T-500 clear at 2c0daf88c0357f8ee90174cb0220106f40afbe1c, direct parent/source-reviewed 2c7b97ee241c0061fcda14a589a70b46e7a4fbf9. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e plus exactly4 unchanged task allowance entries, sorted within allow. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. Extra allowance values match the old reviewed head exactly. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

Fixture/signal cleanup source A-3526 and12/12 corrected lifecycle proof remain unchanged. Four extras are exactly the previously reviewed owner exit, timeout, watchdog-SIGKILL and watchdog-teardown allowances, with original values/reasons. C2 five-file sequences/required full task evidence remain pending; earlier Linux e7ab10bc is not a completed current-head gate claim here.

Only source-established criteria C1,C3 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Artifact A-3560: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3560-t-500-shared-manifest-delta-clear-at-2c0daf88.md
Single transport retry after implementer's root-file check confirmed the first write absent, and after the two-minute cooldown.

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-16T02:46:50.596Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-final
commit: 2c0daf88c0357f8ee90174cb0220106f40afbe1c
scope: evidence

Final evidence review T-500 clear at unchanged pushed/source-reviewed2c0daf88c0357f8ee90174cb0220106f40afbe1c. Standards/Spec: no new findings. C1/C3 source correction A-3526 and exact shared-manifest delta A-3560 remain current; origin branch ref independently confirms this head.

Mac C2 audit: read A-3615 README/receipts and programmatically parsed all55 raw whole-file logs. Every file has tests=pass, fail0/cancel0/skip0:680/680 total. Eleven files each appear exactly5 times: process-cleanup27, executor-run21, executor-safety20, suite-close7, suite-close-recovery5, suite-remote-budget13, verification-workers4, demo7, heartbeat9, suite11 and remote-fixture-lifecycle12 per run. Lifecycle covers normal, timeout, explicit exit, ownerTERM/INT/KILL, live-watchdog teardown/KILL/TERM/INT, polling child owner loss/directory loss. Five complete12/12 lifecycle runs include the signal paths previously corrected after source review. Serial whole-file admissions and quiet/loaded labels are recorded; first lifecycle receipt uses2c7b97ee, whose only difference from current head is reviewed2149fe33 durations data. Product/test source stayed unchanged throughout the sequence.

Linux A-3586/e7ab10bc-82b2-466b-9868-22e62eec9979 was actual c-8 Linux x64, source head2c7b97ee, workers4. Crucial ordinary summaries independently checked: free38/38/fail0 and machine1826tests/1822pass/4skip/fail0/cancel0 complete at1696047.687ms, before timeout. All12 lifecycle identities have ordinary completions and exact load5/5. Root teardown, SIGKILL and live-watchdog TERM/INT observations therefore have completed Linux evidence. No ordinary assertion or hard duration-budget failure is printed.

Whole run remains exit124 at50m; suite2997.14s, load extra1298.57s, peak14.74. Only inflated stale-manifest load lane continued after the ordinary completion. Some partial/outside load failures exist; late0/5 lines printed after Finished exit124 are not evidence of five independently completed failed assertions. Neovim was never reached. Do not relabel this as whole-suite exit0. The diff contains no nvim paths, though shared process-cleanup imported by nvim caused full selection. Current head differs from Linux source only by exact reviewed baseline refresh plus unchanged own allowances.

Primary Coordinator8a10e27f-0342-4a89-9626-71f84f84a08f explicitly accepts this receipt IF the full ordinary hub phase completed green and no nvim diff exists; both conditions checked. Primary d4491e24-f7b5-4750-8d14-43934a26b07d directs final review on accepted A-3586 plus completed Mac proof, no replacement/head change. It also requires recording loaded timing observations without new allowances: lifecycle63.320s beside a local suite, signal cases7.725/6.938s, versus quiet36.8–38.9s. These are preserved as contention observations, not silently removed or converted into looser shared budgets.

C2 now verified; C1/C3 reverified/current through unchanged source chain. All task criteria established under the explicit gate disposition. No further run/edit/shared pick or per-item QA requested. Reviewer performed no tests/compiler/binary execution, edits, installs, signals, commits, merges, provider actions, task.view scan or subagents.

Review artifact A-3616 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3616-t-500-final-evidence-clear-55-mac-files-and-accepted-ordinary-linux-completion.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-16T02:50:33.335Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-500-merge-final
commit: 65cedd22d3f54491b0bd3cd81b8d6911c10ee376
scope: delta

Merge-only delta review T-500 clear at pushed65cedd22d3f54491b0bd3cd81b8d6911c10ee376. Standards/Spec: no high, medium or low findings. This refreshes final criteria under Coordinator's explicit no-new-run disposition; it does not claim new execution at the merged head.

Primary ca88c02f-6cec-41f6-ac90-9639d0b55efc read in topic-343 authorizes fresh origin/dev merge following durations.json-only merge-gate conflict, preservation of dev baseline/own allowances, shard lint and limited delta review. It explicitly waives a new suite/Mac proof because task test files are unchanged.

Immutable history: merge705ee78f212e451e0379fc52728dbfad67b721f3 has parents accepted task2c0daf88c0357f8ee90174cb0220106f40afbe1c and dev89a1ba8c590226217800ffa1c29eddf5b106ec37. Follow-ups fe79c4e1 and65cedd22 change durations.json only to remove serialization formatting/key-order churn. Final origin ref equals requested SHA. Independent git diff --check passes.

Strict JSON parse rejects duplicate keys. Root keys exactly version/source/budget/files/tests/allow. All five non-allow fields match dev parent exactly. Every one of231 dev allowance entries has identical value/reason in final; no drops or common-value changes. Final235 entries add exactly four prior T-500 allowances, byte-value/reason identical to accepted task head: owner exit5.678, actual10s timeout11.127, watchdog-SIGKILL8.386, watchdog-teardown11.125. The complete textual diff against dev manifest is exactly16 added lines for these four entries; no escaped Unicode, key ordering or numerical-format churn remains. This preserves dev's T-505/T-517/T-559 additions as requested.

shards.json diff against dev is solely the existing remote-fixture-lifecycle.test.ts machine entry, retaining dev's full roster. Direct comparison against accepted task head shows zero changes in process-cleanup.ts, fixture-guard.ts, remote-fixture.ts, remote-fixture-parent.ts, remote-fixture-lifecycle.test.ts, file-barrier.ts or suite.test.ts. Thus the task's ownership/signal cleanup and regression assertions are untouched by resolution. Shard lint reported green; Reviewer did not run it.

Retain A-3616 final assessment and its explicit limitations: A-3615 all55 whole-file Mac receipts/680passes; accepted A-3586 full ordinary Linux hub complete green and all12 own lifecycle identities ordinary+5/5. Overall run was124 after stale load lane timeout and no Neovim phase; this remains historical accepted evidence, carried across this authorized merge under ca88c02f, not relabelled new-head exit0. Loaded timings remain observations and no further allowances were added. No additional test source, product fix, suite, Mac proof or per-item QA required for this delta.

C1/C2/C3 refreshed at65cedd22 under unchanged task source plus explicit evidence waiver. T-500 ready for Coordinator's normal merge gate. No Reviewer edits/tests/compiler/binary execution, installs, signals, commits, merges, provider actions, task.view journal scan or subagents.

Review artifact A-3622 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3622-t-500-final-merge-delta-clear-at-65cedd22.md

Criteria: C1 verified, C2 verified, C3 verified.
