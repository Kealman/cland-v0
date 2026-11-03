---
id: T-1665
kind: task
title: The publication scanner flags test titles and prose containing 'bearer' as credentials, forcing presentation omissions in every QA run
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-03T21:49:08.624Z
updated: 2026-11-03T21:49:08.624Z
---

## Summary

On 2026-11-03, `assertPublishable` (`.claude/skills/qa/qa-demo-policy.ts`) flagged plain English as Bearer credentials in four QA runs: brief prose such as "bearer and" and "bearer welcomes" in E-1532 stage 2, and the generated test titles "C2: Unix upgrade refuses wrong bearer like loopback" and "… missing bearer like loopback" (`hub/test/spoke-unix-edge.test.ts`) in E-1532 stage 3. Each time QA had to keep the originals privately and export labelled presentation omissions. That is safe but repetitive, and it adds a manual step to every run touching these files.

## What to build

Narrow the scanner's Bearer rule so it matches a credential shape, for example `Bearer <token-like run of at least N characters>` or an `Authorization:` header, rather than the bare word. Keep a positive control for real `Authorization: Bearer <token>` shapes and add negative controls for the prose and titles above. Alternatively rename the two test titles, but fix the rule first if it is the cause.

## Acceptance criteria

- [ ] C1. `assertPublishable` still refuses a planted `Authorization: Bearer <synthetic token>` and a bare `Bearer <synthetic token>`, and accepts the two spoke-unix-edge titles, the host-secret-admission title "C1 host bearer welcomes only its role-holding launch session" and the brief prose "bearer and" and "bearer welcomes" (test).
