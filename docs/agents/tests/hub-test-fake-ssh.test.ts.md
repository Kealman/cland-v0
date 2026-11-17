# hub/test/fake-ssh.test.ts

Terminal sign-in cases cover all three exact native forms, map homes beneath
the authenticated fake machine, and select absolute committed fake binaries.
Unknown commands mentioning `/cland/auth/` refuse before execution. The PATH
trap case proves an installed or planted harness cannot receive sign-in. Every
fixture PATH contains only its scratch fake wrappers, Node and system tools;
never demonstrate a red sign-in by allowing fallback to an installed harness.

`hub/test/fake-ssh.test.ts` is T3. Run it alone with Node 24 after checking disk
and load, under the standing cover-quiet rules. It creates disposable roots and
sealed environments, joins native children, closes sockets, then removes roots.
It launches no hub, browser, real SSH, provider or account.

Use `createFakeHost(root, name)` from `hub/test/fakes/fake-host.ts`. Set
`CLAND_FAKE_HOSTS` to comma-separated names and `CLAND_FAKE_HOST_ROOT` to the
absolute disposable root. Use the directory returned by `createFakeHost` (the shared resolver
`shared/fake-host-directory.ts` also serves hub registration); its short alias
resolves to `<realpath(root)>/.fixture-sockets/<name>`. Each host has
`home/.cland-host/run` at 0700,
`boot-id`, synthetic `host-key.pub`, synthetic `client-key` and `known_hosts`.
`CLAND_HOST_BOOT_ID_FILE` is supplied to host commands. Fake mode requires it;
missing boot evidence rejects before agent recovery on every platform. The host gate's
`CLAND_FAKE_HOSTS` plus `CLAND_FAKE_HOST_ROOT` enable `sshBinaries(env)` overrides
via `CLAND_SSH_BIN` / `CLAND_SCP_BIN`.
The droplet executor uses the same selector with an additional marked executor
fixture gate described in [shared test procedures](../tests.md#executor-transport-fixtures).
Executor-contract tests exercise its injected execution boundary without
launching a native transport; host fixtures retain their existing gate.
Provider bootstrap also uses the shared selector with its provider-supplied
fake-host membership; it ignores ungated overrides.
Point these at the executable `.ts` stand-ins on a PATH with Node 24.

The subset is `-N` master, `-S`/ControlPath, `-O check|exit|forward|cancel`,
Unix `-R`/`-L`, `-t` one-shot commands and local-to-host scp. Every invocation
requires StrictHostKeyChecking=yes and UserKnownHostsFile with the named host's
exact key. Host paths may be absolute within its HOME or start with `~/`.
SCP refuses traversal and symlink escapes. Shell commands are trusted fixture
code and run in the host HOME with fixtureEnvironment after the final overlay;
they are not filesystem-sandboxed. `-t` accepts the carrier's attach argv but
does not emulate a terminal/PTY. Unsupported flags are refused.

A local Unix listener may target a host loopback port. Declare that port in
`<returned host directory>/ports.json`, mapping its string to a Unix socket in host HOME.
This models the OpenCode port without TCP. A preloaded network guard in the
forwarding tests rejects every TCP listen/connect; the same guard accompanies
the successful relay positive controls. TCP listening forwards are rejected.

The control endpoint answers check only after initial forwards bind. Tests
assert exact relayed bytes, cancellation refusal on a removed listener, native
master close, stale control file, key mismatch and bind failure. `kill-master`
uses the live control socket to self-SIGKILL, never a persisted PID. Every
control request carries canonical host directory and boot identity; kill additionally
requires the random token captured by that master. `master-control` is atomically
published JSON `{control, owner: {directory, boot}, token}` only after the control
socket binds and its mode is set. Copied and stale records refuse without signals;
a failed bind cannot overwrite the live receipt. Tests retain a fresh cleanup
positive control and a copied/stale receipt negative control. `gone`
writes a marker and refuses subsequent connections; it does not shut down
existing commands or the master. Owners must join their processes before root
removal. All subprocesses register native identity ownership immediately, share abort and
teardown cleanup, and join their process trees and close receipts within separate
five-second bounds started when termination/cleanup is requested. Raw close
observers are armed at launch without a deadline for long-lived masters; setup
and one-shot commands receive their own phase bounds. The regression injects the shared Clock scheduling subset only into the master
close deadline, advances 5.5 seconds, and checks actual control liveness. As a
positive timer control, an explicitly requested join expires after a further
5-second advance and its rejection is observed; the test then requests exit and
asserts native close. Setup, cleanup, subprocess dates and native I/O remain real.
No wall-clock delay or duration allowance is needed.
Missing receipts retain the root and report native exit/signal
plus a bounded diagnostic tail. A held writer cancellation regression proves this
cleanup before removal. Byte-stream assertions accumulate partial chunks.
The scripts intentionally leave stale control and forward sockets on
abrupt exit to exercise carrier cleanup/reconnect. No second transport carrier
or transport contract is defined here (T-1625 owns the reusable contract).

<!-- cland-allow-closed-wording: "stand-in" names the fake ssh component, not a placeholder -->
T-1595 extends the stand-in's known-hosts value parser for quoted paths and
multiple filenames. Fake authentication combines user/global entries as OpenSSH
does. FAKE_SSH_GLOBAL_KNOWN_HOSTS opts into one scratch default global file;
without it the fake never reads system trust. Explicit GlobalKnownHostsFile
replaces that default. Existing fake-ssh cases remain unchanged; transport-ssh
owns the matching-global/wrong-private red control and exclusive-pin regression.

Reboot CLI fixtures start `serveFakeReboots(name, env)` in their lifetime owner
before launching workers and join its close during cleanup. The separate CLI
authenticates through its private reboot-control record; it never recovers PID
signal authority itself. Missing or mismatched owner/token refuses before cleanup.

Reboot's post-capture writer census is bounded by `LAUNCH_SETTLEMENT_MS`; it waits
for trailing children without acquiring new signal authority. Residual diagnostics
include PID, parent, comm and birth. The reboot control request/receipt shape,
authentication, kill-agent and kill-master contracts are unchanged (T-1691).

The shared `createFakeHost` factory self-ignores each fake machine directory
before writing keys or runtime state. A fixture may initialize Git in its parent;
`git add .` then excludes the home and atomic checkpoint temporaries. The native
relaunch regression in `host-relaunch-native.test.ts` proves this staging boundary.
