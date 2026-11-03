# hub/test/host-ssh-registry.test.ts

T2 registry ownership uses typed carrier and Git-listener owners without native
processes or sockets. It checks the installed default supervisor path without a
supervisor override, checks that startup calls the carrier, and verifies that a
failed stop still closes the Git owner and remains retryable. The real carrier
and agent-backed launch remain in host-ssh-contract.
