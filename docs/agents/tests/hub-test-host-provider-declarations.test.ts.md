# hub/test/host-provider-declarations.test.ts

Run `node --test hub/test/host-provider-declarations.test.ts` with supported
Node 24 and targeted admission from ../tests.md. This T1 file uses pure inputs
and the contract registrar; it creates no processes, files, timers or sockets.
No preservation lock is required.

Cases cover missing declared fields, invalid prices and capabilities, billing
minimum alignment, and the earliest stop deadline for short and long idle
periods. The reusable-contract regression invokes the registered declaration
case against a good provider and malformed providers, including every missing
field, a negative price and an unaligned minimum. Lifecycle cases remain in the
fake-provider entry. Both time boundaries use literal epoch milliseconds.
