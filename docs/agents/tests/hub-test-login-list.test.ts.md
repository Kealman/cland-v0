# hub/test/login-list.test.ts

T2, projectHub with FakeClock and fake lock process facts for both hub and droplet startup. `login list text and JSON expose rows and hosts, retained across hub restart` proves C3/C6 plus help and argument validation. Rows are seeded through the public metadata store. It awaits hub.stop before reopening and compares the full list including bindings. `login list refuses session, web and remote edges like host list` proves C5 through dispatcher web/gateway edges and an authenticated session actor on the CLI socket. No browser, native host, harness login or external network is needed. Stage QA can run both files; no local native lifecycle files changed.

Run: `node --test hub/test/login-list.test.ts`. Full task evidence uses mode-free `cland verify` after source review.
