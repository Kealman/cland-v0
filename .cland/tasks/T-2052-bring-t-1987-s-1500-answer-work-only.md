---
id: T-2052
kind: task
title: Bring T-1987's 1500-answer work-only startup case under its 5 s budget, or renew its C-216 allowance, before it expires on 2026-11-28
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-21T08:56:13.794Z
updated: 2026-11-21T08:56:13.794Z
---

## Summary

T-1987 added `hub/test/startup-listener-scale.test.ts` › "1500 startup freshness answers keep summary hydration and dependent work linear". It measured 8.039 s on a Linux droplet (run 84066c69, A-22444), with a worst retained sample of 10.278 s (A-22429), against a 5 s per-test budget. The Coordinator approved a 15.418 s allowance owned by C-216. The parser allows a non-legacy owner seven days, so it expires on 2026-11-28. An expired allowance fails every suite.

## What to build

Make the work-only case fit 5 s without weakening its census, for example by sharing the fixture's setup or reducing setup cost rather than the 1,500-answer scale. Or renew the allowance with fresh samples before it expires. Act before 2026-11-26.

## Acceptance criteria

- [ ] C1. Either the case passes under its 5 s budget on a Linux droplet with its census assertions unchanged, or the allowance is renewed with an expiry at least seven days out and a reason citing fresh samples (evidence).
