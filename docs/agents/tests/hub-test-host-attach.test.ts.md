# hub/test/host-attach.test.ts


T3 proves native CLI exec and attach exit against a disposable process identity.
Three harness commands use scratch binaries, HOME, XDG and Git environments.
The stty binary records `susp undef`; attach's native close precedes final
session birth/liveness assertions. Records are scanned with planted executor,
host and session credentials and an OpenCode password. No real login or browser.
Separate SSH command assertions cover pinned keys and disabled sharing/forwards.

The native `env` argv trap is positively controlled with the planted password
before attach. The real terminal command exports the password using shell
builtins and execs the harness directly; the trap must remain absent and the
harness must receive the password only in its environment. A held Codex client
simulates assertion failure and joins identity-owned cleanup/native close before
checking the original session birth and before fixture directory removal.
