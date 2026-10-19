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
updated: 2026-10-19T15:24:22.441Z
---

## Summary

Week 4 of D53, with parts earlier. `cland merge` enqueues into a hub-owned merge queue. The queue runs T3 once per batch of up to three reviewed heads, lands a green batch and bisects a red one leave-one-out with `merge-bisected`. A task verify runs T0–T2 only, occasions run T1–T4, a nightly T4 soak runs within the daily cap, and the budgets enforce. Per-tier `[verification]` commands make the tier model cland's product rule for any project. Source: A-4143 (memo §5.2, §5.5 step 4 and §5.6).

## Goal

A merged ticket costs about 1.5 runs instead of 2.5, the task gate takes 8 minutes or less, and the Coordinator's manual covers retire.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. The median task-run body (check through collection) over the first 20 droplet task runs after T-713 went live is measured against the 8-minute target on c-8 at workers 2, with the run ids (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
- [ ] C2. Executed suite runs per merged ticket over the merges since T-713 went live are measured against the 1.6 target, counting task runs, batch runs divided by batch size and bisection jobs (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
- [ ] C3. Task runs since T-713 went live are measured for red rate (target ≤ 10 %) and red-on-a-flake rate (target ≤ 5 %, a quarantined or later-green test with no code change) (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
- [ ] C4. From T-713 going live (restart #17, 2026-10-19 04:23Z) to the release build, every commit on dev landed from a green batch tree or as a tracker/docs-only or human-override direct landing, and no manual cover ran (accumulated-to-release scope, D63).
- [ ] C5. Over merges since T-713 went live, the median batch wall (target ≤ 15 minutes) and the median droplet cost per merge (target ≤ $0.08) are measured (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
- [ ] C6. Budgets enforce: a planted over-budget T2 test without an allowance fails its run, and T3 growth without an allowance is refused with `merge-budget`.
- [ ] C7. Every nightly soak due between T-715's merge and the release build is listed with its cost against the daily cap and the $0.25 target and with whether it recorded a coverage map (D65: measured and recorded on this epic with the target; the miss is carried to v0.2's E-880, not a release gate).
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
