---
id: T-453
kind: task
title: executor-run remote-verify test's scan reads a transient spend.json.lock.break entry (ENOENT)
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-291
branch: t/T-453-executor-run-remote-verify-test-s-scan
created: 2026-10-15T06:07:18.320Z
updated: 2026-10-15T12:30:32.150Z
---

## Summary

`hub/test/executor-run.test.ts:16` (remote verify) failed in T-254's gate b6f1e5ff (A-2699): its state scan at line 45 hit ENOENT, at line 51, on a transient `.cland/executor-state/spend.json.lock.break` entry that the ledger lock removed while the scan read it. T-389 fixed the same class in executor-safety's sentinel scan by quiescing the hub before the audit (A-2595..A-2599). Apply the same boundary here, or skip lock-break entries that vanish during the scan.

## Acceptance criteria

- [x] C1. The scan tolerates, or excludes by quiescing, the ledger's transient lock entries, and the file passes 5/5 beside a local full run.
  - verified: rev-30 [reviewer] · run rev-20261015-453-final · 2026-10-15T12:30:11.983Z · commit aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73
  - done: impl-453 · 2026-10-15T12:30:30.221Z

## Comments

### impl-453 · 2026-10-15T11:38:56.922Z

Applying the proven T-389 audit boundary: finish live/cache/invalid-executor checks and flush logs, then assert successful fixture hub shutdown before recursively scanning persisted bytes. No token assertions, timing bounds or scan entries are weakened. The existing A-2699 ENOENT receipt and T-389 repair establish this test-only failure pattern; skipping a new race-injection regression that would duplicate the audit implementation. Existing whole-file repetitions exercise the repaired boundary.

### rev-30 · 2026-10-15T11:41:42.102Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-453-source
commit: aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73
scope: full

Source review clear; no high, medium or low findings.

Standards: no findings; follows the existing T-389 executor-safety persisted-audit boundary.
Spec: hub/test/executor-run.test.ts:44–46 asserts fixture hub shutdown after all live checks and log flush, before scanning persisted bytes. CLI stop waits for process exit, removing the active ledger sweep writer. Original complete local/remote directory scan and all token/call/API assertions remain unchanged; no skipped entries/errors, production changes or widened bounds.

A-2945 records typecheck and loaded whole-file run 1 green (18/18). C1 remains unverified pending five repetition receipts and accepted same-head post-source gate. Direct Coordinator afa03f95 allows at least three loaded of five, with quiet remainder labelled, and no new local tests during cover quiet window. No Reviewer tests or changes.

### impl-453 · 2026-10-15T11:43:03.331Z

Head aa9ecfac pushed, source review clear rev-20261015-453-source. Targeted whole-file loaded repetitions 1–2 each passed 18/18, wall times 86.238s/92.233s beside impl-447's full run 51c6416e. npm run typecheck passed. Configured verify 851aacd5 submitted. Remaining repetitions held because local coord full cover 6a13b9a5 now owns slot; will resume afterward per Coordinator afa03f95, at least one further loaded pass required.

### rev-30 · 2026-10-15T11:52:20.418Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-453-cancelled
commit: aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73
scope: evidence

Evidence review not clear: verification incomplete, no new T-453 source finding.

Standards: source review rev-20261015-453-source stands.
Spec/evidence: 851aacd5/A-2954 at reviewed aa9ecfac was cancelled, exit 143; not accepted gate evidence or a qualifying completed Linux receipt. Repaired executor-run.test.ts:16 audit case passes in 8.081 s (A-2954:1174); all nine top-level executor-run cases print green. No final machine-shard summary; receipt 37/37 is the completed free shard only.

Three outside-task failure lines appear (Claude session signal order/prior-launch and Codex accepted-steer recovery), without final stack summaries due cancellation. No causal/known-ticket classification inferred here. C1 remains unverified; no failed criterion mark for cancellation. Repetitions 1–2 reported green loaded; three remain, at least one more loaded under afa03f95. No new verify before announced restart per bef82ca8. No Reviewer tests or edits.

### rev-30 · 2026-10-15T12:26:16.306Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-453-gate-green
commit: aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73
scope: evidence

Gate evidence clear; no new high, medium or low source findings. Final C1 settlement still awaits fifth repetition.

Standards: source review rev-20261015-453-source stands.
Spec/evidence: same-head 7453981f/A-2966 exits 0, typecheck green, hub-only + Neovim smoke, 1734/1734 passed, zero failures/skips/cancellations; local darwin arm64, Node v24.21.0, Neovim v0.12.5. Current branch matches exact reviewed aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73.

Direct Coordinator 8ff12347 accepts this local fallback gate and A-2954's nine green executor-run top-level cases as scoped Linux evidence; cancelled A-2954 is not described as a completed gate. Fallback cause: droplet lock acquisition deadline reached.

Direct Coordinator dafb7b70 accepts two loaded + three labelled quiet standalone files. A-2949/A-2963 establish four 18/18 passes so far; fifth is still pending under local load rules. C1 remains unverified until that receipt. No further gate run required by this review.

### impl-453 · 2026-10-15T12:29:38.493Z

Final evidence A-2969: all 5 serial executor-run.test.ts repetitions passed 18/18, zero failures/skips/cancellations. 1–2 loaded (86.238s, 92.233s), 3–5 quiet at start (144.491s, 123.683s, 62.039s); run 4 overlapped the later local gate. Run 5 admitted with load 3.62 and no other targeted test, queue local empty. Source aa9ecfac unchanged, clean tree. A-2966 same-head gate 1734/1734 green; per Coordinator 8ff12347, paired with A-2954 Linux executor-run file evidence. Requested final C1 settlement from rev-30.

### rev-30 · 2026-10-15T12:30:11.983Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-453-final
commit: aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73
scope: evidence

Final review clear; no high, medium or low findings. Current branch/source/gate head remains aa9ecfac203c6152e6b1fb1ca43e49ce0be7ae73.

Standards: source review rev-20261015-453-source stands, no findings.
Spec: C1 verified. Quiesced scan preserves every original token assertion. A-2969 raw logs establish 5/5 serial whole-file passes, each 18/18 with zero failures/skips/cancellations. Exactly two loaded beside impl-447 full run and three labelled quiet at start (fourth later overlapped local gate), accepted by direct Coordinator dafb7b70. Fifth passes 62.039 s; no claim all five were loaded.

Accepted same-head gate 7453981f/A-2966: exit 0, typecheck green, hub-only + Neovim smoke, 1734/1734, zero skips/failures/cancellations, local darwin arm64 after automatic droplet lock-deadline fallback. Direct Coordinator 8ff12347 accepts this plus scoped Linux evidence from A-2954's nine green executor-run top-level cases. A-2954 remains cancelled overall, not a completed gate; its outside failures and cancellation preserved in prior A-2955. No further droplet needed under that decision. No Reviewer tests/edits.

Criteria: C1 verified.
