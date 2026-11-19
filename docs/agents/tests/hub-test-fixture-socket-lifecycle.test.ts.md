# hub/test/fixture-socket-lifecycle.test.ts

The native Git/copy control allocates a live receipt and reciprocal alias before
repository initialization. It requires ordinary source to remain visible while
runtime metadata is absent from status, `git add .`/commit and a real clone.
An actual filesystem copy uses the same exported filter as prepared roots,
fake machine images and fake volume snapshots; source bytes survive and runtime
identity does not. An ordinary project with similarly named user data supplies
the positive control. The managed `.cland/.gitignore` update leaves the nested
owner ignore unchanged, and removing a receipt creates no tracked deletion.
This is a T3 native Git/descriptor boundary, with shared sealed environments and
owned original work; it is not a fake-only subprocess claim.

T3 observes real native listeners in disposable child processes. Normal close and
SIGKILL both wait for the child's close receipt before directory ownership removes
the private socket directory. The SIGKILL control proves the endpoint survives
native termination before checking removal after fixture cleanup. Separate bounded
setup and close observers precede each trigger. The failed-drain test runs an
isolated test worker with an explicit live-listener directory-removal guard. A
resource error still permits every directory disposal attempt; the guard retains
only its live root, then a final check observes retention and closes the listener.
The parent records its root and private endpoint, observes its native
exit and expected cleanup failure, then checks both directories remain. Only after
that exit does the parent remove retained data. Those listener controls start no
hub or harness.

The receipt recovery case gives a disposable worker its own captured native group
before asking it to launch a stub in that group. The stub survives the worker's
individual SIGKILL after publishing its open root-local receipt. Until the parent
captures the stub's own native identity, the original worker-group owner still
joins acquisition and descendants. The case then asks the native
orphan sweep to discover and join that exact surviving PID through its open file
paths. No global registry enumeration is needed. The final receipt assertion runs
before normal fixture teardown, so teardown cannot repair a failed sweep.

Separate isolated test workers exercise success and a planted test failure. Each
persists its exact project, hub/spoke fallback and receipt paths before finishing.
The parent observes native close and checks those paths absent; each child also
runs the file-level fixture census. The failing case must report the planted
failure and exit 1. Missing completion or path receipts never count as cleanup.

These new controls use the item-local `residueControl` composition before setup,
with separately bounded setup/observation waits and ownership of the original
continuations. `residueChild` enrolls close observation and a resource-close slot
inside the native producer before identity capture can reject; cleanup requires
both its native group join and close receipt. Diagnostics retain exit/signal and
at most 4000 kept bytes while draining through native close. The generated
fake-only child cases install the counted full native guard before acquisition.
An isolated rejected-close control exercises the real guarded cleanup: it observes
the root and guard retained after rejection, exits the owning process, then lets
the parent recover only its admitted subtree after native closure. This process
boundary is required so the deliberately retained guard cannot affect later
parent tests. Existing listener and sweep controls keep their original assertions.

A separate worker allocates and binds under a nested disposable root, then dies
by SIGKILL. The surviving parent observes native close before removing the tree.
Its fresh-process recovery uses root-owned alias records, and the final `lstat`
requires alias deletion: a dangling symlink is not a cleanup receipt.

The worker-kill case runs through both the ordinary fixture owner and public
`suite-lock.sweep`, with a captured native worker identity and root device/inode.
The suite case requires alias deletion immediately after sweep, before ordinary
test teardown can repair it. Both cases preserve existing process and quarantine
authority and do not run a real verification queue.

The cold-child host case starts from a tempProject whose listing is still empty.
A spawned hub child receives fixtureEnvironment with its exact scratch-root
opt-in and serves the scratch project with an inert fake Host. The allocation
observer is armed before the parent sends the action. Before starting the hub,
only that child registers the synthetic host in its scratch database, with no
persisted marker, memory opt-in or fake-root grant. Its first allocation therefore
depends on the exact environment root. The child then starts an inert-Host hub
from that persisted record and returns both initial and restored storage paths.
The assertion checks that account-environment sealing retains the subject
project root separately from the worker's account HOME.
The parent observes native close, asserts that storage stays inside the owned
root, clears its memory opt-in and checks that the persisted marker alone keeps
the reader on the same path. Final cleanup asserts removal of the exact alias.
Setup/close have separate bounds and incomplete messages retain native exit,
signal and a bounded diagnostic tail. No provider, real SSH or credential is
involved. Run this T3 file serially in the native preservation slot.
