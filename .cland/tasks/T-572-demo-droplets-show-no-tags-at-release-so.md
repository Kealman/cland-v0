---
id: T-572
kind: task
title: Demo droplets show no tags at release, so the hub refuses to delete a live untagged droplet
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - bug
  - hub
  - executor
  - v0.1.3
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-553
topic: topic-357
branch: t/T-572-demo-droplets-show-no-tags-at-release-so
created: 2026-10-16T05:01:37.265Z
updated: 2026-10-16T06:19:07.014Z
---

## Summary
E-423 demo run qa-2026-10-16-27-17 at 3c596742, case D18 (A-3726), on the restarted hub pid 37109, which has T-553. At 05:00:24Z, `cland demo stop E-423` returned exit 0 with the lease in state releasing and "operator attention required; identity mismatch; deletion refused". Lease 375889a3 expected droplet 609583042 named cland-v0-375889a3 with tags [cland, cland-p-8a978a214ba5]. The provider showed the same name and status active, but tags []. Run 16's demo droplet (609578713) hit the same refusal under the old message at 04:35Z and was gone by 04:37Z, cause unknown. No code in hub/src/executor removes tags. So the demo droplets are either created without their tags or lose them, and either way a live cland droplet exists that tag-based reaping can't find and release refuses to delete. That breaks the standing constraint that every cland droplet carries a cland tag and guaranteed destruction. Task-run droplets created tonight do show their tags.

## Acceptance criteria
- [x] C1. Find where a demo droplet's tags go missing (the demo create request, the snapshot or create path, or provider eventual consistency on read) and record the cause with provider request evidence on this item.
  - done: impl-572 · 2026-10-16T05:14:28.518Z
  - verified: rev-30 [reviewer] · run rev-20261016-572-source · 2026-10-16T05:27:14.575Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
  - verified: rev-30 [reviewer] · run rev-20261016-572-final · 2026-10-16T05:56:12.566Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
  - verified: rev-30 [reviewer] · run rev-20261016-572-merge-final · 2026-10-16T06:19:06.085Z · commit 4f83d56911b1d4ecef93cfaa222d0beb8b590e4c
- [x] C2. Every demo droplet carries both cland tags from creation, and a test with the fake provider fails if the demo create path omits them.
  - done: impl-572 · 2026-10-16T05:14:28.827Z
  - verified: rev-30 [reviewer] · run rev-20261016-572-source · 2026-10-16T05:27:14.575Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
  - verified: rev-30 [reviewer] · run rev-20261016-572-final · 2026-10-16T05:56:12.566Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
  - verified: rev-30 [reviewer] · run rev-20261016-572-merge-final · 2026-10-16T06:19:06.085Z · commit 4f83d56911b1d4ecef93cfaa222d0beb8b590e4c
- [x] C3. A droplet whose name and id match its lease but whose tags read empty is still destroyed, or retried until destroyed, with the mismatch logged. A droplet whose name or id differs is still refused.
  - done: impl-572 · 2026-10-16T05:14:29.214Z
  - verified: rev-30 [reviewer] · run rev-20261016-572-final · 2026-10-16T05:56:12.566Z · commit ae48c3611f860ad73201eb757f08cf613a1719aa
  - verified: rev-30 [reviewer] · run rev-20261016-572-merge-final · 2026-10-16T06:19:06.085Z · commit 4f83d56911b1d4ecef93cfaa222d0beb8b590e4c

## Comments

### coord · 2026-10-16T05:01:52.096Z

Stand-in check at 05:03Z: droplet 609583042 returns 404 from DigitalOcean. The account holds only n8n plus the four task droplets, each with both cland tags, so no live untagged droplet is left and the constraint held. The lease record 375889a3 still reads "releasing, watchdog alive, operator attention", a record-only leftover. The likely reading, also logged on T-553: the identity check caught the droplet mid-teardown at the provider, with tags already stripped and status still "active", perhaps because the watchdog or an earlier delete had started it, and called that a mismatch. Run 16 matches: refused at 04:35Z, 404 by 04:37Z. So C1 should first test the provider's teardown state before suspecting the create path. C3's direction: on a tags-only mismatch where id and name match, re-read after a short delay, treat a 404 as released, and clear the lease's attention state.

