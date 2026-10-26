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
