# hub/test/host-restart-reconcile.test.ts

`hub/test/host-restart-reconcile.test.ts` is T2. Its directory-only fake provider
and reopened SQLite storage prove positive absence settlement and conservative
provider failure. FakeClock gives provider, lease and spend readers the same
clock. The renewal cases cover one-hour and twelve-hour leases at their exact
15-minute and one-hour cadence. Injected native identity observations represent
an existing watchdog; these cases start no process.

`hub/test/host-registry.test.ts` proves a missing registration exits a session
without native operations, and a registered host with no transport retains its
running row. These distinguish absence of ownership from a temporary outage.

The immediate-expiry regression uses the production dispatcher, SSH registry and
Sessions settlement owners around an in-memory worker. It restores an already
expired lease, observes the destroy producer's completed record, and checks that
provider release follows the worker's durable stopped status. The old startup
ordering returns destroying instead of destroyed. No native worker is launched.

Mirror controls cover missing, malformed, earlier-expired and earlier-live
publication with a later database deadline. Injected watchdog identity/arm
observations keep this boundary process-free. Effective expiry remains expired,
and the live shorter mirror retains its deadline after replacement. The minimum
regression reopens persisted inventory and awaits PoolRuntime.close(), joining
every admitted scaling flight before checking no creator ran and one host remains.

All lease/spend options in this component use one fake LockProcessTable from
`hub/test/fakes/lock-processes.ts`. Recovery forwards it through lease reserve,
renew, cancellation and settlement. The expiry owner's destroy call also injects
watchdog identity/signal observations so retirement does not run native ps.
Production callers omit these optional dependencies and keep native observations.

The positive no-native lifecycle control replaces native launch functions before
exercising the real lease/spend boundary. It first verifies the native hook is
installed and its guard rejects attempts, then asserts zero launches for reserve/renew/settle/cancel and that
the injected birth table was actually read. An enforce-mode tier-bootstrap run
of this entire file must produce zero tier-mismatch records; a green test exit
with report-only findings is insufficient evidence. The first verification's
process-free claim was corrected after its spend/watchdog ps probes were observed.
