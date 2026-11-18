# hub/test/opencode-host.test.ts

Recording/fault Host bases use the shared `recordingHost` helper. The remote
rename case maps its logical OpenCode root to distinct scratch host storage;
the helper maps both move paths and forwards source identity. Explicit process
and transport overrides stay scoped to each case. Actual `localHost` subjects
remain in local rename, file-owner/reservation and native-log authorization
controls so the helper cannot replace the production boundary under test.

Rename cases use renameCase to enroll whole-callback ownership before imports,
guard installation or root acquisition. Each boundary has its own bounded wait;
the original setup/body is joined before adapter/agent disposal and directory
removal. Fixture-owned method descriptors and the positively controlled
native launch guard remain installed until disposal is confirmed. A failed join
or cleanup retains them and the root rather than restoring native fallbacks.

The fake remote Host maps the same logical path to a separate scratch directory.
Plant a hub mirror with distinct password bytes and prove it remains unchanged.
Observe the original stream opening before rename, then prove delivery to the
new name, resume and private-file retirement. Check persisted failure visibility
through Sessions.view for running, stopped and exited rows, before and after a
fresh adapter reads the same state, while resume and retirement remain fenced.
The local case checks preserved bytes, password mode and directory inode.

Old-agent capability tests retain the previous hello shape and require the
structured moveDirectory refusal without a prepare call. The new-agent fake
uses production PreparedOperations, drops an accepted commit reply, and checks
durable settlement without a second commit. Occupied destinations refuse; failed
moves join reservation cleanup. Native process operations remain throwing fakes.

Replacement controls preserve a moved-aside original source and seed its saved
private-directory identity before planting a replacement. Reservation controls
replace the captured directory at pre-move revalidation and failed-move cleanup;
each requires positive proof that the injected boundary ran and that both the
replacement and original source survive. These use fixture-owned filesystem
seams, restored only after positive completion, with no SSH or OpenCode binary.
These controls detect observed out-of-band replacements; they do not prove an
inode-bound pathname mutation. The supported writer model is the shared Host
directory owner. Hold the actual rename seam, queue a source-directory write
and finish an unrelated-directory write, then assert the native entry order
after release. Post-move replacement produces the structured unknown result,
fences later mutation and never invokes rename again. Available/unsupported
no-replace fakes cross the same owner and final identity check; the shipped
backend remains the checked fallback without any native runtime bridge.
If the native rename rejects after an uncertain effect and the reservation
cannot be positively identified for cleanup, keep the unknown fence and the
original native error as its cause; the cleanup diagnostic stays secondary.

Followed-file alias controls cover write, append, truncate, local log open,
prepared-agent log open and direct-agent log open, each with an existing or
missing referent. Hold only the exact session-directory rename (never checkpoint
renames), observe the writer's canonical admission after setup, complete an
independent write, then release the move. Keep the positive native entry order
and moved-file bytes/absence assertions. Release and join held work in the
original body and before resource owners close; every real launch stays guarded.

Unknown-move controls run production PreparedOperations prepare/commit after a
post-move identity mismatch or lost native completion. Read the exact committing
plan, require no durable result, pending owned settlement and wrong-owner refusal,
then repeat commit and reopen a fresh PreparedOperations owner. Its mutation
admission, commit and abort must refuse; settlement remains pending, the plan
stays identical, the native move count is one and original/replacement bytes
remain. Expected incomplete close still joins original work before fixture roots
and manual filesystem seams can be released. This is in-process recovery with
throwing process fakes, never a native agent restart or SSH launch.

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
