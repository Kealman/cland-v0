---
id: T-1034
kind: task
title: A Claude Code auto-update re-exec looks like a harness death and revokes the Coordinator
state: open
status: backlog
size: M
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-21T05:59:56.127Z
updated: 2026-10-21T05:59:56.127Z
---

## Summary

Claude Code updated itself mid-session twice (2.1.304→2.1.305 at 21:33Z on 2026-10-20, 2.1.305→2.1.306 at 03:32Z on 2026-10-21) and re-executed under a new pid. The hub took the old pid's exit as the harness's death and revoked coord's Coordinator role. The crew ran without a Coordinator for 5 h 20 m and then 2 h 25 m, because nothing relaunches after "harness exited".

## What to build

1. **Launch env.** Hub-launched Claude Code sessions run with `DISABLE_AUTOUPDATER=1` in their launch environment, so a hub-owned harness never updates under a live session. The human updates Claude Code between sessions.
2. **Re-exec, not death.** When the same harness session (same harness session id and transcript) says hello again under a new pid shortly after its old pid ended, the hub records the new pid and keeps the row, role and claims. It does not post "harness exited" and revoke. T-372 is the adjacent case of a relaunched row that stays exited.
3. **Coordinator vacancy alarm.** When the Coordinator role is vacant for more than 10 minutes, the hub posts one decision-kind notice in General naming the last holder and the relaunch commands (`cland session resume coord --relaunch`, `cland role set coord coordinator`).

Evidence: the hub's role revocation events for coord at 2026-10-20T21:33Z and 2026-10-21T03:32:28Z. cland-impl's diagnosis on 2026-10-21: the transcript ends cleanly with last-prompt/cost-state after the version change.

## Acceptance criteria

- [ ] C1. A Claude Code session launched by the hub has `DISABLE_AUTOUPDATER=1` in its environment, after the credential filter (test with the fake harness).
- [ ] C2. A fake Claude session whose pid changes while its session id stays the same, followed by a hello within the grace window, keeps its row, role and claim, and no revocation event is posted (test).
- [ ] C3. A Coordinator vacancy longer than 10 minutes posts one notice in General with the relaunch commands, and posts nothing more while the role stays vacant (fake-clock test).
- [ ] C4. `hub/README.md#coordinator-session-procedure` describes the re-exec handling and the vacancy notice.
