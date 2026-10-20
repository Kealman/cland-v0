---
id: T-991
kind: task
title: The web phase of the suite
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-990
  - T-978
  - T-980
topic: null
branch: null
created: 2026-10-20T16:51:40.483Z
updated: 2026-10-20T16:51:45.726Z
---

## Summary

The suite gains a `Web` shard after the hub phase on `node:test` with `playwright-core` and Chrome Headless Shell, with the fixtures from the stack research. A `web-only` selection runs it for diffs inside `web/**` with the hub's and Neovim's smoke files. The first browser test opens the shell through the hub's web edge (T-978, T-980); there is no development bridge (Coordinator proposal, approved with the plan).

## What to build

- **The shard.** The `Web` shard has resource `machine` and runs two workers locally.
- **The fixtures.** `web/dist` is built once per run, and each test file gets a scratch hub through the hub harness and a one-time link minted with `web.link` on the hub's web edge. Each file has one browser and each test a fresh context, all closed explicitly. A `Notification` stub goes in through an init script. A failure saves a trace. Paths under `TMPDIR` are kept short.
- **The waits.** The waiting helpers poll through `page.evaluate`, so the strict CSP stays on.
- **Selection.** Diffs inside `web/**` select `web-only`, and the protocol and edge files keep forcing `full`. One web smoke file joins the other modes' smoke.
- **Budget.** The phase has a 40-second budget on a full run. Its tier placement is the tier the human set with this epic's plan approval (recorded as a comment on E-415).
- **Docs.** `web/README.md` and `docs/agents/tests.md` say how to run the phase.

## Acceptance criteria

- [ ] C1. A local `npm test` run on this branch reports a `Web` shard after the hub phase, with resource `machine` and two workers, on `node:test` with `playwright-core` and Chrome Headless Shell (run log).
- [ ] C2. The fixtures build `web/dist` once per run, start a scratch hub per file, mint a one-time link by a frame, use one browser per file and a fresh context per test, stub `Notification`, save a trace on a failure and use short `TMPDIR` paths (fixture tests).
- [ ] C3. A browser test opens the shell through a `web.link` link on the hub's web edge, reads the rail's seven areas, and records no request that leaves the origin.
- [ ] C4. The waiting helpers poll through `page.evaluate`, and a test shows the strict CSP still blocks an inline script.
- [ ] C5. A diff inside `web/**` selects `web-only`, which runs the web phase with the hub and Neovim smoke files, while a protocol or edge file forces `full` (suite-selection unit tests).
- [ ] C6. The web test files carry the tier the human set with this epic's plan approval (recorded as a comment on E-415) in `hub/test/tiers.json` and `hub/test/durations.json`, and the tier lint passes.
- [ ] C7. No browser or scratch hub process outlives the run (the fixture-process census).
- [ ] C8. `web/README.md` and `docs/agents/tests.md` describe the web phase, `web-only` and how to run the browser tests.
