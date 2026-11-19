---
id: T-1993
kind: task
title: The duration-allowance printer names the nearest open container as owner, which the lint refuses for epics
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1646
branch: t/T-1993-the-duration-allowance-printer-names-the
created: 2026-11-19T02:34:21.412Z
updated: 2026-11-19T05:24:20.010Z
closed: 2026-11-19T05:24:20.010Z
---

## Summary

`durationAllowanceStanzas` prints the allowance owner as the task's nearest open container, and docs/agents/tests.md documents that rule. For a task under an epic, the duration lint refuses that stanza: "duration allowance has epic owner E-1883 ... use a standing container (for example E-880)". impl-1952 hit this in T-1952 on 2026-11-19, so the shared printer's own output fails admission.

## What to build

Make the printer pick an owner the lint accepts, a standing container, and make docs/agents/tests.md say the same. Keep one rule for owner admission and have the printer use it, so the two can't drift apart again.

## Acceptance criteria

- [x] C1. For a task under an epic, the printed stanza names a standing container, and the duration lint accepts it unchanged (test, red on the current printer).
  - done: impl-1993 · 2026-11-19T03:47:28.335Z
  - verified: rev-36 [reviewer] · run rev-36-1993-final-1 · 2026-11-19T04:24:25.784Z · commit adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0
- [x] C2. docs/agents/tests.md's generated-stanza paragraph states the same owner rule the lint enforces (docs).
  - done: impl-1993 · 2026-11-19T03:47:29.020Z
  - verified: rev-36 [reviewer] · run rev-36-1993-source-1 · 2026-11-19T03:53:05.623Z · commit adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0
  - verified: rev-36 [reviewer] · run rev-36-1993-final-1 · 2026-11-19T04:24:25.784Z · commit adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0

## Comments

### coord · 2026-11-19T03:00:31.804Z

Second symptom, from T-1957's verify ab774d6b (A-21515, 2026-11-19). When the nearest open container is an epic, the printer prints nothing and fails the T4 phase: "duration check: allowance owner unavailable; cannot print commit-ready stanzas; link task to an open container". T-1957 is linked to the open epic E-1883, so the advice is wrong too. The fix should default to a standing container the lint accepts, such as E-880.

### impl-1993 · 2026-11-19T03:42:20.562Z

Rule 20 inventory: printer durationAllowanceStanzas is called by taskDurationReport (suite-duration-budget.ts), then run-suite.ts; direct tests in suite-duration-budget.test.ts. Owner lookup durationAllowanceOwner callers: suite-selection.ts and suite-tiers.test.ts. Admission predicate isStandingDurationOwner readers: lookup and lintDurationManifest in suite-durations.ts. Lint/owner-record consumers: suite-shards.ts, run-suite.ts, suite-tiers.test.ts, suite-duration-budget.test.ts, durations-runner-budget.test.ts, durations-refresh.test.ts. Text readers/examples: docs/agents/tests.md, docs/agents/tests/hub-test-suite-duration-budget.test.ts.md, docs/hub/standing-duration-allowance-owners.md, docs/hub/running.md, hub/test/lint-tiers.ts and its frozen CLI usage. Searched hub, nvim, web, shared, docs, qa and .agents for field/function names and wording. No wire shape, admission predicate or CLI help change intended; existing callers remain compatible. No durations.json edits.

### impl-1993 · 2026-11-19T03:46:49.640Z

Implementation uses unchanged isStandingDurationOwner admission for both nearest ancestor and configured budget.legacyOwner fallback, per Coordinator decision. Shared durationLegacyOwner keeps omission default E-677 consistent across lint, report and selector. The fallback's dates remain seven days. Diagnostic now names the standing rule. Consumers updated: suite-selection.ts wires the pinned manifest fallback; suite-duration-budget.ts diagnostic/default reader; docs/agents/tests.md, matching file guide, docs/hub/running.md and standing-duration-allowance-owners.md. Existing two-argument owner callers remain unchanged; no wire or allowance entry migration. Red: 14/16 passing, both task-epic fake-reader cases failed with owner unavailable; green then 17/17 T1. Full npm run test:lint completed exit 0, 0 refusals (130 report-only pre-existing findings).

### rev-36 · 2026-11-19T03:53:05.623Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1993-source-1
commit: adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at corrected full commit adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0 (tree ffc26f0dfa2ebddcfc1b13e83083f4ebdf43541f), clean and pushed. A-21544 records Standards/Spec review, owner/fallback/expiry policy, consumer reads and evidence limits. Shared unchanged isStandingDurationOwner governs ancestor and configured legacy-owner fallback; durationLegacyOwner shares historical omission behavior. Printed expiry remains seven days. Actual emitted JSON is exercised against real lint in the new fake-reader tests, including delivery-epic refusal, ancestor precedence and invalid fallback advice. Docs agree with shipped behavior. No findings. C2 verified from source/docs; C1 remains unverified for exact generated acceptance receipts in the same-head configured run. Local red/green/static results and later serial T1 completion are implementer evidence, qualified in the artifact; no Reviewer runtime or configured pass is claimed. Source/experiment review pin is released by this verdict; normal Coordinator-controlled verification window is the next step.

Criteria: C2 verified.

### rev-36 · 2026-11-19T04:24:25.784Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1993-final-1
commit: adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged clean/pushed adb96f44e820d3abf7d9bdcbc4e930a7534b6cb0. Configured6f354d4e-4123-46a3-91b6-1dd76ac43858/A-21563 finished/passed, autoexit0; A-21564 retains independent streaming audit and exact generated receipts. The T-1952 and T-1957 allowance-printer cases plus admitted-ancestor/invalid-fallback case each have structured base pass and5 distinct passing load repetitions; whole T1 file17basepasses. C1 verified from actual emitted JSON→real lint, positive delivery-epic refusal and seven-day fallback expiry assertions. C2 source/docs verification retained and reconfirmed at same head. Owner6907/6907 base passes=6762top-level+145nested, zero fail/cancel/skip/todo;225 separate load passes and722 passing base file envelopes231T1/436T2/55Web. T0/T1/T2/Web exit0; T3 batch-deferred/T4 unexecuted. Provenance pins runtime tree8e73177af9a01c49bda408949b00c0807ee88d8b, cachednull, droplet Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5 and actual chromium_headless_shell-1248 binary/Google Chrome for Testing156.0.8078.4. Lifetime1504s/$0.1045 are executor accounting;109.001s is T0 host step only.130lintfindings/63files and budget/ratchet notices remain report-only. Earlier local red/TS failure and unpinned lint qualification remain retained in A-21542/A-21545, not rewritten by this pass. No findings, Reviewer runtime or new QA claim. C1/C2 verified; hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T05:24:20.010Z

Merged b34b2bd5fa32edb6fbca8a79a3974262f6f84444 onto dev.
