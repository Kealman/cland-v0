# hub/test/host-supervisor.test.ts

T3, fake hosts only. `node --test hub/test/host-supervisor.test.ts` uses a disposable
root and the shared environment builder. Node detached spawn supplies setsid on
macOS, where no setsid binary is installed; the initiating shell runs nohup and
exits. Linux deployment uses setsid nohup explicitly. No real SSH or provider.

The C1–C4 case observes the singleton receipt, authenticated hello, a native
harness launch, HUP survival, a stale-identity refusal, SIGKILL and a replacement
hello within three seconds, then checks the original harness identity in the
recovered process table. Setup has separate deadlines. Captured fixture process
ownership captures each authenticated agent at hello (including its replacement).
Teardown captures native writer births before stopping every supervisor and
starter sharing the root. It then takes a final writer snapshot and joins both
sets, plus registered agents. The earlier births retain ownership when shutdown
reparents a writer or its cwd moves outside the original root. The file
retains all fixture roots until its after hook asserts an empty cwd census; only
then does it remove roots and assert native filesystem absence. A failing census
still joins the observed writers before removal, so the regression control
cannot itself leak agents.

The starter is captured before a launch gate releases its child. It stays alive
until the supervisor receipt is captured, so missing receipt setup retains live
ancestry for cleanup. The setup-failure control observes an independent real PID
while withholding the expected receipt and proves native absence before root
removal. A two-host control copies the other live agent's valid receipt and proves
owner refusal while both original agent identities and harnesses remain usable.

Fake-host directories use the reciprocal alias owned by `fixtureSocketPath`.
This keeps HOME-derived agent sockets within the macOS 104-byte budget including
NUL even with `/private/tmp/cland-suite-<uuid>` as TMPDIR. Fixture setup and lookup
validate the agent path before native connections; `fixture-socket-path.test.ts`
checks the guard, multibyte paths and independent reader agreement. Cleanup
removes the alias after clients, harnesses and supervisors have drained.

A held teardown control kills the original agent while restart-owner shutdown
is gated, observes a replacement authenticated hello and native birth, then
releases shutdown. After the restart owner stops, a fixture-only preload moves
the replacement cwd to a second disposable root on SIGUSR2. A durable pid/cwd
receipt and independent native cwd census prove the relocation before final
discovery. The replacement is not registered through the hello path. Teardown
must join its captured birth even though the original root can no longer find
it; both roots must have empty censuses. A structured diagnostic retains each
survivor's pid, parent, group and native identity. Safety cleanup drains the
relocated root even on a red assertion, before either root is removed.

The held replacement control enrols its complete body before native acquisition.
Test cancellation releases its hold; test hooks and file/root cleanup cancel
and join that same body before census or directory removal. Relocation receipt
setup has a separate load-scaled three-second bound. The cancellation control
holds an asynchronous producer while requesting real root disposal, then checks
the producer's closed receipt and a bounded missing-receipt observer's completion
at the guarded removal boundary. Both must drain before the root can disappear.

This is a deterministic discovery-loss control, not a reproduction of the
unverified Linux scheduling cause in T-2009's original failure. Linux evidence
comes from the configured verification executor; local macOS evidence proves
the forced ordering and writer join only.
