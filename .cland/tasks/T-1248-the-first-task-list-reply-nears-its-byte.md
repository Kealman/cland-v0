---
id: T-1248
kind: task
title: The first task.list reply nears its byte cap as the live tracker grows
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-24T13:33:24.335Z
updated: 2026-10-24T13:33:24.335Z
---

## Summary

T-1204 measured the first `task.list` reply on the copied live tracker on 2026-10-24: 99,795 bytes against its 131,072-byte cap, with 31,277 bytes of headroom (about 27 open rows). At 50–100 new items a day, it hits the cap in about 4–8 days if the open share stays near 86/1,238, and within hours if new items stay open. The cap test will then go red. The guide says to page or trim the reply, not to raise the cap.

## Acceptance criteria

- [ ] C1. The first `task.list` reply stays under its cap independent of tracker size: it pages, or trims open rows to the fields the first paint needs, and the rest load on demand (test on the copied tracker plus a synthetic 5,000-item tracker).
- [ ] C2. Neovim and Web first paint and item counts are unchanged for the user; existing consumers of the reply are migrated in the same item (rule 19) (test).