### impl-572 · 2026-10-16T05:09:36.141Z

C1: fake-provider reproduction A-3727 proves that a prior accepted DELETE followed by GET {same id/name, status: active, tags: []} triggers the reported releasing/attention leftover. The demo POST includes both cland tags. This reproduces the failure from supplied real receipts and supports the teardown-state explanation; without real API access it does not prove why DigitalOcean stripped tags or which actor initiated deletion. Shared cleanup.ts scope approved by Coordinator in topic-357. Local test slot yielded to T-523 at its request; continuing source/test additions meanwhile.

### impl-572 · 2026-10-16T05:15:42.086Z

C1 disposition (Coordinator decision af678989-2b8e-4461-8c99-30c8258d64cc, topic-357): settle on bounded inference from faithful fake reproduction A-3727 and supplied real-provider receipts: A-3726 GET same id/name, active, tags []; stand-in 404 at 05:03Z; run 16's matching sequence. Demo creation has both tags. Which actor strips the tags or initiates deletion is not observed. No dedicated paid live teardown tracing is required. E-423 D18 rerun on a hub containing T-572 is the real check; if it still sticks, reopen C1 with live tracing.

### impl-572 · 2026-10-16T05:26:54.289Z

Local green proof at ae48c361: A-3739 demo-release.test.ts 7/7 pass, 15.94s wall, load 1.875, pgrep clear; includes sanitized provider POST with both tags, GET same id/name active/tags=[], and released demo result. All new cases <2.52s. A-3740 executor-droplet.test.ts 14/14 pass, 12.23s wall, load 2.48, pgrep clear. Tree/head unchanged; source Reviewer has receipts. Mac capacity yielded to T-574. No real provider API calls.

### rev-30 · 2026-10-16T05:27:14.575Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-572-source
commit: ae48c3611f860ad73201eb757f08cf613a1719aa
scope: full

# T-572 source review clear at ae48c361

Head ae48c3611f860ad73201eb757f08cf613a1719aa; branch t/T-572-demo-droplets-show-no-tags-at-release-so. Fixed point frozen dev3c596742; one implementation commit, six changed files. Origin task ref matches. task.view confirms claimant impl-572 and C1–C3. Direct Standards/Spec review; no Reviewer execution.

## Standards
No high, medium or low findings (0).
Shared cleanup.ts is the authorized boundary for hub release and detached watchdog. Per-id GET must match both lease resource id and name; either mismatch immediately refuses before deletion, including archive state. A tags-only mismatch logs then observes for at most min(caller deadline,now+2000ms), with100ms pauses and deadline-limited rereads. A404 returns absence; persistent mismatch refuses. Missing tags never authorize DELETE. Existing tagged name discovery for uncertain creates and key absence confirmation remain.
Hub logs executor-release-identity-recheck with lease/id/attention via existing logger; detached watchdog writes structured watchdog.log in its owned lease directory. Error diagnostics include optional id fields compatibly with older persisted attention. Normal confirmed release/accountRelease clears attention. No destructive fallback is added. Existing deletion-start/archive guard is tightened to retain name equality.
Fake provider adds explicit tags-stripped active teardown and wrong GET-id faults, and advances accepted deletion on per-id GET as well as listing. Tests therefore exercise the new observation loop without relying on a tagged listing to rediscover a tagless resource. No production tags are removed by this patch.

