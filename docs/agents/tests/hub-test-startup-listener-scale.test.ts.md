# hub/test/startup-listener-scale.test.ts

The embedded `projectHub` fixture seeds 1,500 retained branch verdicts, 1,645
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
seed, lease seed and transport setup each have a named five-second bound.
Hub acquisition uses `testSetupWaitMs()` from the shared wait helper: the
configured setup base (5,000 ms fallback) receives the executor/load factor,
including the droplet's minimum factor of two. The returned hub logs its own
acquisition outcome, duration, bound and drain counters before transport setup;
the separate request assertion retains its two-second behavior bound.

The observer is installed before startup. It observes the actual socket bind,
the serving receipt, structured timings for all three listener awaits, and the
exact `T-1` response to `task.view` during the incomplete freshness drain.
The client and first-commit-read observer are armed before the held freshness
callback runs. Polling after startup can miss the drain and measure its tail
instead; the test checks that the reply arrives before all commit reads.
The request has a 2,000 ms bound. The listener budget is report-only at 2,000 ms;
freshness admission before serving and missing listener receipts fail the test.
The request gate covers 1,500 unique commit wants. The reply records the number
of commit reads and published answers at that exact boundary; the test requires
at least one read and fewer than 1,500 reads at the reply. Startup must have a
serving receipt, all listener awaits must report `bound`, and freshness scheduling
must occur after serving.
Shutdown joins tracker work before the fixture directory is removed.

A separate work-only case uses the same 1,500 branches and plan but only the
two stage-cover suites, with no artifacts or retained lease files. It does not
sample task.view latency. Fixture-owned SQLite tracing counts summary computations at the
open-blocker query and hydration as returned rows with a title. The census runs
from the explicit freshness read through publication of all 1,500 resolved item
answers. It permits at most ten summary computations and forty hydrated rows
per answer, including the request's work in the latency case. Structured
freshness-settled receipts must name zero stage-cover dependents. The test then
joins the announcement producer's positive completed receipt. A work-budget
overrun records the counts and throws at the traced query, stopping synchronous
excess work even when timers cannot run; the final assertion still fails with
the recorded counts. This keeps Git
completion, publication and producer completion as separate observations.

The work-only case can run locally in a granted slot; the first timing sample
for the 1,500-want request case belongs to droplet verification. Both cases use
fake Git and a positively controlled guard against native process launches.

The request latency and drain counters are captured at the reply receipt; the
later diagnostic uses that snapshot rather than including refresh completion.
The listener case has a report-mode 13.599-second duration allowance, E-880,
expiring 2026-12-21. The work-only case has a separate 15.418-second allowance,
C-216, expiring 2026-11-28. Its cap is 1.5 times the worst retained passing
Linux sample (10.278319785 seconds in A-22429; the later A-22444 sample was
8.039 seconds), rounded upward to milliseconds. Both samples replay through
the production checker before allowance admission. These durations include
case setup, assertions and cleanup; they do not describe task.view latency.
The first Linux task.view sample in A-22444 was 256.190149 ms, after 10 of
1,500 commit reads and before any answer publication, within the unchanged
2,000 ms behaviour bound. The whole verification still exited 1 for the missing
work-only duration allowance. C-216 owns the follow-up due before 2026-11-26
to reduce that case below five seconds or renew its allowance before expiry.

Run this production-scale T3 file only in a granted native slot, within its
current machine-load limit.
It is distinct from the smaller T2 startup-ready-component fixture and from the
startup-replies-scale frame-byte/work-count fixture.
