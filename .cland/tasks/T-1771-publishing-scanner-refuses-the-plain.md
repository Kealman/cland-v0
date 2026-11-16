---
id: T-1771
kind: task
title: Publishing scanner refuses the plain test title 'C1 host bearer welcomes only its role-holding launch session'
state: closed
status: done
size: XS
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-09T11:19:57.789Z
updated: 2026-11-16T07:28:08.005Z
closed: 2026-11-16T07:28:08.005Z
---

## Summary

The publishing scanner (`assertPublishable`) rejects the plain English test title "C1 host bearer welcomes only its role-holding launch session" (`hub/test/host-secret-admission.test.ts:61`) as if it were a secret, so a QA capture of that file withholds two TAP lines and its row reads INCONCLUSIVE. It is a false positive on the word "bearer" in prose. Found aside by qa-678 in E-1534 stage-3 QA (row E1534S3-33, 2026-11-09); a labelled presentation substitution of that exact title passed 17/17.

## Acceptance criteria

- [ ] C1. A test title or log line that uses "bearer" as a plain word, with no token-shaped value after it, passes `assertPublishable`, while a real `Bearer <token>` shape is still refused (test).
- [ ] C2. The QA capture of `hub/test/host-secret-admission.test.ts` withholds no line (test).

## Comments

### coord · 2026-11-16T07:28:08.005Z

Merged into T-1665 (triage A-19813): T-1665's C1 already lists this exact title, and the rule is `qa-demo-policy.ts:42`.
