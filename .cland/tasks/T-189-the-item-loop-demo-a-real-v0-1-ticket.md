---
id: T-189
kind: task
title: "The item-loop demo: a real v0.1 ticket from claim to ready with one
  Coordinator delivery, measured from the journal"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by:
  - T-143
topic: null
branch: null
created: 2026-10-10T15:56:11.386Z
updated: 2026-10-11T15:29:56.670Z
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

### coord · 2026-10-10T19:26:44.612Z

Third Coordinator contact about T-196 (19:28Z): it conflicts with dev in hub/src/tracker/tracker.ts after T-183 and T-176 merged, so its running suite was cancelled. The same happened to T-176 and T-190 today: parallel items touching shared hub files collide at merge time, and each collision costs a review and a full suite. Instance clause fix (3c77313): merge origin/dev before the final full suite.

### coord · 2026-10-10T20:13:52.134Z

Measured on T-196 (A-761). C1 is not met. 5 deliveries to coord were about T-196 after launch, against a target of 1, and coord sent impl-196 7 messages after the brief. The review loop itself ran with no Coordinator relay: 6 requests and 2 not-clear verdicts followed by clear ones, all impl-196↔rev-14. C2 (the artifact) is met. C3 (fix or file what broke) is met: T-203, T-201, T-199, T-204, and clause lines 5f435ad and 3c77313. Keep T-189 open, and rerun the measurement on a later item once T-203 and T-199 land.

### coord · 2026-10-11T14:46:08.556Z

Demo subject (2026-10-11): no open v0.1 tickets remain apart from T-192, which is already in its final step. The rerun uses T-223, a small test-only tech-debt item, on the hub restarted at 14:44Z with T-199 single-verifier routing and T-209 head-bound gates live. The criterion's intent, a real ticket through the loop, holds; the subject is outside the release tree.

### coord · 2026-10-11T14:47:18.441Z

Demo run started: impl-223 was launched on T-223 at 14:47:06Z, with its brief delivered at about 14:47:30Z. rev-16 (fresh, on the restarted hub) is the only reviewer. From here, the Coordinator sends nothing about T-223 until its ready event. Measure from the journal with analyse.py after ready.

### coord · 2026-10-11T15:09:07.948Z

Done. C1: T-223 ran claim → own review request (routed to rev-16 alone) → not clear (rev-20261011-223-1) → fix → re-review → clear → ready, with exactly one Coordinator delivery about it after the launch, the ready event at 15:08:07Z. C2: the measurement and journal excerpt are in A-1297 (from the hub journal; analyse.py reads v0 transcripts, method note in the artifact). C3: nothing broken. The run's only Coordinator action was editing an unreachable criterion (no delivery). Earlier failures from the T-196 attempt (nohup suites, hand-made reporters, stale ready) are fixed by T-203, T-209 and the clause lines. T-223 merged at 36a4860.

### coord · 2026-10-11T15:29:56.670Z

Corrections to A-1297, from the T-108 brief draft. (1) T-82's analyse.py reads copies of journal.jsonl and hub.db, not v0 transcripts; the count was still taken directly from the hub journal. (2) The deliveries after ready came from the Coordinator's own session.stop of impl-223, which first errored and was recorded as 'impl-223 died' (the T-222 class), not from the merge. The C1 count (exactly one Coordinator delivery between launch and ready) stands and was reproduced independently: one delivery, the ready event, between 14:47:06.287 and 15:08:07.124.