## Spec
C1 verified under primary Coordinator af678989-2b8e-4461-8c99-30c8258d64cc: settle on bounded inference, not unsupported certainty about DigitalOcean internals. A-3726 is the real diagnostic with expected lease tags and observed same-name active/tags=[]; Coordinator stand-in later404 at05:03 and run16's analogous sequence support teardown-in-progress. A-3727 reproduces tagged fake POST, prior accepted DELETE, same-id/name active/tags=[] and old release refusal. The real actor stripping tags and exact provider behavior remain unobserved. No dedicated paid tracing is required; E-423 D18 on the merged/restarted T-572 hub is the real after-stage check, and C1 reopens for live tracing if it still sticks.
C2 source-verified: existing demo acquire builds tags[cland,projectTag] from creation; new fake-provider guard asserts the POST includes both, plus a cland-p-12hex tag. It fails if demo create omits them. No speculative create-path rewrite is needed.
C3 implementation established by source and targeted tests, but final runtime criterion mark awaits fresh exact-head droplet verification. Primary scope decision a49b7fec explicitly requires bounded tag-only observation, strict id/name refusal,404 confirmation and persistent-tagless refusal; source implements exactly this. It does not delete an indefinitely live tagless resource just because its name/id match.

## Evidence audited
A-3739 corrected whole demo-release file7/7,0fail/cancel/skip,15.936s. Prior-delete active/tagless case2.513s with concrete fake POST/GET/release diagnostic, persistent tags2.484s, persistent id1.954s, detached watchdog2.442s, prior delete retry2.139s, archive tags2.098s, foreign name/tags refusal2.061s. State/attention persistently clear after404; no extra DELETE is accepted for tagless state. Watchdog starts expired with10s outer retry interval but receipt required within8s, isolating the shared bounded reread path. Exact worker exit is observed before directory cleanup.
Earlier6/7 A-3732 was only a wrong journal-vs-hub.log assertion; the committed correction uses flushProjectLogs and hub.log, now green in A-3739. Read actual real diagnostic A-3726 and red-reproduction A-3727. Typecheck reported green; immutable whitespace check clean. Related compatibility files are still being checked by Implementer; no unsupported claim they already passed.
Source clear, verify C1/C2. C3/final task gate remains pending exact reviewed-head --executor droplet --fresh receipt. Finish any already-running targeted compatibility check before suite submission; failures require diagnosis/new source review if head changes. No per-item QA brief; E-423 after-stage D18 remains separate Coordinator/QA work. No Reviewer tests, compiler/binary execution, edits, signals, provider calls, commits, merges or subagents.
Totals Standards0,Spec0 findings. Existing rule proposal for preserving identity across teardown is already acknowledged by Coordinator for the human batch.

Artifact A-3741 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3741-t-572-source-clear-bounded-tags-only-rereads-with-strict-ownership-refusal.md

Criteria: C1 verified, C2 verified.

### rev-30 · 2026-10-16T05:56:12.566Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-572-final
commit: ae48c3611f860ad73201eb757f08cf613a1719aa
scope: evidence

# T-572 final evidence clear at ae48c361

Head ae48c3611f860ad73201eb757f08cf613a1719aa; branch t/T-572-demo-droplets-show-no-tags-at-release-so. Origin ref matches exact A-3764 receipt; source A-3741 remains unchanged. No new source findings.

## Standards
No high, medium or low findings (0). Shared cleanup still requires per-id id/name agreement; missing tags only trigger bounded observation and never authorize DELETE. Persistent mismatches retain resources/attention,404 confirmation clears it, hub/watchdog diagnostics are covered. No foreign identity deletion fallback introduced.

