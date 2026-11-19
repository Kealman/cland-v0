# hub/test/item-summary-scale.test.ts

The 1,650-item branch churn case shares `tip-churn-fixture.ts` with the tracker
oracle. Forty rounds start `task.view` and `suite.queue` reply observers before
the ten-branch refresh. Each command has its own p95 behaviour bound of 1,000 ms;
samples include refresh queueing, socket transport and view I/O, excluding setup.
The hub uses in-process fake infrastructure and fake Git under a positively
controlled native-launch guard; it starts no harness, droplet or browser.
The shared `fixtureNativeGuard` verifies and restores in `afterCleanup`, keeping
the guard installed through hub disposal and fixture directory cleanup.
Shared churn setup seeds only its scratch index through the public index writer,
with the seeding transaction checkpointed and closed before projectHub opens it.
For T-1646, criterion proof comes from reviewed-head droplet receipts.
Coordinator-authorized local troubleshooting is report-only and requires the
quiet-over notice.

The exact C2 churn case has a 19-second setup-inclusive duration allowance, owner
C-216, added 2026-11-18, expiring 2026-11-25. Coordinator decision 39891d33
uses C1's roughly 1.4 droplet/local ratio (5.55/3.97 seconds) to project C2's
8.917725-second local case at roughly 12.5 seconds remotely, then sets the cap to
about 1.5 times that projection. This is not a droplet latency receipt; all 40
reply samples and the one-second p95 assertions remain unchanged. The earlier
droplet C2 attempt failed during config provenance lookup before any samples;
the fake now accepts only that exact log request and returns unknown provenance.

Startup explorer regressions use `item-summary-scale.test.ts` at T2: a thousand
durable rows with a planned epic and retained verdicts count recompute batches.
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
