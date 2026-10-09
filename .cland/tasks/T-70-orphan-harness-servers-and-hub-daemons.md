---
id: T-70
kind: task
title: "Orphan harness servers and hub daemons: session stop ends the server, doctor and hub start sweep what no session owns"
state: open
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T10:44:01.288Z
updated: 2026-10-09T11:44:43.294Z
---

## Parent

Part of T-19. Found by the human's stand-in on 2026-10-09 at 10:45Z while chasing the load: 11 orphan `opencode serve` processes aged 3 to 20 hours with no live OpenCode session (left by the adapter's stop or by T-46's QA runs), one Codex app-server (cx-0ad4250d3535) with no live session, and four stale hub daemons of temp test projects; all killed by hand.

## What to build

- `cland session stop` (and the adapter's stop on relaunch) ends the harness server it started: the OpenCode `serve` process, the Codex app-server, the Claude Code process group; it waits for the exit and kills after a grace period; the journal records what it ended.
- `cland hub start` and `cland doctor` sweep: a harness server whose socket or args name this project (`.cland/run/cx-*.sock`, an OpenCode server started by this hub) with no running session in the process table is ended (hub start) or reported with a `fix` line (doctor); a hub daemon whose project directory no longer exists is ended by `cland doctor --fix` or reported.
- Tests: the fake harnesses prove stop ends the server and relaunch replaces it; a real OpenCode `serve` left behind on purpose is swept by `hub start` in a scratch project (skip with the reason where OpenCode is absent).

## Acceptance criteria

- [ ] After `cland session stop <opencode session>` no `opencode serve` of that session remains; same for a Codex app-server and a Claude Code session
- [ ] `cland hub start` ends this project's harness servers with no session and says so; `cland doctor` reports them with a fix
- [ ] `npm run typecheck && npm test` pass; hub/README.md documents the sweep

## Notes

Size S. Implementer: Codex gpt-6.1-sol. Independent of the test-harness lock item (same incident, different fix).

## Comments

### coord · 2026-10-09T11:44:43.294Z

Added scope, from rev-6's review of T-58 on 2026-10-09 at 11:44Z. The session pid probes still reach `spawnSync('ps')` through `processStarted`, in hub/src/hub/lock.ts or the process table. That code is unchanged from main. It runs on hub request paths, such as `session.list` and launch or resume checks, so a slow `ps` blocks the event loop: the class of stall T-67 removed for git. T-58 made the territory lock's own `ps` asynchronous (`acquireLockAsync`). Do the same for every `ps` call reachable from a hub request: run it asynchronously, or cache the process start times on a timer. Add a test that the request handlers spawn no synchronous process.
