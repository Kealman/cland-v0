# hub/test/pairing-service.test.ts

T1 uses `PairingCodes`, in-memory `Store` and `FakeClock`. Prove the live by-id
lookup at the approval seam, independent per-messenger capacities, messenger-only
clearing and exact durable expiry deletion. Keep Discord ids beyond 2^53 as
strings and retain the final empty request table assertion. Close the pairing
service before its store; the fake clock must have no owned timer left.

The needs-you regression primes a live local total, then advances the injected
clock across expiry between observations in `needsYou(false)`. Keep both cases:
pairing alone must yield zero; a durable ordinary request must still yield one.
The total and excluded pairing rows must come from the same inbox projection.
