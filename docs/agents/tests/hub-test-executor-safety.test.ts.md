# hub/test/executor-safety.test.ts

T3 keeps native shell, hub-process and detached-watchdog lifecycle boundaries.
The sentinel case uses the normal fixture lifetime while preparing, delivering
and starting each run. It observes the crash run's durable `pgid` before stopping
the hub. After confirmed shutdown, atomically publish an expired lease and set
the same deadline on that run's saved scheduler lease in the stopped database.
The detached watchdog is still the only running owner of cleanup. Observe its
`watchdog.json` confirmed-deletion receipt before restart, then retain the
lifetime-expired result, single report, released resources, spend and sentinel
absence assertions. Shortening a lifetime before delivery spends the expiry
budget on host scheduling and can fail before `pgid`; adding time to the group
wait does not repair that race. No new sleep or wider wall-clock bound is needed.

Restart's scheduler reads its own saved lease as well as the lease file, so the
fixture must update both durable deadline copies. Keep this fixture edit after
shutdown; do not change product expiry, name reservations or cleanup guarantees.
