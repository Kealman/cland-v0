# hub/test/harness-framing.test.ts

T2 tests the existing `frameClient` callback stream and `connectSocket` Unix socket
client against an in-process peer, with no hub process or native harness. Account
admission and sealing use the shared fixture; socket roots are disposable and
teardown observes both endpoints close before directory removal.

`FrameClient.request(frame, timeoutMs?, signal?)` and
`FrameClient.waitFor(predicate, timeoutMs?, signal?)` accept a fixture-owned
AbortSignal. Aborting rejects with its reason and removes the timer and pending
result/waiter. Completion and timeout remove abort listeners too. Callers without
a signal retain their existing request/result and buffered-frame contract. Closing
the transport alone does not cancel waits; fixture teardown must abort its owner.
The authenticated session-client wrapper forwards the signal.

Cancellation tests use fake timers, assert the settled rejection receipts and
verify that advancing past the former deadline fires no callbacks. They also
exercise already-aborted owners, completed receipts, and expired waiter removal.
Reentrant predicates may abort themselves or another waiter: dispatch checks live
membership before and after predicate evaluation, and buffered lookup rechecks
the signal before accepting a hit or registering a timer. Keep the exact later
frame assertion for an unrelated waiter and both true/false buffered-hit controls.
The cancellation cases enroll their complete caller in `receiptFixtureCase`
before named account setup, retain its positively controlled native-launch guard,
and abort/join pending client work before restoring timer/method mocks.
An injected result observer may throw after a later result arrives. The request
must reject with that exact reason while the stream callback still throws and
retains unread frames. Its control independently bounds the settlement receipt
with a fake clock; a missing receipt is an explicit incomplete failure. Keep the
exact subsequent frame, no-fired-timer and no-abort-listener assertions.

Each client receives a 20 MiB payload in 64 KiB and 4 KiB chunks/writes. The
two-second bound starts immediately before delivery and ends after the complete
parsed frame/result arrives. Setup, payload construction and serialization are
excluded; socket delivery, event-loop yields and parsing are included. Write
sizes do not promise matching OS read boundaries. The 4 KiB callback case is the
historical negative control: the accumulated-string reader took 6027.8 ms on the
local macOS arm64 implementation run, versus 518.7 ms at 64 KiB. The socket
reader took 3004.9 ms and 5874.5 ms respectively before its fix. These are
targeted local observations, not Linux or suite evidence.

Keep partial and coalesced lines, CRLF/blank lines, UTF-8 split across writes,
queued and waiting frames, out-of-order result ids, refused results, event order,
peer closure and synchronous malformed-JSON errors covered. A caught parse or
consumer callback error must retain the current chunk's unread suffix: an empty
next input drains a complete retained line and later input completes a partial
retained line. Keep chunk offsets advanced before parsing or invoking consumers.
Performance checks
observe the actual complete payload, rather than merely the send completion.
