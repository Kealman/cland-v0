# hub/test/config-reload-component.test.ts

Executor switching uses a disposable `projectHub`, a fake candidate and real
socket requests. Check the effective executor/workers receipt, managed-file
readback, next dry-run admission and Coordinator-only role routing. The queued
run and retained running-worker snapshots are covered by executor-run-rules.
The baseline reload case keeps executor/droplet reload distinct from local-worker
reload; no live project config or provider call is involved.
Changed callbacks enter `guardedLeaseCase.run` before guard/root setup, adopt
late roots, and use separate named setup bounds. The real CLI subject is its own
case with the helper's CLI allowance; the other new cases retain the fake-only
positive launch guard. Normal and signal teardown join callers before resources,
roots and guard seams are released.

`hub/test/config-reload-component.test.ts` is T2: the real CLI talks to a sealed
in-process `projectHub`, with fake adapters and scratch HOME/Git environments
owned by the shared harness. No native hub-process lifecycle or browser is used.

The generated `hub reload refuses changed web.<key> with restart guidance and
retains the config/roles pair` cases cover origin, bind, port and dist independently.
They await the CLI's terminal receipt, require exit 1 and `web changed: restart required`,
then read the loaded config provenance, remote budget, web status and role model.
The equivalent-parsed-settings case accepts explicit defaults and a normalized
HTTPS origin, then refuses removing that configured origin. The existing command
reload test preserves the successful response shape. See the
[config-set guide](hub-test-config-set.test.ts.md) for the save/restart regression.

Run the touched files individually with `node --test <file>`, subject to
cover-quiet admission. T3 `config-reload.test.ts` owns SIGHUP/PID behavior; extending
the shared startup-field guard needs no new process or browser test.

The generated `project configuration` and `roles file` skill-snapshot cases use
scratch skill directories, fake interval advancement and the public
`availableSkills` read. Trap all synchronous filesystem exports around that read,
then retain the startup inventory, unchanged snapshot before refresh, added-skill
and removed-directory assertions after publication. Drain the previous refresh
before the next edit/tick. These are T2 filesystem receipts without native
processes; no source-commit Git query runs in the configuration fixture.


T-1738: pool settings publish capacity through ProjectConfiguration.config(). The apply callback sees 2 then 4 and a retained prior snapshot remains 2. Await set completion before checking publication; no wall-clock wait.


Pool publication also checks subset and empty weights/pin replacements through the running configuration owner, after set completion.
