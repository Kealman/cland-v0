---
id: T-1464
kind: task
title: Periodic dev T3 skips a run when a newer integrated or stage cover just passed
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1229
branch: t/T-1464-periodic-dev-t3-skips-a-run-when-a-newer
created: 2026-10-30T05:44:58.711Z
updated: 2026-10-30T10:18:39.809Z
---

## Summary

Periodic dev T3 cost $9.01 and 35.9 h in v0.3.0 (25 % of spend); three runs repeated what the stage covers had just proven (retro A-14149). Skip a periodic run when an integrated, stage or release cover at the same or a newer dev tip passed within the last hour, and say so in the notice. Retro v0.3.0 change 4.

## Acceptance criteria

- [ ] C1. A periodic tick after a fresh green cover at the same tip records a skip naming that cover.

## Comments

### impl-1464 · 2026-10-30T10:18:39.809Z

Rule-20 consumer inventory: scheduler #checkDevT3 and suite-job durable records (suites.ts/Store); SuiteCandidate production and suite-unit/suite-component/harness/remote fixtures plus suite scheduling/queue tests; daemon onSoakNotice and dispatch periodic result delivery; CLI usage + commands.json fixture; suite-soak T1 and suite-soak-component T2 tests; dev-t3-search/component/probe tests consume admitted jobs unchanged; shared wire/web/nvim read suite projections unchanged. rg searches covered SuiteCandidate, dev-t3-attempt, verification-dev-t3-skipped, onSoakNotice, devT3EveryMs and periodic dev T3 across hub/web/nvim/shared, QA briefs, docs and shipped skills. No wire/persisted job shape changes planned: reuse attempt cursor and existing skip event/notice. Optional ancestry capability on candidate preserves older injected candidates conservatively (same-head remains supported); complete green full-T3 integrated dev receipts only, fresh <=1 hour, positive ancestry for newer cover.
