---
id: T-816
kind: task
title: Coordinator relaunch fails on a pre-T-603 default-directory account_env, and its harness exit goes unnoticed
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T18:34:34.099Z
updated: 2026-10-18T18:34:34.099Z
---

## Summary

The Coordinator's harness (pid 99977) exited at 17:48Z on 2026-10-18 without anyone noticing, and the hub released the role. This is the fourth T-372-class exit. The plain `cland session resume coord --relaunch` then failed with "Workspace not trusted". The exited harness_processes row still carried the pre-T-603 explicit account_env {CLAUDE_CONFIG_DIR: ~/.claude}, which T-603 deliberately did not migrate. cland-impl nulled that column by hand, and the relaunch then worked (logged on T-204).

## Acceptance criteria

- [ ] C1. Relaunching a row whose account_env names only the default Claude Code config directory drops or ignores that entry and starts the harness as a default-account launch; a regression test with a pre-T-603 row shows the relaunch succeeding without hand edits.
- [ ] C2. When the Coordinator's harness exits, the hub posts a notice to General within one heartbeat, naming the session, its exit time and the released role, so a vacant Coordinator is visible before work stalls.
