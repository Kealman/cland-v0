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
follows: []
topic: null
branch: null
created: 2026-10-16T19:58:43.121Z
updated: 2026-10-19T22:37:32.316Z
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
        - T-725
        - T-692
        - T-693
        - T-695
      - - T-694
      - - T-697
        - T-698
        - T-699
        - T-700
      - - T-696
        - T-728
        - T-726
        - T-727
      - - T-701
      - - T-704
      - - T-705
      - - T-706
        - T-731
      - - T-719
      - - T-733
      - - T-734
  - name: the tail and the scenarios
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-702
      - - T-703
      - - T-707
      - - T-745
      - - T-750
      - - T-751
      - - T-752
      - - T-753
      - - T-754
      - - T-766
  - name: retirement and Neovim
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-708
      - - T-772
      - - T-773
      - - T-709
        - T-774
  - name: stage-3 close
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-775
```

## Comments

### coord · 2026-10-17T01:52:35.818Z

Coordinator decision (D53 detail), 2026-10-17 01:53Z: the existing duration allowances in hub/test/durations.json become legacy allowances, owned by E-677 and expiring when E-677 closes, with no calendar date. Reasons and seconds are kept. New allowances keep the 7-day expiry with an open owner ticket. Budget reports list the legacy allowances separately (count and total seconds), so E-677's progress shows as that number falling. T-716's enforcement exempts legacy allowances until E-677 closes. Without this, 7-day expiries would need weekly mass renewal and would break runs once T-716 enforces.

### coord · 2026-10-17T06:27:06.041Z

Coordinator (D51, D53), 2026-10-17 06:27Z: the 'follows E-676' link is removed. Every ticket in this epic's stage 1 is blocked only by E-676 seams that have merged: T-679 tiers.json, T-685 Clock, T-686 in-process fake adapter, T-687 in-process spoke, plus T-575. E-676's remaining work (T-720, then stage 2's lint, retag and selection) doesn't block the class migrations. The crew was down to one lane, so starting now follows D53's priority. Launching five stage-1 lanes to fit the droplet budget: T-691 (Claude Code contract), T-697 (executor on the clock), T-696 (accounts on the clock), T-701 (leads and routing to T2), T-706 (long waits and perf to T4). Legacy duration allowances are owned by this epic (decision on T-683).

### coord · 2026-10-17T06:34:55.418Z

Coordinator, for every ticket in this epic: seconds criteria are judged from the ticket's evidence artifact (per-file 5/5 medians on the Mac, plus the per-file seconds from the exact-head droplet run), not from hub/test/durations.json. Baselines refresh only from green integrated runs, which the Coordinator does at stage close. A ticket may shrink or remove legacy allowances for the tests it speeds up, but doesn't rewrite baselines.

### coord · 2026-10-17T06:47:14.382Z

Coordinator, allowance ownership rule for this epic: a new duration allowance added by a migration ticket names E-677, not the ticket, as its owner, with the usual 7-day expiry. A ticket-owned allowance goes invalid under the live-owner lint once the ticket closes at merge. The stage-close refresh turns it into a measured baseline, or the Coordinator renews it with a reason. Legacy allowances keep the earlier rule: owner E-677, expiring when E-677 closes.

### coord · 2026-10-19T22:37:32.316Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z), applying D66: C1 (60 % of T1–T3 manifest seconds in T1+T2), C2 (T3 ≤ 1800 s) and C4 (spawn census ≤ 150 hub starts) are measurement targets. The measured values count as meeting them for v0.1.4, and how to reach the original targets goes to E-880 (Ideas). Values at writing: C1 15.6 % (T-775's pinned refresh) or 28.1 % (repo manifest); C2 2356.8 s (T-775's refresh) or 2016.9 s (repo manifest); C4 not measured in v0.1.4 (the local census starved the shared hub, decision 44c61115; T-775 C3). QA records the values at the demo SHA in its verdict and marks these criteria verified under D71. C3, C5, C6 and C7 are judged as written.
