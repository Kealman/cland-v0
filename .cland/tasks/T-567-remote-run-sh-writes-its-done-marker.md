---
id: T-567
kind: task
title: Remote run.sh writes its done marker before the timestamp, so a poll can read code 0 with an empty finished time and the run never enters the cache
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - executor
  - v0.1.3
assignee: null
parent: E-425
blocked_by: []
topic: topic-355
branch: t/T-567-remote-run-sh-writes-its-done-marker
created: 2026-10-16T03:27:02.619Z
updated: 2026-10-16T04:44:31.072Z
---

## Summary
Found by impl-562 on 2026-10-16 (evidence A-3644), reproducible on dev 58696d94 and on T-562's 0f42e138. The droplet's run.sh creates `done` with `date >done`, so the file exists before the timestamp is written. A status poll in that window reads done with code 0 and finished ''. DropletRun.status then reports the run (reported=true) but leaves job.finished unset, and `#cached` rejects the run that just completed. That is the cause of T-562's Linux failure at verification-workers.test.ts:73 (`cached.cached?.run` undefined). Holding the fake machine's `date` reproduces it in about 8 s.

## Acceptance criteria
- [x] C1. run.sh writes the done marker atomically (write to a temporary file, then rename), and DropletRun.status treats a done marker without a finished time as still running instead of finished.
  - done: impl-567 · 2026-10-16T04:14:35.652Z
  - verified: rev-30 [reviewer] · run rev-20261016-567-source · 2026-10-16T04:15:30.851Z · commit a0a568b5762e054512efb4fae2bfc1fe736cd63e
  - verified: rev-30 [reviewer] · run rev-20261016-567-final · 2026-10-16T04:44:30.566Z · commit 6b6ed172243c1baa50714a599f30f953e960dd50
- [x] C2. A test holds the fake machine's date at the done boundary and shows the run is reported only once finished is set, and that a same-head relaunch then hits the cache.
  - done: impl-567 · 2026-10-16T04:14:35.873Z
  - verified: rev-30 [reviewer] · run rev-20261016-567-final · 2026-10-16T04:44:30.567Z · commit 6b6ed172243c1baa50714a599f30f953e960dd50

## Comments

### coord · 2026-10-16T03:47:16.505Z

Second signature of the same race, in T-548's droplet run f4fb4357 (A-3657, lines 4195–4210). verification-workers.test.ts:71 failed with lease costUsd undefined against an expected NaN, because lease.lifetimeMs was absent. That is the assertion two lines above T-562's :73 cache miss, in the same test, right after the same `result()` wait. It fits the same window: the run is reported while `finished` is still empty, so the lease's lifetime and cost aren't settled yet. C2's test should also check that lifetimeMs and costUsd are set when the run is reported.

### impl-567 · 2026-10-16T04:12:06.341Z

Implementing C2 first at the requested verify/report/cache seam with the fake machine date held at completion. Test also covers DropletRun.status on an older empty marker and observes date completion before waiting for the final report; final report must have the timestamp and settled lease cost/lifetime, then same-head launch must reuse it.

### rev-30 · 2026-10-16T04:15:30.851Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-567-source
commit: a0a568b5762e054512efb4fae2bfc1fe736cd63e
scope: full

# T-567 source review clear at a0a568b5

Head a0a568b5762e054512efb4fae2bfc1fe736cd63e; branch t/T-567-remote-run-sh-writes-its-done-marker.
Fixed point 0724d034b515d60577e9f798d7fc7042ab4f6159, pre-review merged dev. One implementation commit a0a568b5; three-file diff only run.sh, run.ts and verification-workers.test.ts. Origin task ref matches. Direct Standards/Spec review; no Reviewer execution.

## Standards
No high, medium or low findings (0).
run.sh:18 follows the existing same-directory temporary-file/rename publication pattern already used for platform metadata at24–25. The writer closes the timestamp output before mv publishes done; unsuccessful date cannot publish it. Exit code and final log precede publication under the existing exclusive shell admission lock. Reader adjustment stays in DropletRun.status at95, with no provider/accounting/cache redesign.
The regression uses the actual delivered shell through the fake-machine boundary and public verify/report/cache interfaces. It holds a specific date milestone rather than sleeping to hope for the race. Release is in finally; downstream report waits start only after the date completion observation, then the renamed final marker is observed separately. Existing fixture ownership cleanup covers shell, watchdog and directories. AGENTS.md, lifecycle rules and docs/agents/tests.md apply; no new smell finding in this narrow change.

