---
id: T-1607
kind: task
title: Claude Code sessions on a host
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
  - T-1556
topic: topic-1375
branch: t/T-1607-claude-code-sessions-on-a-host
created: 2026-11-02T03:33:57.061Z
updated: 2026-11-03T22:20:59.641Z
---

## Summary

A Claude Code session on a fake host runs `claude --bg` through the agent, with its `mcp.json` and `settings.json` on the host. It finds its worker with one `claude agents --json` (T-1556), adopts the worker into the agent's table, and reports state through hooks and the mod bridge on the host. These reach the hub through the forwarded `hub.sock` with the host's secret and the session's credential.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/host/agent/processes.ts` (adopt), `hub/test/claude-code-remote.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through the frame protocol a Claude Code session launched on a fake host with the scripted Claude fake receives a delivery and reports its state from its hooks (test).
- [ ] C2. The worker found by the one `agents --json` is adopted into the host agent's table with its Linux identity, and liveness and stop go through the agent (test).
- [ ] C3. The session's hooks and mod bridge connect through the host's `hub.sock` and are dispatched as that session, and their settings carry host paths only (test).
- [ ] C4. Over several poll intervals no short-lived `claude` command runs on the host for the running row (test).
- [ ] C5. The claude-code-adapter, claude-code-sessions and claude-code-schedule test files pass with no test edited.

## Notes

Shared files: `hub/src/adapters/claude-code.ts`

## Comments

### impl-1607 · 2026-11-03T22:03:54.501Z

T-1607 Claude Code sessions on a host: read A-15100/A-15370/A-15588, spec/decisions, T-1599/1600/1556/1601 and comments. Before-edit consumer inventory published in item topic. Coordinator d658d9eb approves optional Host.adopt + capability gated agent operation, identity/launch proof required and older-agent explicit refusal. Existing credential is CLAND_LAUNCH_TOKEN in private launch files, not a new credential variable. Asked lead to settle safe positive launch proof for detached/reparented workers before implementation.

### coord · 2026-11-03T22:20:59.641Z

Coord decision 2026-11-03 22:21Z on the launch-token scan versus the Claude job record. No source documents real `claude --bg` job-record content, so it is treated as possibly holding settings content. CLAUDE_CONFIG_DIR stays the account's existing config root (account_env); there is no relocation, symlink or credential copy. Precondition: the root is realpath'd, owned by the agent user and mode 0700, otherwise launch is refused by name. The session's jobs/<pinned job id>.json is generation-owned and removed by pinned id after a confirmed stop or rollback; sibling records are untouched. Scan: while running, the token appears only in the generation's private files and that one job record; after stop or rollback, nowhere (host home, fake home, generation folders). The fake's home is the fake account root, 0700.
