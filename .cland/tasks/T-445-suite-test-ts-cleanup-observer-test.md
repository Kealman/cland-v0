---
id: T-445
kind: task
title: suite.test.ts cleanup-observer test times out under full-suite load (unverified cleanup preserved, 15 s)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-203
topic: null
branch: null
created: 2026-10-15T00:40:00.743Z
updated: 2026-10-15T00:40:00.743Z
---

## Summary

`hub/test/suite.test.ts` 'failure cleanup preserves a live worker whose recorded start identity is unavailable' (line 784 at b874faa1, 943 on dev) failed in T-433's full local run 54e82e23 (A-2608): `unverified cleanup preserved: not within 15000 ms` at line 798. The whole file passed 5/5 alone at the same head (A-2623), with the case taking 3–4 s. It is a load-sensitive observer wait, and it got the flaky rule's one resubmit.

## Acceptance criteria

- [ ] C1. The wait observes the cleanup outcome event, or its durable record, rather than polling for 15 s, and the file passes 5/5 beside a local full run.
