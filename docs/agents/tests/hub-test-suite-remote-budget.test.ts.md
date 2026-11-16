# hub/test/suite-remote-budget.test.ts

A terminal no-lease report retry must leave the sole remote slot available to a
successor. The scheduler restarts from that seed while report publication fails;
observe the successor's scripted worker-start receipt before asserting membership.
Existing preparation and unconfirmed-cleanup cases retain their capacity fences.

These T1 scheduler cases use `suiteUnit` and its semantic receipts rather than real
machines: the scripted machine plus fake DigitalOcean provider create the lease and
delivery facts, `FakeClock` advances acquisition, run and wait time, and
`DropletExecutor` acquire/release are mocked so no droplet exists. The fixture's
`remote(f)` helper submits an explicit `--executor droplet` request, which sets
`requireRemote` and keeps it queued instead of falling back locally. `remoteBudget`
is the slot count under test; leave provider POST counts to assertions that a
queued waiter acquired nothing.

The restored-delivery case seeds a durable delivered lease with `deliveryLogEnd`
and a stale pre-delivery job offset, then reopens the scheduler. It observes the
restored running receipt before finishing. Keep the complete remote census and
local diagnostics, with exactly one census prefix. A second seed already has
collected remote bytes: recovery must use the durable prefix, never current file
size, so those bytes are neither replayed nor skipped. Existing fake leases
without the optional field exercise the prior persisted shape unchanged.
The absent-offset seed models a crash before any suite-job remote offset was
saved: hydration must precede the local Workers admission line. The legacy
seed omits the new lease field and keeps its correct job offset. Recovery-side
cleanup diagnostics go to the hub journal once a remote prefix exists, so they
cannot be mistaken for mirrored remote bytes.

Lease controls belong to the fixture root, not the live project: write a durable
lease with `writeLease(root, …)` (the `leasedOnly` helper writes a `creating`
lease with no suite job behind it) to model preparation or an unconfirmed cleanup
holding a slot. Reservation and spend ledgers stay untouched by policy cases; the
real backend is exercised only by `suite-accounting.test.ts`.

The durable-slot ETA cases assert both directions of the estimate: with one
running remote job and one preparation-only lease in a two-slot budget, the
explicit waiter's ETA equals the running job's remaining time (a known millisecond
value seeded by a completed run), never zero; with only a preparation-only lease
in a one-slot budget, the waiter stays labelled `waiting for remote` with a null
(unknown) ETA and no provider create request. The third case reads the scheduler's
own published `snapshot()` after a tick and `settled()`, so the workbench queue —
not only `suites.queue()` — counts the durable-only slot.

`suites.queue()` sweeps leases itself; the scheduler refreshes them off the tick,
and `settled()` observes that admitted sweep, so a snapshot after a settled tick is
deterministic. Never make that refresh an awaited step of the check or publish path:
`Suites.#check` coalesces due ticks, and an extended check swallows the advance
window a stall or timeout case expects (see the coalescing note in
`docs/agents/tests.md`).
