---
id: T-1832
kind: task
title: The onboarding tour's stage on agent hosts
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1827
topic: null
branch: t/T-1832-the-onboarding-tour-s-stage-on-agent
created: 2026-11-12T10:07:21.965Z
updated: 2026-11-14T22:18:19.069Z
---

## Summary

The onboarding tour gains a tenth stage on agent hosts, in the tour's form: one round, tied to what is on the human's screen, ending with its "Look now". It says where the Hosts row is, what a waiting launch and its reasons mean, and how to add a login. Its commands match `cland host` and `cland login` as built.

## What to build

Spec §3.9 (the onboarding) and v0.1.4 §3.4 (the tour's form). The stage covers:
- the Hosts row in both workbenches, and the hosts view it opens in the web;
- a waiting launch: a status line in the inbox, not an ask, with its current reason ("waiting for a host", "waiting for a login <harness>", "waiting for host <id> to boot"), and the "create one?" card;
- adding a login with `cland login add <harness> --pool <pool>` in the human's terminal, or from the web's hosts view;
- that setting hosts up is one `cland setup` run, or `cland config set` by hand.

It ends with "Look now: the Hosts row in the sessions panel". The SKILL.md tour offer and the skill test's stage count move from nine to ten.

## Acceptance criteria

- [ ] C1. TOUR.md has ten numbered stages, the tenth on agent hosts, each stage with exactly one "Look now" line, the tenth naming the Hosts row (test).
- [ ] C2. The tenth stage names the Hosts row, the three waiting-launch reasons as the hub emits them, `cland login add` and the web's hosts view (test).
- [ ] C3. Every `cland` command and config key in the stage passes the onboarding command check against the CLI help and the config keys, and SKILL.md's stage count reads ten (test).

## Blocked by

- T-1821
- T-1827

## Notes

- Hot files: `.agents/skills/onboarding/TOUR.md`, `.agents/skills/onboarding/SKILL.md`, `hub/test/skills-onboarding.test.ts`.
- Tests: `hub/test/skills-onboarding.test.ts` (T1 assertions inside the existing T2 file).
- Serves epic C6.
