---
id: T-1219
kind: task
title: An OpenCode session's shell has no cland session identity, so its CLI calls run as the human
state: open
status: in progress
size: S
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-951
branch: t/T-1219-an-opencode-session-s-shell-has-no-cland
created: 2026-10-24T09:26:22.640Z
updated: 2026-10-24T09:27:11.422Z
---

## Summary

Found by oc-1020 during the E-1216 qualification (2026-10-24 09:25Z, topic-950). hub/src/adapters/opencode.ts puts CLAND_HUB_FILE, CLAND_SESSION_ID, CLAND_SESSION_NAME, CLAND_LAUNCH_TOKEN and CLAND_ROLE only into the cland MCP server's environment (the `mcp.servers.cland.environment` block). The OpenCode server process it starts (`startServer`) carries no CLAND_* variables, so its shell tools run `cland` with no session identity. The Claude Code and Codex adapters put the same variables in the harness process environment (claude-code.ts, codex.ts).

Seen: oc-1020's `cland verify --report topic-950 --to oc-1020` resolved as the human and was refused with "this session already has a suite queued or running", because oc-1063's verify had also been counted as the human's. oc-1020 resubmitted with its own CLAND_SESSION_ID, CLAND_SESSION_NAME and CLAND_ROLE set by hand and was admitted (run 9e969299). Any cland CLI call from an OpenCode shell (verify, task, merge) is affected, and two OpenCode sessions' verify runs collide as one "human" owner.

## Acceptance criteria

- [ ] C1. A command run from an OpenCode session's shell tool sees the same session identity variables a Codex shell sees, and `cland verify` from it is owned by that session, shown with fake OpenCode and a real project hub (test).
- [ ] C2. Two OpenCode sessions submit verify runs at the same time and each is admitted under its own name (test).
- [ ] C3. The ready report states how the hub authenticates a shell's claimed session identity (launch token or secret versus plain variables), and whether a shell can claim another session's identity; a gap found there is filed separately.
