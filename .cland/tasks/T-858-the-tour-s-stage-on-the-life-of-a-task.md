---
id: T-858
kind: task
title: The tour's stage on the life of a task names the project's own checks, and every key the tour names is a workbench key
state: open
status: ready
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-857
topic: topic-606
branch: t/T-858-the-tour-s-stage-on-the-life-of-a-task
created: 2026-10-19T08:10:03.111Z
updated: 2026-10-19T15:37:02.248Z
---

## Summary

TOUR.md is the accepted wording, but stage 5 says verify runs "`npm run typecheck`, then `npm test`". After E-614 it runs the project's `[verification]` check and test. The tour's eight stages, "look now" lines and language rule otherwise stay as accepted.

## What to build

- **TOUR.md stage 5.** "cland verify runs the project's own checks, the check and test commands recorded with the stack, and posts the result there."
- **The merge sentence** changes only if the Coordinator decides that a new project's merge goes through the hub's queue (open question 6).
- **The keys.** Check each key the tour names (space then i, e, g, t, n, s, a, R, l, ?, space; Ctrl with h/j/k/l; Ctrl and \; g then a) against the Neovim workbench's keymaps at the head. Correct any that changed since 0ff421f8.
- **SKILL.md §8 and "How to talk"** keep the language rule unchanged: the tour is in the human's language, while rules, items and briefs stay in English.

## Acceptance criteria

- [x] C1. TOUR.md stage 5 names the project's recorded check and test commands and no npm script (source review, and N3's T1 assertion still passes).
  - done: impl-858 · 2026-10-19T15:07:08.071Z
  - verified: rev-30 [reviewer] · run rev-20261019-858-final · 2026-10-19T15:37:00.479Z · commit 24dff1818f7186803ce5cfd7a04d75796c7a3351
- [x] C2. Each workbench key TOUR.md names is bound in the Neovim workbench at the branch head (source review against the keymap source, listed in the review).
  - done: impl-858 · 2026-10-19T15:07:08.702Z
  - verified: rev-30 [reviewer] · run rev-20261019-858-source · 2026-10-19T15:07:56.513Z · commit 24dff1818f7186803ce5cfd7a04d75796c7a3351
  - verified: rev-30 [reviewer] · run rev-20261019-858-final · 2026-10-19T15:37:00.479Z · commit 24dff1818f7186803ce5cfd7a04d75796c7a3351
- [x] C3. TOUR.md keeps eight stages, each ending with a "Look now" line, and SKILL.md keeps the tour and welcome note in the human's language and rules, items and briefs in English (T1 assertion on the stage count and "Look now" lines; source review).
  - done: impl-858 · 2026-10-19T15:07:09.173Z
  - verified: rev-30 [reviewer] · run rev-20261019-858-final · 2026-10-19T15:37:00.479Z · commit 24dff1818f7186803ce5cfd7a04d75796c7a3351

## Comments

### impl-858 · 2026-10-19T15:05:54.990Z

Read E-616's decisions (including decision 6). Implementing the scoped TOUR.md stage-5 wording and auditing all named workbench keys; retaining all eight stages, Look now lines, and SKILL.md language guidance. No per-item QA required (none/after-stage).

### impl-858 · 2026-10-19T15:07:09.756Z

Committed and pushed 24dff181. C1–C3 implementation complete; A-6133 holds the key binding source audit and validation. Typecheck passed; skills-onboarding.test.ts 13/13 passed (3.709 s). Source review assigned to Reviewer rev-30; waiting for clear source before mode-free verification.

### rev-30 · 2026-10-19T15:07:56.513Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-858-source
commit: 24dff1818f7186803ce5cfd7a04d75796c7a3351
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6134, findings []. TOUR uses requested recorded check/test wording, preserves Coordinator squash sentence per E-616 decision 6, all eight Look now stages and SKILL language rules. Independently audited named workbench/ask/terminal/Enter/ga bindings; actual ask key installation is ask_card.lua:94–116 (corrected citation from implementation note). C2 verified by source. New T1 stage guard checks exact count/numbering/final Look now; existing stack-neutral guard retained. A-6133 reports 13/13 and typecheck. C1/C3 final verification awaits same-head mode-free gate; no new process/wait or Reviewer tests.

Criteria: C2 verified.

### rev-30 · 2026-10-19T15:37:00.479Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-858-final
commit: 24dff1818f7186803ce5cfd7a04d75796c7a3351
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6163 audits full A-6162 / 431d8cd9 at unchanged reviewed head. Ordinary1559/1559 zero fail/cancel/skip/TODO; all479 groups5/5. C1 npm-independent guard passes ordinary49185 and5/5 at52655; C3 eight-stage/Look-now guard49190 and5/5 at52664. C2 retains exact binding audit A-6134; human-language policy unchanged. Four inherited T-856 push tripwire rows54276–54279 retained under actual Coordinator c322ebda/T-877 disposition; no new guard trip or finding. C1–C3 verified; T3 remains landing evidence. No Reviewer execution or further run.

Criteria: C1 verified, C2 verified, C3 verified.