## Spec
No findings (0). C1 source-verified: done is published with date >done.tmp && mv done.tmp done, within one directory; status trims a visible done marker and returns running if empty. A nonempty timestamp retains ordinary code/platform completion behavior; pending, missing-group, lifetime, lost-machine and SSH-unreachable paths remain unchanged. This deliberately handles older runners that expose an empty marker rather than reporting partial completion.
C2 regression is implemented at the requested seam but final verification remains pending exact-head actual Linux suite evidence. While date is held, it requires running, no final report and no published final marker. It then temporarily introduces an older empty marker and independently checks running/no report. Thus writer-only and reader-only fixes cannot each satisfy the entire test. After release and marker publication it checks a parseable timestamp, exact job.finished equality, reported success, released lease, finite positive lifetime/cost, same-head cache reuse and exactly one original report.
Coordinator's existing task comment expands C2 to the accounting signature (undefined cost/lifetime as well as cache miss); those assertions are present. No weakened preexisting verification-workers assertions or changes to droplet.ts.

## Evidence and disposition
A-3689 records old-source red at status done versus running (3.855s), corrected whole verification-workers file5/5 (19.238s), new case4.261s, typecheck and whitespace green. This is the Implementer's durable reported targeted evidence, not a claim of Reviewer execution or a substitute Linux suite. Immutable diff whitespace check independently clean.
Source verdict clear, C1 verified. C2 final/runtime mark awaits one fresh exact-head --executor droplet --fresh verification at this SHA. No per-item QA. Changed head requires delta review. Existing proposed project rule951bda5f already says publish completion only after its data is written and reject incomplete reader data; no duplicate proposal is needed.
Totals: Standards0, Spec0 findings. No tests, compiler execution, edits, signals, installs, merges, provider actions or subagents performed by Reviewer.

Artifact A-3690 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3690-t-567-source-clear-atomic-completion-and-held-date-report-cache-proof.md

Criteria: C1 verified.

### rev-30 · 2026-10-16T04:43:07.678Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-567-linux-first
commit: a0a568b5762e054512efb4fae2bfc1fe736cd63e
scope: evidence

# T-567 Linux evidence not clear: owned duration budget

Head a0a568b5762e054512efb4fae2bfc1fe736cd63e, source-clear A-3690. A-3717 /2bb29724-3825-49df-b98e-486dfbfaddfb identifies exact head, actual Linux c-8 lon1, four workers, Nodev24.21.0/Neovimv0.12.5. Overall exit1:1890pass,0ordinaryfail,4platform skips. Hub phases complete; Neovim smoke not reached.

## Standards
Medium M1 — hub/test/verification-workers.test.ts:100 / hub/test/durations.json: the new held-date integration regression passes functionally but requires7.634605s on Linux (raw4266/6121), above the hard5s new-identity budget (6151). Current manifest has no reasoned allowance. This owned task budget must be addressed rather than classified as an outside known flake. Diagnose unnecessary fixture work if present, or record a narrow measured lifecycle allowance without relaxing assertions or moving the identity into baseline tests.
The other hard budgets are shared remote-fixture-lifecycle watchdogTERM6.997s and watchdogINT6.974s. Posted08e88000 and b4fc313b are authorized shared fixes to include if this head changes; do not mistake those hard failures for harmless duration-regression notices.

## Spec
No functional failure of atomic completion is observed. The new C2 case passes ordinarily and5/5 fresh load repetitions (4355), retaining empty-marker running, no early report, valid finished, settled lease lifetime/cost, same-head cache reuse and once-only report assertions. Source C1 stands; final C2/runtime gate remains pending a qualifying corrected-head receipt. No criterion-failure mark is inferred from successful functional assertions.
Final gate is not clear because it exits1 on the owned budget as well as shared budgets. Impl c064b199 already proposes measured allowance plus exact posted shared picks, then delta source review, honoring the active verify hold. Follow that sequence; no unchanged retry or new verify until the Coordinator's explicit restart/lift notice. No dev merge during freeze. The required selected Neovim phase is still absent.
Findings high0,medium1,low0; Standards1medium,Spec0 functional findings. No Reviewer execution, edits, signals, provider actions or subagents.

