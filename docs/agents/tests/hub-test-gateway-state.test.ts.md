# hub/test/gateway-state.test.ts

T2 frame seam: `projectHub`, `testMessenger` and real SQLite state in a
disposable project. The harness supplies fake poller process facts; native
process inspection is not needed to prove gateway ownership.

Keep a first gateway serving successful `hub.status` replies while a second
waits on the same database. Release the first and observe the second's start,
frame reply and durable owner row. Cancelling a waiter must settle startup
without acquiring or stopping a platform resource. Hold the owner's stop and
check its lease before the stop receipt; a rejected stop must retain the row.

Restart the in-process hub and compare persisted records, including literal
Discord-sized TEXT ids and a map to the exact sent hub message id. Capture
database-open paths and directory entries around remote writes to prove they
use only hub.db, without a separate state file. Close supplementary Store
handles after gateway shutdown and before disposable-directory cleanup.

For gateway-wide acquisition failures, retain the fake-time 60-second conflict
case and an injected native-probe error. Both must leave platforms unstarted
and unstopped, with redacted disabled/reason rows and logs. The conflict case
redeems a scratch sign-in and reads `hub.status` over the authenticated web
frame edge; no bundle, browser process or real account is involved. A successful
Unix status reply alone does not prove that web still serves. The native-error
case also reopens hub.db to read the sanitized persisted status.

Held stop setup uses `fakes/held-remote-boundary.ts` with an unconditional owner
registered before launch, fake-time setup deadlines and fixture/test signal
cancellation. Omitted-receipt and aborted-setup controls join the actual stop
and run work before closing SQLite. The daemon conflict's omitted-inspection
control also drains a late startup and consumer stop, settles its suppressed
receipt, and proves SQLite closed. Its disposer is registered before the case
deadline helper's pending-work drain, which must never retain an unanswered
setup promise ahead of resource disposal.

Own the web socket through a nullable variable before acquisition. Register its
close observer immediately, bound open/welcome/status independently (500 ms
frame waits inside a 1000 ms case wait), and retain the successful authenticated
status/root assertion. Disposal waits for the actual client close receipt before
hub stop, SQLite close and directory cleanup. No browser process is involved.
