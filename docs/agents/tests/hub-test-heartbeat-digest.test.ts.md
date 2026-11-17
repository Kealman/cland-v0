# hub/test/heartbeat-digest.test.ts

In-memory Store and FakeClock evidence only. A missing soak receipt preserves
older-store rendering; planted skip and trim receipts remain explicitly
unexecuted in the digest. Rendering does not rewrite run history or classify
missing runtime evidence as passing coverage.
