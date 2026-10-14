---
id: T-335
kind: task
title: "Lane flow: the next epic in a lane starts when the previous epic's last ticket merges, not when its QA demo closes it"
state: open
status: backlog
labels:
  - ready-for-human
assignee: null
parent: E-423
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:23:44.027Z
updated: 2026-10-14T16:43:38.996Z
---

Observation from the human and the stand-in (2026-10-13 14:30Z), for the v0.1.3 grilling.

During v0.1.2 the crew went fully idle twice (13:50–14:22Z on 2026-10-13, and shorter gaps before) because each lane serialized on a sync point: last ticket merged → integrated run → hub restart → epic QA demo → epic closed → next epic's to-tickets/plan-epic → first launch. The epic→epic blocking edge (E-268 → E-269, E-269 → E-270) encoded lane order, not a code dependency, and twice the stand-in had to unlink it by hand (recorded on both items) to keep Implementers busy.

Proposed rule: a lane's next epic may be cut (to-tickets, plan-epic) and its first stage launched as soon as the previous epic's last ticket merges; the previous epic's QA demo runs in parallel and closes it later. The QA demo still gates the epic's close and the release (D16); merges of the next epic's tickets that touch the same surfaces wait for the demo's verdict so it sits on the dev tip. Add to this: the next epic's to-tickets and plan-epic can be prepared while the previous epic's last stage is in review, so the launch is immediate.

Related: the batch rule for hub restarts (one integrated run per batch) and the QA-demo serialization (suite-weight demos need dev frozen) are the remaining sync points; consider a dedicated QA machine or droplet for epic demos so dev need not freeze.
