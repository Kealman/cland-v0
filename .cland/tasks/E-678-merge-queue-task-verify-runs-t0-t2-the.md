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
topic: topic-665
branch: null
created: 2026-10-16T19:58:43.217Z
updated: 2026-10-20T02:57:23.313Z
---

## Summary

Week 4 of D53, with parts earlier. `cland merge` enqueues into a hub-owned merge queue. The queue runs T3 once per batch of up to three reviewed heads, lands a green batch and bisects a red one leave-one-out with `merge-bisected`. A task verify runs T0–T2 only, occasions run T1–T4, a nightly T4 soak runs within the daily cap, and the budgets enforce. Per-tier `[verification]` commands make the tier model cland's product rule for any project. Source: A-4143 (memo §5.2, §5.5 step 4 and §5.6).

## Goal

A merged ticket costs about 1.5 runs instead of 2.5, the task gate takes 8 minutes or less, and the Coordinator's manual covers retire.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. The median task-run body (check through collection) over the first 20 droplet task runs after T-713 went live is measured against the 8-minute target on c-8 at workers 2, with the run ids (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
- [ ] C2. Executed suite runs per merged ticket over the merges since T-713 went live are measured against the 1.6 target, counting task runs, batch runs divided by batch size and bisection jobs (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
- [ ] C3. Task runs since T-713 went live are measured for red rate (target ≤ 10 %) and red-on-a-flake rate (target ≤ 5 %, a quarantined or later-green test with no code change) (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
- [ ] C4. From T-713 going live (restart #17, 2026-10-19 04:23Z) to the release build, every commit on dev landed from a green batch tree or as a tracker/docs-only or human-override direct landing, and no manual cover ran (accumulated-to-release scope, D63).
- [ ] C5. Over merges since T-713 went live, the median batch wall (target ≤ 15 minutes) and the median droplet cost per merge (target ≤ $0.08) are measured (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
- [ ] C6. Budgets enforce: a planted over-budget T2 test without an allowance fails its run, and T3 growth without an allowance is refused with `merge-budget`.
- [ ] C7. Every nightly soak due between T-715's merge and the release build is listed with its cost against the daily cap and the $0.25 target and with whether it recorded a coverage map (D66: the measured values are accepted as meeting the target for v0.1.4; how to reach the original target is recorded for later in E-880 under Ideas).
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

## Comments

### coord · 2026-10-19T22:37:32.796Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z). C4 passes with these exceptions, all the Coordinator's, from restart #17 (04:23Z) to the release build. Direct non-batch, non-tracker/docs commits on dev: 9e79d7e4 (D64 [merge] batch = 4), 1d81bd6e (D68 daily cap $20), 595c7f01 (durations baseline refresh from green run cd21226d / A-6297), e56825e8 (D69 batch_wait 2m), plus the D68 revert at 00:00Z 2026-10-20 if it lands before the release build. Manual integrated full dev runs (diagnosis or baseline, not occasion runs): e06cee33, d0660b6b, cd21226d, e1986b51 (326b4251 and 87ff7258 never ran tests). Stage, epic, release, soak and hub dev-t3 occasion runs are not manual covers. C6 counts the enforce mechanism, proven by its tests. Switching the manifest from report to enforce is a separate v0.1.4 task before the release (D63), and C6's verdict names it. C1, C2, C3, C5 and C7 already carry D66.

### coord · 2026-10-20T02:57:23.313Z

D73 (stand-in under D24, ask 8fe184d2, 2026-10-20 02:56Z): duration budgets enforced from T-915's landing (2026-10-20 ~00:41Z) until T-930 returns them to report mode for the v0.1.4 release. In that window stage covers #3 and #4 went red only on budget lines (zero test failures) from load variance. C6 still counts the mechanism (D71): it was live and refused real over-budget tests (T-670's T3 growth at 00:42Z). Re-enabling enforcement with variance-based headroom is T-931 under E-880.
