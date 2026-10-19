---
id: E-678
kind: epic
title: "Merge queue: task verify runs T0–T2, the hub lands batches on T3"
state: open
rank: 4229
criterion_seq: 8
labels:
  - epic
  - verification
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
follows:
  - E-676
topic: null
branch: null
created: 2026-10-16T19:58:43.217Z
updated: 2026-10-19T14:51:31.840Z
---

## Summary

Week 4 of D53, with parts earlier. `cland merge` enqueues into a hub-owned merge queue. The queue runs T3 once per batch of up to three reviewed heads, lands a green batch and bisects a red one leave-one-out with `merge-bisected`. A task verify runs T0–T2 only, occasions run T1–T4, a nightly T4 soak runs within the daily cap, and the budgets enforce. Per-tier `[verification]` commands make the tier model cland's product rule for any project. Source: A-4143 (memo §5.2, §5.5 step 4 and §5.6).

## Goal

A merged ticket costs about 1.5 runs instead of 2.5, the task gate takes 8 minutes or less, and the Coordinator's manual covers retire.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. The median task-run body (check through collection) over the last 20 droplet task runs (or all available since T-713 went live, at restart #17 on 2026-10-19 04:23Z, if fewer; D63) is 8 minutes or less on c-8 at workers 2.
- [ ] C2. Executed suite runs per merged ticket average 1.6 or less over the last 50 merges (or all available since T-713 went live, at restart #17 on 2026-10-19 04:23Z, if fewer; D63), counting task runs, batch runs divided by batch size, and bisection jobs.
- [ ] C3. Over the last 50 task runs (or all available since T-713 went live, at restart #17 on 2026-10-19 04:23Z, if fewer; D63), 10 % or fewer were red, and 5 % or fewer were red on a flake (a quarantined or later-green test with no code change).
- [ ] C4. From T-713 going live (restart #17, 2026-10-19 04:23Z) to the release build, every commit on dev landed from a green batch tree or as a tracker/docs-only or human-override direct landing, and no manual cover ran (accumulated-to-release scope, D63).
- [ ] C5. Over the last 50 merges (or all available since T-713 went live, at restart #17 on 2026-10-19 04:23Z, if fewer; D63), the median batch wall is 15 minutes or less and the median droplet cost per merge $0.08 or less.
- [ ] C6. Budgets enforce: a planted over-budget T2 test without an allowance fails its run, and T3 growth without an allowance is refused with `merge-budget`.
- [ ] C7. Every nightly soak due between T-715's merge and the release build ran within the daily cap and recorded a coverage map that task selection used; the nights and runs are reported as accumulated at release (D63).
- [ ] C8. A non-Node fixture project with per-tier commands runs unit and component tests in its task verify and integration tests in its merge batch.

## Plan

```yaml
stages:
  - name: queue entries, occasions and budgets
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-710
      - - T-714
      - - T-716
  - name: batches and the soak
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-711
        - T-712
      - - T-715
  - name: the protocol switch
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-713
        - T-718
      - - T-803
      - - T-850
      - - T-823
      - - T-831
  - name: the product rule
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-717
      - - T-824
      - - T-827
      - - T-812
```
