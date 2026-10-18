---
id: T-769
kind: task
title: 'aide.test.ts: Sessions.#inject queries the process table after the hub closed its store ("database is not open")'
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-473
branch: t/T-769-aide-test-ts-sessions-inject-queries-the
created: 2026-10-18T03:35:21.412Z
updated: 2026-10-18T04:09:48.636Z
closed: 2026-10-18T04:09:48.636Z
---

## Summary

hub/test/aide.test.ts, "a fake Claude Aide keeps answering when a settings hook exits without reading stdin", failed with `Error: database is not open` (ERR_INVALID_STATE). The stack ran ProcessTable.bySessionId (hub/src/adapters/processes.ts:217) → Sessions.#inject (hub/src/adapters/sessions.ts:1478, called from :1510) on a microtask after the hub closed its store. There are two receipts:
- A-4041 (2026-10-16, listed under T-657);
- A-4929: the macOS stage run f45ac80d for E-677 stage 2, dev d392167a, 2026-10-18 03:35Z, peak load 14.3.
This is the T-573 signature: an injection continuation outliving hub close.

## What to build

Hub close cancels or awaits pending Sessions injections before closing the store, or #inject checks a closed flag and drops its continuation quietly. The fix is in production code, not the test.

## Acceptance criteria

- [x] C1. A T2 test closes the hub while an injection continuation is pending, records no "database is not open" rejection, and fails before the fix. aide.test.ts then passes 20/20 serially.
  - done: impl-769 · 2026-10-18T03:44:50.187Z
  - verified: rev-30 [reviewer] · run rev-20261018-769-final · 2026-10-18T04:09:39.228Z · commit ef6453528422dad29e66a9254279754b50b9e499

## Comments

### coord · 2026-10-18T03:36:22.324Z

Reproduces alone on dev d392167a. coord ran `node --test hub/test/aide.test.ts` 5× serially on the Mac at load 4.6–5.2 and got 4 pass and 1 fail: run 1 had 7 pass, 1 fail. It isn't load-only. It blocks the E-677 stage-2 macOS stage cover, so it's urgent.

### impl-769 · 2026-10-18T03:39:46.052Z

Merged origin/dev at 37c4921c. Added two T2 component regressions in fake-harness.test.ts using projectHub/FakeClock and in-process adapters: (1) held injection with pending bridge retry at adapter close reproduces the exact ProcessTable.bySessionId → #inject database-is-not-open stack; (2) accept/reject/uncertain outcomes arriving after hub stop reproduce a closed Store.markUncertain rejection. Both observed red on unchanged production source, then green with existing Sessions.#closed guarding entry and all promise continuations. A-4933 preserves the first red. Host typecheck, tiers and lint passed; serial 5x touched-file and 20x aide validation now running below load 15.

### rev-30 · 2026-10-18T03:46:00.377Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-769-source
commit: ef6453528422dad29e66a9254279754b50b9e499
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4941: source clear; no Standards or Spec findings. Existing #closed state now gates injection entry, success, rejection/uncertain and queued retry before storage access; in-flight cleanup remains, and open-session behavior is unchanged. Two T2 projectHub/FakeClock regressions cover close-settled retry and accept/reject/uncertain callbacks after full storage close. Baseline-red ProcessTable/#inject and Store.markUncertain receipts are preserved in A-4933/A-4935. Audited A-4940: fake-harness whole file 5/5 (30 passes) and aide whole file 20/20 (160 passes), zero failures/cancellations/skips. No new process, observation sleep or duration allowance. C1 remains unverified until the exact-head task receipt is assessed.

### impl-769 · 2026-10-18T04:09:21.290Z

Exact-reviewed-head verification is green: suite f25373a5-9c77-4d8e-96df-6a7d1658115c at ef6453528422dad29e66a9254279754b50b9e499, hub-selected, 1047/1047 passed; zero failed/cancelled/skipped. Receipt A-4951. Linux x64 droplet c-8 lon1, Node v24.21.0; lifetime 1344s, cost $0.0933; peak one-minute load 7.37. Reviewer received the result directly for final verdict. Source head unchanged.

### rev-30 · 2026-10-18T04:09:39.228Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-769-final
commit: ef6453528422dad29e66a9254279754b50b9e499
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4952: final same-head evidence clear; C1 verified, no findings. A-4951 / f25373a5 exits 0 with 1047/1047 passes and no failures/cancellations/skips, including smoke 5/5. Both shutdown regressions have ordinary pass/timing receipts (0.110s, 0.244s) plus 5/5 fresh load gates each; all six fake-harness and eight aide cases execute positively, including original settings-hook case at 2.758s. Together with the source-reviewed baseline-red ProcessTable/#inject and Store.markUncertain receipts and audited aide 20/20/local 190 passes, this establishes C1. No source or allowance changes since source clear; report-only unrelated duration notices remain disclosed.

Criteria: C1 verified.

### coord · 2026-10-18T04:09:48.636Z

Merged a4ba0a7dfa8707ed367d0767d566a4198b6f1356 onto dev.
