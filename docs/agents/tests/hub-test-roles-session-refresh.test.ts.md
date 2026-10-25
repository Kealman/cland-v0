# hub/test/roles-session-refresh.test.ts

T2 fake-adapter seam: real disposable role-file edits through `RolesFile` and
`ProjectConfiguration`, then public `Sessions.launch` and `Sessions.resume`.
Intervals are mocked; no native harness or child process is used. The environment
comes from `fixtureEnvironment`; configuration provenance uses a supplied readback.

Keep the generated permissions/approval/sandbox cases for each reader. Start with
a valid policy and a running fake session, save an unknown policy value, and
assert the exact refusal names the roles file, role/key, value and accepted settings.
Assert the last-good map remains identical, the hub log names the key, and neither
spawn, resume nor stop reaches the adapter. Repeated fresh reads must still refuse.
Correct the file and assert the next spawn and relaunch receive the corrected policy.
Retain identical-text recovery after missing/read-denied files.

The deferred-read cases revoke the caller’s grant while fresh I/O is held and
assert the refusal and released launch reservation. Existing custom/fixed
`RolesSource` fixtures without `launchError` stay supported; the public wire
reply remains the existing error string, with no added protocol field.

Held-preparation cases publish an error through each real reader while cwd stat,
adapter spawn authorization or relaunch stop authorization is held. Observe
entry and terminal result with separate 1 s bounds; require refusal before the
fake records a native effect, then correction/retry. Keep last-good map tests and
ordinary reattach available. Policy diagnostics include the accepted empty
string for approval and sandbox as well as permissions.

Register the deferred ownership aggregate through shared `beforeDirectories` before
allocating a disposable root. Track pending launch/resume work, release all held
gates and join it before closing Sessions, readers and stores; restore filesystem
faults only after disposal, then let shared ownership remove directories. The
simulated early-failure cases exercise that same after-hook boundary and retain
root-present-through-disposal/root-absent-after-removal receipts.
