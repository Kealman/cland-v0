---
id: T-495
kind: task
title: "session-usage test: turn() takes an uncorrelated usage frame (12 vs 24) and the journal read meets a limits-only row (Linux)"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by:
  - T-463
regression_of: T-389
topic: topic-298
branch: t/T-495-session-usage-test-turn-takes-an
created: 2026-10-15T13:10:49.459Z
updated: 2026-10-15T15:16:59.440Z
---

## Problem

Two more boundary assumptions in `hub/test/session-usage.test.ts`, seen in T-395's droplet run e54c3004 (A-3003). T-463's restart fix doesn't cover them; that's impl-463's analysis at 2ddc0d86.
- :42 asserts `latest.total?.totalTokens === 24`. `turn()` accepts the next session.usage frame without correlating it to the requested turn, so an intermediate publication that still says 12 can satisfy the wait.
- :78 reads `(r.total as …).totalTokens` across journal rows. An earlier row has no total, consistent with the independent initial limits-only publication.

These are rework of T-389's tests.

## Acceptance criteria

- [x] C1. `turn()` waits for the session.usage publication that belongs to the requested turn, and the journal read at :78 skips or explicitly expects the limits-only row. Every assertion and time bound stays as it is.
  - done: impl-495 · 2026-10-15T14:13:06.821Z
  - verified: rev-30 [reviewer] · run rev-20261015-495-source · 2026-10-15T14:14:06.720Z · commit 25ad9ab6d1368a52638457c875bf6afd7306d116
  - verified: rev-30 [reviewer] · run rev-20261015-495-delta · 2026-10-15T14:45:37.955Z · commit 0046b17afa32cb2d5450e079ab05e2374c93739b
- [x] C2. session-usage.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
  - done: impl-495 · 2026-10-15T14:44:06.842Z
  - verified: rev-30 [reviewer] · run rev-20261015-495-final · 2026-10-15T15:16:58.006Z · commit 0046b17afa32cb2d5450e079ab05e2374c93739b

## Comments

### impl-495 · 2026-10-15T14:05:28.233Z

Replayed a late previous session.usage frame at turn()'s existing FrameClient boundary. Before fix, `node --test --test-name-pattern='Codex journals changed totals once' hub/test/session-usage.test.ts` failed with the reported 12 !== 24 (1 test, 0 pass). The same replay passed after matching the expected fixture response (1/1). Temporary replay removed. All original assertions and timeouts retained; first two Codex journal tests read token-bearing records to skip independent initial limits-only publications. Baseline whole file passed 8/8 quietly. Five final whole-file Mac runs pending the free targeted-test window.

### impl-495 · 2026-10-15T14:13:23.218Z

Committed source 372e1223 and pushed review head 25ad9ab6 (latest origin/dev merged; final merge tracker-only). A-3061 contains five serial quiet Mac whole-file passes, each 8/8, in 22.6s, 26.8s, 21.5s, 22.2s, 21.4s. Typecheck passed before/after refreshed dev; diff check passed. Review requested. C2 stays incomplete until same-head default droplet verification passes this file.

### rev-30 · 2026-10-15T14:14:06.720Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-495-source
commit: 25ad9ab6d1368a52638457c875bf6afd7306d116
scope: full

Source review clear at 25ad9ab6d1368a52638457c875bf6afd7306d116; no high, medium or low findings.

Standards: no findings against repo test guidance or code-review smell baseline. Matching the expected fixture response retains the original frame boundary/session identity and existing timeouts; no production or fixture changes.
Spec: C1 verified. session-usage.test.ts:33–38 now requires post-send frame position, stable sessionId and caller-specific usage predicate. Ordinary turns match the expected distinct cumulative totals; repeat usage matches the fake's 100000 context-window marker; limits-only update matches primary usage 9. The fake defines these markers distinctly, so a late previous publication cannot satisfy the tested step. Assertions still independently compare totals/rates/raw tokens and journal exactly-once/final behavior. recordsWithTotals excludes independent startup limits-only rows in the two Codex token-journal checks; the burst case's later final-record assertion remains on the raw journal.

A-3048 records deterministic stale-frame replay with unchanged 12!==24 failure before and success after; temporary replay is absent from the final source. A-3061 supplies five serial quiet Mac whole-file passes (8/8 each, no failures/skips/cancellations). Final merge 372e1223..25ad9ab6 changes only three tracker files. C2 local half supported, Linux half pending.

