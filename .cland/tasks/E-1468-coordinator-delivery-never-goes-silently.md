---
id: E-1468
kind: epic
title: Coordinator delivery never goes silently deaf
state: open
labels: []
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1261
branch: null
created: 2026-10-30T07:49:58.701Z
updated: 2026-10-31T02:33:44.303Z
---

## Goal

A Claude Code session never goes silently deaf. A human message reaches an idle Coordinator within a minute; a relaunch leaves exactly one harness process; and when delivery is stuck, the human is told and has a command that releases it.

## Contents

Root cause (A-14159, from the read-only RCA of the 2026-10-30 06:53–07:34Z incident, in which the human's Telegram answer waited 41 min):
- The Claude Code poll overrode a pushed idle with busy while a background shell ran.
- Held human messages release only on an idle edge.
- Relaunches left duplicate daemon jobs.
- The daemon's 60-minute idle retirement went undetected.
- The bridge and flush logs were misleading.

The human asked for the investigation and a fix (cland-impl, 07:44Z): «разобрался еще с этим инцидентом почему так произошло и как сделать фикс чтобы так не происходило».

## Definition of done

- [ ] C1. The incident's sequence is replayed in a test: idle hook, then a poll reporting busy, then a human send, then idle. The message is injected within 60 s.
- [ ] C2. A relaunch leaves one Claude Code process for the session, and a spoke from an earlier launch is refused.
- [ ] C3. A live session holding a human delivery for over 5 minutes is shown as `deaf`, the human is told, and `cland session retry` releases it.

## Plan

```yaml
stages:
  - name: delivery and launch fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1469
        - T-1470
        - T-1473
        - T-1472
        - T-1475
      - - T-1471
      - - T-1474
```
