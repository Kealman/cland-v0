# Host leases

A successful create reserves the pinned provider rate (including the address
charge) to `[hosts] lease` under the shared verification spend cap and the
hosts cap. Reservation refusal precedes acquisition and creates no lease row.
The default lease is 12 hours, with a 30-second minimum, as parsed by the shared
host-pool configuration parser. Fake providers normally declare zero cost;
DigitalOcean creation remains refused by its provider admission.

`HostRecords.leases` owns `host_leases` in hub.db. The provision identity and
creation cancellation/completion owner exist before asynchronous spend admission.
Initial DB or mirror faults unwind through that owner; a lease exhausted while
waiting for the ledger never calls acquire. Create and renewal write the
ledger first, database second, then atomically replace the per-host JSON mirror
at `hostLeasePath(root, id)` (`.cland/run/host-leases/<id>.json`). Its fields are
`id`, `pool`, `created`, `deadline` (ISO timestamps). The watchdog uses `readHostLeaseFile(root,id)`, reading only
this file. A failed mirror update leaves an earlier deadline, never a later
one. Each failure logs a typed `host-lease-publication` error and retries the
pending publication after one hub-clock second, independently of the next
renewal cadence and of a later change to the in-use predicate. No existing provision record or wire reply changes shape.

`createHost.inUse(id)` supplies the sessions-or-minimum predicate. The manual
fallback selects the first `min_hosts` ready hosts in the pool by id. Renewal
runs on the injected hub clock every min(1 hour, lease / 4), extending to a full
lease from now only when that predicate returns true and the host is ready.
A rejected spend extension keeps the existing lease and reservation. `leases.arm`
accepts an error callback and a one-shot `onExpired` callback for its lifecycle owner.

`leases.effective(id, root, clock)` returns min(database deadline, published
deadline), plus `expired`. Missing mirrors expire at creation. All lease timing
uses that effective deadline. An independent expiry timer remains armed during
pending ledger writes. At expiry, create’s callback enters the confirmed destroy
path: its synchronous record checkpoint changes `ready` to `destroying`, fencing
pool membership before deletion. Publication recovery moves this timer beyond
the old deadline. Expiry itself never settles spend; both provider absence
receipts are still required.

`leases.stop(id)` and `leases.close()` cancel timers and join ledger writes.
The SSH registry awaits close before returning from shutdown, before storage
closes. Shutdown retains leases and reservations. Restart restores these owners through
[host restart recovery](host-restart.md). No daemon or store shutdown contract changes.
See the [detached host watchdog](host-watchdog.md) for independent expiry.

Explicit destruction releases the lease only after provider success and both
machine and key absence receipts. Failed provisioning also retains unknown
acquisition/deletion outcomes. Settlement uses the observed real lifetime,
subject to the provider's billing minimum. Its timestamp is checkpointed for
idempotent settlement retries. Call `leases.release` only at a confirmed absence
boundary; it is not cancellation or evidence of absence by itself.

Provision checkpoints pin `nonAcquisition: {kind, at}` with kind `not-called`
or `provider-refused`. Immediately before acquire, that receipt is replaced by
`acquisition: pending`; a successful machine result changes it to `acquired`.
Missing fields on older records confer no cancellation authority. An unknown
acquire result retains the pending reservation for reconciliation. Only a durable
non-acquisition receipt with no machine may call `leases.cancel`; the shared
`cancelHostSpend` API settles at $0 and releases both caps. Acquired hosts still
settle at the pinned provider billing minimum. Cancellation keeps the v1 ledger
shape: cost 0 plus released is settled, never a live reservation.

Published mirror read/parse errors return an expired effective deadline with a
typed publication failure. The renewal owner reports the failure and enters its
one-shot expiry path. Registry shutdown attempts every transport/native owner
even if lease cleanup reports an error; it reports aggregate cleanup failures
after the remaining owners have drained.
