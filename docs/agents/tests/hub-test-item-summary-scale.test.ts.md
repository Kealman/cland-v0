# hub/test/item-summary-scale.test.ts

The 1,650-item branch churn case shares `tip-churn-fixture.ts` with the tracker
oracle. Forty rounds start `task.view` and `suite.queue` reply observers before
the ten-branch refresh. Each command has its own p95 behaviour bound of 1,000 ms;
samples include refresh queueing, socket transport and view I/O, excluding setup.
The hub uses in-process fake infrastructure and fake Git under a positively
controlled native-launch guard; it starts no harness, droplet or browser.
The shared `fixtureNativeGuard` defaults to fenced cleanup, verifying and
restoring only after positive resource, hub and directory cleanup receipts.
Rejected closure retains the guard until a repaired cleanup succeeds.
Shared churn setup seeds only its scratch index through the public index writer,
with the seeding transaction checkpointed and closed before projectHub opens it.
For T-1646, criterion proof comes from reviewed-head droplet receipts.
Coordinator-authorized local troubleshooting is report-only and requires the
quiet-over notice.

The churn root, seed, hub acquisition and initial warm refresh start inside the
selected churn case, with its TestContext owning the whole caller. Name-filtered
runs of other cases never acquire that fixture. The loading regression asserts
zero acquisitions; the churn consumer supplies the positive one-acquisition
control. Run the loading case alone with `--test-name-pattern='loading scale cases'`
to exercise selection. The other startup cases have separate
roots. The forty observed refresh/reply rounds, exact item identities and
one-second p95 assertions exclude setup; case timings include setup.
Fake Git accepts the exact configuration
provenance lookup and returns unknown provenance, with other logs refused.

The same pre-acquisition case owner spans seed, projectHub startup, initial
refresh and the original churn callback. projectHub registers partial-startup
closure through the owner's resource context. Callback socket/trace hooks stay
with that owner through cancellation; teardown joins original work, requires
successful resource closure, then permits root removal and native-control
restoration. Unknown or rejected closure retains these controls and the root.

Startup explorer regressions use `item-summary-scale.test.ts` at T2: a thousand
durable rows with a planned epic and retained verdicts count recompute batches.
The startup work assertion bounds 1,000–2,100 recomputed rows. Original source
measured three batches and 2,052 rows; chunked publication measured six chunks
and 2,058 rows. This tightens the former four-batch worst case of 4,000 rows
while allowing the loop to yield. The ancestor-source-once assertion remains.
The serving case arms both receipt promises and an early Unix client before
startup, retaining the first listener receipt as the two-second serving anchor.
It also measures serving to the actual `hub.status` reply, including client
readiness, within two seconds while the first freshness read is still running.
This avoids hiding a blocked event loop by waiting for `projectHub` to return
before sending the request. A prototype observer counts the real explorer source
updates for E-2 and R-1: each refreshes once in that first announcement batch.
The held planned write is observed separately, released, and followed by the
planned status receipt. The whole-case owner and positive launch guard cover
setup through cleanup. The original seed promise is enrolled with the cleanup
owner before observing its separate 15-second setup deadline. That observation
may reject early; cleanup still joins the seed's original writes before removing
the root or restoring fixture seams. Individual write failures are collected
only after every seed write settles.
Fixture setup has its own bound. No real daemon or browser is needed. The diagnostic
`hub/scripts/measure-startup.ts` copies durable live inputs into a sealed scratch
root; its measurements are diagnostic evidence, not a suite receipt.
The planned-stage comment regression seeds 1,650 synthetic rows with earlier
stage closure receipts, retained branch verdicts and paired platform covers.
A live in-process Reviewer fails C1 and posts a not-clear verdict while moving
branch freshness. Twenty extra clients acknowledge subscription then drain bytes;
one legacy subscriber parses frames and a separate request client measures the
actual task.view reply, avoiding subscriber backlog in the requesting stream.
Its clock starts at the explorer receipt containing the tail item, before that
publication can block. Setup and tail-publication receipts have separate bounds.
The tail receipt and a second edit during publication prove the remaining frames
retain the newer title. CPU diagnostics include the embedded hub, one parsing
subscriber and native socket writes through the final publication receipt;
they exclude fixture setup, browser work and remote execution.

The new comment callback enters `stageCase.run` before acquisition. Its named
setup observations use 15-second bounds; detached reply, tail, second-edit and
poke sequences retain their originals with separate 60-second observations.
`stageCase.wait` accepts that per-observation bound while preserving its existing
five-second default and cleanup bound for other callers. The root is adopted
immediately. Hub and MCP partial acquisition hooks register through the required
resource context, and each extra socket arms its native close receipt before
connection setup. Poke failures propagate at their join; joining a rejection is
separate from positive hub/resource closure. Explicit owner close must succeed
before the case reports closure, and root/native-guard restoration remains
fenced on that success. The existing refused-close guard regression in
`suite-persistence.test.ts` exercises the same owner.
