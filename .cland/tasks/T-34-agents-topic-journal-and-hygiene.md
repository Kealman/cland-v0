---
id: T-34
kind: task
title: Agents topic, journal and hygiene
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-32
topic: null
branch: null
created: 2026-10-08T11:54:58Z
updated: 2026-10-08T13:17:15.605Z
github:
  repo: Kealman/cland-v0
  number: 34
  url: https://github.com/Kealman/cland-v0/issues/34
---

## Parent

Part of #19. Spec sections 4.2 and 4.5; decisions https://github.com/Kealman/cland-v0/issues/7 (Agents topic) and https://github.com/Kealman/cland-v0/issues/13 (journal, hygiene). Design: Agents in the topics lists; prototype `prototype/workbench` (Agents log view).

## What to build

Every agent-to-agent message and every lifecycle event (session start and stop, role assignment, revocation and handover, item claims, tool refusals) is recorded by the hub and shown in the read-only Agents topic as a centre view; replying there addresses the sender of the message replied to. The JSON-lines journal in `.cland/journal.jsonl` holds the same events plus the audit log; a hub restart appends, never truncates. Hygiene from BCAS is in force with thresholds in `.cland/config.toml`: message size cap, per-session rate limit, and a loop breaker that mutes an agent pair exchanging messages without a human until a cool-down or an explicit unmute; mute and counter state persists in SQLite. Tool-level noise (commands, outputs) never enters the Agents topic.

## Acceptance criteria

- [ ] Two sessions exchanging messages show up in Agents with sender, role and time; the human's own topics show nothing of it
- [ ] A looping pair trips the breaker at the configured threshold, both see a typed refusal, the Agents topic shows the mute, and the mute survives a hub restart
- [ ] Changing a threshold in `config.toml` takes effect on the next hub start
- [ ] The journal file contains every event and audit line as JSON lines and is append-only across restarts
- [ ] Tests cover the breaker, persistence of mutes and the Agents view against a real hub
