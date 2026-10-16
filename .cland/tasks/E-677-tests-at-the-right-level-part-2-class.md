---
id: E-677
kind: epic
title: "Tests at the right level, part 2: class migrations and the scenario set"
state: open
rank: 4239
labels:
  - epic
  - v0.1.4
  - verification
assignee: null
parent: R-577
blocked_by: []
follows:
  - E-676
topic: null
branch: null
created: 2026-10-16T19:58:43.121Z
updated: 2026-10-16T20:00:51.801Z
---

## Summary

Weeks 2 and 3 of D53. The heaviest test files move to T1 and T2 by class: adapters onto the in-process fake adapter with one real-binary contract file per harness, executor and suite files onto the clock with an in-process provider, and roles, subscriptions, tracker and inbox files onto projectHub. A curated set of ten T3 scenarios replaces the integration files it covers. Source: A-4143 (memo §2.2 and §5.5 steps 2–3, the four slice reports).

## Goal

Most test time leaves real processes with no behaviour claim dropped. That makes the task gate short and the T3 merge batch affordable.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. A durations refresh from a green integrated run puts at least 60 % of T1–T3 manifest test-seconds in T1 and T2 (decision 8's exit).
- [ ] C2. T3 manifest seconds are 1800 s or less, so the projected T3 wall at 2 workers is 900 s or less.
- [ ] C3. T1–T3 manifest seconds total 3600 s or less, from 5281 s at A-3877.
- [ ] C4. A spawn census of a full run shows 150 hub process starts or fewer (from under 600 after T-575).
- [ ] C5. `tiers.json` names ten scenarios, each 120 s or less, and one contract file per harness, and the lint baseline holds no fake-binary, `startDaemon` or `spawnSpoke` call site outside contract, scenario and T3-header files.
- [ ] C6. No T2 Neovim file reaches a `hub/src` runtime module, and the selection replay over 40 landings has no T2 Neovim selection decided by `nvim test import`.
- [ ] C7. The T1 and T2 phases of a full run together take 8 minutes of wall or less on a quiet c-8 at workers 2.

## Plan

```yaml
stages:
  - name: the head of the distribution
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-691
        - T-692
        - T-693
        - T-695
      - - T-694
      - - T-697
        - T-698
        - T-699
        - T-700
      - - T-696
      - - T-701
      - - T-704
      - - T-705
      - - T-706
  - name: the tail and the scenarios
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-702
      - - T-703
      - - T-707
  - name: retirement and Neovim
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-708
      - - T-709
```
