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
