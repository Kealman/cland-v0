# hub/test/fixture-socket-path.test.ts

The recovery scan controls use `recoveryScanOwner`, the same whole-case owner
as the remote restart test, with filesystem-only writers. One enters real
guarded directory removal while the scan is held, confirms the root is retained,
then releases the scan and observes successful writer closure before removal.
The other injects a scan failure and rejected writer close: the scan reason
remains primary, guarded removal refuses, and only a positive close retry permits
removal. No child process or native harness is needed for these controls.

The registration alias control uses an allocated scratch directory and a
symlink alias inside its owner. On macOS it also presents that same allocation
through `/var` when its canonical path starts with `/private/var`. Each persisted
receipt must list only the canonical scratch root. Replacement and unowned-root
refusals remain covered independently by the candidate and registration guards.

Optional registration has a refused-root control and an independently accepted
scratch-root control. A planted initial ENOSPC write preserves its structured
cause, closes the exact failed descriptor (EBADF), removes the partial receipt
and independently observes the retained scratch directory. Both controls run
inside the positively controlled native launch guard.

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
Production layout tests and absent-socket controls without fixture opt-in retain
production paths. Opted-in project hub/spoke and local Codex fallbacks use the
same private allocator when their project paths exceed the native byte budget.
Short project paths retain their existing placement. A root-local receipt control
closes the owner descriptor without its normal unlink, then exercises guarded
root cleanup and verifies receipt removal. A separate negative control points one
root's ownership directory at another root's receipts: the reader refuses that
link, guarded cleanup preserves the foreign receipt, and the original reader
still accepts it. Root metadata that names a different root is also refused.
No command, setting, wire shape or role permission changes.

The new receipt and fallback controls enroll `residueControl` before acquisition.
It composes the existing case-deadline owner: each setup and observation has its
own bound, while the original operation remains joined after a deadline or
cancellation. The counted native guard covers callback, custom-promisifier,
sync and lower-spawn forms before the first root. Resource close rejection keeps
its positive closure obligation; root guards reject removal until that obligation
is met. Guard and TMPDIR restoration follow observed root removal. Two held-close
controls cancel an acquisition or reject setup, observe the still-present root
and installed guard, then require a written closure receipt and root removal
before confirming restoration. Other fixture families are not migrated here.

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

Registration controls attempt the live source worktree and a scratch symlink to
it. Both refuse before creating a receipt. A valid version-1 local receipt is
then forged to include the source; the reader refuses it. The orphan component
regression exercises sweepFixtureOrphans with the forged receipt, checks zero
termination calls and independently checks the preserved diagnostic files.

The source association control uses separate source and scratch directories. An
authorized source-removal callback observes the PID/birth-bound scratch process
joined. Actual guarded scratch removal then leaves the source sentinel intact.
A positively controlled directory-open observer sees the scratch traversal and
rejects source traversal. A previous local version-1 receipt without association
metadata is still read successfully with scratch-only selection.
