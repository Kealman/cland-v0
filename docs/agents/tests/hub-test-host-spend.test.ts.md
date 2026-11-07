# hub/test/host-spend.test.ts

T1 ledger API checks use scratch HOME and XDG state, injected process identity,
and FakeClock. Run `node --test hub/test/host-spend.test.ts` with CLAND_* removed
from the launch environment. No provider, transport, browser or native child runs.

- `host reservation preserves previous v1 settlements and legacy reconciliation`:
  seed previous-format primary and legacy ledgers with disagreeing settled costs;
  reserve a host, then read both durable ledgers. The larger settlement survives,
  the version remains 1, and the host carries category and pool. An absent category
  contributes to verification totals.
- `host and executor admissions share the cap while hosts also obey their own cap`:
  seed verification spend; observe both host refusals, then verify executor admission
  counts the host reservation and an identical host retry adds no entry.
- `renewal raises the held lifetime and settlement bills actual lifetime with a minimum`:
  observe rejected renewal retaining its reservation, successful extension, and a
  shorter renewal retaining the extension. Settle once, repeat identically, reject
  a contradictory settlement and renewal after settlement. A one-second host with a
  one-hour minimum bills two dollars; the half-hour host bills one dollar.
- `settled UTC totals separate days, months and pools while pending costs stay excluded`:
  settle hosts across October/November and two pools, hold another reservation, then
  advance the shared fake clock across midnight. Today resets; month totals and
  pending admission spend remain.
- `executor shard admission does not mistake a host identity for a verification run`:
  a host with the same run identity cannot suppress an executor reservation.

Run unchanged executor-spend.test.ts alongside this file to preserve migration,
retirement and executor accounting coverage. Stage QA consumes these named cases;
live-host accrued cost and CLI host-status rendering belong to later epic items.

Review regressions:

- `native host lease conflict refuses admission without changing durable accounting`
  and `shard host lease conflict refuses admission without changing durable accounting`
  seed both ledgers, then exercise native lease and exact `reserved:<run>` collisions.
  Each must refuse without changing primary bytes, and locked legacy reconciliation
  must retain the full combined reservation.
- `offset settlement instants count in the UTC day and month and shared cap` settles
  October 31 at 23:30 -02:00 (November 1 at 01:30 UTC). Category, pool and shared-cap
  spend must all include two dollars on November 1. An identical-instant UTC retry
  is idempotent and the durable settlement is canonical UTC.
