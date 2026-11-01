# hub/test/opencode-host.test.ts

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
