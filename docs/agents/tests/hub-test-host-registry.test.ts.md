# hub/test/host-registry.test.ts

T2 uses disposable project databases and the real projectHub frame seam with a
fake adapter. It removes the host column from a populated fixture, reopens it,
and checks legacy local and named-host persistence. Local launch/list frames
omit the host field. A test-host lookup from the adapter verifies opt-in
registration, Linux identity, spawn refusal and flushed hub.log operation rows.
Unknown-host process lookup, projection, stop and resume cannot touch local PIDs.
The test Host itself performs no native operations.


Legacy fixture construction uses removeProcessHostColumn from the shared
legacy-process-schema helper. It inspects SQLite index metadata and drops only
indexes that depend on host before removing that column. New placement indexes
cannot invalidate either pre-column fixture; migration/orphan assertions remain
unchanged.
