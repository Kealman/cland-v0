---
id: T-24
kind: task
title: "Claude Code adapter: spawn, attach, inject and state"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-23
topic: null
branch: null
created: 2026-10-08T11:53:43Z
updated: 2026-10-10T00:58:17.334Z
github:
  repo: Kealman/cland-v0
  number: 24
  url: https://github.com/Kealman/cland-v0/issues/24
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12 (contract and v0 mapping); research `docs/research/harness-surfaces.md` on branch `research/harness-surfaces` (Claude Code section: `--bg`, `attach`, hooks, mods, `claude agents --json`).

## What to build

The first adapter and, with it, the adapter contract inside the hub: `spawn(name, role, model, cwd)`, `attach_command(session)`, `inject(session, message)` confirming the `injected` stage, a normalised `state` stream (`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown`), `stop`, `resume`, and a capability table with per-signal reliability. For Claude Code: spawn runs the harness in background mode with the spoke's MCP configuration injected at launch (nothing machine-specific is written into committed files); attach is the harness's own attach command; inject goes through a cland mod that submits a prompt when the session is idle, with the inbox socket as fallback; state comes from the harness hooks calling `cland hook <event>` (turn start, turn end, permission request) and the mod's turn-complete event, with the polled sessions list as fallback; model and usage come from the documented surfaces. Harness processes live in the hub's process table; a crash sets `unknown` and writes a journal event. An unconfirmed inject stays `delivered`, logs an event and retries at the next idle. This is the first "hello": a message typed in General reaches a real Claude Code session and its reply comes back.

## Acceptance criteria

- [ ] From the Neovim client, a human message in General reaches a real Claude Code session; the stage shows `injected` once the mod submits it; the reply appears in the thread
- [ ] The session's state changes are visible in the hub (`busy` during a turn, `idle` after, `waiting for approval` on a permission prompt) and come from hooks or the mod, never from the model's self-report
- [ ] `attach_command` returns a command that, run in a terminal, attaches to the live session; two attached clients work
- [ ] After a hub restart, `resume` re-finds the running session through the process table and reconnects state reporting
- [ ] The capability table declares what the adapter cannot do (for example approval relay) instead of emulating it
- [ ] Tests drive the adapter against a fake Claude Code (a fake harness process honouring the hooks and the mod surface); one manual smoke run against the real harness is recorded in the ticket

## Comments

### Kealman · 2026-10-08T13:49:51Z

<!-- github-comment: 6061336641 -->

## Manual smoke against the real Claude Code (2.1.294, `--model haiku`), 2026-10-08

Temporary git project, hub started with `cland hub start`, a scripted UI client on the hub's Unix socket (subscribe, `topic.send` into General). Commits: 1647250, 7291c45, 0fe1e61, cb32f0a, 1631b67, 9c69e6a.

**Surfaces found in 2.1.294.** `--bg`, `attach`, `stop`, `agents --json`, `--settings` (hooks with `async`), `--mcp-config`, `--plugin-dir` and mods (`$.prompt.submit`, `turn.start`/`turn.complete`, `$.process.*`, `$.env`) all exist. `claude plugin validate hub/mod/cland` passes.
- `--bg` refuses an untrusted workspace ("Workspace not trusted. Run `claude` … once and accept the trust prompt"). It was accepted once by hand.
- `--bg` takes `--session-id` but does not use it. The session picks its own id, prefixed by the background id. Fixed in cb32f0a: recorded as `harnessSessionId`.
- The SessionStart hook arrives before `claude --bg` and the first `agents --json` return. On the first launch it was dropped as `signal-unmatched`. Fixed in cb32f0a: early signals and the mod's bridge are kept for the launch in progress.
- The inbox socket is not used: its message format is undocumented.

Hub log (abridged), second launch onwards:

