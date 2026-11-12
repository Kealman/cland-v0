# hub/test/login-host-pin.test.ts

T2: injected sign-in runner and in-memory host records with FakeClock. Tests prove
the host is pinned before the sign-in runner begins, stays pinned through its
completion, and releases on success, failure or disconnect. The lifecycle case
asserts a durable lease deadline extension while pinned, prevents idle-stop,
then observes destruction after unpinning. All filesystem state is disposable;
no native process, real host, browser or external provider runs.

Admission controls refuse invalid, empty and duplicate names before creation or
pinning. The creating row is reserved before asynchronous host preparation.
Fault controls change readiness after allocation, attachment, mount and config
publication, and replace the captured machine birth while keeping it ready;
none may publish a terminal plan or continue with new effects. Pre-capture
create/replacement loss records sign-in failure without an interrupted-host fence.
After attach/mount/publication, the captured machine owns the shared interrupted
sign-in fence: the hub performs no umount/detach on its own after owner loss
(A-18815 sign-in recovery). The pin releases but the disk stays attached and the
retry refuses. Each case rejects absent and replacement-machine deletion receipts,
then releases its actual directory-only fake machine, persists that provider's
positive deletion read and calls the production settlement owner. Fake inventory
confirms the disk detached; the exact-machine fence clears and a fresh sign-in
is admissible. Mount/publication effects are injected, not native process proof.

`login add creates a host while its only login is still creating` proves the
T-1784 C5 exemption through preparePoolLogin with injected creation and sign-in.
