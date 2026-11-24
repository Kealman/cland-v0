---
id: T-2012
kind: task
title: docs/hub/artifacts.md says qa lint exit 0 means 'no findings'; it should say 'no blocking findings' after T-1903's report-only advisories
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: null
branch: null
created: 2026-11-19T19:40:29.286Z
updated: 2026-11-24T09:01:21.922Z
---

## Summary

`docs/hub/artifacts.md:177` says a `cland qa lint` exit 0 means "no findings". Since T-1903 added report-only QA lint advisories, exit 0 means "no blocking findings". The main qa-brief-lint reference and help already say so. This was a low, non-blocking finding in T-1903's review (A-21884).

## Acceptance criteria

- [ ] C1. `docs/hub/artifacts.md` describes exit 0 as "no blocking findings", matching the qa-brief-lint reference and help, and no other doc still says "no findings" for that exit (search across docs and skills) (docs).
