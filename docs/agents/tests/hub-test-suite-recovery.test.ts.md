# hub/test/suite-recovery.test.ts

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
