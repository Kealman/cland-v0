---
id: T-26
kind: task
title: Codex adapter
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:54:00Z
updated: 2026-10-10T00:58:17.345Z
github:
  repo: Kealman/cland-v0
  number: 26
  url: https://github.com/Kealman/cland-v0/issues/26
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12; research `docs/research/harness-surfaces.md` (Codex app-server, `thread/status/changed`, `resume --remote`, the embedded-mode trap) and `docs/research/bcas-hub.md` (the BCAS Codex supervisor, reusable).

## What to build

The Codex adapter on the contract established by the Claude Code adapter: spawn starts a Codex app-server on a per-session Unix socket with the spoke's MCP configuration passed to the app-server (never to the TUI process), starts a thread with the requested model, and runs a first turn that delivers the session's clause (a placeholder until roles exist) so that attach works; attach is `codex resume --remote` on that socket and thread; inject uses `turn/start` with a tool output when idle and `turn/steer` during an active turn, confirming `injected` from the result; state comes from `thread/status/changed` (`idle`, `active`, `waitingOnApproval`, `waitingOnUserInput`) keyed by thread id, declared `reliable`; usage from token events and the rate-limit call. Approvals are left to the attached TUI; the hub only shows `waiting for approval`. The BCAS supervisor's durable inbox and wake-up pattern are reused where they fit.

## Acceptance criteria

- [ ] A Codex session spawned from the hub appears in the registry with its state; a message to it from General is `injected` and its reply comes back
- [ ] `attach_command` opens the real Codex TUI on the hub-owned thread; a Neovim restart leaves the thread running
- [ ] No `-c` override or `--profile` is ever passed to the Codex TUI process
- [ ] State transitions `idle` → `active` → `waiting for approval` → `idle` are observed from the app-server, not inferred
- [ ] Tests run against a fake Codex app-server speaking JSON-RPC on a Unix socket; one manual smoke run against the real harness is recorded

## Comments

### Kealman · 2026-10-08T14:20:50Z

<!-- github-comment: 6061932493 -->

## Manual smoke against the real Codex (acceptance criterion 5)

Codex `codex-cli 0.160.0`, model `gpt-5.6-luna` (the cheapest model listed by `model/list`), ChatGPT Pro sign-in. A fresh temp project under `$TMPDIR`, with a hub from the `worktree-agent-abef08100addc8cce` branch. Driven over the UI protocol (`session.launch`, `topic.send`, `session.attach`, `session.stop`). No approval was answered by anything.

**Launch**: `session.launch {name: "cx", harness: "codex", model: "gpt-5.6-luna"}` returned in about 0.3 s:
```
pid 72751, harnessId (socket) /var/folders/…/T/cland-cx-4be3edfbff18.sock, thread 01a11bd3-3e93-7f63-94f4-285500b1b203
attach: codex resume --remote unix:///var/folders/…/T/cland-cx-4be3edfbff18.sock --cd /private/var/folders/…/T/cland-smoke-lfis6w 01a11bd3-3e93-7f63-94f4-285500b1b203
capabilities: {"history":"none","usage":"reliable","setModel":"none","approvalRelay":"none","states":{"busy":"reliable","idle":"reliable","waiting for approval":"reliable","waiting for human":"reliable"}}
14:03:11.558 state cx: busy (app-server)    ← the clause turn
14:03:22.645 state cx: idle (app-server)
```
The spoke connected as `cx` through the `-c mcp_servers.cland.*` overrides on the app-server.

**Attempt 1 (misaddressed, never reached the model).** "Reply with the single word pong" was sent to General with no `to`. General addresses the `coordinator` role, and the session had no role, so the message stayed `queued` for the role and was never delivered to `cx`. This was a mistake in the smoke driver, not the adapter. The coordinator then allowed one more send.

**Attempt 2**: `topic.send {topic: "general", text: "Reply with the single word pong", to: ["cx"]}`, with the TUI attached:
```
14:06:59.335 send → outcome delivered
14:06:59.387 stage 5a0ae5fa…: delivered
14:06:59.387 stage 5a0ae5fa…: injected      ← turn/start {toolOutput: hub_event} result
14:06:59.387 state cx: busy (app-server)
14:07:07.711 msg   [general] cx: pong (replyTo 5a0ae5fa…)
14:07:14.131 state cx: idle (app-server)
usage.tokens.last: {"totalTokens":27956,"inputTokens":27775,"cachedInputTokens":27392,"outputTokens":181,"reasoningOutputTokens":174}, rateLimits.primary.usedPercent 11
```

**Attach**: the attach command ran in a tmux pane. The first attach asked "Folder access … Trust this folder?" (recorded; accepted for the throwaway temp folder). The TUI then showed the hub-owned thread live:
```
>_ OpenAI Codex (v0.160.0)
› You are "cx", a session of cland. … Nothing to do yet: reply with the single word "ready".
• ready
  Worked for 11s
• Called cland.send
  └ {"ok":true,"outcomes":[],"topic":{"id":"general","title":"General"}}
• pong
  Worked for 14s
  GPT-5.6-Luna high · …/cland-smoke-lfis6w
```
The `hub_event` tool output itself is not shown in the TUI. `cland.send` ran without an approval prompt (`default_tools_approval_mode="approve"` on the cland MCP server).

**TUI closed** (standing in for a Neovim restart): the app-server pid stayed alive, and `hub.status` still showed `cx` as `running` and `idle`.

**Stop**: `session.stop` → `status: stopped`, state `unknown (stopped)`, and the app-server process was gone. `cland hub stop` → 0.

Not observed with the real Codex, because only one prompt was allowed: `waiting for approval`. The fake app-server covers it in `hub/test/codex-adapter.test.ts`.

### Kealman · 2026-10-08T14:45:48Z

<!-- github-comment: 6062427666 -->

Done on main (2bd9a88..e22870c, merged at ca72122): Codex adapter on a hub-owned app-server per session (spoke passed to the app-server only via -c mcp_servers.cland.*; TUI attach via codex resume --remote with no -c/--profile), turn/start with hub_event toolOutput and turn/steer, state from thread/status/changed (all signals reliable), usage from token and rate-limit events, resume via the process table; first turn now carries the role's clause from roles.toml (clauseAtSpawn). Fake app-server tests plus a recorded smoke on gpt-5.6-luna. Decisions: cland MCP tools are pre-approved in Codex (default_tools_approval_mode=approve); effort not passed to the app-server (unconfirmed parameter). Open: waiting-for-approval observed only on the fake; possible double delivery if an inject times out after Codex accepted it.
