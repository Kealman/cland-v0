# hub/test/host-registry.test.ts

T2 uses disposable project databases and the real projectHub frame seam with a
fake adapter. It removes the host column from a populated fixture, reopens it,
and checks legacy local and named-host persistence. Local launch/list frames
omit the host field. A test-host lookup from the adapter verifies opt-in
registration, Linux identity, spawn refusal and flushed hub.log operation rows.
Unknown-host process lookup, projection, stop and resume cannot touch local PIDs.
The test Host itself performs no native operations.
