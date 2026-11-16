---
id: T-1901
kind: task
title: Enqueue preflight for interaction reds
state: open
status: backlog
size: M
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1528
  - T-1635
topic: null
branch: null
created: 2026-11-16T07:29:47.119Z
updated: 2026-11-16T07:29:49.063Z
---

## Summary

Before enqueue, at the item head merged with current dev: the whole-source lints, T-1635's wording lint against post-landing state, the importer T3 subset, and an allowance check for new tests of 4 s or more on Linux. About half of the 49 red first batches were such interactions (§3.3). §7 #4.

Kind: product. Triage ticket H-13 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. Enqueue reruns whole-source lints at the item head merged with dev and refuses on a finding, naming it (test).
- [ ] C2. A new identity measured at 4 s or more on Linux with no allowance is refused before enqueue, with the allowance stanza (test).
- [ ] C3. A non-empty importer T3 subset runs before ready (test).

## Dependencies

T-1528, T-1635
