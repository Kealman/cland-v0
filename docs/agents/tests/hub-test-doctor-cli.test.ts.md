# hub/test/doctor-cli.test.ts

T3 covers native doctor CLI rendering and exit codes, probe handle closure, and
deadline termination of a probe's entire process group. Run with Node in the
root package's supported engine range:

`node --test hub/test/doctor-cli.test.ts`

The healthy CLI case requires a current installed web build. The deadline case
can run alone with `--test-name-pattern='a probe that never answers'` before the
file argument; it uses an injected web-bundle result and needs no browser.

The deadline case invokes `runDoctor` in process with production `run` probes.
Its injected lock-start reader runs the same hanging `ps` probe and returns an
unknown birth, exercising the live-holder fallback and actual scratch hub status.
The two lock observations and Claude version/auth probes each use a distinct
receipt file. Each fake shell publishes its own PID and its sleep child's PID
after starting that child. The test requires both processes alive before firing
the captured production deadline callback. Only synchronous deadline registration
is intercepted; setup, native cleanup and outer test bounds keep real clocks.
Thus startup time consumes no part of the simulated one-second probe budget.
The production timeout error, fail verdict, hub verdict and final absence of all
eight PIDs remain asserted. Killing just the shell leaves sleep alive and fails.

Fixture roots register disposal when allocated. Spawned probe groups register
ownership before readiness; readiness also registers each observed child. All
owners settle before directory disposal, including failed assertions. Child
environments use `fixtureEnvironment` after overlays, with scratch HOME, XDG and
Git settings. Every in-process probe receives the disposable directory as its
explicit native cwd. A registry tracks all probe promises, closes admission when
the doctor settles, and joins all admitted work with attempt-all drainage before
assertions and directory disposal. A sibling branch cannot start a later probe
after another branch fails. No real harness or live project state is used.

For timing-race validation, repeat the deadline case alone at least twenty times,
then alongside one other targeted file, keeping one-minute load below 20. Record
native exits, durations and before/after inventories of `/private/tmp` names
starting `hc-`, `ct-` and `cland-h-`; preserve existing entries. This is targeted
macOS evidence, not a full-tier or Linux receipt. Before sharing captures, scan
only declared outputs for secrets with a positive matching control.
