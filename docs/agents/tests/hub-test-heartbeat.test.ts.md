# hub/test/heartbeat.test.ts

T2 heartbeat digest over a projectHub fixture and a FakeClock: schedules, firing, in-flight and stale sections, and durable replacement through real frames.

The missing-review row is suppressed by a queued request whose first line continues after the item (`review request <id> — branch and source`). That is the store's `pendingReview` consumer of the shared matcher: keep the request queued (no live Reviewer) and assert the ask row still ages while `T-n review without` is absent, so the suppression has to come from the queued delivery.
