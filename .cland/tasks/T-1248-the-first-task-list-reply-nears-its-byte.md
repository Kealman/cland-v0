---
id: T-1248
kind: task
title: The first task.list reply nears its byte cap as the live tracker grows
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1200
branch: t/T-1248-the-first-task-list-reply-nears-its-byte
created: 2026-10-24T13:33:24.335Z
updated: 2026-10-29T17:09:32.261Z
---

## Summary

T-1204 measured the first `task.list` reply on the copied live tracker on 2026-10-24: 99,795 bytes against its 131,072-byte cap, with 31,277 bytes of headroom (about 27 open rows). At 50–100 new items a day, it hits the cap in about 4–8 days if the open share stays near 86/1,238, and within hours if new items stay open. The cap test will then go red. The guide says to page or trim the reply, not to raise the cap.

## Acceptance criteria

- [x] C1. The first `task.list` reply stays under its cap independent of tracker size: it pages, or trims open rows to the fields the first paint needs, and the rest load on demand (test on the copied tracker plus a synthetic 5,000-item tracker).
  - done: impl-1248 · 2026-10-29T17:08:20.011Z
- [x] C2. Neovim and Web first paint and item counts are unchanged for the user; existing consumers of the reply are migrated in the same item (rule 19) (test).
  - done: impl-1248 · 2026-10-29T17:08:20.295Z

## Comments

### impl-1248 · 2026-10-29T17:00:35.256Z

Rule 20 inventory before changes: production task.list owners hub/src/tracker/{requests,tracker}.ts; independently restated request shared/wire/index.ts; tool schema hub/src/spoke/task-tools.ts; CLI hub/src/cli/task.ts; Telegram/Discord release readers; Neovim init.lua startup and closed pages; Web connection.ts uses snapshot domain items plus explicit by-id/closed requests. Tests in hub/test (tracker-summary/component/hierarchy, startup-replies-fixture/scale, connection-snapshot, task-card, request guards and authority); nvim stub-hub.ts, recorded protocol fixtures, startup-budget-support, explorer/shell/plan components and native shell/scenarios; web tree/board/plan/item tests. QA briefs and shipped onboarding/implement/qa examples request legacy lists/counts. Plan: additive opt-in paged:true for open summary requests, byte-bounded pages and numeric cursor; retain every legacy reply unchanged. Neovim startup opts in and accumulates pages before applying buffered events; Web snapshot path, CLI/tool full lists, remote readers, persisted records and historical QA/recorded examples unaffected. Startup probes migrate to paged traversal. Full path inventory available in forthcoming artifact.
