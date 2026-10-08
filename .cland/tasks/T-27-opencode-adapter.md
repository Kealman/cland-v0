---
id: T-27
kind: task
title: OpenCode adapter
state: closed
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:54:07Z
updated: 2026-10-08T18:56:26.190Z
github:
  repo: Kealman/cland-v0
  number: 27
  url: https://github.com/Kealman/cland-v0/issues/27
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12; research `docs/research/harness-surfaces.md` (OpenCode 2.x service, SSE events, `permission.asked`, `form.created`, prompt API with `delivery: steer|queue`).

## What to build

The OpenCode adapter: a session is created on the local OpenCode server (the shared per-user service, or a standalone server per session when isolation is needed), with the spoke's MCP configuration injected through OpenCode's own configuration at spawn; attach runs the OpenCode TUI client against that server on that session; inject uses the prompt API with `steer` during a turn and `queue` otherwise, confirming `injected` from the API reply; state is derived from the SSE event stream, with `waiting for human` and `waiting for approval` derived from `form.created` and `permission.asked` and declared `heuristic` in the capability table, since the server reports only `running`; usage per message from the API. The role's default for the Implementer is OpenCode with a free model, so the model choice is a launch parameter.

## Acceptance criteria

- [ ] An OpenCode session spawned from the hub receives a General message as `injected` and replies into the thread
- [ ] The capability table marks `waiting for human` as heuristic and the UI shows that qualifier
- [ ] `attach_command` opens the OpenCode TUI on the hub's session; the session survives a Neovim restart
- [ ] A pending permission in OpenCode shows as `waiting for approval` in the hub within one event
- [ ] Tests run against a fake OpenCode server (HTTP plus SSE); one manual smoke run against the real harness with a free model is recorded

## Comments

### Kealman · 2026-10-08T14:08:51Z

<!-- github-comment: 6061696301 -->

## Manual smoke: the OpenCode adapter against real opencode v2.0.24 (2026-10-08)

Temp project, hub from branch `worktree-agent-a26ed6aedd9be2b35`, UI frames on the hub's Unix socket. Model `opencode/big-pickle` (OpenCode Zen, free). One prompt.

**Launch** (`session.launch {name: impl, harness: opencode, role: implementer, model: opencode/big-pickle}`):
```
process: harness opencode, model opencode/big-pickle, pid 73503 (opencode serve --hostname 127.0.0.1 --port 0),
harnessId http://127.0.0.1:54104, harnessSessionId ses_ee42c4ed5ffeuRqOy4u2E13sfV, status running
attach: OPENCODE_PASSWORD="$(cat '<project>/.cland/opencode/impl/password')" opencode --server http://127.0.0.1:54104 --session ses_ee42c4ed5ffeuRqOy4u2E13sfV
hub.log: session-state impl idle (source sse); the spoke said hello as impl/implementer 0.3 s later
session.list adapters.opencode: states {busy: reliable, idle: reliable, waiting for approval: heuristic, waiting for human: heuristic}, usage reliable, history/setModel/approvalRelay none
```

**Attach** in a tmux pane before the prompt: the OpenCode TUI opened on session `impl`, with MCP `cland` shown as Connected and the model shown as `Build · Big Pickle OpenCode Zen`.

**Send** (`topic.send {topic: general, text: "Reply with the single word pong", to: [impl]}`):
```
+0.0s delivery delivered
+0.0s delivery injected            (the prompt API's reply, delivery queue)
+0.0s session.state impl busy  (sse)
+43.0s message from impl: "pong"  (topic general)
+59.9s session.state impl idle (sse)
usage: {model: opencode/big-pickle, inputTokens 96, outputTokens 3, reasoningTokens 3, cacheReadTokens 9536, cost 0}
```

**The TUI pane after the turn** (shortened):
```
┃  <channel source="cland" from="human" from_kind="human" via="hub" to="impl" msg_id="4d7d261e-…" ts="…" topic="general" topic_title="General">
┃  Reply with the single word pong
┃  </channel>
┃  To answer, call the cland `send` tool with topic "general" and no `to`; text printed in this terminal reaches no one.
   + Thought · 496ms
   ✓ execute
   › cland.send [text=pong, topic=general]
   + Thought · 122ms
   pong
   Build · Big Pickle · 59.9s · 0.8 tok/s
```

**Closing the TUI**: after the tmux pane was killed, the server (pid 73503) was still running and the session still read `idle`. **Stop**: `session.stop` returned status `stopped`, state `unknown`, and the server process was gone.

The default model was checked separately, with no prompt: a launch without `--model` picked `opencode/exo-free`, the first free model the server lists.

### Kealman · 2026-10-08T14:10:46Z

<!-- github-comment: 6061734688 -->

Done on main (6cbe950..8b95825, fast-forwarded at b8b87aa): OpenCode adapter with a standalone server per session, spoke injected via OPENCODE_CONFIG, per-session OPENCODE_PASSWORD, prompt API with steer/queue confirming injected, SSE-derived state (busy/idle reliable; waiting for approval and waiting for human heuristic), usage per step, resume via the process table; 5 tests against a fake OpenCode server over HTTP+SSE; smoke on opencode/big-pickle recorded in the issue. Open: the UI qualifier display is #25/#28; Implementer default harness stays claude-code until roles config (#29).
