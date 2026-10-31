---
id: T-1505
kind: task
title: Guard tests that run only in a build step also belong to a verify tier
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: t/T-1505-guard-tests-that-run-only-in-a-build
created: 2026-10-31T08:18:54.391Z
updated: 2026-10-31T16:20:34.210Z
---

## Summary

A guard test that runs only inside a build step, such as the site prebuild, is invisible to `cland verify`. That let the site guard stay red from T-1275 (2026-10-25) until T-1480. Every such guard must also belong to a verify-selected tier, and a lint lists the orphans. Rule batch 5 (A-14855) C2, accepted by the human on 2026-10-31.

## Acceptance criteria

- [ ] C1. A static lint, run in `test:static` in report mode (rule 27), lists every test or guard script that a package build or prebuild step invokes but no verify tier selects.
- [ ] C2. The site onboarding guard and any other orphan found are mapped to a tier, or recorded with a reason in the item.
