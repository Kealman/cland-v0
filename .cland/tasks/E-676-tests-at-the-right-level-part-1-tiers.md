---
id: E-676
kind: epic
title: "Tests at the right level, part 1: tiers, test lint and in-process simulation"
state: open
rank: 4220
labels:
  - epic
  - v0.1.4
  - verification
assignee: null
parent: R-577
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:58:43.022Z
updated: 2026-10-17T11:42:55.235Z
---

## Summary

Week 0 and week 1 of D53. Every test file declares a tier in hub/test/tiers.json. A test lint reports, then refuses, tests at the wrong level, and per-tier budgets report what they would refuse. The hub gets the in-process seams that T1 and T2 tests need: a Clock with a FakeClock, an in-process fake adapter for the three harnesses, and an in-process spoke. Source: A-4143 (memo §5.1–5.5, report-strategy).

## Goal

New tests stop arriving at the wrong level, and the seams exist to move the old ones. Nothing changes what a run executes until the merge-queue epic switches the protocol.

The plan, lanes and hot files are in A-4143's companion PLAN (topic-406).

## Definition of done

- [ ] C1. `hub/test/tiers.json` lists every hub and Neovim test file sorted by path, `shards.json` is gone, and the tier lint passes at the demo SHA.
- [ ] C2. A task run and an integrated run at the demo SHA each show per-tier lines, the test-lint summary and the budget would-fail lines, and `cland verify --dry-run` prints the same without creating a queue entry or lease.
- [ ] C3. A planted new T3 file without a lifecycle header, a planted new numeric sleep and a planted new `startDaemon` call site are each refused at verify and at merge admission.
- [ ] C4. `projectHub` serves a project with a `FakeClock`, the in-process fake adapter in all three flavours and an in-process spoke, each proven by a T2 file whose spawn census row shows no hub, spoke, harness or Neovim child process (git and ps infrastructure probes are T-719’s).
- [ ] C5. heartbeat.test.ts runs on the fake clock in 5 s or less (from 25.7 s) and passed 20/20 serially.
- [ ] C6. Ten consecutive droplet task runs show no typecheck on the droplet and the host-gate reuse line.
- [ ] C7. The selection replay over the last 40 landings shows zero own-test misses and more selecting landings than the baseline recorded at A-10's merge base.
- [ ] C8. An Implementer's `cland verify all` is refused with `verify-all-reserved`, and the tier share baseline (A-12) is recorded on the epic.

---

## Plan

```yaml
stages:
  - name: report only
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-679
        - T-681
        - T-683
        - T-720
      - - T-680
        - T-689
        - T-722
      - - T-685
        - T-686
        - T-687
      - - T-659
      - - T-688
  - name: stop the growth
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-682
        - T-730
        - T-735
        - T-684
      - - T-690
      - - T-729
```

## Comments

### coord · 2026-10-17T08:27:54.039Z

Coordinator, 08:28Z: stage 1 'report only' is closed. Every ticket in it is merged, and integrated cover 41455236 at 010c9955 is green, 2471/0 with the Neovim phase (A-4396). The usual stage-close refresh of hub/test/durations.json is deferred to E-677 stage 1's close. Six open E-677 branches all edit allowances in that file, and a refresh commit now would conflict with every one of them. Ticket seconds are judged from each ticket's own evidence artifact in the meantime (rule posted on E-677).
