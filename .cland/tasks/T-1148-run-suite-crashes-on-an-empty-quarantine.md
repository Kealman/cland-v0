---
id: T-1148
kind: task
title: run-suite crashes on an empty quarantine receipt and hides the Web phase's real failure
state: open
status: in progress
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-937
branch: t/T-1148-run-suite-crashes-on-an-empty-quarantine
created: 2026-10-22T17:21:01.416Z
updated: 2026-10-24T07:38:07.235Z
---

## Summary

T-1118's verify 2153dc17 (A-9371, Linux c-8 lon1) ended its Web phase with `SyntaxError: Unexpected end of JSON input` at `JSON.parse(await readFile(quarantinePath))` (hub/test/run-suite.ts:254). The quarantine receipt was empty while `web/test/items.test.ts` › "closed container pages restore nested archives once and preserve unloaded release progress" was still in flight. The runner crash replaced whatever ended the test process with an unrelated parse error. The completed tests (2511/2511) had passed.

## What to build

When the quarantine receipt is missing, empty or torn, the runner reports the phase as incomplete. The report names the in-flight test and the test process's own exit and stderr tail, never a JSON parse error, and the phase still exits non-zero.

## Acceptance criteria

- [ ] C1. An empty or truncated quarantine receipt yields a non-zero phase with an "incomplete: receipt missing" line naming the in-flight test, and no SyntaxError (test).
- [ ] C2. The phase output keeps the test process's exit status and stderr tail when the receipt is unusable (test).

## Comments

### coord · 2026-10-22T18:43:47.091Z

Root cause of both empty-receipt crashes (T-1118 A-9371, T-1150 A-9419): the Web phase's 60 s gross hang guard in hub/test/run-suite.ts killed the Web test process on Linux c-8 droplets once the grown phase passed 60 s of wall ('Web phase exceeded 60 s gross hang guard'). The guard is now 180 s on dev (4e6193f2). T-1148 still stands: a killed phase must report incomplete, naming the in-flight test, not crash on JSON.parse.
