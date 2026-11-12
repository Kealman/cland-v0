# hub/test/edges-component.test.ts

T2 runs the Unix edge in projectHub with a FakeClock and a disposable root.
Before writing the framing probe, drain and assert welcome, remote.state and the
empty hosts.state connect projection. Both connections use that same handshake.
Retain the exact near-limit byte count, three requests in one write, each reply
id, and socket-close receipts for both a complete oversized line and an
unfinished oversized remainder. No production admission change is implied by
these connect-frame assertions.
