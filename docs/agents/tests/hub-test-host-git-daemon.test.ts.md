# hub/test/host-git-daemon.test.ts

`hub/test/host-git-daemon.test.ts` is T3 native Git coverage using disposable bare
repositories and fixtureEnvironment after overlays. It never opens SSH or TCP,
uses a real Git daemon and the built-ins proxy as core.gitProxy, and leaves the
live territory untouched. Run this file alone with `node --test` after disk/load
admission. No GC, prune or repack command is used.

The native clone/push/fetch case compares an 8 MiB incompressible file after fetch,
checks protected-branch and deletion refusals, and reads the Unix socket's mode
and address. The environment case checks the fixed receive configuration and
removed authority. The capacity case waits for eight native launch PIDs before
opening a ninth socket, observes refusal EOF and its log, then joins all eight
native close receipts and verifies the PIDs are gone. Cleanup closes the listener
before deleting any root; failed drainage retains the root.

The failed-permissions case holds the optional chmod operation after socket bind,
admits a real Git child, then injects failure. It bounds setup separately and
requires the original startup error only after a matching native close, PID
absence and socket removal. Its teardown releases the held operation, disconnects
the client, and joins all admitted exits even on red; incomplete drainage retains
the root. The normal native clone case remains the valid startup positive control.

The existing territory guard body is retained, with a test-only environment receipt
prelude. Per-host branch leases
and transport startup/reconnect are covered by their owning items, not this file.
