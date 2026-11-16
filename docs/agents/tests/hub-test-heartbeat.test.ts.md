# hub/test/heartbeat.test.ts

T2 heartbeat digest over a projectHub fixture and a FakeClock: schedules, firing, in-flight and stale sections, and durable replacement through real frames.

Expiry fixtures enter the inclusive five-day UTC warning window. The first case
observes every exact allowance in the Coordinator message and its injection
receipt; the held-read case crosses the boundary while I/O is pending and proves
the warning uses the firing clock sampled after that read.

The missing-review row is suppressed by a queued request whose first line continues after the item (`review request <id> — branch and source`). That is the store's `pendingReview` consumer of the shared matcher: keep the request queued (no live Reviewer) and assert the ask row still ages while `T-n review without` is absent, so the suppression has to come from the queued delivery.

Queue maintenance runs before the async heartbeat work guard. Pre-arm a held
warning-read owner, observe entry with caseDeadlines, then admit a blocked verifier
request and advance past 1000 ms. Require the durable stalled notice before
releasing the warning promise in finally; later ticks retain one notice. Existing
hub teardown joins heartbeat work after the owner is released.
