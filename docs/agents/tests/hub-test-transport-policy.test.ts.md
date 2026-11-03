# hub/test/transport-policy.test.ts

T1 injects FakeClock into the shared reconnect policy and checks exponential
jitter bounds/cap, the exact 30-second uptime reset and clock-gap detection.
It starts no native processes or sockets.
