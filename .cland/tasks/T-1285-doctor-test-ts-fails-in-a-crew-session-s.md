---
id: T-1285
kind: task
title: "doctor.test.ts fails in a crew session's shell: three cases inherit the session's CLAND_* variables and hit the scratch hub's credential check"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:06:40.797Z
updated: 2026-10-25T10:06:49.355Z
---

## Summary

Found by impl-1258 on 2026-10-25 at 10:06Z and reproduced by coord on dev 82cf0f6c (macOS). Run from a crew session's shell, `node --test hub/test/doctor.test.ts` fails 3 of 19:
- "a broken skills symlink fails with the fix";
- "the managed hooks or AGENTS.md block removed: named failures, fixed by cland update";
- "doctor warns about free OpenCode training and its missing OS sandbox without failing".

The error is `fail hub: pid … holds the lock but does not answer on <scratch>/.cland/hub.sock (session "<name>" credential is missing or invalid …)`. With the six inherited CLAND_* variables unset (CLAND_LAUNCH_TOKEN, CLAND_SESSION_NAME, CLAND_SESSION_ID, CLAND_HUB_FILE, CLAND_NODE, CLAND_CLI), it passes 19/19. The doctor child processes don't build their environment through the shared sealed builder (rule 15), so they act as the outer session against the scratch hub (T-1220's credential admission). Droplet verifies pass because they have no CLAND_* variables.

## Acceptance criteria

- [ ] C1. doctor.test.ts passes 19/19 when run with CLAND_* session variables set in the parent environment; its child processes get their environment from fixtureEnvironment with scratchGitEnvironment, and a red control shows the old inheritance failing (test).
- [ ] C2. The T0 child-environment lint (T-1237's guard) or an equivalent check flags this inheritance pattern in hub/test, with the doctor case as its positive control (test).