Reviewed task diff against d6e222bef3eb28eef84e24fb8113585a04b06f1a; one test-only source change plus tracker-only integration. git diff --check passes. Both review axes reviewed directly; role prohibits delegation. Proceed with exact-head default droplet cland verify before final C2 verification. No Reviewer tests or edits.

Criteria: C1 verified.

### rev-30 · 2026-10-15T14:44:30.157Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-495-linux-first
commit: 25ad9ab6d1368a52638457c875bf6afd7306d116
scope: evidence

Evidence review not clear at unchanged 25ad9ab6d1368a52638457c875bf6afd7306d116; gate disposition pending.

Medium — hub/test/merge-gate.test.ts:220 and merge-policy.test.ts:96: CLI calls fail because the hub does not answer within 3000 ms (A-3076:4128–4166). No exact open-item match found; needs lead classification before a known-flake retry can rely on this receipt.
Medium — hub/test/codex-adapter.test.ts:739: expected taken steer log is absent, exact T-467 staging case (A-3076:3977–4042).
Medium — hub/test/handover.test.ts:103: inherited clause-opening regex mismatch, shared b8ae050b (A-3076:4053–4116).
Medium — hub/test/orphan-servers.test.ts:346: fixture second SQLite connection is locked, exact T-499 (A-3076:4168–4177).
Medium — hub/test/suite-recovery.test.ts:60/:harness.ts:449: stale compatibility-holder variant waits more than 500ms for suite.cancel (A-3076:4180–4185); same timeout family as T-494, whose original summary names the live-holder variant. Lead association requested.

Standards: source verdict rev-20261015-495-source stands, no new task findings.
Spec/evidence: all eight session-usage tests pass on Linux. Repaired totals case 5.449 s and burst/limits case 4.697 s; no hard duration-budget failures for existing identities. A-3061 supplies five serial quiet Mac whole-file passes. C1 source verification retained; C2 file-run portions supported but verification remains pending accepted overall gate. No failed implementation criterion mark for unrelated failures.

af207517/A-3076 matches source-reviewed/current head; host/remote typecheck green, Linux x64 c-8, exit 1, 1755 pass/6 fail/3 platform skips/0 cancelled. Neovim smoke not reached. Current dev/shared fix integration needs delta source review before a new run. No Reviewer tests or edits.

### impl-495 · 2026-10-15T14:45:04.172Z

A-3076 is first Linux receipt: all 8 session-usage cases green. Coordinator 837a1fb3 classifies every suite failure as known (T-467; shared handover regex b8ae050b; T-499; T-494 family; newly filed T-501 for both 3000ms merge CLI timeouts). Merged origin/dev 4095dd11, including b8ae050b and T-458, pushed 0046b17a. Task file byte-for-byte unchanged from source-reviewed 25ad9ab6. Delta source review requested; second default droplet verify awaits that verdict.

### rev-30 · 2026-10-15T14:45:37.955Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-495-delta
commit: 0046b17afa32cb2d5450e079ab05e2374c93739b
scope: delta

Delta source review clear at 0046b17afa32cb2d5450e079ab05e2374c93739b; no high, medium or low findings.

Standards: no findings. Required dev merge includes the exact shared b8ae050b handover regex, preserving its surrounding assertions. T-458 Rulebook integration is inherited reviewed work (full Linux A-3068).
Spec: task source is byte-identical to reviewed 25ad9ab6; empty git diff old..new on session-usage.test.ts confirms it. Net task diff against merged dev 4095dd11 remains one file, 18 insertions/12 deletions. All expected-response predicates, frame/session boundaries, totals filtering and existing assertion/deadline literals are retained. C1 reverified at this head. C2 repetition/file-run evidence stands, but final gate remains pending.

Direct Coordinator decision 837a1fb3-e6fa-493f-a4f6-8a6d4eb39fa8 classifies the two merge CLI reply timeouts as T-501 and explicitly accepts A-3076 as the first known-only red receipt with session-usage green, directing delta review then a second droplet. That decision also associates its remaining failures with known items/shared fix. Cite this decision when assessing any receipt pair.

Reviewed merge delta 25ad9ab6..0046b17a and net task diff 4095dd11...0046b17a; git diff --check green. Both review axes performed directly; no Reviewer tests or edits. Proceed with default droplet verify at this exact head.

Criteria: C1 verified.

### impl-495 · 2026-10-15T15:15:53.897Z

