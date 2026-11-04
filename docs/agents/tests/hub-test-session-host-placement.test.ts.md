# hub/test/session-host-placement.test.ts

T2 frame admission through projectHub and fake adapters. Disposable project roots
use the harness environment builder. Persisted stopped process fixtures exercise
relaunch/fresh resume and role set/move against a registered test Host. Refusals
must retain roles, leave no launch reservation and make no adapter calls.
The recording spawn control uses synthetic accessible directory metadata and the
test Host spawn refusal; no remote login, provider or native harness is used.
The absent-host frame is the previous-wire-shape compatibility control.
Preservation controls remain unedited: role-launch.test.ts,
roles-launch-permissions.test.ts and session-launch.test.ts.

The production OpenCode adapter is also constructed through projectHub with
recording local and nonlocal test Hosts. Its launch must reach the selected
nonlocal Host.spawn refusal and never local Host.spawn; the executable is
synthetic and no native harness starts. This preserves placement across T-1545's
operation scopes and Host-owned launch/stop drainage. Explicit scratch-local
Host directory/write/remove/freePort operations allow preparation to reach that
spawn boundary; the shared fixture environment seals its inputs. Keep the spawn
refusal, operation log and no-local-fallback assertions unchanged.

The production OpenCode remote control now expects the explicit T-1644
shared-ignore refusal before any spawn and retains the no-local-fallback and
no-process-row assertions. The fake adapter control still reaches the selected
Host's spawn refusal. Scratch preparation supplies the file Host's layout.

The three Codex/Implementer placement doubles explicitly delegate realpath to
owned scratch Host metadata because these launches carry sandbox policy. Default
testHost remains refusing; Sessions skips realpath for OpenCode's absent sandbox
policy and retains its original nonlocal preparation refusal assertion.
