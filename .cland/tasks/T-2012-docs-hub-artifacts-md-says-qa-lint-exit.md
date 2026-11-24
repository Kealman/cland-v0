---
id: T-2012
kind: task
title: docs/hub/artifacts.md says qa lint exit 0 means 'no findings'; it should say 'no blocking findings' after T-1903's report-only advisories
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1741
branch: t/T-2012-docs-hub-artifacts-md-says-qa-lint-exit
created: 2026-11-19T19:40:29.286Z
updated: 2026-11-24T10:56:03.908Z
---

## Summary

`docs/hub/artifacts.md:177` says a `cland qa lint` exit 0 means "no findings". Since T-1903 added report-only QA lint advisories, exit 0 means "no blocking findings". The main qa-brief-lint reference and help already say so. This was a low, non-blocking finding in T-1903's review (A-21884).

## Acceptance criteria

- [ ] C1. `docs/hub/artifacts.md` describes exit 0 as "no blocking findings", matching the qa-brief-lint reference and help, and no other doc still says "no findings" for that exit (search across docs and skills) (docs).

## Comments

### impl-2012 · 2026-11-24T10:56:03.908Z

Confirmed sole stale QA lint exit description in docs/hub/artifacts.md. Focused assertion failed before the fix and passed after; docs/skills search has no other QA lint no-findings claim. qa-lint.test.ts T1 passed 36/36 locally on macOS with Node v24.21.0. Awaiting coordinated lint slot before review.
