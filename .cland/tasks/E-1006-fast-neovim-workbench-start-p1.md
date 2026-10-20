---
id: E-1006
kind: epic
title: Fast Neovim workbench start (P1)
state: open
labels:
  - epic
  - v0.2
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:00:31.060Z
updated: 2026-10-20T17:06:48.385Z
---

## Summary

P1 from the human, 2026-10-20 16:55Z: the Neovim workbench takes many minutes to start and slows the whole Mac while it loads. The explorer shows "loading the items…" for more than 5 minutes. The header says "no coordinator" and "sessions 0" while the hub is connected and holds the Coordinator and six sessions. The human: «запуск должен быть быстрым и если надо иметь ленивую подгрузку, но не так что десятками минут ждать», «весь мак жестко тормозит пока воркбенч грузится».

## Notes

These are cland-impl's measurements at 16:57–17:00Z on the live project (1,005 items):
- Neovim re-polls `hub.status`, `task.list`, `topic.history(200)`, `events.list(200)`, `session.list`, `artifact.list`, `rule.list` and `account.list` about every 30 s, in a loop that never settles.
- `task.list` carries full bodies: 1,830,013 bytes.
- The `nvim --embed` process sits at about 58 % CPU and its RSS grows past 1.6 GB.
- Materialising each poll swings the hub between 80 MB and 912 MB RSS at 100 % CPU, and its `hub.status` answers take 1.4–2.7 s.
- `.cland/tasks` holds 6,029 files, of which 5,026 are `.conflict` captures. Almost every tracker write adds another, including plain `task create` and `task edit`. That churn keeps Spotlight and iCloud indexers busy.

The epic takes priority over every other v0.2 launch and over E-412 stage 2.

## Definition of done

- [ ] C1. On a copy of the live tracker (about 1,000 items), the Neovim workbench shows the open items, the sessions and the Coordinator within 3 s of the hub connection, measured on the human's Mac and recorded as local evidence.
- [ ] C2. With the workbench idle for 10 minutes, no full re-read of the item list or any other whole-state list happens, and the hub's CPU stays near idle (local evidence).
- [ ] C3. A Neovim smoke test with a 1,000-item fixture tracker fails when startup exceeds its budget or when the explorer's first payload exceeds its byte budget.
- [ ] C4. Tracker writes from the hub and the CLI create no `.conflict` capture unless a real concurrent edit happened, and old captures are pruned by a documented retention rule (with T-452).

## Plan

```yaml
stages:
  - name: summaries, settling and quiet writes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1007
      - - T-1008
      - - T-1009
        - T-452
  - name: the startup budget
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1010
```

## Comments

### coord · 2026-10-20T17:06:48.385Z

Crew GUI rule (Coordinator, 2026-10-20 17:06Z): Neovim or browser checks for this epic run headless (nvim --headless or --embed under a scratch HOME); no GUI process starts from a crew session on the human's Mac. Live measurement on the human's own workbench is T-1010 C4 and the epic's C1, run by the Coordinator or with the human.
