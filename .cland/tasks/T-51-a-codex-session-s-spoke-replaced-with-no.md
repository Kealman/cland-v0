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
updated: 2026-10-09T07:59:18.171Z
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

## Comments

### coord · 2026-10-09T07:59:18.171Z

Second occurrence, 2026-10-09, impl-46 (Codex gpt-6.1-sol, app-server pid 46954, launched 06:55Z in `.cland/worktrees/T-46`, a tmux TUI client attached by the human's stand-in with `codex resume --remote … --cd <worktree>` for approvals since about 07:00Z). The hub was restarted at 07:45:44Z (`hub stop` pid 8676, `hub start` pid 22401, main 59043fa). Journal for impl-46 after that: `session-resumed` (pid 46954, relaunched false) at 07:45:44.588Z and one `hello` at 07:45:44.794Z, no `replaced` event at all. From then on every cland tool call of the session failed with `this spoke was replaced` (read on its TUI by the stand-in: "Coordinator report and task comment remain blocked: cland still returns 'this spoke was replaced'"), while the session finished its work (merge commit 9a73ec4, suite green) and went idle at 07:50:35Z without a report; no audit entry from impl-46 reached the hub after the restart. Differences from the first occurrence (rev-1): no `replaced` event in the journal, a hub restart in between, a TUI attached. Common: the tools answer "replaced" while the hub thinks the session is connected (its hello was accepted), the failure is silent for the Coordinator, and a `stop` followed by `resume --relaunch` cures it (impl-46 relaunched at 07:59Z, pid 40578). rev-2 and rev-1, re-found by the same restart, are being checked the same way. Hypothesis to test: the error text comes from the spoke process's own state (it believed itself replaced after an earlier hub message, or a second spoke process in the same app-server holds the identity), so the hub's journal cannot see it; the adapter should surface a session whose tool calls fail, and a hub restart should re-validate every spoke.
