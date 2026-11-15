# hub/test/fixture-socket-path.test.ts

T2 exercises `fixtureSocketPath` from `shared/fixture-sockets.ts` (also exported
through the test compatibility path `test-support/socket-path.ts`) through a
native Unix listener. A disposable multibyte directory longer than 90 UTF-8 bytes
becomes TMPDIR; long multibyte endpoint labels still produce paths including the
NUL strictly below 104 bytes. Listening and filesystem socket receipts precede
the assertion. Close completes before removal and TMPDIR is restored.

Explicit test listeners and their clients use this shared allocator (stable within the fixture owner process),
keyed by disposable root and endpoint label. It uses canonical `/tmp`, independent
of suite TMPDIR, with a short symlink alias to a private 0700 `.fixture-sockets` directory
inside each canonical fixture root, and hashes endpoint labels. Reciprocal alias
records live under that root before alias creation, so surviving directory owners
can recover even after the allocating worker is killed.
Hub and Neovim directory owners stream the disposable tree without following
symlinks, verify each reciprocal alias target and unlink aliases only after
resource and child drainage, including after SIGKILL. Ordinary root removal owns
the actual socket nodes. Recovery never sweeps global temporary paths. A live-writer removal guard retains its root
and socket directory when drainage is incomplete; keep existing child/peer drainage barriers. Do not pass a live project root.
Production layout tests, absent-socket controls, and native fake harnesses receiving
production-selected paths retain those paths to test the production contract.
No command, setting, wire shape or role permission changes.

The nested fake-storage case allocates reciprocal aliases at two depths and
asserts that owner disposal removes both. Traversal includes nested
`.fixture-sockets` directories and never follows their aliases. The scratch host
case opts into fixture routing, binds all three host endpoints and a long session
endpoint under a deep multibyte root, and checks the additional SSH control suffix
budget. Default production host fallback coverage remains in host-records.

The discarded-registration control opts a nested raw directory in without
retaining its per-call disposer, then disposes the parent scope through
removeFixtureSockets. A subsequent first lookup must not allocate fixture
storage. Disposal snapshots matching registrations before traversal and retires
those same identities only after successful alias cleanup. This is also the
lifetime owner for raw fake-host registrations and deep-root opt-ins.
A separate replacement case registers a new grant while an older asynchronous
disposal is in flight. Completion of the old scope must preserve that new grant;
registration identity is per admission even when device/inode are unchanged.
