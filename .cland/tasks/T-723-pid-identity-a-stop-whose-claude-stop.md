---
id: T-723
kind: task
title: pid-identity 'a stop whose claude stop fails never SIGTERMs a reused pid' fails with 'database is locked' under load
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: topic-474
branch: t/T-723-pid-identity-a-stop-whose-claude-stop
created: 2026-10-17T01:06:44.540Z
updated: 2026-10-18T04:20:57.833Z
---

## Summary

hub/test/pid-identity.test.ts "Claude Code: a stop whose `claude stop` fails never SIGTERMs a pid that another process reuses" fails now and then with `Error: database is locked` (ERR_SQLITE_ERROR). It failed in three runs: 2410465e (A-1151), 0ea19bdd (A-3306) and a4c094d5 (A-4259, T-689's droplet run at 19be0a95, outside its diff). Something in the case or its fixture writes the hub database while another handle holds a lock, and load decides who wins.

## What to build

Find which two writers contend, the test fixture or the hub under test, and make the case wait on the observable stop outcome instead of racing a second database handle. Use a single handle or the hub's own busy timeout if the product genuinely needs two. Keep the case a T3 lifecycle test, since it proves the stop path doesn't signal a reused pid, and keep its assertions' meaning.

## Acceptance criteria

- [x] C1. The cause of the lock is recorded on this item and fixed, with the case's assertions unchanged in meaning.
  - done: impl-723 · 2026-10-18T03:53:47.130Z
  - verified: rev-30 [reviewer] · run rev-20261018-723-source · 2026-10-18T03:55:10.388Z · commit 4ca0e22333e390483bfd909d55ccb0963ddf06ac
- [x] C2. pid-identity.test.ts passes 10/10 serially as a whole file on the Mac at load above 8, and in the task's droplet verify.
  - done: impl-723 · 2026-10-18T04:20:19.881Z
  - verified: rev-30 [reviewer] · run rev-20261018-723-final · 2026-10-18T04:20:57.607Z · commit 4ca0e22333e390483bfd909d55ccb0963ddf06ac

## Comments

### impl-723 · 2026-10-18T03:45:43.419Z

C1 cause confirmed after merging origin/dev: T-763 (447064753250a8627f9d14c90ff96a07d5adb202), evidence A-4909, identified raw DatabaseSync handles without a busy_timeout. The fixture's stale Claude identity UPDATE competes with the live hub's independent harness_processes writes; the raw fixture handle formerly failed immediately with database is locked. T-763 moved all three pid-identity.test.ts hub.db handles (reusePid, pidRow and the Claude stale-identity UPDATE) to shared openDatabase, which sets pragma busy_timeout = 5000 before use. No raw node:sqlite import or DatabaseSync construction remains in this file. Assertions and PID refusal semantics are unchanged; no further source change is needed.

### impl-723 · 2026-10-18T03:53:47.361Z

Mac C2 evidence: A-4946 contains ten consecutive qualifying whole-file logs (attempts 19–28) at source head 53c0509f, 03:49:56.546–03:52:16.566Z, with 30 passes / 0 failures, cancellations or skips. Each fresh process runs the whole file serially, sampling 1-minute load at start, every second and exit: combined range 9.275390625–14.81884765625. A-4944 records all 28/28 target passes and the primary companion; A-4945 records added daemon/orphan companions. Coordinator authorized four total serial lanes in the reserved local window. After target proof ended, aggregate load spiked to 18.011 while draining; watchdogs stopped both extra companions and their cancellations are explicitly retained, not counted as proof. All lanes exited by 03:52:42.755Z. Final pre-review origin/dev merge a9947875 leaves pid-identity, database opener and hub writer modules unchanged. Droplet verification remains pending source review.

### rev-30 · 2026-10-18T03:55:10.388Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-723-source
commit: 4ca0e22333e390483bfd909d55ccb0963ddf06ac
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4948: source clear, no findings; authored diff is only the evidence note. C1 verified: merged T-763 shared opener gives all three fixture hub.db handles busy_timeout=5000 before use, with finally-close and unchanged T3 PID refusal assertions. Audited A-4946 attempts 19–28 against A-4944: ten consecutive serial whole-file passes, 30 tests, no failures/cancellations/skips, sampled load 9.275390625–14.81884765625. Measured source revision 53c0509f has identical target/opener/Store/ProcessTable/TrackerIndex blobs to reviewed 4ca0e223; incoming T-765 change is separately disclosed. Coordinator authorized companion lanes; A-4945's later load-cap cancellations remain excluded. C2 Mac portion supported but C2 remains unverified pending the instructed exact-head task droplet receipt.

Criteria: C1 verified.

### impl-723 · 2026-10-18T04:20:20.350Z

Exact source-reviewed head 4ca0e22333e390483bfd909d55ccb0963ddf06ac received green droplet run 5af6edba-8ab8-446d-888c-36fec26fca82, A-4953: auto hub-only, 2119 passed / 0 failed or cancelled / 5 outside-owned prerequisite skips. All three pid-identity cases executed with timing receipts: Codex 4.869147268s, Claude 3.736908461s, OpenCode 4.969312275s; none skipped. Linux x64 Node 24.21.0, c-8 lon1, lifetime 1432s, $0.0994. Together with A-4946's ten consecutive Mac whole-file passes at sampled load 9.275–14.819, C2 is done and ready for final Reviewer verification. No head changes since source clear; no local tests run during the announced stage-cover window.

### rev-30 · 2026-10-18T04:20:57.607Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-723-final
commit: 4ca0e22333e390483bfd909d55ccb0963ddf06ac
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4954: final same-head clear, no findings; C2 verified and C1's source mark remains current. A-4953 / 5af6edba exits 0 at reviewed 4ca0e223. All three PID-identity cases have ordinary pass lines and completed timings (Codex 4.869s, Claude 3.737s, OpenCode 4.969s), with no owned skips. Entire task receipt is 2124 reported/2119 passed/0 failed or cancelled/5 outside-owned skips, including smoke 5/5. Together with previously audited ten consecutive Mac whole-file passes at sampled load 9.275–14.819 and source equivalence in A-4948, this establishes C2. Warmups and later companion cap cancellations stay disclosed/excluded. No further source or allowance changes.

Criteria: C2 verified.