## Spec
C3 final runtime verified; C1/C2 refreshed from source and accepted evidence.
Actual Linux task suite A-3764 /586b8df7-8cea-404c-833f-ddcfbc8e39b8: hub-only selected package due shared cleanup infrastructure,1917tests/1913pass/0fail/cancel/4platform skips,exit0. Linux x64 6.8.0-142-generic,c-8lon1 cland-v0-eb377eb6,Nodev24.21.0,Neovimv0.12.5,fourworkers. Hub free38/38, hub machine1863pass/4skip, Neovim smoke12/12. Typechecks and all selected phases complete. Suite1609.42s,peak1m12.98,loadextra232.95s; lifetime/cost unknown as reported. No exception needed; known-entry duration notices are not hard failures.
Own fake-provider behavior inside that actual Linux suite:
- prior accepted DELETE → same-id/name active/tags=[] →404 confirms released4.005s and5/5 fresh repetitions (952/961);
- persistent tags/id mismatches refuse without DELETE, then later404 clears attention3.912/3.376s and5/5 (954–955/1023/1128);
- detached watchdog bounded reread confirms without its10s outer retry4.058s and5/5 (956/1210);
- archived stripped-tag deletion and foreign name/tags refusal pass3.657/3.757s and5/5 (958/963/1270/1314).
Whole demo-release file passes with retained diagnostics, attention/accounting and exact process-exit checks. Earlier quiet Mac A-3739 whole7/7 and A-3740 executor-droplet14/14 support unchanged source. The outer real droplet suite is execution evidence; the controlled deletion assertions are fake-provider regressions, not proof of actual DigitalOcean internal teardown semantics.

C1 settlement remains primary Coordinatoraf678989's bounded inference from A-3726 real diagnostic/Coordinator later404 and run16 sequence plus faithful fake reproduction A-3727. Actual stripping actor/provider internal cause is unobserved. E-423 D18 rerun on the merged/restarted T-572 hub remains the real after-stage validation, and C1 reopens for live tracing if it still sticks. This per-item final verdict does not replace that QA work.
C2 create POST guard still requires both cland and project tags; source acquires them from creation. No speculative create-path change or tagless-deletion permission is inferred.

Final evidence clear; C1–C3 verified at this exact head. No per-item QA brief; container after-stage QA remains. No further suite requested; changed head requires delta review. No Reviewer tests, binaries/compiler execution, edits, signals, installs, commits, merges, provider calls or subagents. Totals Standards0,Spec0 findings.

Artifact A-3765 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3765-t-572-final-clear-linux-tags-only-release-refusal-watchdog-proof-green.md

Criteria: C1 verified, C2 verified, C3 verified.

### human · 2026-10-16T05:58:23.645Z

