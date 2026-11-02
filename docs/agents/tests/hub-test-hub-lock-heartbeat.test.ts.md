# hub/test/hub-lock-heartbeat.test.ts

T2 uses `projectHub`, disposable roots and the shared sealed fixture environment.
No native harness or browser is launched. Advance the injected FakeClock for all
heartbeat and lapse behavior; native I/O completion waits retain real timers.

Observe persisted heartbeat bytes every 10 seconds and foreign refusal across
multiple 60-second lapse periods. Keep an open prior-file descriptor to prove
whole-file replacement. Replacement-token coverage waits for the normal stopped
receipt before asserting the successor survives. Inject a heartbeat-only write
fault at the filesystem boundary and restore the native binding before cleanup;
assert the failure log, unchanged record, next-beat timestamp and live hub.
Stopping must remove the owned lock and advancing time must never recreate it.
Missing ownership is diagnostic, never proof that another token owns the lock.

Preservation controls run unchanged: `startup-cleanup.test.ts`, `daemon.test.ts`
and `telegram-polling-restart.test.ts`. Native-to-embedded restarts retain the
captured native lock identity as described in the identity test guide.
