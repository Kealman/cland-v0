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

The attach-close observer is armed immediately after spawn. Its `testWaitMs()`
budget (15 seconds by default, configurable with `CLAND_TEST_WAIT_MS`) includes
fresh CLI module loading, private record validation and native identity probing,
then shell exec, stty and the fake harness. It is a completion bound, not a
latency assertion or a production shutdown timeout. A missing native close still
fails with exit code, signal, a bounded stderr tail and the last usable durable
fixture receipt (harness output, stty output, or neither). Final native close,
environment, foreign-record and original-session identity assertions remain.

T-1849 validation uses five lone OpenCode case runs and a serial pair with
`hub/test/host-attach-routing.test.ts`, under the native preservation lock.
Controlled startup-delay and held-client mutations prove the old deadline can
expire before exec and that the configured bound still rejects a missing close;
these mutations are removed after the probes and their artificial durations do
not measure product latency. Native identity probing uses absolute OS binaries;
the fixture's stty, harness and env argv trap do not intercept that probe.
