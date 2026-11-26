---
id: T-2071
kind: task
title: A snapshot prepare's five-region image transfer hits DigitalOcean's request deadline, and a failed prepare may leave its image and builder behind
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1788
branch: t/T-2071-a-snapshot-prepare-s-five-region-image
created: 2026-11-24T08:59:26.627Z
updated: 2026-11-26T19:56:47.425Z
closed: 2026-11-26T19:56:47.425Z
---

## Summary

Split from T-2008's 2026-11-24 comment by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. `cland executor prepare` failed after 1,433 s with "transfer: DigitalOcean 0 deadline: request deadline reached; image 256132409; regions ams3, fra1, nyc1, sfo2, blr1", with the builder lifetime and cost "unconfirmed". The builder cland-v0-fd861f52 showed "releasing; operator attention: deletion not confirmed" before it went away. Image 256132409 may remain as a partly transferred snapshot.

## What to build

Give the five-region image transfer a deadline that fits its measured duration, or transfer to the regions in use first and the rest asynchronously. Make a failed prepare delete its own image and confirm the builder's deletion and cost. All of this runs against the fake DigitalOcean API; tests use no real droplet or image.

## Acceptance criteria

- [x] C1. A transfer slower than one request deadline but within the prepare budget completes, or a regional subset publishes, against the fake API (test).
  - done: impl-2071 · 2026-11-25T13:26:39.371Z
  - verified: rev-41 [reviewer] · run rev-41-20261126-2071-final · 2026-11-26T18:33:32.573Z · commit 531cb5186ebda3838923834da8bbb49849ed5d02
- [x] C2. A failed prepare deletes the image it created and reports the builder's confirmed lifetime and cost, or names what's still unconfirmed (test).
  - done: impl-2071 · 2026-11-25T13:26:39.590Z
  - verified: rev-41 [reviewer] · run rev-41-20261126-2071-final · 2026-11-26T18:33:32.573Z · commit 531cb5186ebda3838923834da8bbb49849ed5d02

## Comments

### impl-2071 · 2026-11-25T13:12:43.013Z

Consumer inventory before change: prepareSnapshot callers are executor prepare and host-pool prepare in hub/src/executor/droplet/droplet.ts; suites passes the action test override. SnapshotRecovery readers/writers are snapshot-recovery.ts and prepare.ts, with optional existing seen IDs (no new wire field). Tests: executor-prepare-component and executor-snapshot-confirmation, native executor-prepare plus prepare-retry, host-provider-digitalocean-prepare and host-prepare. QA E-1533-stage-3 references prepare. Docs running.md and hub/README.md describe action bounds. No CLI usage export or wire shape changes planned; existing clients retain fields. Transfer will use remaining builder lifetime; request transport cap remains 15 seconds. Identified image ID will be checkpointed in existing seen before transfer, and failure text will explicitly name image cleanup confirmation.

### rev-41 · 2026-11-25T13:22:34.504Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2071-source1
commit: 73e93030a2d244572e9192d52c21adbe99c1a502
scope: full
findings: [{"severity":"medium","text":"M1: all six new cases leave setup/stop and prepare waits unbounded: step only admits work, while drive may wait indefinitely for native-I/O/notification. Add separate named scope.wait setup and behaviour bounds, retaining whole-case ownership and final assertions (also lines 697–703, 720–736).","file":"hub/test/executor-prepare-component.test.ts","line":692}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at exact head 73e93030a2d244572e9192d52c21adbe99c1a502. Medium M1 at hub/test/executor-prepare-component.test.ts:692 (also 697–703, 720–736): scope.run/step enroll ownership but impose no operation deadline; guard setup alone is bounded. C1/C2 failed for this test gap, neither verified. Production transfer lifetime, checkpointed image identity, deletion receipt and explicit accounting changes otherwise match the spec on source inspection. Full Standards/Spec record: A-23421, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23421-t-2071-source-review-not-clear-at-73e93030a.md (its primary line 696 is adjacent owner setup; exact unbounded acquisition is line 692). A-23417 inspected as local partial implementation evidence; no configured suite or Reviewer test run claimed.

Criteria: C1 failed (New transfer regression lacks bounded setup and prepare observations; admission step and post-completion request counts cannot terminate a stalled case.), C2 failed (New failed-transfer regressions lack bounded setup and prepare rejection observations; add named scope.wait bounds while preserving cleanup ownership.).

### rev-41 · 2026-11-25T13:26:29.991Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2071-source2
commit: 531cb5186ebda3838923834da8bbb49849ed5d02
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 531cb5186ebda3838923834da8bbb49849ed5d02. M1 resolved: six cases separately bound acquisition/setup/stop/config writes, preparation completion/rejection, reads and disposal using named scope.wait, preserving admitted work ownership, removal guards and final assertions. Production unchanged from reviewed 73e93030a; no merge. Standards/Spec record A-23426 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23426-t-2071-source-review-clear-at-531cb5186.md. Findings none. C1/C2 remain runtime-dependent/unverified pending same-head configured receipts. A-23425 reports local macOS arm64 Node24.21 T2 63/63/full typecheck+lint0; no Reviewer tests, native T3 or browser/configured verification. Earlier importer evidence remains prior-tree evidence. Readback still shows previous failed criterion marks; lead should restore implementation done marks. Human budget/Coordinator verify-window hold remains in force.

### rev-41 · 2026-11-26T01:26:05.730Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2071-evidence1
commit: 531cb5186ebda3838923834da8bbb49849ed5d02
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence incomplete, not clear. Run734871a8/A-23513 exact source/tree match; producer code143/deadlineExpiredtrue cause `run timeout 75m; secondary diagnostic: package closure incomplete; machine deletion required`, packageClosure incomplete/nativeExit143. Structured T0/T1/T2/T3 complete exit0; Web interrupted/no complete receipt, T4 unexecuted. Six new exact identities have36 paired start/finish pass receipts (base+5load each), base file and30load file finishes pass; retained only as partial evidence. No source finding and no criterion failure inferred from missing Web completion: C1/C2 stay done/unverified, neither verified. A-23514 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23514-t-2071-configured-run-incomplete-at-531cb5186.md. Linuxx64c8nyc1 Node24.21 Nvim0.12.5 workers2, ChromeHeadlessShell1248/CFT156.0.8078.4 in incomplete Web; 12declaredskips, advisory duration/lint report-only. No Reviewer tests. Coordinator hold/no rerun retained; item lead owns retry decision.

### rev-41 · 2026-11-26T18:33:32.573Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2071-final
commit: 531cb5186ebda3838923834da8bbb49849ed5d02
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified at source-clear531cb5186 from same-head retryf0df6b7c/A-23564. Exact source/tree1a058ca6 match, producer code0/causeempty and complete T0/T1/T2/T3/Webexit0. Six exact generated cases and files pass base+5/5load each, retaining region completion/lifetime expiry, by-ID image cleanup/recovery identity and confirmed/unconfirmed builder accounting final assertions. A-23565 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23565-t-2071-final-review-clear-at-531cb5186.md. Linuxx64c16nyc1workers4 Node24.21/Nvim0.12.5 ChromeHeadlessShell1248/CFT156.0.8078.4, noncached,12platform/prereq skips;251selectedT3once, remainingT3batch/T4unexecuted, advisory budgets/lintreport-only. Earlier734871a8/A-23513 remains incomplete75mtimeout, never pass. FakeAPI evidence only, no real paid mutation/production latency claim. No findings or Reviewer test/native/browser execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-26T19:56:47.425Z

Merged b9d0624e3b3f0ebd5da93b8b201d58678f3cbcda onto dev.
