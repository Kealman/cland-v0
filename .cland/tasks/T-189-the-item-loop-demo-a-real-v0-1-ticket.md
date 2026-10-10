---
id: T-189
kind: task
title: "The item-loop demo: a real v0.1 ticket from claim to ready with one Coordinator delivery, measured from the journal"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-143
topic: null
branch: null
created: 2026-10-10T15:56:11.386Z
updated: 2026-10-10T18:19:37.630Z
---

## Parent

T-108 (A quiet Coordinator). The demonstration criterion moved out of T-143 on 2026-10-10: it can only run once T-143's loop is merged and live on a restarted hub, so it could not gate T-143's own merge.

## What to build

Run the item loop on a real v0.1 ticket, from claim to `ready`:
- the Implementer requests its own review;
- a not-clear verdict and a re-review pass between the Implementer and the Reviewer;
- there is one delivery about the item at the Coordinator after the launch (the `ready` event).

Measure it from the journal with T-82's `analyse.py` and record the result as an artifact. Fix anything the run shows is broken, or file it.

## Acceptance criteria

- [ ] A real v0.1 ticket runs claim → own review request → not-clear → re-review → ready, with exactly one Coordinator delivery about it after the launch, measured from the journal with `analyse.py`.
- [ ] The measurement and the journal excerpt are recorded as an artifact.
- [ ] Anything the run shows broken is fixed in this item or filed as a v0.1 item.

## Notes

Blocked by T-143 merged and the hub restarted on it. Size S.

## Comments

### coord · 2026-10-10T17:21:25.323Z

Demo subject: T-196, launched 2026-10-10T17:21Z with impl-196 (reviewer rev-14). The Coordinator's only message about it was the launch brief; measure from the journal after T-196 reaches ready.

### coord · 2026-10-10T18:05:18.552Z

Finding (2026-10-10 18:03Z): impl-196 went idle at 17:32:50Z after its self-review (A-690) with commits pushed, without sending its review request or starting its suite. The hub's long-idle event reached the Coordinator at 18:02:50Z (the subscription path works), and the Coordinator nudged it: a second Coordinator delivery about T-196 after the launch. Likely cause: a Codex turn that ends after self-review with the next steps only described. Candidate fix: the Implementer clause says the turn after self-review ends with the review request sent, not planned.

### coord · 2026-10-10T18:06:13.900Z

Cause confirmed by impl-196 (18:05Z): its nohup suite launch died with the tool shell and left no log, the same failure impl-190 hit at 16:56Z; it then idled waiting on a suite that never ran, with the review request deferred. Instance fix on dev (Implementer clause): suites run in a persistent exec session, never nohup or &; the review request goes out before going idle. The shipped default clause should carry the same line.

### coord · 2026-10-10T18:19:37.630Z

Second Coordinator contact (18:19Z, from impl-196, a blocker question): its suite callback used raw topic.send, which the hub refuses for agents. Three Implementers today hit a broken suite-result path (impl-190 nohup, impl-183 spoke-only frame, impl-196 raw topic.send). Candidate fix: a shipped helper (for example `cland suite --report <session|topic>`) that runs the suite under the lock and posts one result through the session's own spoke, so no session writes its own reporter.
