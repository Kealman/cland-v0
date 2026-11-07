# hub/test/tcp-listener-census.test.ts

Run `node --test hub/test/tcp-listener-census.test.ts` for T1 deterministic native
observation sequences, without processes, sockets or clock waits. The same helper
is used by transport-forwards' real native planted listener and final census.
Stable births retain command/parent attribution. Replacement during listener or
command observation and unavailable birth observations retain the raw listener
failure while suppressing unproven metadata. An empty census stays clear.
No native PID reuse is induced; these cases prove the observation policy, while
`transport-forwards.test.ts` proves the actual platform probes and zero-TCP check.
