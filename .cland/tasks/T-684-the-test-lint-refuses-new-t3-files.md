---
id: T-684
kind: task
title: The test lint refuses new T3 files without a lifecycle header, new wall-clock waits and new process-helper call sites
state: open
status: review
size: M
criterion_seq: 6
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
updated: 2026-10-18T05:34:58.514Z
---

## Summary

Week 1 stops the growth (memo §5.5 step 1): a new test must be T1 or T2 unless its header names the process behaviour it proves; no new literal sleeps; the real-process helpers may not spread. This ticket turns T-682's lint from report to refusal for what is new, freezes the rest in a baseline that can only shrink, and adds the `until` helper. With T-682 it supersedes T-660.

## What to build

- **New files.** A test file absent from the base `tiers.json` is refused when it is T3 without a `// T3: <behaviour>` header (or a contract or scenario entry), or when it is T1/T2 and breaks its tier's rules.
- **A baseline that only shrinks.** `hub/test/lint-baseline.json` records, per file, the count of wall-clock findings and of `startDaemon`, `spawnSpoke` and fake-binary (`fakeClaude`, `fakeCodex`, `fakeOpenCode`) call sites at the merge of this ticket. A head may not raise any count, except process-helper counts in a file with a T3 header or a contract or scenario entry. `npm run test:lint -- --shrink` lowers the baseline to the head's counts; the lint refuses a baseline that grew.
- **Refusals.** `cland verify` refuses with `verify-test-lint` and `cland merge` with `merge-test-lint`, naming file, line and rule, before queueing or changing refs. The dry run (T-681) shows the same lines.
- **`until(predicate, { what })`** in `hub/test/harness.ts`: one deadline scaled by `CLAND_TEST_LOAD_FACTOR` (default from the executor), a named failure, no fixed sleep. `docs/agents/tests.md` documents it with one existing flaky file converted as the worked example.

## Acceptance criteria

- [x] C1. A new T3 test file without a lifecycle header is refused at verify and merge with the rule named, and the same file with the header is admitted, proved by admission and merge-gate tests.
  - done: impl-684 · 2026-10-18T04:57:01.679Z
- [x] C2. A new numeric sleep wait in an existing file is refused unless it carries the reasoned marker, and removing one then running the shrink tool lowers the file's baseline count, proved by lint tests.
  - done: impl-684 · 2026-10-18T04:57:02.078Z
- [x] C3. A new `startDaemon` call site in a file without a T3 header is refused, and one in a file with the header is admitted, proved by lint tests.
  - done: impl-684 · 2026-10-18T04:57:02.814Z
- [x] C4. A baseline file whose counts grew is refused by name, proved by a lint test.
  - done: impl-684 · 2026-10-18T04:57:04.458Z
- [x] C5. `until` fails with its `what` text after the load-scaled deadline, proved by a harness unit test, and one existing flaky test file uses it in place of its fixed sleeps with its assertions unchanged in meaning.
  - done: impl-684 · 2026-10-18T04:57:05.627Z
- [x] C6. `docs/agents/tests.md` documents the refusal rules, the T3 header, the baseline, the shrink tool and `until`.
  - done: impl-684 · 2026-10-18T04:57:07.252Z
  - verified: rev-30 [reviewer] · run rev-20261018-684-source · 2026-10-18T05:05:41.542Z · commit ab93275fc79203cdf2926027f92a6c2752daa509
  - verified: rev-30 [reviewer] · run rev-20261018-684-coverage-delta · 2026-10-18T05:34:58.514Z · commit 00c13011d1df307dc342a0ed727d92c3c895f073

## Comments

### impl-684 · 2026-10-18T04:49:22.472Z

Implemented shared lint admission policy, per-file/category frozen baseline and --shrink, lifecycle/helper/wait regressions, load-scaled until helper, and hygiene reconnect worked example. Initial typecheck/test:tiers/test:lint and targeted checks green. Completing whole-file 5/5 serial checks at one-minute load <15 before committing and requesting review.

### impl-684 · 2026-10-18T05:02:27.119Z

Source ab93275fc79203cdf2926027f92a6c2752daa509 committed and pushed to origin after merging origin/dev. All C1–C6 marked done. Typecheck, tier lint and test lint green; every touched whole test file passed 5/5 serial at peak one-minute load 12.038 (<15). Implementation/criterion map and all 30 receipts: A-4967, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4967-t-684-implementation-and-final-serial-5-5-receipts. Source review delivered to Reviewer; waiting for verdict before exact-head droplet verification.

### rev-30 · 2026-10-18T05:05:41.542Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-684-source
commit: ab93275fc79203cdf2926027f92a6c2752daa509
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4970: source clear, no Standards/Spec findings; C6 verified from documentation. Shared direct-source policy gates committed/worktree verify and immutable merge before queue/ref mutation with typed codes and file/line/rule text; dry run uses the same inspection. Baseline categories are independent, values cannot grow/disappear, and shrink takes per-category minima; all 339 manifest paths match. Reasoned markers/lifecycle exceptions and same-line bound-site counting are covered. until owns a scaled deadline and retains reconnect identity assertions. Direct-only admission follows T-744's accepted diagnostic-reachability scope. Audited A-4967: all six files 5/5, 300 test passes, zero failures/cancellations/skips. No duration allowance changes. C1–C5 runtime verification remains pending exact-head task evidence.

Criteria: C6 verified.

### impl-684 · 2026-10-18T05:34:25.202Z

First droplet A-4990 failed only the process coverage fixture: its copied harness support list omitted until.ts. Reproduced the exact missing module on Mac, added the file in one line, and pushed 00c13011d1df307dc342a0ed727d92c3c895f073. Whole suite-coverage.test.ts passed 5/5 serial at peak load 3.435; typecheck, tiers and lint green again. Delta review requested before fresh droplet verification. Evidence A-4991: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4991-t-684-coverage-fixture-dependency-fix-and-serial-5-5-receipts. T-747 current account module copy compatibility inspected read-only; subscribed to its landing.

### rev-30 · 2026-10-18T05:34:58.514Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-684-coverage-delta
commit: 00c13011d1df307dc342a0ed727d92c3c895f073
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-4992: Standards/Spec delta clear, no findings. Sole change copies until.ts into the process-coverage fixture; its Clock dependency is already in copied hub/src. No original assertion, baseline, policy or allowance changes. Failed parent A-4990 remains disclosed; Coordinator eebb1875 authorizes correction/review/new verification. A-4991's five whole-file logs each pass both tests (10 aggregate passes), with positive package-capture receipts, zero failures/cancellations/skips and peak load 3.435. Current T-747 account module remains in the support list; landing follow-up remains explicit. C6 documentation refreshed; C1–C5 remain unverified until a passing exact-head task receipt. Normal verification may proceed.

Criteria: C6 verified.
