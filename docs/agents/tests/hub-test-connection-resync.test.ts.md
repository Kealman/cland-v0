# hub/test/connection-resync.test.ts

T2 uses projectHub, disposable roots and the hub FakeClock. It exercises stalled
socket readers and direct dispatcher fan-out. No native hub or browser runs.

For explicit resume during an in-flight publication, obtain a pre-action
snapshot.end receipt and retain its sequence as the baseline. Startup projections
may already have consumed model numbers. The test must still observe exactly one
task followed by exactly one nested topic, consecutive baseline-relative numbers,
and exactly one successful correlated resume reply. Keep the queued subscriber
invalidation and reentrant publication controls intact.
