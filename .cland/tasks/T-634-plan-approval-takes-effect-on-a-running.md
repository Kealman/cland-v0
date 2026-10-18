---
id: T-634
kind: task
title: plan.approval takes effect on a running hub, without a restart
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by:
  - T-633
topic: topic-494
branch: t/T-634-plan-approval-takes-effect-on-a-running
created: 2026-10-16T16:04:12.357Z
updated: 2026-10-18T09:52:12.801Z
---

## Summary

The onboarding records "I approve epic plans" while the hub already runs, and the Aide cannot restart it, yet today a change of `[plan] approval` needs a hub restart. A value set with `cland config set`, or edited by hand and loaded with `cland hub reload`, governs the next launch for an epic at once.

## What to build

- The hub's config reload applies `plan.approval` to the plan-approval gate instead of answering "plan changed: restart required"; `plan.qa_default` and the other keys that need a restart keep that answer.
- `cland config set plan.approval …` applies the value at once and says so.
- The gate reads the value at each launch: with `human`, a launch for an epic whose current plan the human or an Aide has not approved is refused with "awaiting human plan approval", whether the plan was set before or after the change; with `none`, it goes through.
- The reload's applied list names `plan.approval`.

## Acceptance criteria

- [x] C1. After `cland config set plan.approval human` on a running hub, a launch for an epic with an unapproved plan is refused with "awaiting human plan approval", without a hub restart (frame-protocol test).
  - done: impl-634 · 2026-10-18T09:23:01.884Z
  - verified: rev-30 [reviewer] · run rev-20261018-634-final · 2026-10-18T09:52:11.560Z · commit 4ca0b721f173784d90920d9bb4c5e830e7e78bde
- [x] C2. Setting it back to `none` lets the same launch through, again without a restart.
  - done: impl-634 · 2026-10-18T09:23:03.400Z
  - verified: rev-30 [reviewer] · run rev-20261018-634-final · 2026-10-18T09:52:11.560Z · commit 4ca0b721f173784d90920d9bb4c5e830e7e78bde
- [x] C3. `cland hub reload` after a hand edit of `plan.approval` applies it and its applied list names it, while a change of `plan.qa_default` still answers restart required (config reload test).
  - done: impl-634 · 2026-10-18T09:23:05.336Z
  - verified: rev-30 [reviewer] · run rev-20261018-634-final · 2026-10-18T09:52:11.560Z · commit 4ca0b721f173784d90920d9bb4c5e830e7e78bde

## Comments

### impl-634 · 2026-10-18T09:22:26.385Z

Implemented live plan.approval publication into the tracker gate; plan.qa_default remains restart-only. TDD: new T2 config/launch tests first failed because human policy still permitted launches; reload test then failed on the missing applied-list entry. Both are green after the minimal consumer/classification fixes. Existing config-set test now expects applies=now. Running lint, typecheck and existing reload component coverage before source review.

### rev-30 · 2026-10-18T09:24:18.441Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-634-source
commit: 4ca0b721f173784d90920d9bb4c5e830e7e78bde
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5111. Live approval is published through the existing last-good commit callback after restart-only validation/file fences; qa_default remains restart-only and mixed edits retain prior gate. Tracker reads the mutable approval policy at launch without altering approval records. CLI applies-now reporting and reload applied list agree. T2 cases cover before/after plans, refused/no-spawn and none acceptance, hand reload and mixed QA refusal; existing config-set assertion intentionally updated. C1–C3 await exact-head droplet evidence. A-5110 reported red/green/static checks retained; no reviewer execution.

### rev-30 · 2026-10-18T09:52:11.560Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-634-final
commit: 4ca0b721f173784d90920d9bb4c5e830e7e78bde
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5165: independently audited exact-head A-5163 / e8bfcb59: 2149 pass/0 fail/5 outside-scope skips, Neovim smoke complete. Both owned live approval cases pass ordinarily and 10/10 load repetitions; all eight config-set carrier cases pass. Live human/none policy and applied-list/qa_default last-good assertions satisfy C1–C3. Source unchanged; no findings.

Criteria: C1 verified, C2 verified, C3 verified.
