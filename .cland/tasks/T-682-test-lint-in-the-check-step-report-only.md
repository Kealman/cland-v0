---
id: T-682
kind: task
title: "Test lint in the check step, report only: tier import rules, wall-clock waits and the T3 lifecycle header"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
  - T-680
topic: topic-426
branch: t/T-682-test-lint-in-the-check-step-report-only
created: 2026-10-16T19:59:27.971Z
updated: 2026-10-17T07:53:08.285Z
---

## Summary

The guidelines in `docs/agents/tests.md` exist only as text, so 481 `startDaemon` sites, 158 literal sleeps and 147 `Date.now` deltas kept growing (memo §2, §3.1; A-4004 recommendation 4). T0 gets a test lint (memo §5.1, §5.2.2). This ticket runs it in report mode only (memo §5.5 step 0); T-684 makes it refuse. It supersedes T-660's lint half.

## What to build

A lint module beside the tier lint, run once per run in the check step (after the typecheck, T-680) and by `npm run test:lint`. Its rules, per file and tier:

- **T1**: no `node:child_process`, `node:net`, `node:http(s)`, `node:dgram`; none of the harness's process or socket helpers (`projectHub`, `startDaemon`, `spawnSpoke`, `cland`/`clandWithEnv`, `connectUi`, the fake harness binaries); in-process pieces (`createHubBase`, `dispatcherUi`, the in-process fake adapter and fake clock) are allowed.
- **T2**: none of `startDaemon`, `killDaemon`, `spawnSpoke`, `fakeClaude`, `fakeCodex`, `fakeOpenCode`, or a spawned hub; `projectHub`, real sockets and a CLI subprocess are allowed. A Neovim file is T2 when it drives headless Neovim against the stub hub only; one that starts a real hub is T3.
- **Every tier**: a numeric literal passed to `sleep`, `pause`, `delay` or `setTimeout` used as a wait, and an assertion on a `Date.now()`/`performance.now()` difference, unless the line carries `// lint-allow-wall-clock: <reason>`.
- **T3**: the file's first comment block names the process behaviour it proves (`// T3: <behaviour>`), or the file is a contract or scenario entry.

Report mode: the result, the log and `cland verify --dry-run` (T-681) print `test lint (report only): <n> findings in <m> files`, the top findings by file, and per file the lowest tier it already qualifies for. Nothing refuses.

## Acceptance criteria

- [x] C1. A planted T1 file importing `node:child_process` and a planted T2 file calling `startDaemon` each produce a finding naming file, line and rule, and clean T1/T2 files produce none, proved by lint tests.
  - done: impl-682 · 2026-10-17T07:53:01.186Z
- [x] C2. A planted numeric sleep used as a wait and a planted elapsed-milliseconds assertion each produce a finding, and the reasoned marker suppresses it, proved by lint tests.
  - done: impl-682 · 2026-10-17T07:53:01.580Z
- [x] C3. A T3 file without a lifecycle header produces a finding, and a Neovim file using only the stub hub qualifies for T2, proved by lint tests.
  - done: impl-682 · 2026-10-17T07:53:01.934Z
- [x] C4. The lint runs once per run in the check step, its summary and per-file qualifying tier appear in the result and in the dry run, and no finding changes a run's exit, proved by a run-report test.
  - done: impl-682 · 2026-10-17T07:53:02.218Z
- [x] C5. The repository's finding counts per rule at the merge head are recorded on this item as the baseline T-684 freezes.
  - done: impl-682 · 2026-10-17T07:53:02.575Z

## Comments

### coord · 2026-10-16T21:45:37.772Z

Coordinator, input from T-679: hub/test/clock.test.ts declares itself T1, but its FakeClock setTimeout/setInterval calls and source-boundary literals match the MACHINE pattern in hub/src/suite-shards.ts. So the T1 hermetic check refuses it, and T-679 tagged it T2 for now. The tier import rules here should tell FakeClock timer calls from real timers, so that T-690 can retag it to T1.

### coord · 2026-10-16T23:29:37.487Z

Coordinator, second scanner false positive, from T-686. The MACHINE pattern in hub/src/suite-shards.ts matches any import path containing 'harness', including the in-process ./fakes/harness.ts. That makes T-686's unit file (fake-harness-capabilities.test.ts) fail T1, so it's tagged T2 for now. The tier import rules here should tell in-process fakes from process helpers by module, not by a substring of the path. T-690 then retags it, and clock.test.ts, to T1.

### impl-682 · 2026-10-17T07:53:01.165Z

Implementation committed/pushed at 37cc3a2dad5d8f3da9daca528538b7705df3d79b after fetching/merging origin/dev (already current). C5 baseline for this head to merge: 267 files, 504 findings in 238 files; tier-import 0, tier-process 0, wall-clock-wait 125, wall-clock-assertion 144, t3-lifecycle 235. Full per-file findings/qualifying tiers: A-4366 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4366-t-682-report-only-lint-baseline-at-37cc3a2d.json). Complete npm check output A-4367. Both known false-positive files qualify T1 with zero findings. T-684 can freeze this exact source baseline; refresh if the final merge tree adds unrelated test changes.
Validation at load 2.7–3.0: npm run typecheck, npm run test:tiers, npm run check pass. Serial files: test-lint.test.ts 0.158s, suite-check.test.ts 0.627s, suite-tiers.test.ts 0.297s, suite-dry-run.test.ts 2.680s, suite-tier-report.test.ts 0.146s. No assertions removed; legacy hermetic refusal fixtures remain and now also prove in-process fakes pass admission. QA policy scope none.
