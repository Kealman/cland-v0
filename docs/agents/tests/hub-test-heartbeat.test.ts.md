# hub/test/heartbeat.test.ts

T2 heartbeat digest over a projectHub fixture and a FakeClock: schedules, firing, in-flight and stale sections, and durable replacement through real frames.

Aggregate notice/log controls opt into the fixture's `stageCase` owner. It adopts
the root and registers a required partial-resource closer before constructing
or starting Tracker/Crew/Hub. Tracker startup is awaited on this owned path.
Positive Hub, Crew and Tracker close receipts are remembered independently;
directory hooks run afterwards. Existing fixture callers keep their old path.

Ownership fault controls cover Tracker and Crew startup failure after acquisition,
and rejected Hub close after complete setup. Each first refuses its required
resource close, then invokes a real `ownDirectory` removal guard independently
of the existence check. A `beforeRemove` safety stop would fail the test before
deleting live storage if the guard were bypassed. Assert no removal entry,
retained root and native guard, and refused restoration. Repair the resource
fault, run registered cleanup and assert positive close, root removal and guard
restoration inside the named load-scaled proof observation.

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
