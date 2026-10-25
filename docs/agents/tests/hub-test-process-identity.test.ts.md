# hub/test/process-identity.test.ts

`hub/test/process-identity.test.ts` is T1: Linux stat field 22 with embedded
parentheses in comm, Darwin 64-bit kinfo timeval bytes, malformed data, additive
process-table persistence and pending-stop recovery. The previous adapter record
shape, carrying `pidStarted` without `pidIdentity`, remains readable with unknown
native identity. No real process, clock or socket is needed at this seam.

Native OS and signal proofs: [system processes](hub-test-system-processes.test.ts.md).
Fixture teardown: [process cleanup](hub-test-process-cleanup.test.ts.md).
Pending launch restart: [name reservation](hub-test-name-reservation.test.ts.md).

A literal full-field Linux stat fixture includes spaces and closing parentheses
in comm; field22 must be the fixed expected start ticks. Optional failure
observers distinguish boot-id validation, stat layout/PID and field22.
The previous three-argument parser, nullable single-PID reader and Map return
shapes remain usable; observers cannot grant identity or throw into control flow.

Native exit has a separate optional callback after the existing arguments. Linux
stat Z/X and Darwin extern_proc.p_stat SZOMB (5 at byte36 in the supported
648-byte ABI) return no signal identity and report exit only after full PID and
birth validation. Previous nullable/Map APIs remain compatible. Malformed or
wrong-PID records produce no exit receipt. Exit means no running writer; a
parent may still need to reap the PID.
