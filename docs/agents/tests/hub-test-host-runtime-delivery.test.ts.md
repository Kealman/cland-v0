# hub/test/host-runtime-delivery.test.ts


`hub/test/host-runtime-delivery.test.ts` (T3) exercises
`C1-C3 whole runtime delivery verifies files, reuses digest and atomically replaces CLI and spoke`.
Run with Node 24.13–24.x, under the stage preservation lock and load ceiling:
`node --test hub/test/host-runtime-delivery.test.ts`.
Strip inherited `CLAND_*` variables from the test runner environment.

The host is a disposable directory with `fixtureEnvironment` and a scripted shell
transport. The dependency-install system seam is a scratch PATH `npm` stub: it
records exact `ci -w hub --omit=dev --ignore-scripts` argv and links existing test
dependencies. It never contacts a registry and does not prove an actual npm install.
CLI and spoke run as bounded native Node children; their exit is joined before
fixture deletion. No browser, provider, real SSH host or credentials are used.

Assertions read every delivered file against its manifest digest, run both bins
with `--version`, derive supervisor/code paths through the published version link,
render the prelude from the delivered runtime (including its packaged cland-auth.sh),
and check unchanged delivery copies no bundle. A deliberately bad changed digest
must fail while the original complete tree remains selected; valid replacement
switches the pointer and leaves the old reader's tree intact.

`host-agent-restart.test.ts` (whole), `host-agent-closure.test.ts` (whole),
`claude-code-remote.test.ts`, `host-ssh-registry.test.ts`,
`host-survival-native.test.ts` and `host-runtime-join.test.ts` are preservation
checks; run heavy native files serially under the same preservation lock.

`held installer fixture teardown joins writer before removing its root` holds a
scripted npm writer after its native PID receipt. Ending its nested fixture scope
must stop and join that writer, observe the installer PID’s native `ESRCH`
receipt, and persist an external `closed` receipt before root removal. The
shared cleanup owner uses SIGKILL, so the test does not rely on a TERM handler. An outer owner captures the live installer for red-control cleanup.
Native command owners bind to TestContext immediately, and `beforeDirectories`
joins close receipts before `ownDirectory` removes fixture roots, including on
cancellation. Commands use sealed environments; npm remains fully scripted/offline.

T-1730 extends the same case through `agentVersionHandoff`: ready V1 then V2
checks CLI/spoke/mod explicitly and every source against V2 bundle hashes. An open
V1 file reader spans handoff and ready retention and reads the original generation
before it closes. The production handoff uses the identical installer seam.
