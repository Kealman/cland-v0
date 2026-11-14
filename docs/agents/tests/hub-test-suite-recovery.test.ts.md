# hub/test/suite-recovery.test.ts

T-1846's racing-hand-holder case pauses the worker immediately before creation
of its compatibility queue directory, using a fixture-only preload. Do not hold
its native self-identity probe: that probe has a production 3-second deadline,
so a delayed fixture release can prevent ticket publication altogether.
The pause receipt and FIFO ticket use `FIFO_SETUP_MS = testWaitMs(45_000)`.
The ticket remains the positive acquisition receipt; cancellation still requires
the exact job result, empty queue, dead worker, retained hand lock, absent command
marker and one result. The release is in `finally` and the preload hold is bounded.

T3 owns crashed-worker and package-runner recovery. The recreated-root scenario
kills the runner, then lets its fake child create a different inode at the
recorded path. Retain the original directory to prevent inode reuse. Require
the next run's successful public result and the durable
`suite-recovery-quarantined` journal event with both device/inode pairs; read the
preserved bytes from its quarantine path. Both fixture locks must be absent.
All lock, root and quarantine cleanup names the exact fixture-owned paths.
The absent-runner negative control seeds both stale locks with a recreated
canonical root and no runner metadata. Public admission must retain the exact
root bytes and both owner records, expose `runner group unknown`, and start no
worker. Missing runner metadata never proves a dead group.
The dead-parent positive case leaves a detached writer in a separate group under
the recreated root. Admission must discover and reap it through independent cwd
ownership before quarantining bytes and admitting the successor. An argv or
environment candidate outside that root stays alive and blocks recovery as
ambiguous; preserve its bytes and both lock owner records.
Register the external root's `beforeDirectories` owner before mkdir, spawn or
setup awaits. Its deferred parent/child identities and cwd discovery cover a
missing setup receipt. Stop the hub and all writers before removing any exact
root, original or recorded quarantine path.

The path, symlink, live-holder and unknown-group refusal cases stay at T2 in
`suite-protocol.test.ts`; they refuse before OS process discovery. Queue error
delivery uses the T2 compatibility boundary in `suite-admission-responsive.test.ts`.