Second droplet receipt A-3101 (d6e75622) at source-reviewed 0046b17a again has all 8 session-usage cases green. Suite exit 1 has four distinct failures, none shared with first receipt A-3076: heartbeat:260 old-updated-date 1 vs 0; session-events process-row case 5000ms frame timeout; session-model live-resume model case 5000ms frame timeout; subscriptions:472 additional impl idle despite T-486 ancestry. Reported each aside to lead (Bugs/S) for classification before Reviewer applies the E-482 two-distinct-receipt gate. No third run or source change; holding reviewed head.

### rev-30 · 2026-10-15T15:16:02.025Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-495-linux-second
commit: 0046b17afa32cb2d5450e079ab05e2374c93739b
scope: evidence

Evidence review not clear at unchanged 0046b17afa32cb2d5450e079ab05e2374c93739b, pending lead classification of four new outside-task failures.

Medium — hub/test/heartbeat.test.ts:260: newly observed review/ready state is already counted stale despite old updated-date protection (A-3101:3979–3994).
Medium — hub/test/session-events.test.ts:84: process-row lifecycle/usage case receives no matching frame within 5000ms (A-3101:3996–4001); the log does not identify which wait from its predicate stack, so no narrower failure cause is inferred.
Medium — hub/test/session-model.test.ts:146: live-resume model journaling case receives no matching frame within 5000ms (A-3101:4003–4008).
Medium — hub/test/subscriptions.test.ts:472: terminal-role metadata/next-launch case records an additional idle event instead of only the expected launch event (A-3101:4010–4029).
No exact existing ticket matches found. Reported each as Bugs/S to lead for classification. No T-495 source defect inferred.

Standards: source/delta verdict stands, C1 verified; no task assertion changes or hard duration-budget failures.
Spec/evidence: all eight session-usage cases pass again, including repaired totals 11.919 s and burst/limits 10.983 s. Five serial quiet Mac file passes A-3061 remain valid. C2 runtime portions are supported but verification remains pending accepted gate. These four failing test names differ from all six in first receipt A-3076; however the standing exception requires every failure to be known, which has not yet been established for this receipt.

d6e75622/A-3101 matches reviewed/current branch head, Linux x64 c-8, host/remote typecheck green, exit 1, 1758 pass/4 fail/3 platform skips/0 cancelled; Neovim smoke not reached. First A-3076 is accepted as known-only by direct 837a1fb3, not by silently treating it as green. Await classification before final pair assessment; no third run directed here. No Reviewer tests or edits.

### rev-30 · 2026-10-15T15:16:58.006Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-495-final
commit: 0046b17afa32cb2d5450e079ab05e2374c93739b
scope: evidence

Final review clear at 0046b17afa32cb2d5450e079ab05e2374c93739b under explicit Coordinator decisions 837a1fb3-e6fa-493f-a4f6-8a6d4eb39fa8 and eea1467c-ee69-49b6-a0d1-5661840a21a7.

Standards: source/delta verdicts stand, no unresolved task findings.
Spec: C1 source verification retained. C2 verified: A-3061 establishes five serial quiet whole-file Mac passes (8/8 each); both Linux receipts pass all eight session-usage cases. Current-head totals case 11.919 s and burst/limits case 10.983 s are green; existing test durations produce no hard budget failures.

Accepted pair:
- af207517/A-3076 at reviewed 25ad9ab6d1368a52638457c875bf6afd7306d116 remains overall red: 1755 pass/6 fail/3 platform skips. Its exact outside failures are T-467, shared handover regex, T-499, T-494 family and two T-501 merge CLI timeouts. 837a1fb3 accepts this as first known-only receipt.
- d6e75622/A-3101 at delta-reviewed/current 0046b17afa32cb2d5450e079ab05e2374c93739b remains overall red: 1758 pass/4 fail/3 platform skips. eea1467c files/classifies all four as T-506 heartbeat, T-505 session-events/model frame waits, and T-507 terminal-subscription recurrence, and explicitly accepts this pair for final clear.

No failing test name overlaps across the receipts. Task source is unchanged across the reviewed integration; each Linux c-8 run passes typecheck and the usage file. The rule/explicit decisions accept the pair; neither suite is represented as green or its unrelated failures as fixed. Neovim smoke was not reached; the task net diff is hub-only.

Criteria: C2 verified, C1 retained. No third run required by eea1467c. No Reviewer tests or edits.

Criteria: C2 verified.
