---
id: E-678
kind: epic
title: "Merge queue: task verify runs T0–T2, the hub lands batches on T3"
state: open
rank: 4229
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
created: 2026-10-16T19:58:43.217Z
updated: 2026-10-19T04:17:34.419Z
---

## Summary

Week 4 of D53, with parts earlier. `cland merge` enqueues into a hub-owned merge queue. The queue runs T3 once per batch of up to three reviewed heads, lands a green batch and bisects a red one leave-one-out with `merge-bisected`. A task verify runs T0–T2 only, occasions run T1–T4, a nightly T4 soak runs within the daily cap, and the budgets enforce. Per-tier `[verification]` commands make the tier model cland's product rule for any project. Source: A-4143 (memo §5.2, §5.5 step 4 and §5.6).

## Goal

A merged ticket costs about 1.5 runs instead of 2.5, the task gate takes 8 minutes or less, and the Coordinator's manual covers retire.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. The median task-run body (check through collection) over the last 20 droplet task runs is 8 minutes or less on c-8 at workers 2.
- [ ] C2. Executed suite runs per merged ticket average 1.6 or less over the last 50 merges, counting task runs, batch runs divided by batch size, and bisection jobs.
- [ ] C3. Over the last 50 task runs, 10 % or fewer were red, and 5 % or fewer were red on a flake (a quarantined or later-green test with no code change).
- [ ] C4. In the last 7 days every commit on `dev` landed from a green batch tree or as a tracker/docs-only or human-override direct landing, and no manual cover ran.
- [ ] C5. Over the last 50 merges, the median batch wall is 15 minutes or less and the median droplet cost per merge $0.08 or less.
- [ ] C6. Budgets enforce: a planted over-budget T2 test without an allowance fails its run, and T3 growth without an allowance is refused with `merge-budget`.
- [ ] C7. A nightly soak ran on at least 5 of the last 7 days within the daily cap, and each recorded a coverage map that task selection used.
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
  - name: the product rule
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-717
      - - T-824
      - - T-827
```
