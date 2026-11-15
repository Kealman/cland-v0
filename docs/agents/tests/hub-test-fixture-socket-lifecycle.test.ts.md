# hub/test/fixture-socket-lifecycle.test.ts

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
