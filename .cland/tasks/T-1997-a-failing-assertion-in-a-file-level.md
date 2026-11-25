---
id: T-1997
kind: task
title: A failing assertion in a file-level after hook may not fail the test run
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1790
branch: t/T-1997-a-failing-assertion-in-a-file-level
created: 2026-11-19T03:30:57.433Z
updated: 2026-11-25T13:59:50.726Z
---

## Summary

impl-1676 observed in T-1676 (2026-11-19) that a failing assertion in a file-level `after` hook didn't fail the run in this harness. In an isolated legacy Codex control, the hook ran with one leftover placeholder, the child exited 0, and the parent still saw the placeholder. In the full-file control the child exited 0 with 69 passing and 4 placeholders left. Moving the identical check into a final named test produced exit 1 and a failed case. If this holds in general, every guard or census written as a file-level `after` assertion may pass silently.

## What to build

First, reproduce minimally: a file whose `after` hook throws or fails an assertion, run through the project's test runner and suite pipeline in both direct and parallel modes. Record whether the exit status, the suite result and the failure list show it. If they don't, make an `after`-hook failure fail the file with a named failure in every runner path. Alternatively, add a lint that refuses assertions in file-level `after` hooks and points to a final named test, then migrate the existing ones.

## Acceptance criteria

- [x] C1. A minimal reproduction records exactly what each runner path does with a failing file-level `after` hook (exit status, suite result, failure list), with literal output (evidence).
  - done: impl-1997 · 2026-11-25T13:48:00.990Z
- [x] C2. A failing file-level `after` hook fails its file with a named failure in every supported runner path (`node --test`, runSuite direct and parallel); a child test run started from a test does not inherit NODE_TEST_CONTEXT, so it cannot skip a file silently; and a report-only lint names file-level `after` assertions (enforcement in a follow-up item, rule 27) (test).
  - done: impl-1997 · 2026-11-25T13:58:52.605Z
- [x] C3. Every existing file-level `after` hook that asserts is listed with its disposition (rule 41).
  - done: impl-1997 · 2026-11-25T13:48:01.524Z

## Comments

### coord · 2026-11-19T07:10:56.039Z

A possible lead from impl-1669 (T-1669, 2026-11-19): a nested `node --test` child that inherits `NODE_TEST_CONTEXT` from its parent runner silently skipped files until that variable was removed with the fixtureEnvironment final overlay. Check whether inherited `NODE_TEST_CONTEXT` in the child explains T-1676's observation (exit 0 despite a failing `after` hook) before calling it a harness defect.

### impl-1997 · 2026-11-25T13:46:25.109Z

Consumer audit and C1/C3 evidence: A-23440 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23440-t-1997-hook-reproduction-and-dispositions.md); literal-import consumer list A-23441 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23441-t-1997-consumer-inventory.json). Inventory: 28 direct neutral-environment importers, 11 direct test-lint importers, 954 reachable test files across tiers. Raw NODE_TEST_CONTEXT production readers already clear it; builder now clears after final overlay. New file-after finding is advisory only, existing result fields unchanged, old finding shapes retained. Six original global after source files audited: three direct assertion guards migrated; account/prepared cleanup retained; tip-churn indirect guard retained for T-2107 per Coordinator decision. T-2108 literal contradictory progress row is in A-23440. No help export or frozen usage bytes changed. Five close consumers checked locally; full reachable closure deferred to verify.

### rev-35 · 2026-11-25T13:52:53.059Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1997-source-1
commit: fcd1f8250fc1bbb881cbc2d6944ed3aacc34624a
scope: full
findings: [{"severity":"medium","text":"M1: Three new native direct/serial/parallel callbacks use fixtureWork root/step/acquire without separate named setup/native-close observation deadlines. Its5s budget bounds settle/dispose only; await child.closed and spawn setup are otherwise unbounded. Source gap confirmed; preserve early resource stop/original work/positive close/root retention while adding shared bounded observations.","file":"hub/test/after-hooks.test.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23446 records one medium finding/clear bar; no additional filter/census/migration/consumer blocker. Final NODE_TEST_CONTEXT filter and reportOnly policy checks reviewed; C1 literal reproduction and C3 six-source dispositions retained, including approved tip-churn T-2107/progress T-2108 follow-ups. Add shared real-time policy observations preserving all exact exit/signal/hook/failure-list assertions; no broader redesign. Source/experiment hold released for correction; fresh committed-head review before configured verification; human midnight/Coordinator spending hold remains. Reviewer ran no tests/lint/probes/native/browser.

Criteria: C2 failed (M1: give all three supported native regression modes separate named setup and native-completion bounds without losing owned original acquisition/close work.).

### rev-40 · 2026-11-25T13:59:50.726Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1997-source2
commit: 6363563e4b23bdf81cfacbb73bf4fbfad683cb9e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23449 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23449-t-1997-correction-source-clear-at-6363563e4.md), no findings. Prior M1 resolved by named root/write/launch setup observations and producing-native-close observation under shared caseDeadlines/testDeadlineMs policy. Early captured-child stop precedes original-work join; late acquisition is adopted; fenced resource cleanup awaits close before roots. Original exact exit1/signal-null, hook/assertion/fail1 and structured file-failure checks retained. Full prior environment isolation/report-only lint/migration scope reviewed; C1 literal reproduction and C3 dispositions retained with approved T-2107/T-2108 follow-ups. Current local A-23448: native3/3, shared T2 10/10, static0; other A-23443 receipts remain earlier and 954 reachable files are inventory, not coverage. C1–C3 final marks pending exact-head configured evidence. Human midnight UTC hold/Coordinator window unchanged. Reviewer ran no tests/probes or edits.
