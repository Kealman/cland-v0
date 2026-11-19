# hub/test/startup-listener-scale.test.ts

The embedded `projectHub` fixture seeds 375 retained branch verdicts, 1,645
suite rows, 8,163 human artifact index entries and 4,202 released lease files.
All dates share the fixture clock. Git graph answers are injected; released
leases have an empty active index, so no provider is contacted. No live database
or project state is copied.
The stage-tree reader is injected separately from freshness Git, using the
fixture's known tree. A positively controlled native launch guard remains active
through hub shutdown and directory cleanup.
The shared whole-case owner starts that guard before root acquisition, adopts
late roots/resources, fences each filesystem continuation, and joins original
work before removal or seam restoration. Root, tracker seed, suite/artifact
seed, lease seed, hub and transport setup each have a named five-second bound;
the separate request assertion retains its two-second behavior bound.

The observer is installed before startup. It observes the actual socket bind,
the serving receipt, structured timings for all three listener awaits, and the
exact `T-1` response to `task.view` during the incomplete freshness drain.
The client and first-commit-read observer are armed before the held freshness
callback runs. Polling after startup can miss the drain and measure its tail
instead; the test checks that the reply arrives before all commit reads.
The request has a 2,000 ms bound. The listener budget is report-only at 2,000 ms;
freshness admission before serving and missing listener receipts fail the test.
The committed request gate uses the calibrated 375-want size: the rollback
control answered there, while 750 and 1,500 exceeded the external 60-second
probe deadline. A separate 1,500-want run remains report-only evidence in
A-21496; it also returned the first item during the drain within 2,000 ms.
Shutdown joins tracker work before the fixture directory is removed.

The request latency and drain counters are captured at the reply receipt; the
later diagnostic uses that snapshot rather than including refresh completion.
The exact-case report-mode duration allowance is 20 seconds, E-880, expiring
2026-11-26. It projects a 9.28-second local macOS case using the observed 1.4
droplet/local ratio and 1.5 times headroom; it is not a Linux timing receipt.
The first configured droplet result should replace that projection.

Run this production-scale T3 file only in a granted native slot, within its
current machine-load limit.
It is distinct from the smaller T2 startup-ready-component fixture and from the
startup-replies-scale frame-byte/work-count fixture.
