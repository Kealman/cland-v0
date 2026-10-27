---
id: T-1367
kind: task
title: The onboarding tour gains a stage on remote control
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1362
  - T-1366
topic: null
branch: null
created: 2026-10-27T05:46:50.673Z
updated: 2026-10-27T20:05:45.372Z
---

## Summary

The tour's ninth stage teaches remote control in the tour's form: one round, tied to what is on the human's screen, ending with its "Look now". Its commands match `cland remote` and `cland secret` as built.

## What to build

Spec §3.11 (the onboarding) and v0.1.4 §3.4 (the tour's form). The stage covers:
- what a remote is: the human's private Telegram chat with the project's bot, mirroring General and the needs-you rows;
- what the human can do from it (write to the Coordinator, answer asks, approve commands, `/status`, `/inbox`, `/mute`);
- what stays in the workbench: pairing approval, plans and every topic but General;
- that setting a remote up is one `cland setup` run in the human's own terminal, because a token is typed only at a hidden prompt (see the open question).

It ends with "Look now: the Remotes row in the sessions panel". It names Telegram only. Discord's line comes with 11 and the speech key's with 09. The SKILL.md tour offer and the skill test's stage count move from eight to nine. The command check also verifies that every secret name the stage mentions is one of `cland secret`'s names.

**External wait and shared files:** none · **Shared files:** .agents/skills/onboarding/TOUR.md, .agents/skills/onboarding/SKILL.md, hub/test/skills-onboarding.test.ts

## Acceptance criteria

- [ ] C1. TOUR.md has nine numbered stages, the ninth on remote control, each with exactly one "Look now" line (test).
- [ ] C2. Every `cland` command and config key in the stage passes the onboarding command check against the CLI help, and every secret name it mentions is one of `cland secret`'s names (test).
