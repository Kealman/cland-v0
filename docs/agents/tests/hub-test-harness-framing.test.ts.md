# hub/test/harness-framing.test.ts

T2 tests the existing `frameClient` callback stream and `connectSocket` Unix socket
client against an in-process peer, with no hub process or native harness. Account
admission and sealing use the shared fixture; socket roots are disposable and
teardown observes both endpoints close before directory removal.

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
