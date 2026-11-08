# hub/test/host-provision-records.test.ts

T1 in-memory SQLite storage seam. `node --test hub/test/host-provision-records.test.ts`
proves a ready checkpoint cannot use a revoked or different-address registration,
and revocation changes a previously ready provision row in the same database
transaction. No native processes, files, sockets or clocks.

The active-inventory case inserts 10,000 failed/destroyed rows and all six active
states, then counts JSON decoding at the public iterator: exactly seven live
rows (including the fixture's cloning row) and no terminal history. The existing
state expression index supplies selection; no persisted record fields change.


Occupied inventory is distinct from active placement. Pending acquisitions and
incomplete or unknown machine release remain occupied in failed state. Positive
release or either shared non-acquisition receipt frees a failed slot, while
contradictory receipt plus pending acquisition/machine stays fenced. The idle
PoolRuntime close regression preserves a synchronous return for construction
rollback; only actual create flights contribute an asynchronous drain.


Receipt parity uses the shared JavaScript Date.parse predicate, including refusal
of relative dates such as `now`. The indexed occupied query counts active rows
in SQL, then decodes only unreleased failed anomalies: with 10,000 released or
destroyed history rows, exactly three anomaly candidates are decoded. Valid
non-acquisition without a machine/acquisition contributes no occupied slot.

T-1755 adds `current inventory matches occupied including acquired failures and excluding positive non-acquisition`:
it checks the indexed status inventory against the same occupied count with a
failed acquired but unregistered machine, a positive not-called receipt and a
released terminal record. Existing retained-history work-budget cases remain.

`usage and reserve share retained-generation and placement-promise capacity`
checks one 0.5-slot retained generation plus a 0.5-slot promise fills a 1-slot
host, so another reservation refuses; releasing the promise retains 0.5 used.