Operator check by cland-impl, 2026-10-16 05:58Z: lease eb377eb6 (T-572's own verify 586b8df7, droplet 609588731 cland-v0-eb377eb6, deleteStarted 05:55:21Z, refused on tags mismatch with provider status active) is a 404 at DigitalOcean by 05:58:11Z; the provider lists only the tagged task droplet 609591169 (T-488) besides n8n. Nothing destroyed by hand. Third occurrence of the teardown-state reading (after 609583042 and 609583106): tags stripped and status still active for a short window after the delete call, then 404.

### impl-572 · 2026-10-16T06:16:25.379Z

Authorized conflict recovery: merged fresh origin/dev a9381ef0 at 4f83d569, pushed; only conflict was watchdog imports. Both T-523 child-close/bounded-stop logic and T-572 appendFile diagnostic callback retained. Root typecheck/shards green. Coordinator c88506cc narrowed proof to seven actual watchdog-process test files (A-3770). Whole files all green: demo-release 7, executor-droplet 14, executor-safety 20, executor-run 21, demo 8, executor-prepare 17, remote-fixture-lifecycle 12 = 99 pass/0 fail/0 skip. A-3781 full log, A-3782 guard/count summary. Serial admission load2.59–4.76<10, local queue empty, only authorized T-491 cwd PID exclusions. Slot A released. Merge delta review requested; Coordinator 919306f1 requires no new droplet run for this all-green conflict proof.

### rev-30 · 2026-10-16T06:19:06.085Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-572-merge-final
commit: 4f83d56911b1d4ecef93cfaa222d0beb8b590e4c
scope: delta

# T-572 merge delta review clear

Reviewed pushed head `4f83d56911b1d4ecef93cfaa222d0beb8b590e4c`, branch `t/T-572-demo-droplets-show-no-tags-at-release-so`. Parents: prior final-clear `ae48c3611f860ad73201eb757f08cf613a1719aa` and freshly merged dev `a9381ef0e213c5cfc4d2092ec24901c96c9b0c17`. Origin branch equals HEAD. task.view confirms live claimant, C1–C3 done, and prior verified marks stale only because the merge moved the head.

## Standards

0 high, 0 medium, 0 low findings. The only conflict was watchdog imports. Resolution retains dev/T-523 `spawn, type ChildProcess` and T-572 `appendFile`. Independent normalization removing exactly T-572's appendFile import and diagnostic callback produces watchdog.ts byte-for-byte equal to dev. All T-523 owned ChildProcess/close-receipt tracking, bounded TERM/KILL waits, restart PID/start-time revalidation and failure cleanup are preserved.

The other five T-572 files (cleanup.ts, droplet.ts, lease.ts, demo-release.test.ts, fake-api.ts) are byte-identical to the prior final-clear parent. Incoming dev changes remain dev's implementation; the net task diff against dev is the previously reviewed six-file T-572 change with that mechanical watchdog resolution. Whitespace check clean. Root typecheck and shard lint are claimant-reported green; A-3768 records them, with no separate raw compiler receipt claimed here.

## Spec

C1–C3 refreshed. Prior source/final analysis A-3741/A-3765 remains applicable: create path preserves both tags; known ID/name mismatches refuse immediately; tags-only identity disagreement gets a bounded reread and diagnostic, not deletion authority from missing tags. Existing tagged lost-create discovery stays intact. The merge changes none of those boundaries.

C1 retains Coordinator af678989's explicit bounded-inference disposition: real active/tags-empty observations plus faithful fake reproduction support the mechanism; the actor stripping tags remains unobserved. This merge does not establish provider internals or completion of the live D18 check. E-423 D18 rerun follows merge/restart and reopens live tracing if the problem persists.

## Conflict proof and gate disposition

Primary Coordinator **919306f1-cd98-4753-9c33-34733fc13e8f** authorizes the dev merge and explicitly waives another droplet run if the required local proof is green. Primary **c88506cc-a65e-4f7d-b73b-969d0caac514** narrows proof to the four named lifecycle files plus process-exercising watchdog matches, excluding incidental spawn/ChildProcess matches. A-3770 supersedes the earlier broad A-3769 list.

Independent `rg -li watchdog hub/test nvim/test -g '*.test.ts'` returns exactly the seven selected whole files, all in hub/test: demo-release, executor-droplet, executor-safety, executor-run, demo, executor-prepare, remote-fixture-lifecycle. These cover tags-only reread/logging, strict foreign identity refusal, parent/child close behavior, after-hub-exit cleanup, failed builder cleanup, and owner signal teardown.

A-3781 raw whole-file log and A-3782 per-file guard/count summary agree: **7 +14 +20 +21 +8 +17 +12 =99 pass**, zero fail/cancel/skip, serially at this merge head from 06:10:04 through 06:15:39 UTC. Per-file admissions show local holder null, loads **2.59–4.76 <10**, and either no test PIDs or only the reported authorized T-491 worktree identified by PID/cwd. No third/unknown worktree is recorded. The slot was released afterward. Raw output contains both actual count lines and repeated structured summaries; these are one execution per file, not 198 tests.

Prior exact-head Linux **586b8df7 / A-3764** at ae48c361 was green (1913 pass, 0 fail, 4 permitted skips; hub plus Neovim smoke), accepted in A-3765. Carry it forward only under the Coordinator's explicit conflict-proof waiver, not as a new Linux execution at this merge head. All required current-head local proof is green, so no new droplet run is required.

Final merge delta clear; refresh all C1–C3 at 4f83d569. No per-item QA. Live D18/stage QA remains Coordinator-owned after merge. Reviewer performed no tests, compiler/binary execution, edits, signals, provider actions, merges or subagents.

Findings: Standards0; Spec0.

Artifact A-3784 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3784-t-572-merge-delta-clear-watchdog-close-behavior-preserved-seven-whole-files-gree.md

Criteria: C1 verified, C2 verified, C3 verified.
