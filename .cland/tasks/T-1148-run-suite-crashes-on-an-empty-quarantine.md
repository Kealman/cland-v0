---
id: T-1148
kind: task
title: run-suite crashes on an empty quarantine receipt and hides the Web phase's real failure
state: open
status: backlog
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T17:21:01.416Z
updated: 2026-10-22T17:21:01.416Z
---

## Summary

T-1118's verify 2153dc17 (A-9371, Linux c-8 lon1) ended its Web phase with `SyntaxError: Unexpected end of JSON input` at `JSON.parse(await readFile(quarantinePath))` (hub/test/run-suite.ts:254). The quarantine receipt was empty while `web/test/items.test.ts` › "closed container pages restore nested archives once and preserve unloaded release progress" was still in flight. The runner crash replaced whatever ended the test process with an unrelated parse error. The completed tests (2511/2511) had passed.

## What to build

When the quarantine receipt is missing, empty or torn, the runner reports the phase as incomplete. The report names the in-flight test and the test process's own exit and stderr tail, never a JSON parse error, and the phase still exits non-zero.

## Acceptance criteria

- [ ] C1. An empty or truncated quarantine receipt yields a non-zero phase with an "incomplete: receipt missing" line naming the in-flight test, and no SyntaxError (test).
- [ ] C2. The phase output keeps the test process's exit status and stderr tail when the receipt is unusable (test).
