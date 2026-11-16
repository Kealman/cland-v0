# hub/test/opencode-host.test.ts

Port retry regressions call startServer with scripted Host/client operations only.
Repeated freePort selections exhaust SERVER_PORT_ATTEMPTS (eight), throw
OpenCodePortRetryError with the last port, and spawn the colliding port only once.
The fake enforces a 1000-call/1000 ms safety bound inside freePort so a microtask
spin cannot starve the test timeout. A collision followed by a fresh port must
return that second server's PID and URL after its authenticated readiness reply;
the fake then publishes the exact child exit before releasing the fixture.

T2 recording Host seam with a scripted OpenCode HTTP transport. Prove one
spawn per launch, serve argv, cwd, environment filtering and private config/password
and log paths. Synthetic PIDs and birth identities must never reach local probes.
A fake clock triggers poll; wait for the Host receipt and exact exit callback.
Resume and stop use the row Host. Stop forwards authorization and logging
callbacks through Host.stop at the native signal boundary. All fixtures use disposable environments.
Native stdout/stderr append, exit and signal receipts are in the reusable Host
contract (T3 host-local-contract wrapper). Keep opencode-adapter.test.ts and opencode-native.test.ts unedited for C4.
The approved launch-policy exception changes only its native lifecycle fake;
every test body and assertion stays identical.

Hold resume alive/identity and stream-disconnect alive to prove close joins the
actual completion and fences late relaunch, state and backoff work. Hold an
accepted spawn through close with durable recovery enabled: observe Host stop,
retain password/log files until native exited, then assert rollback removal.
Hold the native log open and revoke authority before releasing it; native spawn
must not be reached. Bound setup and completion independently. Poll completion
uses the exact published exit callback; an attempt count is not the receipt.

Successful local launches retain the child-exit receipt after commit. Hold that
receipt after Host.stop acknowledges termination: stop must remain pending until
reap. Advance the fake native timer to the existing five-second settlement bound
and assert cleanup-incomplete, then trigger a watched-row liveness-negative poll.
No exit callback may retire the unreaped launch. Release the exact native receipt,
observe the exit callback, and prove explicit stop retry completes. Recovered
local rows without a child handle retain Host stop confirmation. Register the
release and adapter drain with beforeDirectories before launch setup, so even a
setup failure settles captured work before fixture removal.
