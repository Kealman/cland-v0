# hub/test/session-pool-placement.test.ts

T2 session.launch/list frames on projectHub with provided test Hosts, durable
registration/provision records, and in-process fake harnesses. Configuration is
parsed from scratch TOML with explicit slots; no native child, real provider or
browser is involved. Run with supported Node and inherited CLAND_* removed.

Cases C1–C6 prove selected adapter Host plus list/CLI rendering, default local
and old-wire rendering, dense/spread settings, missing-pool refusal without
holders/spawns, fresh roles between launches, explicit pins and full-pin refusal.
The empty pool case proves no local fallback; concurrent launches fill four
half-weight places in two single-slot Hosts, hold the fifth waiting, then place it after a durable exit/stop checkpoint. No lifecycle timing is measured.

The native create seam is in host-create-ready.test.ts: its existing C1/C2
case now binds Implementer to agents and launches without an explicit host,
then checks the exact persisted native process identity and Host liveness.
After-stage QA routes findings to lead T-1743 in its item topic.

The failed-spawn control refuses the adapter at the selected Host, observes the
failed launch reply, then fills both half-weight places on that same Host. This
checks that failure releases the scoped capacity promise.

`a host leaving ready between launches is excluded from the next decision`
changes the first Host's provision state to destroying after the first launch.
The next launch selects the other Host and a pin to the destroying Host refuses.
Membership is read synchronously from SQLite at every placement decision; lease
expiry can revoke readiness without a pool-runtime cache invalidation step.

Review regressions hold Host.statDirectory, move the selected Host to destroying
and assert no spawn; inject a post-native publication fault plus unknown stop,
fill only the remaining half slot and assert refusal again after hub restart;
and reuse an idle connected Reviewer on its full remote Host with identical
session id and no additional adapter spawn. The fixture's extra Store closes
through onCleanup in the shared resource phase before hub/root teardown.

The final adapter control holds preparation inside the adapter, then invokes
its authorization callback before recording native admission. A separate fault
control simulates a visible running row alongside the same pending generation,
asserts one capacity charge, publishes positive fake Host native absence, waits
for the durable pending-stop removal and admits the released half slot.

The persisted failed-generation restart test uses a half-slot Host filled by
that failed generation alone, independent of ordinary fake process restoration.
The retained-source control checkpoints unknown native closure, moves the
current row, observes source refusal before and after restart, then injects the
lifecycle store's confirmed-closure checkpoint and observes admission. This
proves placement consumption of an owner receipt, not native signal behavior.
The positive-absence observer is joined in resource cleanup on early failure.

Provided Host records use the synthetic provider tag `provided-fixture`, so a
restart does not mistake them for physical fake-provider machines and invalidate
readiness for missing fake-machine directories. Pools still parse explicit
provider/slots from TOML. The native fake-provider create seam remains the T3
host-create-ready fixture; these records deliberately exercise provided Hosts.

The implicit-role control holds the actual role-file fresh read, changes the
durable nonexclusive preassignment through the Store fixture seam, and asserts
refusal with no spawn and the new role intact. The handoff control holds an
Implementer stop after closing its old peer, submits a duplicate worker name,
asserts the reserved-handoff refusal, then completes the original handoff and
checks its name/new session identity and two total spawns. Both held producers
are released/joined in shared resource cleanup, including early assertion failure.

Reverse-order controls hold real account-registry I/O for an early placement.
A later item cannot reuse that worker or take its new roleless name; assertions
retain the original session id and zero additional stops/spawns. Handoff-first
cases cover both held preparation and held stop. Resource restorations use
finally around joins, so a rejected/closed client cannot leave the global reader
or adapter patch installed.
