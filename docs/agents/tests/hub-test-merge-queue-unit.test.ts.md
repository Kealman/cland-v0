# hub/test/merge-queue-unit.test.ts

Fake Git and an in-memory Store prove queue reconciliation and candidate
admission. The empty-diff evidence case enables verification requirements,
supplies no receipt, and checks the enqueued pinned head. Candidate dependency
cases explicitly mark their fixture item ready. No native process is needed.

The two new callbacks enter `candidateCase` before setup. Its shared stage owner
joins the complete original callback and bounds setup separately. Root adoption
precedes native database acquisition. Store connections are captured before
construction; `ownedTracker` captures Tracker connections before construction.
Queue stop and positive Store/Tracker closes are required before directory
cleanup or guard restoration. Existing callers keep the original fixture path.
Shared stage ownership controls in tracker-summary prove late-setup/callback
joining and rejected resource/constructor close retaining root and guard until
positive closure; these five targeted controls are part of M1 validation.

The exact Store callback has separate constructor controls for confirmed and
rejected-then-repaired native closure. Inject a real captured in-memory database
whose schema exec throws the original error after native open. Before Store
assignment the stopper returns undefined, enabling raw-connection fallback.
For an acquired Store it returns a close Promise. The controls enter the same
`candidateCase` fixture path under a supervisor before acquisition and retain
the constructor error by identity. Real registered cleanup attempts the captured
native closer. After a rejected close, the test independently invokes the same
root cleanup hook that tempProject registered, captured through a context used
only for that helper. It forwards the hook unchanged to normal teardown.
The independent call reaches ownDirectory/guardRemoval and receives the stage
guard refusal while the captured handle remains open. Registration-before-open,
attempt count, retained root and unchanged native boundary are separate checks.
Explicit owner repair then proves isOpen=false, actual
root removal and boundary restoration. The earlier registered cleanup rejection
remains reported; successful repair does not erase it. Supervisor emergency
drainage also joins retained work when the deliberately red control fails.
Source3 established that ordinary rejected owner close alone never reached this
directory path; that earlier root-retention assertion was insufficient proof.
