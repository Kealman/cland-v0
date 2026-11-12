# hub/test/request-guard-component.test.ts

T2 uses sealed disposable roots and projectHub. The cold burst sends 500 requests
in one socket write after asserting all connect frames (welcome, remote.state,
hosts.state). Keep all 500 correlated ids and item counts, the exact 499 replayed
reads, and the before/write/after pending-read controls. The extra projection
must never be interpreted as a request result. The independent-client latency
and slow-handler cases retain their existing assertions and bounds.
