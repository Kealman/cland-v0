## Durable remote outbox

`src/remote/outbox.ts` exports `Outbox` over one messenger's `RemoteStore`.
Platform adapters own it under the gateway's poller lease. This is an internal
API with a fake client seam, without a CLI command or platform configuration.
`enqueue` persists `general`, `card`, ordinary `message` and `edit` intents; edits require an opaque
chat/message `target`. Consecutive queued edits with the same target and source
coalesce to their latest payload only before any attempt. Platform ids remain
strings. The additive `target` column migrates existing hub.db rows; absent
targets retain the previous row shape. Jobs and attempts keep insertion order,
including at equal injected-clock timestamps. Optional `accepts`, `compare`, `admit` and
`beforeNext` hooks let a platform own disjoint chat drains, prioritize cards and
wait before selecting the next job and recording its attempt. Without them,
existing clients keep FIFO ownership of the whole remote. Admission is checked
after pacing and again after any asynchronous proof/source check, immediately
before the attempt; refusal drops the queued intent without sending.

`drain()` re-reads queued jobs and unresolved attempts before finishing, so jobs
enqueued during a send, rate-limit wait or reconnection leave in that same drain
when delivery is possible. Concurrent callers share its promise. Each unresolved
job is visited once per pass; an unknown proof does not spin. The completion
owner checks enqueue revisions after the last read, then clears ownership and
settles its promise synchronously; a microtask arrival at that read still joins
the same owner and is drained before it completes. Before calling `client.send`,
it atomically writes `sending` and an attempt with a null outcome. An optional
`client.settled(job, result)` callback observes the completed durable settlement,
so an individual send can finish while later jobs continue in the active drain. The client's
`send(job, attempt)` and `prove(job, attempt)` return one of:

- `sent`, with the platform message map (`RemoteMessage`) when the operation
  creates a message. Reactions have no new message map. The map, sent job and
  attempt outcome commit together before completion is reported.
- `never-left`, the client's positive proof that resending that immutable job
  is safe. The stable job id is the idempotency identity (for example Discord's
  enforced nonce); each send still has a new attempt id. An optional
  `retryAfterMs` carries a platform `retry_after`, converted to milliseconds by
  the client. A finite nonnegative value pauses the whole drain for at most
  300,000 ms (five minutes; zero waits 1 ms), retaining the job as queued,
  including General. Rate limiting is not an outage. The same hint on a
  reconciliation proof waits before a resend. Invalid hints use ordinary
  failure handling. The source is checked again after the wait.
- `superseded`, when a definite rich-format refusal has already persisted its
  replacement plain parts. The rejected intent becomes `dropped`, without
  setting the remote offline or counting a missed General message.
- `unknown`, which never permits another send. A thrown/rejected native error
  also means unknown; the outbox retains only that enum, never the native error.

An interrupted or uncertain attempt is reconciled with `prove` before a resend;
a healthy connection alone is no proof. A failure marks the remote unavailable
in hub.db. Clients may supply `reconnect(signal)`, returning true only after a
successful exchange. Within the active drain, reconnect attempts wait with
exponential equal jitter: a 1,000 ms window doubles after each failed exchange
up to 30,000 ms; each delay is uniformly drawn from half to all of that window
and rounded to milliseconds. A successful exchange resets the window, marks
the remote available and revisits waiting jobs, retaining the proof fence.
Thrown reconnect errors count as failure and are never stored. Without that
optional callback, `drain()` settles offline jobs and returns;
`setAvailable(true)` permits a later recovery pass as before. General jobs that
cannot go out during an outage are terminal `missed` rows rather
than a late replay. `missed()` returns their count and earliest creation time
for the gap line, durably and per remote; it does not consume those facts.
Gap-line delivery/acknowledgement belongs to the messenger's catch-up policy.

Adapters supply `sourceOpen(job)` for expiring cards/notices; it is checked even
while unavailable and again after reconciliation, dropping a closed source
without another send. The default callback treats jobs as nonexpiring; an
outcome edit that must survive source closure should remain open to that policy.
`stop()` fences enqueue/drain, cancels any rate-limit/backoff delay, aborts the
reconnect signal and joins all current client work before store teardown.
Clients must settle a reconnect exchange on abort; the adapter must also
cancel/settle held send/proof I/O. Waits live only in the active drain, using the
injected `Clock` (default `realClock`) and `random` source (default `Math.random`,
returning a number in [0, 1]). There is no independent hub timer loop. Delay and
backoff progress is transient; jobs, attempt proofs and availability remain
durable. Existing clients/results need no new fields, and no store migration
is needed for drain scheduling. Per-chat/bucket pacing remains the client's job.

