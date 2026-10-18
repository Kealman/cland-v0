---
id: T-809
kind: task
title: 'nvim thread.test: "generated live appends…" waits 10 s for a generated append and times out on a droplet stage run; the file slowed from 23 s to 35 s after recorded frames'
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-520
branch: t/T-809-nvim-thread-test-generated-live-appends
created: 2026-10-18T15:41:10.672Z
updated: 2026-10-18T16:23:38.966Z
---

## Summary

nvim/test/thread.test.ts, "generated live appends, ask evictions and delivery changes equal a full render" (4 seeds × 25 renders), failed in E-678's Linux stage run ac462603 (A-5402 line 4630): `the screen never showed generated append within 10000 ms`, after 18.4 s. The file has slowed in every run today (23.5 s baseline → 35.5 s), along with shell, ui and vboard, since T-709's recorded-frame replay (catalog parse about 50 ms per stub process, A-5395). It hasn't failed before in today's logs.

## Acceptance criteria

- [ ] C1. The generated-append wait observes the render event or hub frame instead of a 10 s wall-clock screen poll, or the oracle's seeds run against a per-file catalog slice (T-774's mechanism). Every assertion is kept.
- [ ] C2. The file passes 20/20 serially on macOS plus a green droplet verify on Linux at 2 workers, with its time back under its 23.5 s baseline or the new number recorded.

## Comments

### impl-809 · 2026-10-18T16:23:38.966Z

Baseline whole-file run: 23/23 pass, 28.468 s, oracle 16.527 s. Replaced generated append screen polling with a barrier on the final boundary delivery/queued frame, registered after the synchronous thread consumer. All original render-equivalence assertions retained; explicit rendered-block Live text assertion keeps append-presence coverage. Missing-final-frame mutation fails with 'generated append delivery burst has not landed'; mutation restored. C2's 20 serial whole-file Mac repetitions underway; source review precedes Linux verification.
