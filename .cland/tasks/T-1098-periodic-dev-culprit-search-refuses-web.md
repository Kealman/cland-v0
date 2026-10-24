---
id: T-1098
kind: task
title: Periodic dev culprit search refuses Web test files as invalid batch diagnostic files
state: open
status: backlog
size: XS
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: null
branch: null
created: 2026-10-22T07:52:03.979Z
updated: 2026-10-24T06:46:18.245Z
---

## Summary

The periodic dev T3 culprit search for run 5c6f3777 (A-9033, red head 74175ef9, last green 1b4291e6) reported `web/test/palette.test.ts: inconclusive (Error: invalid batch diagnostic files)`. `hub/src/hub/suites.ts` (about line 456) accepts diagnostic files only under `hub/test`, `hub/src` and `nvim/test`, so every Web-tier failure makes the search inconclusive instead of bisecting the merges. The culprit here was known (T-1095, fixed by T-1097), but a Web regression with no obvious author would go unattributed.

## Acceptance criteria

- [ ] C1. A periodic dev culprit search whose failing file is a `web/test/*.test.ts` file runs the Web tier on the candidate merges, with the same path-safety checks, and names the first red merge (component test with a fake executor).
- [ ] C2. A diagnostic file outside the allowed test roots is still refused with the existing error (test).
