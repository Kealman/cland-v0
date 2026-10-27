# hub/test/outbox.test.ts

T1 seam: a disposable Store and `Outbox` with `outboxMessenger()` from
`hub/test/fakes/outbox-messenger.ts`. A second Store observes the durable
pre-send attempt, and platform delivery receipts carry literal TEXT snowflakes.
Use FakeClock; no real process, socket, platform or credential is needed.

Retain the interrupted-attempt matrix (`never-left`, `unknown`, `sent`), lost
acknowledgement/reopen control, immutable attempted edits and one latest queued
edit per target. The fake can refuse with proof, accept with a lost receipt,
recover, or supply reconciliation facts. A transport throw/rejection remains
unknown and its native error is never persisted. Closure during reconciliation
must drop the source before another send.

For held sends, register `heldRemoteBoundary` ownership before fixture/Store
acquisition and before triggering drain. Its unconditional disposer cancels and
settles setup observers, releases the held client, joins owned drain/stop work,
then closes SQLite. Arm bounded setup and actual-entry observers before drain;
use the injected clock for missing-receipt expiry, with an independent finite
outer test timeout if client entry never happens. A pre-entry shutdown control
omits both setup and actual-entry receipts, expires both observers, and disposes
the same owner while proving zero sends. The omitted-receipt and
aborted-setup controls exercise that same registered disposal path and retain
one-owner/send-count, post-stop admission, closed-database and drained-timer
assertions. A lexical finally calls the registered disposer but is not its only
owner. Payload merging is allowed only before the first attempt.

Retain the held-send arrival regression: enqueue the second job after the
bounded send-entry receipt, then join the original drain and assert both sent
rows and exact platform delivery ids. For `retryAfterMs`, advance FakeClock to
one millisecond before and then exactly at the deadline; assert the durable
non-delivery proof, queued row and fresh attempt timestamp. The above-five-minute
case resumes at 300,000 ms. Also retain the shorter reconciliation hint, source
closure and a new arrival during the wait.

Observe the final empty read through the owned Store seam without changing its
snapshot. Enqueue in a microtask after that read; assert the arrival joins the
original exposed promise and both jobs are sent before it completes. The
unknown-proof variant must retain one proof and one attempt across the completion
recheck, leaving that row uncertain while sending the new job.

Inject `random` samples 0, 0.5 and 1 for reconnect's equal jitter. Observe actual
exchange times through failed/throwing attempts, the 30,000 ms ceiling and reset
after success. A healthy exchange must not authorize resending an unknown
delivery; retain exact attempt count and delivered ids beside a newly queued job
and missed General row. Old-shape clients without `reconnect` or retry hints
remain covered by the original outage/restart tests.

Register the clocked fixture's unconditional resource disposer and independent
held reconnect release before acquiring SQLite or triggering the producer. The
fixture uses `TestContext.after` before `tempProject` registers root removal;
it has no process to own and no direct `process-cleanup.ts` import (the T1
lexical admission rule requires a machine tier for that module). The
disposer releases the fixture independently of production abort, joins stop and
the actual exchange, then closes SQLite. Cleanup release must not fabricate the
`exited` abort receipt. The omitted-abort control expires its bounded observer,
uses that same disposer and proves exchange settlement, missing abort receipt,
zero sends, post-stop refusal, closed SQLite and zero timers.
Stop must cancel both delay kinds, abort and join an active reconnect
exchange, retain the queued job and leave no timer or later send. An independent
finite test timeout bounds a missing client receipt; advancing time alone is
never the final delivery assertion. No wall-clock wait is used.

The chat-owned drain control queues two ordinary messages, another chat and a
card at the same fake instant. Optional accepts/compare hooks must send the card
then ordinary FIFO, leave the foreign row queued and retain the old no-options
clients' FIFO/reconciliation receipts. Platform beforeNext waits precede fresh
selection, so a card arriving during pacing may become the next send.

The optional admit hook is synchronous and defaults to true. Telegram's
component tests change pairing during pacing and after persistence reopen;
Outbox must drop denied General as well as other kinds before a native send,
and recheck admission after asynchronous reconciliation/source checks.

The first durable-attempt case also supplies an optional settled callback and
reads committed sent state and message mapping through its independent Store
inside that callback. Previous clients omit the observer. A sent reaction may
omit a new platform-message map; message-producing clients retain theirs.
