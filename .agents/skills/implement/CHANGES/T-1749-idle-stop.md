# T-1749: pool idle stop

The ready-host scale-down owner uses the hub clock, earliestStop billing floor
and the same inUse predicate as lease renewal. Preserve placement-promise and
minimum-host protection when changing this path. Destruction uses destroyHost;
never call provider.release directly from the scheduler. See
[pool idle stop](../../../../docs/hub/pool-idle-stop.md) and its per-test guide.

Hot application passes the incoming config explicitly through Dispatcher.configure,
Sessions.configurePools and PoolRuntime.configure before the shared config snapshot
is published. Preserve the no-argument startup path.
