# hub/test/suite-cancel.test.ts

T3 owns real worker cancellation, descendant death and restart receipts. The
cross-session refusal case holds fixture-local admission to force a queued,
PID-null submission reply, releases that hold, then reads the worker PID from
the recorded job and waits for the fake package body's PID receipt. The old
single-snapshot liveness assertion fails deterministically at that boundary:
`pidAlive(null)` is false, with state `queued` and no native exit receipt.
This reproduces a startup-snapshot defect; the original Linux failure had no
PID/outcome diagnostics, so its exact native cause remains unknown.

The in-process hub's native signal sends are observed without suppression.
Refused cancellation must send none; human cancellation must send SIGTERM to
the recorded worker as the observer's positive control. Keep the exact refusal,
worker/child liveness, cancelled report and repeat-cancel assertions. Failure
diagnostics name the launch PID, recorded state/outcome (native exit code/signal
when available), result receipt and bounded log tail. The observer identifies
signals from the hub; external signal senders are not available from Node's
native exit receipt. No production cancellation policy changes are involved.

For T-1863 C2, run only the refusal identity twenty times serially in a sealed
Linux Docker container with `--init`, disposable source and dependencies, and
fixtureEnvironment/scratchGitEnvironment. Record each native child exit code,
signal/error, terminal test counts and 1-minute load; require load >=8 and <20
for every run. Coordinate the exclusive load slot with the item lead, use the
suite and preservation locks, and stop all load children before deleting roots.

The
detached fake harness scenarios use the public verify CLI on a sealed project
with fixture-local compatibility locks. Wait for the fake child's PID/root
receipt before cancelling. One fake recreates the root after its runner dies;
the other retains the inode. A filesystem-boundary observer records any attempt
to remove that exact root while the detached child lives. Keep the final
absence assertion, confirmed child death, cancelled result and next-run success.
Stop the fake before removing its exact root, original and quarantine paths.

The artificial 30-second body hold is ended by cancellation. Polls observe
process death or filesystem receipts; elapsed time is never the asserted fact.

The detached cancellation cases also record raw V8 coverage. A live detached
writer publishes its ready marker after writing raw bytes and keeps writing
until cancellation. A native removal observer records any runner deletion with
that writer still alive. Final cancellation requires its PID gone, no early
removal receipt and ENOENT for raw coverage, proving hub release owns deletion.
