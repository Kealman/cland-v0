T-1500: Document the shared byte-budgeted fixture socket allocator and native deep
TMPDIR control, preserving production path coverage and existing cleanup ownership.

Source-review M1: private short socket directories belong to canonical fixture roots; both directory owners remove them after drainage and retain them on incomplete cleanup. Native normal/killed-listener and failed-drain controls cover ownership.

Source-review M1 recovery: actual socket nodes stay under disposable roots; short symlink aliases have reciprocal records there before creation. Surviving owners stream only the disposable tree, verify targets and unlink aliases after worker drainage. Added nested worker allocation/SIGKILL/fresh-parent recovery control with lstat cleanup proof.

Suite-lock sweep uses the same recovered-alias removal boundary after native drainage; its public seam has an independent worker-kill regression before ordinary fixture teardown.

Coordinator-authorized dev merge: retained T-1525 scratch admission/sentinel guidance and T-1495 memory-report guidance. The newly merged sentinel listener also uses the portable allocator while keeping its environment and lifecycle controls.

Full-run correction: restored hub best-effort cleanup of every resource and directory, retaining only guarded live writers. Canonical socket implementation moved to a standalone shared Node module; production has no test-support dependency. Static browser/wire boundaries and web build prove isolation.
