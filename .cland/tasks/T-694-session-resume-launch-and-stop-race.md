---
id: T-694
kind: task
title: Session resume, launch and stop-race matrices run on the in-process fake adapter, with one real proof per harness
state: open
status: review
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
updated: 2026-10-17T14:42:08.266Z
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
  - done: impl-694 · 2026-10-17T14:40:50.255Z
- [x] C2. Their fake-binary call sites fall from 13 to 6 or less and their `startDaemon` sites from 7 to 0.
  - done: impl-694 · 2026-10-17T14:40:50.862Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
- [x] C3. The moved cases are in T2 files that pass the tier lint, and the remaining T3 tests each name the harness behaviour they prove.
  - done: impl-694 · 2026-10-17T14:40:51.168Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-694 · 2026-10-17T14:40:51.548Z
  - verified: rev-31 [reviewer] · run rev-20261017-694-source-3 · 2026-10-17T14:41:35.247Z · commit 9215c35e9e53d0eeb639b316df05e2efb3ec7ce5
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

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
