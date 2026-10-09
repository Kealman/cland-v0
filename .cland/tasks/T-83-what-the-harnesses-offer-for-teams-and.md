---
id: T-83
kind: question
title: What the harnesses offer for teams and sub-agents, and what the hub can see
state: closed
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:38.000Z
updated: 2026-10-09T19:48:07.792Z
---

## Question

What do the three harnesses offer natively for one session to run or coordinate others, what of it is visible or controllable from outside the harness process, and where should the hub's hierarchy stop and the harness's own delegation begin?

## Context

For Claude Code (current release: agent teams and teammates, subagents, `claude agents --json`, hooks), Codex (current release: sub-agents and any multi-agent feature of the app-server protocol) and OpenCode (current release: subagents, sessions, its server API). The hub today sees only the session it launched; a session's in-harness sub-agents are invisible. The human wants, for some crews, one session that manages its own sub-agents over a group of items instead of one fresh session per item. Reuse `docs/research/harness-surfaces.md` on branch `research/harness-surfaces` for the baseline and version numbers.

## Deliverable

`docs/research/harness-teams.md` on branch `research/harness-teams`: a comparison table (feature, how it is started, what is observable from outside through process boundary, API, hooks or events, what it costs in context and tokens, whether the hub could launch, address or observe it); the versions tested; and a recommendation on the boundary between hub hierarchy and in-harness delegation. The ticket "Crew configuration and session reuse" starts from it.

## Comments

### human · 2026-10-09T19:47:59.258Z

Resolution: research on branch research/harness-teams, file docs/research/harness-teams.md (commit 5c34973).

- **All three harnesses delegate inside one session, and none crosses harnesses.** Claude Code has subagents, agent teams and dynamic workflows. Codex has sub-agent threads, which run the multi-agent v2 tools for every current gpt-6 model. OpenCode has child sessions started by its `subagent` tool. Each one spawns workers of its own harness only.
- **Claude Code subagents and teammates never appear in `claude agents --json`** (observed). That held even for a split-pane teammate, which is a separate `claude` process with its own session ID. The hub sees them only through what the session itself emits, chiefly the hooks and mod it installs: `agent_id` on hook input, `$.agent.list()` with live status, and one `turn.complete` per subagent run, with usage.
- **A Codex host that runs the app-server sees every sub-agent thread without asking** (observed). It is subscribed automatically and receives the thread's status, items, token usage and approval requests. It cannot drive the thread: `turn/start` on a v2 sub-agent is refused with "direct app-server input is not allowed for multi-agent v2 sub-agents" (observed).
- **An OpenCode subagent is an ordinary child session** (`parentID`) on the server. The host sees its events, lists children, answers its approvals, prompts it, and can create children of its own (observed). The parent session learns nothing of what the host does to its children.
- **A sub-agent waiting for approval shows at the parent level only in Claude Code.** There, the registry read `waiting` / `permission prompt` and `PermissionRequest` carried the subagent's `agent_id`. In Codex and OpenCode the parent stayed `active` or `running`, and the wait was visible only on the child thread or session (all observed).
- **Delegation costs the parent at least one extra turn**, because the report comes back into its context (observed in all three). Each sub-agent also pays for its own context. Observed first-request prompts: about 27k tokens for a Claude Code general-purpose subagent; 15.7k to 16.2k for a Codex sub-agent, about the parent's own size; about 3.7k for an OpenCode child. A Claude Code teammate's first turn wrote 35k tokens to cache and read 33k, and the lead spent five turns on one trivial teammate.
- **The host can launch a sub-agent in only two cases.** In Claude Code it takes in-process code: a mod's `$.agent.spawn` worked, but the report still landed in the parent conversation, which did not expect it. In OpenCode it takes `POST /api/session` with a `parentID`. Codex has no client method for it.
- **Stability labels.** Claude Code subagents are generally available. Agent teams are experimental and off by default. Agent view is a research preview. Codex multi-agent is stable, though the Codex app-server is experimental. OpenCode's HTTP API calls itself experimental.
- **Recommendation (the one the deliverable asks for):** the hub's hierarchy ends at the session. Roles, claims, branches, topics, verdicts and contact with the human stay with hub-launched sessions. In-harness sub-agents stay inside one session's work and count as part of that session. The hub observes them for state and cost but does not address them (section 5).

Open points for the ticket this research feeds (Crew configuration and session reuse): sub-agents do not work in cland's per-item task worktrees (only a Claude Code mod's `cwd`, untested, could place one); Codex and OpenCode report a child's approval wait only on the child, so the parent's state would have to fold it in; the Coordinator's environment has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, which turns its named subagents into teammates.

### human · 2026-10-09T19:48:07.792Z

Resolved: see the resolution comment
