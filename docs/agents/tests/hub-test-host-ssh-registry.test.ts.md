# hub/test/host-ssh-registry.test.ts

T2 registry ownership uses typed carrier and Git-listener owners without native
processes or sockets. It checks the installed default supervisor path without a
supervisor override, checks that startup calls the carrier, and verifies that a
failed stop still closes the Git owner and remains retryable. The real carrier
and agent-backed launch remain in host-ssh-contract.

Revoked records never acquire a carrier, while the registered peer still starts.
Both carrier and Git owners are injected, and a positively controlled native
`fakeNativeGuard` refuses public callback, custom-promisify and synchronous
child-process APIs as well as lower `ChildProcess.prototype.spawn`. Its positive
controls run before acquisition. Shared normal/signal case ownership joins the
original callback, closes captured registry/database owners and removes roots
before the final non-control attempt check and guard restoration.
An explicit add of the revoked record also refuses. A legacy-schema fixture
checks additive migration, unknown revocation time after reopen/repeat revoke,
and durable revocation overriding stale live-carrier facts.
