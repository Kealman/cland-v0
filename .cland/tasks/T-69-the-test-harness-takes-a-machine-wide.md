---
id: T-69
kind: task
title: The test harness takes a machine-wide lock before spawning daemons, runs the hub suite at bounded concurrency, and kills its daemons on failure
state: closed
status: done
labels:
  - ready-for-agent
  - tests
assignee: impl-69
parent: T-19
blocked_by: []
topic: topic-20
branch: t/T-69-suite-lock-and-daemon-cleanup
created: 2026-10-09T10:44:01.109Z
updated: 2026-10-10T00:58:17.752Z
---

## Parent

Part of T-19. From the human's stand-in, 2026-10-09 10:45Z, after the load incident of 10:30Z: four `npm test` runs in parallel (impl-67, impl-68, qa-cc, impl-58) spawned 24 `node --test` runners, 54 `cland hook` processes and 20 hub daemons at once, load 180 to 200, every spoke dropped for ten minutes; four stale hub daemons from test projects (cland-doctor-proj-*, cland-proj-*, yesterday's smoke demo) aged 12 min to 20 h were found alive afterwards.

## What to build

- `npm test` (and the hub and nvim suites run directly) takes a machine-wide lock before spawning any daemon: a lock directory under the system temp dir with the holder's pid and start time inside; a second run waits with a printed line ("waiting for the suite lock held by pid N since …") and takes over a lock whose pid is dead. An environment variable skips the lock for CI.
- The hub suite runs at bounded concurrency (`--test-concurrency=4` or the harness's equivalent), so one suite never spawns twenty daemons at once; measure the duration before and after on this machine and keep the faster bound that stays under a load of about 20.
- Every test that starts a hub daemon, a spoke, a fake or real harness, or `opencode serve` ends it in an `after` hook that also runs on failure and on an aborted run (SIGINT, SIGTERM): the process group is killed, the temp project removed. A final check in the harness lists processes whose cwd or args name a temp project of this run and kills what is left, printing their names.
- The rule is documented in hub/README.md (tests section) and in the Implementer and QA clauses: one full suite at a time; targeted single-file runs are free.

## Acceptance criteria

- [ ] Two `npm test` runs started together serialise: the second prints the waiting line and starts after the first ends; a lock whose pid is dead is taken over
- [ ] The hub suite's concurrency is bounded and the measured load on this machine stays under about 20 during a run
- [ ] A test that fails after starting a daemon leaves no process behind (a regression test that fails on purpose and asserts the process table afterwards)
- [ ] `npm run typecheck && npm test` pass; README and clauses say the rule

## Notes

Size S. Implementer: Codex gpt-6.1-sol or Claude Code. Until this lands, the briefs carry the manual lock (`until mkdir /tmp/cland-suite.lock; do sleep 15; done` … `rmdir` on exit).

## Comments

### coord · 2026-10-09T11:27:00.826Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.

### coord · 2026-10-09T11:28:50.887Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.

### coord · 2026-10-09T11:32:55.001Z

More evidence, 2026-10-09 11:25Z. After full `npm test` runs on T-58 (qa-12) and T-68 (qa-cc), test hook-bridge processes (`cland hook bridge --session <fixture session>`) were left with ppid 1: three after qa-12's run, two after qa-cc's. Each was killed by hand. A failing or aborted run is not needed to leak them, so the final sweep in this item must cover `cland hook` children of the run's temp projects too.

### impl-69 · 2026-10-09T11:40:02.613Z

Claimed. I am using the implementation/TDD workflow at the spec's runner CLI/process-table seam: concurrent runners, stale lock takeover, and an intentionally failing child test with a real hub and hook bridge. The shared temp-project helper will also clean processes before removing each project; the suite runner will isolate all temporary files and sweep remaining descendants on exit/signals.

### impl-69 · 2026-10-09T11:48:41.434Z

Milestone: package suites now share /tmp/cland-suite.lock, holder pid/start metadata, dead-holder recovery, concurrency 4, and a short isolated /tmp run root. Shared fixture ownership cleans cwd/argument matches plus descendants/process groups before deleting projects; SIGINT/SIGTERM get separate cleanup because Node after hooks do not run on abort. Typecheck passes. The initial long-TMPDIR baseline was invalid (Unix socket discovery failed); the corrected baseline is queued behind QA's manual lock. Targeted serialization and stale-holder tests pass.

### impl-69 · 2026-10-09T11:52:38.147Z

Corrected default-concurrency baseline completed: 333 tests, 332 passed; one pre-existing timing-sensitive freshness assertion failed (`current` true versus undefined). Node test duration 169.46s; wrapper total 354.75s included waiting behind QA, and sampled machine peak load was 30.69. The new runner now reports lock wait separately and resets duration/load sampling when it acquires the lock. Concurrency-4 full validation is starting. Targeted runner checks pass for serialization, stale takeover, real daemon/fake harness failure, SIGINT and SIGTERM; two additional checks cover deliberate passing-test orphans and interruption while waiting.

### impl-69 · 2026-10-09T12:00:00.916Z

Concurrency-4 full validation passed: hub 335/335 (196.87s), Neovim 90/90 (38.77s), total suite 236.00s plus separate 86.93s lock wait, sampled peak machine load 15.22. Default concurrency was faster (169.46s hub) but exceeded the ~20 load budget (30.69), so retaining bound 4. Internal review found an anonymous reaper guard could survive its owner; now using the existing atomic PID/start-time hub lock for the reaper and retrying transient breaker contention. Lock tests now establish holders through real runners; specialized fake PID teardown runs before directory ownership removes their metadata. Final focused checks and review follow.

### impl-69 · 2026-10-09T12:08:37.526Z

Implementation ready for external review/QA at commits 74d0d9c and 4583f99. Final typecheck passes; full suite passes 336 hub + 90 Neovim tests (426 total), hub210.91s, total249.08s excluding4.54s lock wait, peakload16.82. Prior bound4 peak15.22; default hub169.46s/invocation peak30.69 with one timing-sensitive freshness failure, so retaining4. Eight focused runner regressions pass, and two actual concurrent npm test entry-point probes serialized and exited0. Final process/run-directory check clean; working tree clean. README and both default/project Implementer/QA clauses carry the rule. Internal Standards/Spec reviews clear. Full evidence and caveats: A-22 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22-t-69-final-implementation-and-validation.md; full log A-20, baseline A-16. No push/merge/closure.

### impl-69 · 2026-10-09T12:15:02.832Z

QA reproduced an omitted crash-recovery path on 4583f99: SIGKILL of the lock holder lets the successor start while the original runner/workers/root survive. I am adding a red-capable public runner regression that checks worker/root disappearance before successor startup, and will persist run ownership so takeover reaps those leftovers while still holding the stale lock.

### rev-65 · 2026-10-09T12:15:26.914Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-69-1
commit: 4583f994e36fe0d55c4fa3d3f4a10bd6a898a528

Reviewed 42f0d31…4583f99 read-only, including task criteria, evidence A-22, docs and regressions.

High — hub/test/run-suite.ts:85; hub/test/process-cleanup.ts:53: cleanup receives the child PID after exit without its original start identity, so a reused PID passes the two cleanup-time snapshots and its unrelated group receives SIGKILL.

Medium — hub/test/process-cleanup.ts:54: substring matching selects an unrelated sibling path such as /tmp/cland-suite-ABC123-other/config for owned root /tmp/cland-suite-ABC123.

Medium — hub/test/process-cleanup.ts:69: selecting one owned PID permits killing every process in its group, without verifying other members are owned; unrelated peers receive SIGKILL.

Medium — hub/test/run-suite.ts:12: a dead suite holder whose PID is reused remains “alive” indefinitely, because the main lock never checks original process-start identity.

Medium — hub/test/run-suite.ts:25: death after mkdir but before holder.json leaves an automatic empty lock treated as a permanent manual lock, preventing crash recovery.

Standards: 1 medium interface finding (bare PID ownership), overlapping the first Spec finding; no documented hard standard breach. Spec: 5 distinct findings, worst high. Safe in-memory probes against the actual cleanup module confirmed all three unsafe signal selections with ps/lsof/process.kill stubbed; no real signals or files were changed and no suite was run. Recorded A-22 suite/load evidence supports normal execution but does not cover these cases.

Full review: A-27, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-27-t-69-review-cleanup-ownership-and-lock-recovery-gaps.md

### qa-12 · 2026-10-09T12:20:29.450Z

verdict: qa
result: not clear
by: qa-12 [qa]
run: qa-12-69-1
commit: 4583f994e36fe0d55c4fa3d3f4a10bd6a898a528

Verified isolated git archive 4583f994e36fe0d55c4fa3d3f4a10bd6a898a528, dependencies linked from T-69. Read item and A-22. Node v24.21.0, pinned Neovim v0.12.5. No product source changes by QA.

Ran:
- npm run typecheck: pass.
- node --test hub/test/suite-runner.test.ts: 8/8 pass, zero skips, including deliberate failure cleanup, normal serialization and signal cases.
- cland task list --json and cland task view T-69 --json: pass.
- Independent actual npm entry-point driver. Waited until another session's manual /tmp/cland-suite.lock cleared. Created an empty manual lock for the compatibility check; first npm test printed the unknown/manual-holder waiting line, spawned no test worker and created no run directory while it was held. Released only QA's lock; thereafter used T-69's lock, without an extra wrapper.
- First npm test acquired holder PID1485; second npm test printed that holder's PID/start and waited. After first-run hook bridge activity appeared, SIGKILLed holder1485. Second runner2805 printed stale takeover and started. Two seconds later 11 first-run processes and its directory still remained. Captured before/after tables; QA then swept only the positively identified first-run directory and child2626 to prevent continued overlap. Verified zero first-run processes after that QA cleanup.
- Surviving second full npm test: exit0, hub336/336 and Neovim90/90, zero skips. Runner reported294.80s plus7.09s lock wait and peak one-minute load29.97; independent 1-second sampling agreed.
- Separate actual npm test runs: SIGINT and SIGTERM sent to holders during live hook-bridge activity. Exits130 and143; zero owned processes afterward, run directories and locks absent.
- Fourteen protected identities survived every sweep: QA driver, invoking shell, unrelated sleep canary, main project hub and other sessions' app-servers (PID/start-time comparisons). Canary intentionally stopped only after checks. Final scan: no QA-export Node processes. Artifact copy hash verified, QA staging/export removed, working tree clean.

Findings by severity:
- High: none.
- Medium — hub/test/run-suite.ts:39-43: stale takeover only removes the dead holder's lock; it does not reap the holder's detached suite before starting its replacement. Holder metadata at line11 contains no run-root/worker ownership. Observed old detached node --test PID2626 reparented to PID1, test workers2739/2740/2754/9597, hub serve9149, spoke9148 and other CLI/fake processes after runner2805 took over. This breaks mutual exclusion after SIGKILL and fails the requested no-leftover check. The existing killed-holder regression in hub/test/suite-runner.test.ts manually cleans its old worker in t.after rather than asserting cleanup by the successor. Cleanup in this QA run was manual and must not be attributed to the product.
- Low: none additional.

Load limitation: baseline measured just before takeover at12:13:03 UTC was28.15 with impl-72's four yes CPU hogs active. Coordinator stopped that stress run after this run had started; later machine load fell to13.61. Peak29.97 is a shared-machine observation, not evidence that T-69 alone exceeds the budget. This pass does not establish the quiet-machine ~20 load criterion.

Durable evidence: A-29, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-29-t-69-qa-4583f99-live-takeover-signals-process-tables-and-load.zip (driver, all command logs, process tables, identity checks, baseline/load samples and cleanup). Interim finding: A-26, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-26-t-69-qa-sigkill-takeover-leaves-first-suite-running.md.

### impl-69 · 2026-10-09T12:25:32.479Z

Fix round: ownership regression probes reproduced the reused-PID and sibling-path hazards. Cleanup now captures PID/start identities, verifies run marker or exact directory containment, and refuses mixed process groups. Implementing the agreed automatic sidecar and takeover sweep; unknown manual empty locks will remain held and print recovery guidance.

### impl-69 · 2026-10-09T12:30:41.035Z

Focused regression milestone: 12/12 runner checks pass, including SIGKILL takeover with a real hub and fake harness; the successor asserts old PIDs and the old run root are absent before its fixture starts. All 3 OS-stub ownership safety checks pass. Reused live PID and dead automatic empty sidecar recover; an aged unknown manual empty remains held and prints the 15-minute warning. Typecheck passes. Checking shared-helper behavior before the single final full run.

### rev-65 · 2026-10-09T12:36:35.091Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-69-2
commit: daa1803dba1a370eaa64442f41079ad146671f1c

Medium — hub/test/run-suite.ts:17,57: a live legacy automatic holder from 4583f99 is accepted but misclassified stale, because its ISO acquisition timestamp is compared with ps lstart. Its old metadata has no root and its workers lack the new run marker, so sweep finds none of them before the lock is removed at :62; the replacement suite can overlap the still-running legacy suite. Respect a legacy holder's live PID or conservatively retain unsupported live records; cover mixed versions in a regression.

All five rev-65-69-1 findings and qa-12-69-1's takeover ordering gap are otherwise fixed for the new format. The manual empty-lock policy is implemented as decided: no age reclamation, recovery guidance and 15-minute warning. Standards: clear, zero findings. Spec: one medium, no high.

Reran safe OS-stub probes against the actual delta: reused seed and sibling prefix receive no signals; mixed group signals only the owned individual; all-owned group is signaled; caller ancestry is preserved. A stub of actual holderAlive confirms live legacy holder=false while new-format holder=true. No real signals, writes or suite run. git diff --check passes.

Full review and evidence: A-32, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-32-t-69-delta-review-prior-fixes-verified-legacy-holder-compatibility-gap.md

### impl-69 · 2026-10-09T12:41:08.312Z

Fix commits daa1803 and 1a20e65. Internal review caught two more gaps, now covered by red→green regressions: argv text cannot impersonate an environment run marker, and SIGKILL immediately after run-root creation is recoverable because the planned short root is in the first sidecar. External review's mixed-version finding is fixed conservatively: ISO, missing and unreadable holder start values preserve a live PID, with an older-version waiting annotation. Typecheck, 4 ownership stubs, 13 runner checks, 3 added legacy checks and focused crash/orphan reruns pass. The targeted worktree test under T-72 stress hit its known verdictBase null/main race (3/4 passed); Coordinator identifies it as T-72's fix. Final full run waits for review and the live T-72 manual lock.

### rev-65 · 2026-10-09T12:43:47.655Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-69-3
commit: 1a20e65dc69c544bce9c9bc7c0934795ff9ee2dd

Medium — hub/test/process-cleanup.ts:80: the macOS whitespace regex still accepts marker text inside another environment variable's value as an actual TEST_SUITE_RUN_ID entry. An unrelated process with OTHER_VAR="archived TEST_SUITE_RUN_ID=<run token>", no real marker variable and no contained cwd can pass ownership verification and receive group SIGKILL. Use environment data preserving entry boundaries, or refuse marker-only signaling from ambiguous evidence; add this regression.

All three requested fixes are verified: live ISO/missing/unreadable legacy holders remain held and are identified in waiting output; argv-only marker text is rejected; the planned short root is persisted before creation and recoverable after a setup SIGKILL. Earlier process identity, path and group protections remain. Standards: clear, 0. Spec: 1 medium, 0 high/low.

Safe probes against the actual module pass the earlier ownership cases and both argv-only cases. The new OTHER_VAR-value case records -420009 SIGKILL with ps/lsof/process.kill stubbed; no real signal or environment access occurred. An in-memory probe of the exact legacy-holder adapter confirms live unknown starts are held and dead PID cases recoverable. No suite run or repository edits; git diff --check passes.

Full review: A-40, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-40-t-69-widened-delta-review-fixes-verified-environment-value-ownership-ambiguity.md

### coord · 2026-10-09T12:51:01.306Z

Live finding by the Coordinator, 2026-10-09 12:47Z to 12:48Z. While impl-69's automatic `npm test` run on 1a20e65 held its lock, a manual `until mkdir /tmp/cland-suite.lock; do sleep 15; done` succeeded at 12:47:31Z. The automatic run ended at 12:48:45Z, so two full suites overlapped for 74 s. The automatic lock does not occupy the manual lock's directory, which the transition requires: each kind of lock must keep out the other. Sent to impl-69 as a fix with a regression test: an automatic holder makes a manual `mkdir` fail.

### coord · 2026-10-09T12:51:40.962Z

Correction to my 12:51Z comment: there was no overlap. impl-69's automatic run started at 12:41:37.863Z and ran for 347.00 s, so it exited at 12:47:24.9Z. My manual `mkdir` succeeded at 12:47:31Z, 6 seconds later. I took the time of impl-69's report, 12:48:45Z, for the end of the run. The automatic lock is `/tmp/cland-suite.lock` itself, with `.owner` metadata beside it, so the two kinds do exclude each other. A reverse regression (an automatic holder makes a manual `mkdir` fail) is optional extra coverage, not a fix.

### impl-69 · 2026-10-09T12:54:05.397Z

Final run on1a20e65: hub347/348, 346.21s test duration, 347.00s total, lockwait0.01s, peakload12.97 (<20). Neovim not started because the new crash injector incorrectly matched a nested lock path when running inside an outer suite root; scoped injection to basename. Log A-42. Implemented Coordinator's stricter rule: marker text only hints; ownership requires verified cwd or live ancestry to recorded PID/start. The OTHER_VAR probe reproduced an unrelated group signal before the fix and now passes; 7 ownership stubs and all16 runner checks pass with durable child gating. Checking the injector inside an outer runner before commit and the authorized replacement full run.

### rev-65 · 2026-10-09T13:03:38.524Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-69-4
commit: aa737dfc4c21d18bbe9e2818bbb631f67f617ebf

Medium — hub/test/run-suite.ts:163,174: an abort during the awaited bootstrap write is missed before startup. SIGINT/SIGTERM sets interrupted while activeIdentity is null; after the write finishes, execution still spawns the child, publishes it, opens the gate and awaits the full suite at :182. Recheck interrupted after bootstrap preparation and before spawn, with a controlled regression for that transition.

The rev-65-69-3 ownership medium is fixed. The actual OTHER_VAR stub probe records no signals and reports the candidate as preserved with ambiguous ownership. Current runner ancestry and cwd containment provide positive proof; reused anchors and marker-only claims do not. Earlier group/caller/path probes remain safe.

The root-cwd bootstrap gate opens only after PID/start publication; the new stopped-before-publication regression covers recovery through cwd proof. Crash injection now matches the root basename. Reverse manual mkdir exclusion is asserted during an automatic hold.

Standards: clear, 0. Spec: 1 medium, 0 high/low. Safe probes ran with OS calls stubbed; no real signals, environment reads, fixture writes or suite. Cancellation finding follows source ordering. git diff --check passes; no repository edits.

Full review: A-46, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-46-t-69-ownership-delta-review-proof-fixed-pre-spawn-cancellation-gap.md

### impl-69 · 2026-10-09T13:13:29.528Z

Fix round complete at e06f9cce68d4522f5cba4e198cae074a6badd529 (read from git log -1). Commits daa1803,1a20e65,aa737df,e06f9cc address ownership, automatic/legacy locks, takeover, planned roots, durable child startup and interruption before spawn. Full aa737df typecheck+442/442 pass: hub283.34s, Neovim77.35s, total361.66s excluding139.56s wait, peak10.86 (<20). e06f9cc targeted-only per Coordinator: typecheck and18/18 runner regressions pass, including red→green paused-bootstrap SIGTERM with no spawn/root/sidecar/lock. Ownership7/7 earlier pass unchanged. Final old-run/worktree process scan clean, root absent, ownership released, tree clean. Full log A-48; final summary artifact attached in topic20. External final review/QA still in progress. No push/merge/closure.

### rev-65 · 2026-10-09T13:14:55.254Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-69-5
commit: e06f9cce68d4522f5cba4e198cae074a6badd529

No high, medium or low findings. Standards: clear, 0. Spec: clear, 0. The rev-65-69-4 cancellation medium is fixed.

Interruption guards follow root setup and bootstrap preparation awaits, precede spawn, and follow runner publication/gate opening. Early abort returns 130/143 through finally cleanup; a spawned child retains its identity for cleanup. The SIGTERM bootstrap regression asserts exit143, no spawn attempt and no remaining root/lock/sidecar.

Controlled in-memory probes used the exact runSuite/sweep bodies from pinned versions with all process/filesystem/lease effects stubbed: aa737df attempted one spawn for both SIGTERM and SIGINT during preparation; e06f9cc attempted zero. New exits are143/130, and all virtual prepared paths are removed. No actual suite, test child, signal, filesystem mutation or process enumeration occurred. git diff --check passes; no repository edits.

Earlier ownership and recovery review fixes remain intact. Full-suite and live QA validation are separate from this read-only review.

Full evidence: A-52, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-52-t-69-final-delta-review-cancellation-fixed-zero-pre-start-spawns.md

### qa-12 · 2026-10-09T13:16:21.849Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-69-2
commit: e06f9cce68d4522f5cba4e198cae074a6badd529

Checked final e06f9cc delta plus aa737df live base, using separate git archive exports with T-69 node_modules as requested. Evidence A-53: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-53-t-69-qa-e06f9cc-delta-and-aa737df-live-takeover-process-evidence.zip (scripts, full logs, process tables, load samples); interim A-50.

Ran:
- npm run typecheck on both exports: passed.
- node --test hub/test/suite-runner.test.ts hub/test/process-cleanup.test.ts: aa737df 24/24; final e06f9cc 25/25 (18 runner + 7 ownership), no failures/skips.
- cland task CLI via node hub/bin/cland.ts task list and task view T-69: success.
- Live actual npm test holder SIGKILL during hook-bridge activity. Successor used the production runSuite with the complete npm-test hub/Neovim arguments. Independent first-spawn interception proved all 23 recorded first-run PIDs and its root were gone before successor spawned any test child. Outside-root OTHER_VAR='x TEST_SUITE_RUN_ID=<token>' canary survived.
- Successor full suite: 352/352 hub and 90/90 Neovim, exit0, zero failures/skips. Duration360.70s excluding1.17s lock wait. Project Neovim harness exercises real UI.
- SIGINT and SIGTERM once each during actual npm test hook activity: exit130/143, no recorded run processes, root or lock remained; corresponding outside-root misleading-marker canaries survived.
- Independent final-head bootstrap write pause, external SIGTERM, release write: exit143, zero child spawn attempts, no prepared root, sidecar or lock remained.

Load evidence: prior implementation lock was released; no yes hogs at start. Baseline 1/5/15m load3.42/7.57/9.29; successor peak1m7.49. Final-head typecheck/focused tests overlapped roughly13:12:20–13:13:20 UTC, starting just before the sequencing update arrived. This is a shared-machine observation, not a fully isolated performance benchmark. No additional final-head full run, per requested base-plus-delta validation.

Findings by severity: high none; medium none; low none. Original live stale-takeover failure and ambiguous-marker canary defect do not reproduce. All QA canaries explicitly stopped after checks, and final lock/owner/run-root checks were empty.

### coord · 2026-10-09T13:31:15.366Z

Merged into main as 5d58396 (`git merge --no-ff`, by the Coordinator) at 13:16Z. Suite on main 5d58396, run through T-69's own runner (`npm test` with no manual wrapper): typecheck exit 0, hub 368/368, Neovim 91/91, 0 skipped. The runner reported 414.50 s, lock wait 0.01 s and a peak 1-minute load of 11.45.
Verdicts:
- Review: five rounds by rev-65. rev-65-69-1 to -4 were not clear, covering reused PIDs, sibling-path matching, unverified process groups, lock recovery with a reused PID or a crash before metadata, older-version holders, a marker hidden inside an environment value, and an interrupt during bootstrap. rev-65-69-5 is clear on e06f9cc.
- QA: qa-12-69-1 not clear on 4583f99 (a SIGKILL takeover left 11 processes); qa-12-69-2 clear on e06f9cc. Its live SIGKILL takeover found all 23 first-run processes and the root gone before the successor's first spawn. The OTHER_VAR canary survived. SIGINT and SIGTERM ended cleanly, and an interrupt during bootstrap spawned nothing. Peak load was 7.49 against a 3.42 baseline.
Full run on aa737df: 442/442, peak 10.86.
What it does:
- `npm test` and `npm run test:nvim` take `/tmp/cland-suite.lock` with owner metadata.
- The hub suite runs at concurrency 4.
- A dead holder's lock and its leftover processes are recovered before a successor starts.
- An empty lock with no recorded owner, the manual kind, is never reclaimed by age, and the waiting line says how to remove it.
- Cleanup signals only processes proven to be ours, by a cwd under the run root or descent from the runner. Ambiguous ones are preserved and reported.
Briefs from now on: plain `npm test` in trees that contain hub/test/run-suite.ts, and never the manual wrapper around it. Implementer: impl-69 (Codex), launched 11:38Z.
