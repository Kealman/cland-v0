---
id: T-853
kind: task
title: The rules round records "I approve epic plans" as `[plan] approval = "human"`, and the first plan names the categories that init seeded
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-852
topic: topic-576
branch: t/T-853-the-rules-round-records-i-approve-epic
created: 2026-10-19T08:10:02.660Z
updated: 2026-10-19T11:00:07.080Z
closed: 2026-10-19T11:00:07.080Z
---

## Summary

In round 2 of the rules round, the answer "I approve epic plans" also runs `cland config set plan.approval human`, so the hub asks the human to approve every epic plan from then on (§3.4 step 3, §3.5). `cland init` now seeds the four categories, so the plan step describes them in one line each and no longer creates them.

## What to build

- **SKILL.md §2.**
  - After the rules are recorded and read back, a rule giving plan approval to the human gets one more act on the same yes: `cland config set plan.approval human`. The Aide then says, in one line, what it changes for the human.
  - "Decisions, not keystrokes" stays recommended whatever the role, as in the prototype.
- **SKILL.md §3.**
  - The four categories, Bugs, Tech debt, Follow-ups and Ideas, are named with one line each on what they hold, from `cland task list --kind category`.
  - The `cland task create … --kind category` path stays only as a fallback, used when the list is empty in a project initialised before 0.1.4.
- **T2 case.** In skills-onboarding.test.ts, an Aide runs `config set plan.approval human` against an in-process hub, and the hub reads `human` back.

## Acceptance criteria

- [x] C1. SKILL.md §2 runs `cland config set plan.approval human` on the human's yes to a rule that gives them epic plans, and changes nothing else in that section (source review against 0ff421f8).
  - done: impl-853 · 2026-10-19T09:36:41.695Z
  - verified: rev-30 [reviewer] · run rev-20261019-853-source · 2026-10-19T09:37:27.620Z · commit 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
  - verified: rev-30 [reviewer] · run rev-20261019-853-final · 2026-10-19T09:55:08.070Z · commit 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
- [x] C2. SKILL.md §3 names the four categories that init seeded and creates them only when `cland task list --kind category` lists none (source review).
  - done: impl-853 · 2026-10-19T09:36:42.081Z
  - verified: rev-30 [reviewer] · run rev-20261019-853-source · 2026-10-19T09:37:27.620Z · commit 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
  - verified: rev-30 [reviewer] · run rev-20261019-853-final · 2026-10-19T09:55:08.070Z · commit 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
- [x] C3. Run as an Aide against an in-process hub, `cland config set plan.approval human` is accepted and the hub's config reads `human` back (T2, skills-onboarding.test.ts).
  - done: impl-853 · 2026-10-19T09:36:42.551Z
  - verified: rev-30 [reviewer] · run rev-20261019-853-final · 2026-10-19T09:55:08.070Z · commit 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d

## Comments

### impl-853 · 2026-10-19T09:35:24.369Z

Implementation scope: preserve prototype/T-852 wording outside §2 approval act and §3 categories passage. Add one T2 projectHub case for the Aide's config CLI round-trip; leave pending-command list unchanged. QA is after-stage with none scope.

### rev-30 · 2026-10-19T09:37:27.620Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-853-source
commit: 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5941. Standards/Spec: no findings. Section 2 differs from accepted prototype only by required same-yes approval act/explanation; decisions-not-keystrokes stays. Section 3 names seeded categories and permits creation only on yes after an empty list. C1/C2 verified. New projectHub Aide config CLI case uses T2 boundary, checks initial none, successful hub human/applies-now reply and saved config human; C3 awaits exact-head mode-free gate. A-5940 host checks retained. Pending setup mechanism remains T-837's integration responsibility; no unrelated skill edits.

Criteria: C1 verified, C2 verified.

### rev-30 · 2026-10-19T09:55:08.070Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-853-final
commit: 6ccfc55aea8c8008e58bb3b72ef463d24dbcc74d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-5946. Complete A-5943/6a9298a8 audited: 1489/1489 ordinary passed, zero fail/cancel/skip/TODO, zero tier-mismatch rows, all 412 load groups 5/5. Aide config CLI round-trip passes ordinarily (.378092327s) and 5/5; both onboarding guard controls retained and green. C3 established; C1/C2 source A-5941 remains valid. C1–C3 verified, no findings. T3 remains landing evidence; report-only lint/budget diagnostics disclosed.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T11:00:07.080Z

Merged aab9e9f2081def267eebbb2344548c3791c25aca onto dev.
