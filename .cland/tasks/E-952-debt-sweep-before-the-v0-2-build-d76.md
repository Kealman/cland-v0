---
id: E-952
kind: epic
title: Debt sweep after v0.1.4, released as v0.1.5 (D76, D78)
state: open
labels:
  - epic
assignee: null
parent: R-866
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:41:28.312Z
updated: 2026-10-20T12:19:33.282Z
---

## Summary

The human's D76 (2026-10-20, ask 89df1e19): bugs and tech debt found during v0.1.4 that do not affect a newcomer are fixed on `dev` after the v0.1.4 release and before the v0.2 build starts, and ship with v0.2's first release. There is no v0.1.5. The triage A-7125 sorted 37 items. This epic holds the crew-only fixes it kept, plus the items filed during the release itself (T-942, T-949, T-950, T-951).

## Goal

v0.2's feature epics start on a `dev` without known crew-side bugs or tech debt from v0.1.4.

## Definition of done

- [ ] C1. Every child is closed: merged with its own criteria verified, or closed with a recorded reason (fixed elsewhere, duplicate, or the human's decision).
- [ ] C2. A stage cover on Linux and macOS is green at the dev tip after the last child lands.

## Plan

```yaml
stages:
  - name: the sweep
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-820
        - T-794
      - - T-618
        - T-564
        - T-561
        - T-563
        - T-949
        - T-950
      - - T-576
      - - T-587
      - - T-757
      - - T-552
      - - T-808
      - - T-807
      - - T-768
      - - T-602
      - - T-607
      - - T-570
      - - T-764
      - - T-804
      - - T-942
      - - T-951
      - - T-954
      - - T-955
        - T-958
      - - T-956
      - - T-957
      - - T-959
      - - T-960
      - - T-961
        - T-962
      - - T-963
      - - T-964
      - - T-965
      - - T-966
```
