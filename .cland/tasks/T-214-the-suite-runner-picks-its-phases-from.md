---
id: T-214
kind: task
title: "The suite runner picks its phases from the diff: hub-only changes skip
  the Neovim phase, Neovim-only changes skip the hub phase"
state: closed
status: done
criterion_seq: 5
labels:
  - ready-for-agent
assignee: impl-214
parent: C-216
blocked_by:
  - T-174
topic: topic-127
branch: t/T-214-the-suite-runner-picks-its-phases-from
created: 2026-10-11T06:30:53.442Z
updated: 2026-10-11T11:54:19.640Z
closed: 2026-10-11T11:54:19.870Z
---

## What to build

`hub/test/run-suite.ts` and `cland suite` compute the branch's changed paths against fetched `dev` and choose the phases:

- **`hub/` only:** the hub phase, plus a Neovim smoke subset (the tests that drive a real hub through the spoke).
- **`nvim/` only:** the Neovim phase, plus the targeted hub tests the item names.
- **Anything else** runs the full suite as today. That covers changes to both, `.cland/`, the roles or crew files, the message protocol, or the hub event shape.

The integrated dev suite after a batch always runs in full. The chosen mode is printed in the duration line and in the suite report, together with the file list that decided it.

## Acceptance criteria

- [x] C1. The phase choice is a pure function of the diff, with a unit test per rule.
  - done: impl-214 · 2026-10-11T10:29:59.787Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T214-r2 · 2026-10-11T11:22:01.830Z
- [x] C2. `--all` forces the full run.
  - done: impl-214 · 2026-10-11T10:39:26.827Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T214-r2 · 2026-10-11T11:22:01.830Z
- [x] C3. The suite report names the mode and the deciding files.
  - done: impl-214 · 2026-10-11T10:39:27.038Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T214-r2 · 2026-10-11T11:22:01.830Z
- [x] C4. A hub-only item on dev shows the lock held for the hub phase and the smoke only.
  - done: impl-214 · 2026-10-11T10:30:00.182Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T214-r2 · 2026-10-11T11:22:01.830Z
- [x] C5. `npm run typecheck && npm test` pass.
  - done: impl-214 · 2026-10-11T11:21:42.584Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T214-r2 · 2026-10-11T11:22:01.830Z

## Notes

Requested by the human via the stand-in, 2026-10-11. Launch right after T-174 lands. Context: most wall-clock goes to waiting for the serialized suite, and T-201, T-207 and T-203 made the queue fair but not shorter.

## Comments

### impl-214 · 2026-10-11T10:19:36.722Z

Implementation started at dev d8f5e01 in the claimed worktree. Tests will cover the item-specified pure diff selector and the existing runner CLI/report seams. Auto mode will fetch dev, preserve full integrated-dev runs, and use full for ambiguous paths or missing Neovim-only targeted hub tests.

### impl-214 · 2026-10-11T10:29:05.547Z

Implemented automatic selection from fetched origin/dev merge-base diff plus working/untracked changes, with conservative allowlists and shared/event/tooling paths forcing full. Tracker-only and empty diffs run full; fetch failures report their reason. Smoke constants are hub tracer+daemon and Neovim client+sessions, documented in hub/README.md. Durable jobs transport one decision to the runner and report. Local pure/Git/CLI smoke tests pass; typecheck identified a fixture env annotation, now corrected. Existing suite CLI and lock regression tests are running before the required reviewed full suite.

### rev-15 · 2026-10-11T10:33:08.573Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T214
commit: 262cf79f136d1f0af6340825ceddb209cf5d837e

Standards:
Medium — hub/src/hub/dispatch.ts:528: unbounded describeSelection filenames can exceed core.sendFromSession's hygiene cap; retries regenerate the same rejected text, leaving finished suites unreported. Bound report summary and retain full deciding list in durable log.
No other documented-standard or actionable smell findings.

Spec:
Medium — hub/test/run-suite.ts:307: --all with explicit targets (e.g. node hub/test/run-suite.ts --all hub/test/tracer.test.ts) runs that file twice instead of whole phases while reporting full, violating C2. CLI force-all must override/reject targets.
Medium — hub/src/hub/dispatch.ts:528: the same oversized report path fails C3's delivered mode/files reporting requirement.

C2/C3 failed. C1 selector/rule coverage and C4 retained-lock coverage inspected; C5 suite pending. Accepted fixed smoke baseline and tracker/empty/fetch full fallback decisions per Coordinator. Reviewer ran no tests and made no edits. Detailed two-axis review artifact in topic-127.

Criteria: C2 failed (CLI --all with explicit targets runs only those targets in both phases while reporting full.), C3 failed (Unbounded deciding-file JSON can exceed the message cap and strand finished suite report publication on every retry.).

### impl-214 · 2026-10-11T10:35:54.315Z

Review fixes in progress (rev-20261011-15-T214): C2 regression reproduced --all plus explicit target running only the target twice; CLI now discards targets when forced full while retaining targeted fixture API compatibility. C3 regression reproduced a 150-file Unicode diff stranding publication at a 768-byte hygiene cap; report now bounds the file summary to the actual configured cap, preserving complete paths in the durable log and retaining a compact result/artifact fallback.

### impl-214 · 2026-10-11T11:21:42.854Z

Fresh full suite f23d5c1d-e495-482e-a909-3421e8fe32a0 passed at 74d278797d3dc2efc459d7fc74e14e2d25cdda6d: typecheck and full hub+Neovim phases, 1473 tests passed, zero failures/cancellations/skips. Durable log A-1212: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1212-suite-f23d5c1d-e495-482e-a909-3421e8fe32a0-all-at-74d2787.log. C5 marked done. Re-review code clear per rev-15 A-1188; awaiting its final verdict and hub ready event.

### rev-15 · 2026-10-11T11:22:01.830Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T214-r2
commit: 74d278797d3dc2efc459d7fc74e14e2d25cdda6d

Standards: clear; report-size failure resolved with cap-aware UTF-8 samples/fallback and complete deciding paths in the log. No remaining findings.
Spec: clear; C1 pure selector/rule coverage, C2 forced-full target precedence, C3 delivered mode/files reporting, and C4 joint-lock phase/smoke continuity established in A-1188. Fixed smoke baseline and conservative fallbacks follow Coordinator decisions.
C5 verified from fresh suite f23d5c1d at exact reviewed head 74d2787, durable log A-1212: npm run typecheck and npm test full mode pass; hub 1209/1209 plus Neovim 264/264, total 1473/1473; zero fail/cancelled/skipped/todo, exit 0. No exception needed.
All C1–C5 verified. Final review artifact in topic-127; detailed review A-1188. Reviewer made no edits and ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-11T11:22:13.926Z

Merged 1697cedaba7f3e6729d5ef4f31827718cfd4317c onto dev.
