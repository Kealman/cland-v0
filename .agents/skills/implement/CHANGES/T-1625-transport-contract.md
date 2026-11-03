# T-1625 transport contract

Added a reusable fake-only transport contract and two T3 entries for the
approved ssh/fake-SSH pairing. The guide is
`docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md`: future outbound carriers
supply the same contract fixture. Endpoint replies, native descriptor scans
with a positive control, and bounded reconnect receipts are required.
No Transport member, carrier implementation or fake implementation changed.

After the first Linux run exposed helper-attributed replay identities, the two
entry files own node:test registration and the shared function owns assertions
only. Local production load-gate replay must retain each entry-file identity.
