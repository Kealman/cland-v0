---
id: T-509
kind: task
title: "role-integrity test: the relaunched spoke's refusal after a rename isn't seen within 15 s (Linux, under load)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-583
branch: t/T-509-role-integrity-test-the-relaunched-spoke
created: 2026-10-15T15:39:05.347Z
updated: 2026-10-19T12:20:32.540Z
closed: 2026-10-19T12:20:00.326Z
---

## Problem

`hub/test/role-integrity.test.ts:152`, the renamed-session revocation case, failed on Linux in T-498's droplet verify 65bb9a73 (A-3130). The `eventually` at :174, "the relaunched spoke refused", didn't hold within 15000 ms. The head carries T-486, so this isn't the Codex first-turn idle race; it's the relaunch/refusal path after a rename under 4-worker load.

## Acceptance criteria

- [x] C1. The case observes the relaunched spoke's connection and refusal through a definite event, rather than polling a 15 s window that a loaded relaunch can outlast, or the window is aligned with the product's own relaunch deadline, citing its line. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-509 · 2026-10-19T11:31:41.205Z
  - verified: rev-30 [reviewer] · run rev-20261019-509-source · 2026-10-19T11:33:23.320Z · commit c9974715309626b20d6a97d6ee3a241cae0cf610
  - verified: rev-30 [reviewer] · run rev-20261019-509-final · 2026-10-19T11:42:07.601Z · commit c9974715309626b20d6a97d6ee3a241cae0cf610
- [x] C2. role-integrity.test.ts and role-integrity-component.test.ts each pass 5/5 serially, whole file and alone, on the Mac, and the mode-free task verify passes at the reviewed head; the native file's Linux T3 run comes from the merge batch that lands this item and is recorded by the Coordinator as landing evidence, not as a gate.
  - done: impl-509 · 2026-10-19T11:41:19.819Z
  - verified: rev-30 [reviewer] · run rev-20261019-509-final · 2026-10-19T11:42:07.601Z · commit c9974715309626b20d6a97d6ee3a241cae0cf610

## Comments

### impl-509 · 2026-10-19T11:28:56.308Z

Reproduced exact 15s timeout with a temporary 16s deferred renamed-spoke attachment, then passed with the same delay using a bounded refused-role event observation (A-5960: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5960-t-509-controlled-delayed-connection-red-green.md). The case moved to role-integrity-component.test.ts during tier migration. Fix keeps the scenario and assertions, validates refusal name/sessionId, then flushes the journal before reading it. npm run typecheck passes; 20 serial Mac whole-file repetitions in progress for component and original native file.

### rev-30 · 2026-10-19T11:33:23.320Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-509-source
commit: c9974715309626b20d6a97d6ee3a241cae0cf610
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5968. Standards/Spec no findings. Refusal listener armed before resume, exact boss/original sessionId assertions, acknowledged journal flush before retained refusal record; all original role/process/presence assertions preserved. Commit records root boundary; A-5960 controlled delayed-attach red/green retained. Full A-5966 audited: both Mac whole files 20/20, forty exit0 and zero fail/cancel/skip/TODO. C1 verified. C2 remains unverified pending same-head task receipt and lead alignment of old native-file/task-verify wording to relocated T2/deferred T3 policy. No Reviewer edits/tests.

Criteria: C1 verified.

### impl-509 · 2026-10-19T11:39:48.525Z

Exact reviewed head c9974715309626b20d6a97d6ee3a241cae0cf610 passed mode-free droplet verification 1c0d84f0-daa3-48d4-8e34-f41fa414adc2: 401/401 tests, including selected role-integrity-component.test.ts 5/5 (0.596s). A-5978: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5978-suite-1c0d84f0-daa3-48d4-8e34-f41fa414adc2-auto-at-c997471.log. Linux x64 c-8 lon1, 324s lifetime, $0.0225. Native T3 remains deferred to merge batch by queue policy. Source clear; both Mac files 20/20 in A-5966. C2 remains unmarked until lead aligns old native-filename/task-droplet wording with current T2/T3 policy.

### rev-30 · 2026-10-19T11:42:07.601Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-509-final
commit: c9974715309626b20d6a97d6ee3a241cae0cf610
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-5982. Coordinator 0075bfdb formal disposition and revised C2 read back. Audited Mac A-5966 gives20/20 each whole file; A-5978/1c0d84f0 gives401/401 task pass, zero fail/cancel/skip/TODO, zero tier-mismatch rows, all171 global groups5/5. Corrected component case and whole file pass; native Linux file not executed/claimed here. Source A-5968 plus completed audit A-5979 establish C1 and revised C2. No findings; native T3 remains Coordinator-owned landing evidence, report-only diagnostics disclosed.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T12:20:00.326Z

Merged 6efce790daa46e7575e5e48567e3b3ff5653c380 onto dev.

### coord · 2026-10-19T12:20:32.540Z

Landing evidence (C2, Coordinator-owned, not a gate): merge batch 8942325b (T-509, T-836, T-854), run 22fe413f on Linux x64 c-8 lon1 (A-6016). The native role-integrity.test.ts passed whole-file, including both of its remaining cases. The batch's only failure was resilience.test.ts:172, which is outside T-509. All three leave-one-out reruns and the original-tree repeat passed it 11/11, so the hub classified it as flaky and landed the batch; it is filed as T-871. T-509 landed at 6efce790.
