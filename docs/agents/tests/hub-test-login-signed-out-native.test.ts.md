# hub/test/login-signed-out-native.test.ts

`hub/test/login-signed-out-native.test.ts` is T3. Each generated case creates two
fake provider hosts, joins their real fake SSH agents and launches the existing
fake OpenCode executable. It requires no provider account,
real login, browser or network service. Run serially under the release's native
preservation-slot protocol, after source review. Stop between files when asked.

The generated `native <harness> <reason> signs out without stopping existing
sessions` case covers OpenCode provider.auth. Component tests cover every listed
Claude Code, Codex and OpenCode signal variant. Native Claude and Codex
end-to-end coverage is tracked in T-1813 following the Coordinator's scope decision.


After the successful DEAD-LOGIN send receipt, the test awaits the exact persisted
login episode and signal. The final assertions retain the binding, require the next
pool launch's persisted native PID on the other host, observe the original PID
alive, and assert no stop call or stopped process row. Setup uses testWaitMs and
eventually bounds; no elapsed-time assertion substitutes for these receipts.

The host-create fixture owns hub shutdown, watchdog stop, transport drainage and
captured process closure before deleting its root. Mounted login fixture cleanup
then confirms detach/deletion after all native users have joined. Native evidence
records the complete TMPDIR name sets before and after each file, platform,
Node version and head; Linux verification supplies a separate receipt.

The case uses the existing hc- scratch root. OpenCode's
fixed fixture port maps to that fake host's session socket before launch. The
wrapper decorates only the adapter-admitted command environment with scratch
FAKE_ fields; production Host filtering remains final. The pure regression in
login-native-environment.test.ts proves password/config/routing preservation and
sealed inherited credential/Git removal; it starts no native process.

OpenCode setup waits for the native server event-stream subscription receipt
before injecting the error turn. Failure diagnostics read bounded, scanned tails
before fixture teardown; an unavailable or refused tail is explicit.

The first session holds the fixture login-source role and the next session holds
login-worker. Project spoke admission requires a held role; a roleless native
launch can leave input queued and cannot prove the error-turn boundary. Both
roles route through the same pool, without transferring or stopping the first.
