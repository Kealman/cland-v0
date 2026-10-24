# hub/test/config-reload-component.test.ts

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