Artifact A-3718 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3718-t-567-linux-not-clear-functional-proof-5-5-owned-duration-allowance-missing.md

### rev-30 · 2026-10-16T04:44:30.567Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-567-final
commit: 6b6ed172243c1baa50714a599f30f953e960dd50
scope: delta

# T-567 manifest delta and final evidence clear at 6b6ed172

Head6b6ed172243c1baa50714a599f30f953e960dd50; branch t/T-567-remote-run-sh-writes-its-done-marker. Compare source/evidence-revieweda0a568b5762e054512efb4fae2bfc1fe736cd63e. Origin ref matches.
Four commits include exact shared picks709665e1/34ece7ae, owned allowance6c2eba8d and number-format preservation6b6ed172. Net diff is durations.json only,+33lines. No production/test code or dev merge.

## Standards
No remaining high, medium or low findings (0); A-3718 M1 is resolved.
Independent duplicate-rejecting JSON audit confirms final allow equals prior allow plus exactly the two posted shared added-entry sets and one owned C2 entry (eight additions); every other root field and existing allowance is unchanged. Existing number formatting is preserved in the net diff. Own entry7.634605064s cites Linux A-3717, real hub/fake remote held-date lifecycle, reporting/accounting/cache proof and five passing load repetitions. New-test baseline remains absent, preserving load gating. Shared payloads08e88000/b4fc313b remain the posted lifecycle case/file reasons. Whitespace clean; JSON/shard lint reported green.

## Spec
C1/C2 both verified at this head using unchanged source A-3690 and accepted actual Linux A-3717. Raw receipt is at parenta0a568b5, not falsely claimed to run at the new manifest-only head. It exits1 solely on three hard duration-budget lines: own held-date7.634605s, outside watchdogTERM6.997s and watchdogINT6.974s. The reviewed additions cover all three identities; checkDurations treats such reasoned known entries as regression notices rather than new-identity budget failures. There is no functional assertion/load-gate red to waive.
Primary Coordinator bd875a80-daaa-48e3-a3f7-99ddcefe5407, independently read in topic-355, explicitly authorizes the owned allowance plus both picks, accepts A-3717 across this manifest-only change, waives any new droplet and requests final review. This final clearance relies on that explicit disposition, not an invented green rerun.

A-3717 /2bb29724-3825-49df-b98e-486dfbfaddfb: actual Linux x64 6.8.0-142-generic,c-8lon1,Nodev24.21.0,Neovim pinv0.12.5,fourworkers.1894tests/1890pass/0ordinaryfail/4platform skips. Own held-date regression ordinarily7.634605s (4266/6121), five fresh repetitions5/5 (4355). Its unchanged assertions prove no early/empty-marker final report, finished equality, released lease/finite positive lifetime and cost, same-head cache reuse, exactly one original report. Host/remote typecheck and hub phases completed. Neovim smoke did not execute; that missing phase is disclosed and carried by the Coordinator's explicit no-new-run final disposition.
Suite1517.87s,peak1m12.88,loadextra79.33s,lifetime1590s,cost$0.1104. Original final exit1 at6161 is preserved, not rewritten as green. Earlier Mac whole5/5 A-3689 supports unchanged functional source.

Final delta review clear; C1/C2 refreshed. No additional verification required under bd875a80. Active submission/dev freeze and post-restart merge sequence remain Coordinator-owned; no new run or merge performed. No per-item QA. No Reviewer tests, compiler/binary execution, edits, signals, installs, commits, provider operations or subagents. Totals Standards0,Spec0 findings.

Artifact A-3720 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3720-t-567-final-clear-manifest-only-correction-and-explicitly-accepted-linux-receipt.md

Criteria: C1 verified, C2 verified.
