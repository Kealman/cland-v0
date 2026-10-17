---
id: T-735
kind: task
title: Test lint misses child processes started through wrapped calls such as promisify(execFile)
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-446
branch: t/T-735-test-lint-misses-child-processes-started
created: 2026-10-17T11:42:54.922Z
updated: 2026-10-17T15:57:42.112Z
closed: 2026-10-17T15:57:42.112Z
---

## Summary

impl-704 found (T-704, 2026-10-17) that the report-only test lint says `hub/test/tracker-criterion-crash.test.ts` "qualifies T2" although `promisify(execFile)(process.execPath, …)` launches a real SIGKILL writer. The file stays T3 by its header, but a lint that refuses from T-684 onward must not under-report process use, or files get retagged too low.

## What to build

The lint follows `node:child_process` imports through common wrappers: `promisify(execFile)`, `util.promisify`, renamed and destructured imports, and helper re-exports inside the same file. A wrapped spawn counts as process use exactly like a direct one.

## Acceptance criteria

- [x] C1. Planted files that start a child through `promisify(execFile)`, a renamed import and a destructured import each produce the process-use finding, proved by lint tests, and tracker-criterion-crash.test.ts no longer qualifies below T3.
  - done: impl-735 · 2026-10-17T15:18:49.473Z
  - verified: rev-31 [reviewer] · run rev-20261017-735-final · 2026-10-17T15:54:29.492Z · commit baf4eb2b9a2059723203f40c43435d1ac81cf61a
- [x] C2. The review request lists every dev file whose "qualifies" tier changes, with the reason.
  - done: impl-735 · 2026-10-17T15:23:08.716Z
  - verified: rev-31 [reviewer] · run rev-20261017-735-source · 2026-10-17T15:24:50.898Z · commit baf4eb2b9a2059723203f40c43435d1ac81cf61a

## Comments

### impl-735 · 2026-10-17T15:17:50.347Z

Implementation extends lexical binding analysis through promisify, aliases, destructuring and exported local aliases. Static checks pass; tracker-criterion-crash qualifies T3. Full dev qualifier census is A-4576: 43 T2-to-T3 changes, including 8 declared T2 files left for a Coordinator-owned follow-up. Required serial 5/5 checks are underway.

### rev-31 · 2026-10-17T15:24:50.898Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-735-source
commit: baf4eb2b9a2059723203f40c43435d1ac81cf61a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0 findings, A-4588. Lexical declaration provenance follows promisify/util, named/namespace/default imports, local/export aliases and destructuring with cycle guard; shadowed/unused/foreign controls preserve boundaries. Generic child launches require T3, recognizable first-entry cland CLI stays T2, existing hub/harness escalation retained. Independently read Coordinator ada8339f/642e0b72 scope; eight newly affected declared-T2 files assigned T-741, no retags here. Complete 43-file qualifier census supplied with reasons; baseline 66641a53→487830ef source unchanged. C2 verified. Added planted controls cover requested wrapper forms, process finding and tracker crash T3; existing assertions unchanged. Fifteen raw Mac files independently pass (lint 10/10, tiers 8/8, runner 43/43 each five times), no skips/failures/late diagnostics. Report-only lint 354 findings/206 files disclosed. Origin/whitespace exact. C1 final regression/execution mark awaits exact-head diff-selected droplet. No Reviewer edits/tests/delegation.

Criteria: C2 verified.

### rev-31 · 2026-10-17T15:54:29.493Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-735-final
commit: baf4eb2b9a2059723203f40c43435d1ac81cf61a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards 0 / Spec 0 findings, A-4600. Independently audited exact-head A-4598 / ccd6efb9 exit 0: 2103 tests / 2098 passes / 0 failures / 5 prerequisite skips, including 12/12 Neovim smoke. Wrapper and generic-child controls pass ordinarily and 5/5, all five new lint identities 5/5; tracker-criterion-crash reports qualifies T3. C1 verified; C2 source current and independently corroborated by actual qualifier-row comparison against baseline-source A-4595: exactly 43 changes, no missing/extra census paths. Eight declared-T2 follow-ups remain T-741; no retags. A-4584 fifteen raw Mac files and source A-4588 remain applicable; origin unchanged. Hub-only plus smoke, report-only lint 354 findings/206 files disclosed, not a zero-finding/full-Neovim claim. No exception/additional run/per-item QA. No Reviewer edits/tests.

Criteria: C1 verified.

### coord · 2026-10-17T15:57:42.112Z

Merged b5cd8b4ff581715c856a03c9e6a97cc0cd2c6148 onto dev.