```
13:42:57.726 harness-launched  coord harnessId c6a9c14c
13:42:57.850 session-launched  coord pid 9290 sessionId 477787aa-… harnessSessionId c6a9c14c-4050-… early:1
13:42:57.850 session-state     coord idle  (source hook: the early SessionStart, replayed)
-- hub restarted (cland hub stop; cland hub start), the session keeps running --
13:44:11.719 session-resumed   coord pid 9290 state idle relaunched:false
13:44:11.896 bridge-connected  coord  (the mod reconnected through hub.json)
13:44:12.404 hello             coord  (the spoke reconnected)
-- UI: topic.send General "Reply with the single word pong" --
13:44:33.021 message  stage queued
13:44:33.022 delivery stage delivered
13:44:33.161 delivery stage injected      (the mod's $.prompt.submit, confirmed by cland hook injected)
13:44:33.161 session.state busy  source hook  (UserPromptSubmit)
13:44:35.241 session.state idle  source hook  (Stop)
```

Two terminals ran the attach command the hub returns (`claude attach c6a9c14c`, from `cland session attach coord`) in tmux. Both rendered the live session (Haiku 5.5, session `coord`), and both showed the turn:

```
› Prompt from the cland plugin
❯ The cland plugin sent a message:
  <channel source="cland" from="human" from_kind="human" via="hub" to="coord" msg_id="29237a39-…" ts="…" topic="general" topic_title="General">
  Reply with the single word pong
  </channel>
⏺ pong
✻ Crunched for 2s
```

**Not met yet: the reply in the thread.** The model printed `pong` in its terminal instead of calling the spoke's `send` tool, so no `message` event came back. cb32f0a adds one line after the envelope that names the `send` tool and the topic. That line is tested against the fake only. Verifying it on the real harness needs one more short prompt, which is waiting for the coordinator's approval. `waiting for approval` was not triggered on the real harness: auto mode let the turn run without a prompt. It is covered by the PermissionRequest hook in the fake tests.

### Kealman · 2026-10-08T13:50:57Z

<!-- github-comment: 6061357246 -->

## Second smoke run (Claude Code 2.1.294, Haiku): the reply reaches the thread

This run uses the same project and code as cb32f0a, with the reply hint after the envelope. It was a fresh launch (`cland session launch coord --role coordinator --model haiku`, background id `c0e8d6d3`) and one prompt sent through the UI frames.

```
13:50:36.461 message  human → coord "Reply with the single word pong"   stage queued
13:50:36.462 delivery stage delivered
13:50:36.610 delivery stage injected
13:50:36.612 session.state busy  source mod   (turn.start)
13:50:39.922 message  from coord (agent, coordinator) → General: "pong"   replyTo 9c68c9c7-…
13:50:42.200 session.state idle  source hook  (Stop)
```

The attached client, `claude attach c0e8d6d3`, showed this:

```
› Prompt from the cland plugin
❯ The cland plugin sent a message:
  <channel source="cland" from="human" from_kind="human" via="hub" to="coord" msg_id="9c68c9c7-…" … topic="general" topic_title="General">
  Reply with the single word pong
  </channel>
  To answer, call the cland send tool with topic "general" and no to; text printed in this terminal reaches no one.
  Called cland
⏺ I sent "pong" to the human in the General topic, replying to the message you sent (msg_id 9c68c9c7-…). The send call returned ok.
```

Across both runs, every point is now met except one. The message is injected, the reply comes back through `send` into General, busy and idle come from the hook and the mod, two attach clients work, and resume works after a hub restart. Still not observed on the real harness: `waiting for approval`, because auto mode ran the turn without a permission prompt. The fake's PermissionRequest test covers it.

### Kealman · 2026-10-08T13:54:02Z

<!-- github-comment: 6061414742 -->

Done on main (1647250..9c69e6a): the adapter contract, the process table, session state from adapters only, the injected stage in the delivery pipeline, the Claude Code adapter (--bg, --settings hooks calling cland hook, --mcp-config, a cland mod for inject with $.prompt.submit, claude agents --json as polled fallback), a fake Claude Code for tests, two recorded smoke runs on Haiku (reply reaches the thread via send on the second). 107 hub + 6 nvim tests. Not triggered on the real harness: waiting for approval (covered by the fake). Inbox socket not used (undocumented format).
