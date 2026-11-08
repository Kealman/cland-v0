# Pool idle stop

PoolRuntime schedules scale-down with the hub clock. A ready host beyond
`min_hosts` becomes eligible after its pool's `idle_stop` (default `20m`).
The actual deadline is `earliestStop`: the later of the idle deadline and the
machine's creation time plus its provider's billing minimum. Missing or invalid
provider declarations retain the host.

Running sessions, retained native capacity and placement promises use the same
`inUse` predicate as lease renewal. Minimum hosts are selected busy-first,
then oldest and by id. A session or placement promise cancels the old idle wait;
a new full wait begins once the host is empty again. Config changes reconcile
the current inventory and deadlines immediately. Hub restart starts a fresh idle
wait; it does not assume an unobserved idle interval.

At the deadline the runtime fences new placement before calling the existing
confirmed destroy owner. Both the fake and DigitalOcean paths destroy rather
than keeping a stopped billable machine. Destruction joins transport removal,
requires machine and key absence reads, retires the watchdog and releases the
lease/spend reservation. Incomplete destruction retains ownership. Hub shutdown
cancels idle timers and joins admitted destruction before closing storage.

This policy applies to provisioned ready pool hosts, including manual additions.
It does not apply to local or manually registered hosts without provision rows.
Provider availability and the existing creation/auth/network admission still
apply; idle stop grants no creation authority.

Evidence: [pool idle-stop cases](../agents/tests/hub-test-pool-idle-stop.test.ts.md).
