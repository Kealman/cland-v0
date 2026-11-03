# hub/test/transport-fake-contract.test.ts

Runs the same T3 transport contract against the approved fake transport pairing:
`SshTransport` plus the fake ssh stand-in, using stub endpoints on both sides.
See the [shared contract guide](hub-test-transport-ssh-contract.test.ts.md) for
C1–C8, native no-TCP inspection and its positive control, bounded reconnect,
fixture isolation and the requirements for the future `outbound` carrier.
