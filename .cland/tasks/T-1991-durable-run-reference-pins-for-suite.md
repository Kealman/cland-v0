---
id: T-1991
kind: task
title: "Durable run-reference pins for suite runs: verdict, criterion, coverage and duration publishers pin a raw run before referencing it, with an exclusive retirement claim"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1957
topic: null
branch: null
created: 2026-11-19T01:26:31.956Z
updated: 2026-11-19T01:26:31.956Z
---

## Summary

Split from T-1957 by the Coordinator on 2026-11-19. impl-1957's publisher census showed that tracker verdict and criterion writes, duration refresh and delayed coverage publication can all reference suite runs of any age. So an age floor can't make deleting `.cland/run/suites` entries race-free. This item adds the capability retention needs before it may delete (rule 19).

## What to build

Before a publisher's final check and write, it creates a durable per-run pin. Retirement takes an exclusive claim, so a pin present before the claim makes retirement keep the run. A publisher that finds a run already retired refuses the new raw-run reference with the existing error transport. Unknown or crashed pins keep the run indefinitely. This covers tracker verdict and criterion writes, coverage-pointer publication and duration refresh.

## Acceptance criteria

- [ ] C1. For each publisher class, a deterministic overlap regression shows a pin taken before the claim retains the run, and a publish attempted after retirement is refused (test).
- [ ] C2. A crash between pin and write leaves the run retained, and recovery never ages an unknown pin out (test).
- [ ] C3. Every publisher and reader of raw-run references is listed with its disposition (rules 20 and 41).
