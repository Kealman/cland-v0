---
id: T-694
kind: task
title: Session resume, launch and stop-race matrices run on the in-process fake adapter, with one real proof per harness
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
topic: topic-442
branch: t/T-694-session-resume-launch-and-stop-race
created: 2026-10-16T19:59:36.176Z
updated: 2026-10-17T17:14:55.998Z
---

## Summary

Three files prove hub bookkeeping through fake harness binaries (memo §2.2 win 8; report-slice4 top 10 #3, report-slice3 #2 and #4):

- `session-resume.test.ts` (59.3 s): an 8-way `fresh × {claim, closed, exclusive, hold}` matrix of launch, stop and resume.
- `session-launch.test.ts` (40.8 s; 7 `startDaemon`, 7 fake-binary sites): brief ordering and cwd resolution, which `launch-admission.test.ts` already proves in-process in milliseconds.
- `session-stop-races.test.ts` (44.0 s): a 3 harness × 2 stop × 2 forced matrix of one hub rule (stopped is not death).

## What to build

- **session-resume.** The matrix runs as a T2 table on T-686's fake adapter: the resume notes are bookkeeping over claims, holds and roles. One native Claude resume and one Codex `--fresh` stay as T3 proofs.
- **session-launch.** Brief composition and cwd resolution (absolute, refused, relative) are asserted on the `SpawnRequest` the fake records. Two frame proofs stay on `projectHub`: the Coordinator launching an Implementer with a brief, and `cland session launch` forwarding text and artifact briefs.
- **session-stop-races.** Manual and graceful × forced runs in-process with a fake whose `stop` resolves after `stopGraceMs`. One real proof per harness (forced stop after merge, the hardest cell) and the two Codex descendant probes stay T3.

## Acceptance criteria

- [x] C1. The three files' manifest seconds fall from 144.1 s (A-3877) to 55 s or less, T2 and T3 parts together.
  - verified: rev-31 [reviewer] · run rev-20261017-694-final · 2026-10-17T15:20:29.490Z · commit 6467a6143396591e37ad5439c98d6e958258c682
  - verified: rev-31 [reviewer] · run rev-20261017-694-conflict-delta · 2026-10-17T16:00:28.744Z · commit ba704356e65a0fa952e76ec2b677503b06790a72
  - verified: rev-31 [reviewer] · run rev-20261017-694-fresh-final · 2026-10-17T17:14:23.312Z · commit c5b897226f20d75f18df82987a5f4135f0379d21
  - done: impl-694 · 2026-10-17T17:14:54.744Z
- [x] C2. Their fake-binary call sites fall from 13 to 6 or less and their `startDaemon` sites from 7 to 0.
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
  - verified: rev-31 [reviewer] · run rev-20261017-694-allowance-delta · 2026-10-17T15:18:54.059Z · commit 6467a6143396591e37ad5439c98d6e958258c682
  - verified: rev-31 [reviewer] · run rev-20261017-694-conflict-delta · 2026-10-17T16:00:28.744Z · commit ba704356e65a0fa952e76ec2b677503b06790a72
  - done: impl-694 · 2026-10-17T16:43:01.937Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-probe-delta-2 · 2026-10-17T16:43:28.034Z · commit c5b897226f20d75f18df82987a5f4135f0379d21
- [x] C3. The moved cases are in T2 files that pass the tier lint, and the remaining T3 tests each name the harness behaviour they prove.
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
  - verified: rev-31 [reviewer] · run rev-20261017-694-allowance-delta · 2026-10-17T15:18:54.059Z · commit 6467a6143396591e37ad5439c98d6e958258c682
  - verified: rev-31 [reviewer] · run rev-20261017-694-conflict-delta · 2026-10-17T16:00:28.744Z · commit ba704356e65a0fa952e76ec2b677503b06790a72
  - done: impl-694 · 2026-10-17T16:43:02.856Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-probe-delta-2 · 2026-10-17T16:43:28.034Z · commit c5b897226f20d75f18df82987a5f4135f0379d21
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
  - verified: rev-31 [reviewer] · run rev-20261017-694-allowance-delta · 2026-10-17T15:18:54.059Z · commit 6467a6143396591e37ad5439c98d6e958258c682
  - verified: rev-31 [reviewer] · run rev-20261017-694-conflict-delta · 2026-10-17T16:00:28.744Z · commit ba704356e65a0fa952e76ec2b677503b06790a72
  - done: impl-694 · 2026-10-17T16:43:03.357Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-probe-delta-2 · 2026-10-17T16:43:28.034Z · commit c5b897226f20d75f18df82987a5f4135f0379d21
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-31 [reviewer] · run rev-20261017-694-fresh-final · 2026-10-17T17:14:23.312Z · commit c5b897226f20d75f18df82987a5f4135f0379d21
  - done: impl-694 · 2026-10-17T17:14:55.121Z

## Blocked by

T-686 (in-process fake adapter).

## Comments

### impl-694 · 2026-10-17T14:24:05.558Z

Migration in progress in topic-442. Split into T2 component files for launch SpawnRequest/cwd admission, native/fresh resume bookkeeping, and manual/post-merge stop classification on FakeClock. Retain original files as T3 native lifecycle/frame proofs. Baselines: launch 40.800339 s, resume 59.334729 s, stop-races 44.039916 s (durations.json); total 144.174984 s. Initial typecheck + tier lint pass; component single-file runs underway.

### rev-31 · 2026-10-17T14:33:12.400Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-694-source-1
commit: 3eadc4b8987d8b047857527ff76720cac0ac279a
scope: full
findings: [{"severity":"medium","text":"Delayed fake.stop/request has no registered drain/restoration before fixture teardown if a pre-release assertion fails or cancellation starts; register idempotent ownership before request and preserve the pre-release checks with failure/cancellation controls.","file":"hub/test/session-stop-races-component.test.ts","line":43}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; Standards 1 medium / Spec 0 additional findings, A-4549. Implementer 8b0b6045 confirms no existing failure-path drain. Body finally alone cannot guarantee cancellation hook ordering; registered resource drain must precede hub/directory disposal and restore fake.stop. Remaining complete declaration audit found no other dropped claims: SpawnRequest/cwd/brief table seams, first native turn and CLI proofs, native/fresh claims/holds/roles, stopped-versus-death bundle, three harness forced-stop and two Codex descendant probes retained. Native reaping bounded with final assertions. No production diff; sorted T2 additions and dated owner allowance checked. Independently audited thirty Mac files plus six post-merge receipts, all pass; combined median 29.989564453 s at loads 5.921875–8.029296875. Census fakeClaude/fakeCodex 13→6, spawnSpoke 7→1, startDaemon already 0→0. C4 failed; C1/C5 execution pending corrected source. No verification before fresh review. No Reviewer edits/tests/delegation.

Criteria: C4 failed (Moved stop-table proof lacks registered failure/cancellation ownership for its admitted fake timer and pending request before fixture teardown.).

### rev-31 · 2026-10-17T14:39:35.350Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-694-source-2
commit: 602e4d140268c22d9b4cd70d2ba610ff20765efa
scope: full
findings: [{"severity":"medium","text":"New execFile proof child is PID-owned and time-bounded but lacks t.signal and a registered close-callback join on parent cancellation; join stop/close before directory disposal while retaining planted assertions.","file":"hub/test/session-stop-races-cleanup.test.ts","line":50}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected source not clear; Standards 1 medium / Spec 0 additional findings, A-4553. Original stop-table gap resolved by registered pre-socket active drain, shared idempotent body finally, joining explicit clock advance/request/adapter work and exact stop restoration. Failure/cancellation proof includes body-finally-never-reached and mutation red without registration. New proof child itself has successful-body close wait only; Implementer 398ec88a confirms no registered cancellation close join and will correct it. A-4552 ten fresh whole-file Mac passes checked; seven-file combined median 32.344751453 s, unchanged audit A-4547 current. Only three paths change, no dev merge or production change; all pre-release/classification assertions retained. C4 failed; fresh corrected source review before verification, C1/C5 pending. No Reviewer edits/tests.

Criteria: C4 failed (New lifecycle proof subprocess still lacks registered test-cancellation stop-and-close joining before fixture removal.).

### rev-31 · 2026-10-17T14:41:35.247Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-source-3
commit: 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards 0 / Spec 0 findings, A-4555. Remaining child ownership fixed: test signal, immediate PID owner, registered stop/actual-close/result join before directories, normal body also joins close. Planted failure/cancellation assertions unchanged. Original registered stop drain remains before socket/peer cleanup, shared idempotent disposal restores exact method; cancellation proof requires unfinished body finally and mutation without owner is red. Declaration/retained-native assertion audit remains current, no production changes or dev merge. All seven files have current whole-file Mac 5/5 chains A-4547/A-4552/A-4554; latest five logs independently checked, no skips/failures/late diagnostics. Recomputed combined median 31.861885787 s includes added lifecycle proof. Census fake helper sites 13→6, zero daemon sites already at task start; sorted T2/T3/header/allowance checks current. Origin and whitespace clean. C2/C3/C4 verified; C1 timing and C5 exact-head Linux execution pending mode-free diff-selected verification. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-694 · 2026-10-17T14:42:08.266Z

Source clear at 9215c35e (rev-20261017-694-source-3, A-4555); C2/C3/C4 verified. Assertion audit A-4547, cleanup/failure/cancellation proof A-4552, final owned-child close join and 5/5 receipts A-4554. All seven coverage files have Mac serial 5/5 proof; summed medians 31.861885787 s vs 144.174984 baseline (≤55 s target). Mode-free diff-selected droplet verify submitted at this exact head: 46d9eea8-50b6-4089-b0be-a9bd494ffcd5, reports topic-442 to Reviewer, Coordinator and Implementer. C1/C5 await Linux result and timing disclosure. No source changes while waiting.

### rev-31 · 2026-10-17T15:15:46.930Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-694-evidence-1
commit: 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
scope: evidence
findings: [{"severity":"medium","text":"Behavior and repetitions pass, but new lifecycle proof triggers duration budget 5.118139835 s >5 s without allowance; preserve assertions/ownership and resolve measured budget before fresh review.","file":"hub/test/session-stop-races-cleanup.test.ts","line":13},{"severity":"medium","text":"External gate blocker: QA-satisfaction merge case fails merge-changed (lane/gate inputs changed during lookup); outside task diff, reported Bugs/S to lead for classification.","file":"hub/test/merge-policy.test.ts","line":105}]
finding_counts: {"high":0,"medium":2,"low":0}

Evidence not clear, A-4573. Exact-head A-4572 / 46d9eea8 exits 1: 2065 passes, one ordinary failure, five skips; Neovim smoke not reached. Independently audited all nineteen owned cases and ten owned new identities 5/5, seven-file Linux sum 48.496184123 s (<55), Mac median sum 31.861885787 s. No owned behavioral failure, but cleanup duration gate remains red; outside merge-policy ordinary failure also blocks acceptance. C5 failed for own budget only; C1 final mark pending, C2/C3/C4 source continuity retained. Origin unchanged. No unchanged-head retry or branch-local external fix before lead disposition; changed head needs source review. No Reviewer edits/tests.

Criteria: C5 failed (Owned cleanup lifecycle proof triggers a failing unallowed five-second duration budget; accepted verification remains pending correction.).

### rev-31 · 2026-10-17T15:18:54.059Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-allowance-delta
commit: 6467a6143396591e37ad5439c98d6e958258c682
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Allowance-only source delta clear; Standards 0 / Spec 0 findings, A-4579. Sole seven-line exact cleanup-case allowance is 6.5 s, E-677, seven days through 2026-10-24, reason names measured Linux 5.118139835 s and retained real-process cancellation/OS stop/close/result work. Executable files/assertions/baselines unchanged. Independently read Coordinator f2a66cd4: earlier disposition covered external T-740 only; this allowance resolves owned gate, and code-identical A-4572 / 46d9eea8 is accepted with no verify rerun. Raw receipt remains exit 1 with no Neovim phase, not relabeled green. Origin/whitespace exact. C2/C3/C4 refreshed; C1/C5 final evidence settlement follows claimant marks at current head. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-31 · 2026-10-17T15:20:29.490Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-final
commit: 6467a6143396591e37ad5439c98d6e958258c682
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear under explicit receipt reuse; Standards 0 / Spec 0 remaining findings, A-4583. Independently read c1dcd8e0 accepting external T-740, and f2a66cd4 requiring the owned allowance-only delta then expressly reusing code-identical A-4572 / 46d9eea8 with no rerun. Current delta A-4579 addresses 5.118139835 s cleanup line with measured 6.5 s/seven-day allowance; executable files/assertions unchanged. Audited all nineteen owned cases and ten 5/5 load gates, Linux sum 48.496184123 s; Mac seven-file 5/5 median sum 31.861885787 s, both <55. C1/C5 verified; C2/C3/C4 current. Raw A-4572 remains exit 1 with one external ordinary failure, owned budget line and no Neovim phase; this verdict does not relabel it green or claim a new-head run. All five criteria supported under named item disposition. No additional run or per-item QA needed. No Reviewer edits/tests.

Criteria: C1 verified, C5 verified.

### rev-31 · 2026-10-17T16:00:28.744Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-conflict-delta
commit: ba704356e65a0fa952e76ec2b677503b06790a72
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-only integration clear; Standards 0 / Spec 0 findings, A-4605. Independently read Coordinator a3842524 authorizing exact-dev resolution and no rerun, expressly retaining A-4572/46d9eea8 with T-740 disposition. Independently reconstructed durations as exact b5cd8b4f plus exactly three own allowance changes and tiers as exact dev plus four own additions. All metadata/baselines/unrelated allowances equal dev; seven task tests byte-identical to prior final-clear 6467a614; diff from dev has only original nine task files, no manual production edit. Origin/whitespace exact; A-4604 static checks green. Previous source/audit/registered cleanup and final A-4583 evidence carried forward: Mac 31.861885787 s, Linux nineteen owned cases 48.496184123 s, ten 5/5 gates. C1–C5 refreshed under explicit no-rerun disposition. Raw receipt remains exit 1/no Neovim; no new-head green execution claimed. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-17T16:42:26.144Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-694-probe-delta-1
commit: edfc8d4adbb1c380248a40d5d19401c482b3c257
scope: delta
findings: [{"severity":"medium","text":"Owned stop-component allowance remains 5.5405 s despite fresh measured Mac peak 5.712381750 s; cover the measured native/Git work before verification without changing assertions.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Delta not clear for measured budget only; Standards 1 medium / Spec 0 additional findings, A-4622. Implementer 6fd9be8f accepts allowance-only correction. Code merge itself checked: exact parents ba704356+0ffa17c3; sole task-file edit moves NO_PS import to native-process while preserving native prerequisite/declarations/assertions. Other six task tests/durations unchanged; inherited probe/lock/config/Tracker/harness source exactly dev with native defaults retained. Independently read Coordinator e5e72bef requiring this merge plus fresh exact-head droplet after clear (prior no-rerun superseded). Thirty-five raw Mac files pass without skips; seven-file median 36.931053875 s at loads 4.583–8.006, under55. C5 failed pending allowance adjustment/new source review/fresh gate; original audits unchanged. No Reviewer edits/tests.

Criteria: C5 failed (Fresh Mac stop-component peak 5.712381750 s exceeds its 5.5405 s allowance; covering measured allowance and fresh current-head verification remain pending.).

### rev-31 · 2026-10-17T16:43:28.034Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-probe-delta-2
commit: c5b897226f20d75f18df82987a5f4135f0379d21
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected integration source clear; Standards 0 / Spec 0 findings, A-4625. Sole final delta changes allowance seconds/reason: stop component 6.5 s covers measured Mac peak 5.712381750 with explicit0.788s headroom and correctmedian4.380596; E-677/Oct17–24 unchanged. No executed source/assertion changes. Prior A-4622 import integration audit remains current: NO_PS native prerequisite preserved, all native assertions/declarations identical; six other task files unchanged; inherited probes/source exactdev with native defaults. A-4621 all seven files5/5 atmergedsource, median sum36.931053875s under55. Origin/whitespace exact. C2/C3/C4 refreshed. C1 final timing/C5 await Coordinator e5e72bef-required fresh exact-head diff-selected droplet; old no-rerun disposition superseded, A-4572 historical only. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-694 · 2026-10-17T16:44:08.632Z

Authorized T-719 dev merge resolved at edfc8d4a: NO_PS imports from native-process.ts; all native assertion bodies preserved. A-4621 contains exact-source seven-file Mac whole-file 5/5 proof (35 receipts), sum medians 36.931053875 s. New measured Mac peak 5.712381750 s prompted a metadata-only allowance update to 6.5 s; latest pushed head c5b89722. Source delta clear rev-20261017-694-probe-delta-2 / A-4625; C2/C3/C4 refreshed. Required fresh exact-head diff-selected droplet verify submitted: bf76cf3d-7c4b-439e-8a8e-943dd1b5c0db, reports topic-442 to Reviewer/Coordinator/Implementer. C1/C5 await its receipt. Holding head unchanged.

### rev-31 · 2026-10-17T17:14:23.312Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-694-fresh-final
commit: c5b897226f20d75f18df82987a5f4135f0379d21
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh final evidence clear; Standards 0 / Spec 0 findings, A-4647. Independently audited exact-head A-4645 / bf76cf3d final exit 0: 2093 tests / 2088 passes / 0 failures / 5 prerequisite skips, including 12/12 Neovim smoke. All nineteen owned cases across seven files pass and ten new identities pass 5/5 load gates. Linux summed test time 52.950189068 s and fresh seven-file Mac 5/5 median sum 36.931053875 s both meet 55 s including added cleanup coverage. Cleanup 5.403437722 s and stop component 3.242258450 s are within current measured allowances; no failing duration-budget lines. C1/C5 verified; C2/C3/C4 current from A-4625, unchanged origin head. This fresh green gate replaces historical red receipt reuse, no exception needed. Hub-only plus smoke, not full Neovim. No further run or per-item QA. No Reviewer edits/tests.

Criteria: C1 verified, C5 verified.
