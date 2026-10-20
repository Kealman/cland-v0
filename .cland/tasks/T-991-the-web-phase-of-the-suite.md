---
id: T-991
kind: task
title: The web phase of the suite
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-990
  - T-978
  - T-980
  - T-1025
topic: topic-768
branch: t/T-991-the-web-phase-of-the-suite
created: 2026-10-20T16:51:40.483Z
updated: 2026-10-20T19:24:27.931Z
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

## Comments

### impl-991 · 2026-10-20T19:20:47.518Z

Implemented separate Web classification, task/occasion cadence and web-only selection, isolated Headless Shell browser fixtures with real web.link auth/CSP/origin assertions, failure traces and teardown census, plus matching help/docs/skills/clauses. Targeted macOS arm64 smoke currently passes (4 assertions including nested cases; latest top-level 0.857 s, browser group 4→0). Typecheck and planner compatibility checks in progress; source review precedes hub verification.

### impl-991 · 2026-10-20T19:24:27.931Z

Coordinator split the expansion/bootstrap into T-1025. Published planner patch A-7991 (base fe05d55fbed2b9965c621ac91f9e1b1639a78599), removed its source delta from this worktree, and kept only browser dependency/fixtures/smoke/docs changes. A-7992 records pre-cover targeted/check evidence. Blocked pending T-1025 landing, Web-aware hub restart and Coordinator instruction to merge dev. Local tests held by the active stage-cover quiet rule; final fixture cleanup refinements are source-only and need revalidation afterward.
