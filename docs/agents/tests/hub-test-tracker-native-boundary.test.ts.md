# hub/test/tracker-native-boundary.test.ts

Cached rollback and detached cleanup observe completed worktree-list results at
the public owned-Git boundary. Each selected hold has a positive engaged check;
the concurrent writer and exact worktree/ref preservation assertions remain.
Their whole-callback owner captures commands before launch, joins the original
request and hub/tracker stop, and retains filesystem/command observers and roots
until cleanup is confirmed. The territory-hub helper uses a sealed fixture
environment for its Git and hub calls.

The shared territory-hub fixture routes owned construction through ownedTracker,
capturing native DB connections before constructor return. Its T2 companion in
merge-recovery rejects construction after open, refuses native close, exercises
actual guarded removal, then confirms close before releasing roots and seams.
The optional owned route does not rewrite the older raw callbacks in this file.

The existing worktree claim/listing/prune no-sync guard also covers executable
lookup in owned commands. Lookup uses the shared async resolver before native
spawn; cancellation is rechecked before the original-child launch/gate boundary.

The live-admission case holds a real original writer owned-exec child at its durably
released launch gate under a territory reservation. It observes the exact child
receipt, permits an unrelated read and normal ref write, and refuses writers
when the same PID's captured start or birth metadata differs. The original child
and reservation join in finally, including the red path. The admitted verdict
write case likewise releases and joins both original write/merge promises on
every path. It holds the completed public native-read result and positively
checks that the hold engaged, then releases that result and observes merge's
view call behind the admitted write before releasing the write. Final dev and
latest-verdict assertions remain.
