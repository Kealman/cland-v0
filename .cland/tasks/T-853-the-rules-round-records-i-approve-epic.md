---
id: T-853
kind: task
title: The rules round records "I approve epic plans" as `[plan] approval = "human"`, and the first plan names the categories that init seeded
state: open
status: planned
size: XS
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-852
topic: null
branch: null
created: 2026-10-19T08:10:02.660Z
updated: 2026-10-19T08:10:09.121Z
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

- [ ] C1. SKILL.md §2 runs `cland config set plan.approval human` on the human's yes to a rule that gives them epic plans, and changes nothing else in that section (source review against 0ff421f8).
- [ ] C2. SKILL.md §3 names the four categories that init seeded and creates them only when `cland task list --kind category` lists none (source review).
- [ ] C3. Run as an Aide against an in-process hub, `cland config set plan.approval human` is accepted and the hub's config reads `human` back (T2, skills-onboarding.test.ts).
