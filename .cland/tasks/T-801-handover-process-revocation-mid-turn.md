---
id: T-801
kind: task
title: 'handover-process: "revocation mid-turn…" failed once on a droplet (7.5 s) in an unrelated task run'
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-518
branch: t/T-801-handover-process-revocation-mid-turn
created: 2026-10-18T12:59:15.093Z
updated: 2026-10-18T16:22:06.418Z
---

## Summary

hub/test/handover-process.test.ts, "revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it", failed after 7.47 s in T-645's droplet run 2b7bf0f0 (A-5301, line 32479). That run also hit the 75 min timeout. T-645 changes only release and version code, and the test hasn't failed in the day's other droplet logs. The failure detail was lost with the hung shard's reporter (T-799).

## Acceptance criteria

- [ ] C1. The file passes 20/20 alone on Linux, or the cause is named from a reproduction.
- [ ] C2. Any wall-clock wait in the case is replaced by an observed event or a FakeClock step, keeping every assertion.

## Comments

### impl-801 · 2026-10-18T16:22:06.418Z

Baseline handover-process file passed locally (9.19 s). Event-controlled delayed-driver probe waited for pong: Plan the week before role.set: old generic refusal assertion still passed (11.00 s), because a later revocation-turn send was forbidden. Tightening audit selection to the original request's reply_to made that schedule fail (undefined role vs null), demonstrating that the original 2.5 s window does not guarantee mid-turn revocation. Historical droplet failure cause remains unproven; requested C1 evidence decision from Coordinator. Implementing an explicit per-session fake turn barrier; keep every existing assertion.
