# hub/test/connection-snapshot.test.ts

Archived merged session reads use the public `session.list`/snapshot seam in
`connection-snapshot.test.ts` at T2. A sealed project with a fake clock compares
merged rows against the snapshot, archives a stopped process, and checks the
archived-only result and byte-identical legacy fields with unmanaged presence
connected. `web-authority-unit.test.ts` covers the archived read at T1, and
`wire-conformance.ts` checks `SessionListRows` at T0. Existing process lists,
counts, snapshot membership and startup observers remain unchanged.

`hub/test/connection-snapshot.test.ts` uses a disposable `projectHub` at T2 for
feature negotiation, the seven domain frames and end marker, legacy compatibility,
UTF-8 overflow fallback, and a model change raced against the first snapshot
frame. The named `fixture` account injects the existing `accountReader` port, so
the T2 worker never starts the real harness poller process. The observer is armed
before the hello/change, and final assertions retain the complete contiguous
transaction and the later change receipt.
The same file proves numbered model continuity across tracker, topic, session and
inbox changes, slim task layers (including other items affected by a release
change), pin/mute row re-projection, and one serialization per feature set with
three clients. An in-memory dispatcher peer proves that a synchronous action
during fan-out cannot invert the order another client receives. These tests use
the existing frame seam; they add no process. `suite-queue.test.ts` proves with
fake time that elapsed timing does not republish a held queue, while holder and
waiter changes do and explicit reads keep current timing.
Pin/mute/toggle-off also compare pushed topic-owned artifacts with a fresh read.
A scratch pre-extension store with 401 affected older messages and unrelated
history proves attachment-reference backfill, complete affected-row delivery and
bounded wire chunks. The snapshot cursor equality uses `FakeClock` so a legitimate
coalesced inbox publication cannot race the no-number-consumed assertion.
The cross-topic move case compares old-thread creation chips with fresh history
through pin/mute/toggle-off of the destination topic.
`hub/test/snapshot-framing.test.ts` proves each domain cap and the exact-byte
boundary at T1. The wire conformance check keeps the browser leaf aligned.

For copied-live-tracker evidence, run
`node hub/scripts/measure-snapshot.ts /path/to/project/.cland/tasks`.
Only source files are copied; the tracker and hub open in the script's disposable
root with a filtered environment and fake Git/clock. The output labels other
domains as default scratch state and excludes setup/copy/transport from the five
compose/framing samples. Publish that output through `artifact.create` and name
the implementation head/tree and platform; it is a measurement, not a suite pass.
