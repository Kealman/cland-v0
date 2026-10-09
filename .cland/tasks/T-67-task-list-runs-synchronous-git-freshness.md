---
id: T-67
kind: task
title: "No git in the hub's request handlers: verdict freshness computed off the request path, a per-request time budget, and no UI polling floods"
state: open
labels:
  - ready-for-agent
  - slice-2
  - hub
  - high
assignee: impl-67
parent: T-20
blocked_by: []
topic: topic-18
branch: t/T-67-task-list-freshness-cache
created: 2026-10-09T10:19:03.465Z
updated: 2026-10-09T10:20:56.907Z
---

## Parent

Part of T-20; a regression from T-54 seen on cland's own hub on 2026-10-09 from 10:15Z (hub 92891 on main 55780b2), ending in a hang at 10:17:28Z and a restart. T-66 (the items tree reverting under load) is the client-side face of the same thing. Scope set by the human's stand-in at 10:20Z.

## What happened

`Tracker.list()` (hub/src/tracker/tracker.ts:390) calls `#freshness` for every listed item, which runs `branchTip` and `verdictCurrent` (hub/src/tracker/verdict-git.ts: `execFileSync('git', …)`, up to 5 s each, several calls per verdict: merge-base, diff, patch-id) synchronously on the hub's event loop; `verdictBase` runs git too, once per call. The workbench clients poll `task.list` about twice a second (123 audits in the minute 10:17Z) and `session.list` as often (2967 calls in the log). With about fifteen items carrying branches and verdicts and a machine load of 30 to 60, each `task.list` takes seconds of blocked event loop, requests queue behind each other, every client sees `the hub did not answer within 10 s` (the CLI, the spokes, `session launch` after 60 s), and at 10:17:28Z the hub stayed inside one read callback for good while every queued `task.list` ran its git: the socket stopped answering, the process stayed alive at 7 % CPU, the log stopped. Evidence: the Coordinator's 3-second `sample` at 10:15Z (/Users/evgeniyivanov/.claude/jobs/faa688a6/tmp/hub-sample.txt: half the main-thread time in nested `Array.map` → `SyncProcessRunner::Spawn` under a socket read handler) and the stand-in's sample of the hang (/private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/3629c0f3-2940-4f48-833c-921959fe6470/scratchpad/hub-hang-92891.txt: 94 % inside one JS stream-read callback). Log context before the hang: a burst of identical `session.list` and `task.list` audits from the nvim client with the same millisecond timestamp (20 lines stamped 10:17:28), then `client edge=socket client=cli`, `bye rev-6`. Restarted by the stand-in at about 10:18Z (pid 33252).

## What to build

- No git in request handlers at all. Verdict freshness (`current`) is computed asynchronously off the request path and cached per item by (verdict commit, branch tip, base tip); the cache is invalidated by the tracker's change events (an item file or verdict changes) and by a cheap `git rev-parse` of the branch tips and the base on a timer (a few seconds). `task.list` and `task.view` read the cache only; a value not yet computed is reported as unknown, never computed inline. `verdictBase` is cached the same way.
- A per-request time budget: the hub measures every request handler and logs `slow-request` with the tool, the client and the duration when it exceeds the budget (a few hundred milliseconds), so a stuck or slow handler is visible in the log and in `cland doctor` or `hub status` counters.
- A client-rate guard for UI polling: a client that sends the same read request faster than a limit gets the previous answer or a `too-fast` refusal, logged once. And the cause itself: the workbench subscribes to `task` and `session` events instead of polling `task.list` and `session.list` twice a second; read the nvim client's refresh paths (the items tree, the sessions panel, reconnect) and fix the poll loop in the same item, or file an nvim item with the finding if it is larger than this one.
- A reproduction test from the sample's shape: a client flooding `task.list` on a project with twenty items with verdicts does not block another client's request for more than the budget, spawns no git inside the handler (count through an injected runner or a `PATH` shim), and `task.view` still reports `current`/stale as T-54's tests require once the cache is warm.

## Acceptance criteria

- [ ] `task.list` and `task.view` spawn no git process in the handler; `current` comes from the cache or is absent, and T-54's freshness tests pass with the cache warmed
- [ ] The cache invalidates on tracker change events and on a timer's tip check; the git calls are asynchronous
- [ ] A handler over the budget logs `slow-request` with tool, client and duration
- [ ] A flooding client does not delay another client beyond the budget; the same read request repeated faster than the limit is refused or answered from the previous result
- [ ] The nvim workbench no longer polls `task.list`/`session.list` on a timer or on every refresh (events instead), or an nvim item is filed with the measured poll paths
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` says when freshness is computed and what `slow-request` means

## Notes

Test seam: the tracker against a real git repository in a temp project, as hub/test/verdict-commit.test.ts does, plus a spawn counter and two clients on a real hub; the nvim poll paths through the headless harness. Size M. Implementer: Claude Code. Labels hub, high. The hub restart that carries it is the cure; no restart until it lands.

## Comments

### coord · 2026-10-09T10:19:41.506Z

Incident record, 2026-10-09. The hub (pid 92891, main 55780b2) stopped answering its socket at 10:17:28Z with the process alive at about 7 % CPU; the hub log stopped at 10:17:28.730Z. The human's stand-in sampled it (94 % of the time inside one JS stream-read callback: uv__stream_io → OnStreamRead → JS; sample at /private/tmp/claude-501/-Users-evgeniyivanov-Projects-cland-v0/3629c0f3-2940-4f48-833c-921959fe6470/scratchpad/hub-hang-92891.txt), then ran `cland hub stop` (the process ended) and `cland hub start` (pid 33252, port 52857) at about 10:18Z; every session was re-found. The Coordinator's own 3-second sample two minutes earlier (/Users/evgeniyivanov/.claude/jobs/faa688a6/tmp/hub-sample.txt) shows the same handler with `SyncProcessRunner::Spawn` (git) at its leaves under two nested `Array.map`: `Tracker.list` → `#freshness` → `verdictCurrent`. Log context before the hang: a burst of identical `session.list` and `task.list` audits from the nvim client with the same millisecond timestamp (20 lines stamped 10:17:28; 2967 nvim `session.list` calls in the log overall; `task.list` 123 per minute at 10:17Z), then `client edge=socket client=cli`, `bye rev-6`. Reading: each list call blocks the loop for seconds of synchronous git under load 30 to 60; the nvim client re-requests on every refresh and on reconnect, so the backlog grows and the loop never drains. T-66 (the items tree reverting under load) is the client-side face of the same thing. Added to this item's scope, at the stand-in's request: (a) a watchdog in the hub that measures each request handler and logs and drops a client whose handler exceeds a budget, so a flood or a stuck frame never takes the hub down silently; (b) a reproduction from the sample's shape: a client flooding `task.list` on a project with many verdicts; also check that hub/src/hub/lines.ts advances its buffer on every frame. (c) The nvim client's burst at 10:17Z is to be read from the journal: the same-millisecond repeats look like a refresh loop after reconnect (the stand-in's own session had restarted); note the finding here and file it against the workbench if it is one. Effect on the run: calls timed out from 10:15Z; three identical Coordinator comments landed on T-65 because the timed-out calls went through late (left as they are; item files are not edited by hand).

### impl-67 · 2026-10-09T10:20:56.907Z

Claimed and started. Reading tracker freshness (tracker.ts list/view/#freshness/#changed, verdict-git.ts) and the dispatcher; the plan follows the brief's order: (1) async freshness cache off the request path, (2) slow-request budget log, (3) rate guard, (4) nvim poll paths, (5) README.
