---
id: T-684
kind: task
title: The test lint refuses new T3 files without a lifecycle header, new wall-clock waits and new process-helper call sites
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-682
topic: topic-477
branch: t/T-684-the-test-lint-refuses-new-t3-files
created: 2026-10-16T19:59:28.259Z
updated: 2026-10-18T04:49:22.472Z
---

## Summary

Week 1 stops the growth (memo §5.5 step 1): a new test must be T1 or T2 unless its header names the process behaviour it proves; no new literal sleeps; the real-process helpers may not spread. This ticket turns T-682's lint from report to refusal for what is new, freezes the rest in a baseline that can only shrink, and adds the `until` helper. With T-682 it supersedes T-660.

## What to build

- **New files.** A test file absent from the base `tiers.json` is refused when it is T3 without a `// T3: <behaviour>` header (or a contract or scenario entry), or when it is T1/T2 and breaks its tier's rules.
- **A baseline that only shrinks.** `hub/test/lint-baseline.json` records, per file, the count of wall-clock findings and of `startDaemon`, `spawnSpoke` and fake-binary (`fakeClaude`, `fakeCodex`, `fakeOpenCode`) call sites at the merge of this ticket. A head may not raise any count, except process-helper counts in a file with a T3 header or a contract or scenario entry. `npm run test:lint -- --shrink` lowers the baseline to the head's counts; the lint refuses a baseline that grew.
- **Refusals.** `cland verify` refuses with `verify-test-lint` and `cland merge` with `merge-test-lint`, naming file, line and rule, before queueing or changing refs. The dry run (T-681) shows the same lines.
- **`until(predicate, { what })`** in `hub/test/harness.ts`: one deadline scaled by `CLAND_TEST_LOAD_FACTOR` (default from the executor), a named failure, no fixed sleep. `docs/agents/tests.md` documents it with one existing flaky file converted as the worked example.

## Acceptance criteria

- [ ] C1. A new T3 test file without a lifecycle header is refused at verify and merge with the rule named, and the same file with the header is admitted, proved by admission and merge-gate tests.
- [ ] C2. A new numeric sleep wait in an existing file is refused unless it carries the reasoned marker, and removing one then running the shrink tool lowers the file's baseline count, proved by lint tests.
- [ ] C3. A new `startDaemon` call site in a file without a T3 header is refused, and one in a file with the header is admitted, proved by lint tests.
- [ ] C4. A baseline file whose counts grew is refused by name, proved by a lint test.
- [ ] C5. `until` fails with its `what` text after the load-scaled deadline, proved by a harness unit test, and one existing flaky test file uses it in place of its fixed sleeps with its assertions unchanged in meaning.
- [ ] C6. `docs/agents/tests.md` documents the refusal rules, the T3 header, the baseline, the shrink tool and `until`.

## Comments

### impl-684 · 2026-10-18T04:49:22.472Z

Implemented shared lint admission policy, per-file/category frozen baseline and --shrink, lifecycle/helper/wait regressions, load-scaled until helper, and hygiene reconnect worked example. Initial typecheck/test:tiers/test:lint and targeted checks green. Completing whole-file 5/5 serial checks at one-minute load <15 before committing and requesting review.
