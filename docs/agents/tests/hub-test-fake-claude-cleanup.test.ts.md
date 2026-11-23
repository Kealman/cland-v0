# hub/test/fake-claude-cleanup.test.ts

`fakeClaude` owns every fake CLI invocation, including adapter polls, through a
home-local process-identity registry. After resource and hub shutdown it closes
writer admission, reaps session groups (including hooks and spokes), and allows
in-flight CLIs to exit. After 5 seconds a stuck-writer error names the remaining
PID/start identities and retains the home, without killing the polls or starting
removal. Release or stop those writers before retrying cleanup. Only observed OS
exit permits removal; a delayed `execFile` callback is awaited separately.
Removal retries ENOTEMPTY/EBUSY for 1 second and reports remaining paths
if exhausted. A stale fixture environment cannot recreate a closed home.
`fake-claude-cleanup.test.ts` proves the held-poll late write, delayed callback,
home retention at the injected-clock drain deadline, orphan hook cleanup,
closed-home admission and bounded remaining-file diagnostic at the T3 process
lifecycle seam. The same writer drain applies during signal recovery.

Each admitted detached `__session` also holds the shared PID/birth-bound
`fixtureOwnership` receipt under its fake home's `.fixture-sockets/owners/`.
Disposable roots name only the allocated fake home; sourceCheckout is separate
non-disposable source association. During authorized project removal, fresh OS
cwd evidence also selects the receipt-bound process without granting that cwd
directory cleanup. The actual fakeClaude allocator creates a private ignored
fixed-root preload and carries its bootstrap through NODE_OPTIONS; QA and fake
harnesses share the same identity-bound grant policy. A removed home grants
nothing and skips the removed preload, leaving the fake's existing closed-writer
admission intact. Callers adding Node instrumentation append their import instead
of replacing this owned allocation channel. The shared
storage owner keeps runtime files ignored by Git and excluded from fixture
copies. This lets the worktree orphan sweep recover sessions after test-worker
SIGKILL bypasses teardown, and join their captured spoke descendants before
removing roots. Standalone fakes without `FAKE_CLAUDE_WRITERS` do not acquire
this fixture authority. A matching command without a valid open private receipt
cannot authorize termination.

The final named census tests in the native Claude adapter, accounts, sessions,
remote and cleanup files check the captured detached session groups, including
spokes. The census reads retained writer registrations before removal and saves
their group identities; if cleanup is omitted it reads the still-present
registry at file end. It performs a read-only native group census and never
grants signal authority. A census failure is a named test failure with a nonzero
file exit, rather than an assertion in a file-level after hook.

The census regression runs a disposable test file that deliberately drops its
cleanup hook. Live session and spoke controls precede the assertion that its
final census fails and its native exit is nonzero. A separate controlled body
failure retains real cleanup and requires a passing final census plus observed
session and spoke exits. Child test files keep their temporary directories under
the outer owned root; a guarded fallback sweep joins writers before root removal
even if setup fails before publishing its session receipt.

These three native controls enroll `residueControl` before their first
acquisition. Named steps bound setup separately, `residueChild` adopts each
worker and its native close observer during the original spawn, and acquired
session/spoke cleanup remains owned even when acquisition finishes late. Normal
or signal cancellation fences the original sequence and stops the captured
worker group before joining that work. Fallback detached-writer discovery runs
after that join; its empty native census gates root removal. The explicit
worktree-removal assertion settles this fallback while the original root still
exists, after observing the worker, session and spoke exits. Failed closure keeps
the roots. The injected-reader recovery case uses `fixtureReceiptCase`, composed
with `stageCase`, for whole-case ownership and bounded discovery. It registers
its receipt registry before acquisition and captures synchronous native opens
before a constructor save or bind can reject. Initial-save failure now has its
own structured producer failure/cause, positive descriptor closure (EBADF) and
partial-file unlink. A bind failure retains the descriptor and metadata until
the registered owner closes/removes them. Each descriptor close and receipt
removal settles independently; failure of one receipt does not skip the others.
Positive closure gates root removal and restoration of filesystem seams and the
native-launch guard. Narrow save/bind and close/remove rejection controls use
the registered cleanup, observe real held descriptors or retained files, refuse
guard restoration, and explicitly recover while keeping failed-attempt facts.

The worker-death regression kills a disposable fixture worker only after it
publishes a session receipt and the real spoke is observed. The session must
still be alive after the worker's native close. It then exercises the real
worktree orphan discovery/removal boundary with the home outside the project cwd,
and checks that session and spoke
exit before removal starts. This reproduces the detached-launch mechanism; it
does not identify the historical test that produced the nine-day orphan.

The dropped-cleanup census and killed-worker orphan-sweep cases have C-216
allowances of 6.939 and 7.381 seconds respectively, dated 2026-11-23 through
2026-11-30. Caps are 1.5 times the worst recent passing Linux samples, rounded
upward to milliseconds. [T-2052 evidence](../../evidence/T-2052-duration-renewal.md)
lists every sample and the missing-baseline fallback reason for retention.
