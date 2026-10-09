---
id: T-51
kind: task
title: "A Codex session's spoke replaced with no attach behind it: the session's tool calls then fail silently until a stop and relaunch"
state: open
labels:
  - needs-triage
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T07:21:18.317Z
updated: 2026-10-09T07:21:18.317Z
---

## Parent

Part of T-19. Seen once in the real T-42 run on 2026-10-09 with the Reviewer session `rev-1` (Codex 0.160.0, gpt-6.1-sol, app-server pid 62669, launched by the hub at 06:27Z through the spoke's `session.launch`, root checkout). Same family as the OpenCode second-spoke bug fixed in 128fd6e (T-43's run) and T-50 (a steer lost at the end of a turn).

## What happened (journal `.cland/journal.jsonl`)

- 07:07:45Z the T-48 review request is injected into rev-1; 07:07:56Z rev-1's `task.view` and `status` are audited `ok`.
- 07:08:15.420Z `{"event":"replaced","name":"rev-1","sessionId":"72d5bcf7-…"}` followed in the same millisecond by `hello` for the same session id and role, a `role-clause` re-sent with reason `hello`, `flushed` count 1, `harness-steered` into turn `01a11f7d-…`, `injected`. No `session.attach` for rev-1 that day (the human's clients only polled `task.list`, `session.list`, `hub.status` through nvim and the CLI at the time).
- 07:11:38Z the turn ends `idle`. No audit entry from rev-1 after 07:07:56Z: none of its tool calls reached the hub. rev-1 later reported that its verdict and report attempts "failed with the replaced-spoke error", so the app-server kept calling tools through the old spoke process, which answered `this spoke was replaced`.
- 07:13:40Z a nudge from the Coordinator is delivered and injected; the turn runs 37 s and ends idle, again with no tool call. The hub reported nothing: a session whose every tool call fails looks like a normal idle session.
- 07:16:29Z `cland session resume rev-1 --relaunch` found the process alive and did not relaunch it (`relaunched: false`). `cland session stop rev-1` then `resume --relaunch` relaunched it (pid 55863, new `hello` 07:16:54Z) on the same Codex thread; the verdict came at 07:17:23Z with the thread's context intact.

## What to find out and build

- Why the app-server started a second spoke process for the same session with no attach (a restart of its MCP client after an idle stretch, a per-turn MCP launch, a crash of the first spoke): reproduce with the fake app-server starting a second spoke with the same environment, then once with the real Codex.
- Decide the hub's behaviour when a second spoke says hello for a live session: route to the newest but keep answering the old one until it disconnects, or refuse the newcomer while the old one is alive, or detect the replacement in the adapter and relaunch; in every case the Agents topic and the inbox say that the session lost its tools (T-46's shape for a failed turn applies).
- `cland session resume <name> --relaunch` relaunches even when the process is alive, or its help text says that stop then resume is the way.

## Acceptance criteria

- [ ] A test against the fake app-server reproduces a second spoke for a live session and shows the chosen behaviour: the session's tool calls keep working (or the session is relaunched), and the Agents notice and inbox notification appear
- [ ] `cland session resume --relaunch` on a live session relaunches it, or the help and README say it does not
- [ ] `hub/README.md` documents what `replaced` means and what the hub does
- [ ] `npm run typecheck && npm test` pass
