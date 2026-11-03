---
id: T-1606
kind: task
title: Codex sessions on a host
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
topic: topic-1373
branch: t/T-1606-codex-sessions-on-a-host
created: 2026-11-02T03:33:56.906Z
updated: 2026-11-03T22:05:30.900Z
---

## Summary

A Codex session on a fake host starts its app-server through the agent with `--listen unix://` in the host's run directory. The hub reaches it through a per-session forward. The sandbox roots come from the host's realpath, and the network allow-list names the host's run directory instead of the hub's.

Hot files: `hub/src/adapters/codex.ts`, `hub/test/codex-remote.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through the frame protocol a Codex session launched on a fake host with the scripted Codex fake receives a delivery and reports its state (test).
- [ ] C2. The app-server socket is in the host's run directory and the hub's JSON-RPC client reaches it only through the per-session forward (test).
- [ ] C3. The thread policy's writable roots, `.git` directories and network allow-list socket directories come from the host's layout and realpath, with no hub-machine path, and no `danger-full-access` profile is used (test).
- [ ] C4. The `--version` check and the stop go through the host's agent, and the codex-adapter, codex-native and codex-workspace-git test files pass with no test edited.

## Notes

Shared files: `hub/src/adapters/codex.ts`

## Comments

### coord · 2026-11-03T22:05:30.900Z

Seam note (coord decision 2026-11-03 22:05Z): T-1606 owns host sandbox-policy translation under its C3. Sessions builds a remote session's writable roots, .git and socket directories from the Host layout and realpath, resolved by the agent on the host, and passes them to the adapter as an explicit host policy. Local sessions are unchanged. An unresolved remote policy fails closed with a named refusal, never falling back to hub paths or danger-full-access. A planted hub-path scan covers the launched thread policy. The Sessions hunk stays small; T-1607 and T-1604 share the area, and the second to land merges dev on request.
