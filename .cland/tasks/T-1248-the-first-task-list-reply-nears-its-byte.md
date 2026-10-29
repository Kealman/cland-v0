---
id: T-1248
kind: task
title: The first task.list reply nears its byte cap as the live tracker grows
state: open
status: in progress
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
updated: 2026-10-29T18:08:46.302Z
---

## Summary

T-1204 measured the first `task.list` reply on the copied live tracker on 2026-10-24: 99,795 bytes against its 131,072-byte cap, with 31,277 bytes of headroom (about 27 open rows). At 50–100 new items a day, it hits the cap in about 4–8 days if the open share stays near 86/1,238, and within hours if new items stay open. The cap test will then go red. The guide says to page or trim the reply, not to raise the cap.

## Acceptance criteria

- [x] C1. The first `task.list` reply stays under its cap independent of tracker size: it pages, or trims open rows to the fields the first paint needs, and the rest load on demand (test on the copied tracker plus a synthetic 5,000-item tracker).
  - done: impl-1248 · 2026-10-29T17:08:20.011Z
- [ ] C2. Neovim and Web first paint and item counts are unchanged for the user; existing consumers of the reply are migrated in the same item (rule 19) (test).
  - failed: rev-34 [reviewer] · 2026-10-29T18:06:40.742Z · note Fixed initial deadline resets on every full traversal and discards valid late pages, so consistently slow reads can prevent startup indefinitely.

## Comments

### impl-1248 · 2026-10-29T17:00:35.256Z

Rule 20 inventory before changes: production task.list owners hub/src/tracker/{requests,tracker}.ts; independently restated request shared/wire/index.ts; tool schema hub/src/spoke/task-tools.ts; CLI hub/src/cli/task.ts; Telegram/Discord release readers; Neovim init.lua startup and closed pages; Web connection.ts uses snapshot domain items plus explicit by-id/closed requests. Tests in hub/test (tracker-summary/component/hierarchy, startup-replies-fixture/scale, connection-snapshot, task-card, request guards and authority); nvim stub-hub.ts, recorded protocol fixtures, startup-budget-support, explorer/shell/plan components and native shell/scenarios; web tree/board/plan/item tests. QA briefs and shipped onboarding/implement/qa examples request legacy lists/counts. Plan: additive opt-in paged:true for open summary requests, byte-bounded pages and numeric cursor; retain every legacy reply unchanged. Neovim startup opts in and accumulates pages before applying buffered events; Web snapshot path, CLI/tool full lists, remote readers, persisted records and historical QA/recorded examples unaffected. Startup probes migrate to paged traversal. Full path inventory available in forthcoming artifact.

### rev-34 · 2026-10-29T17:59:10.340Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1248-source1
commit: c8ad88ddb1bff3292880f6066e47c71ae8d249c0
scope: full
findings: [{"severity":"medium","text":"M1: Pagination replays per-page journals without traversal-wide validity or size bounds. A later-page Client:snapshot overflow discards earlier-page-row updates while retrying only that page, so final installation can overwrite live state with stale collected rows. Concatenating successful page journals also bypasses the existing 2048-event/2MiB memory bounds. Retain a bounded coherent traversal journal or invalidate/restart the full traversal; add small-limit controls for later-page overflow/earlier-row change and aggregate overflow across individually valid pages.","file":"nvim/lua/cland/init.lua","line":278},{"severity":"medium","text":"M2: New T4 startup-task-pages-soak entry precedes startup-smoke, violating sorted path order. Its index Notes row is also labelled Guide, but unchanged test-docs line27 requires the exact Notes label. Reproduce owning guards, move only the new row after startup-smoke and change the owned label to Notes.","file":"hub/test/tiers.json","line":487}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13899: full source not clear. M1 coherent bounded traversal journal/restart and M2 sorted T4 path/exact Notes label. Hub byte pagination/legacy/Web/CLI compatibility source-consistent; C1 runtime pending. Preserve all existing byte, membership and client assertions, add injected-small-limit invalidation/aggregate controls, then fresh pushed-head review before verification. No Reviewer execution.

Criteria: C2 failed (Later-page journal invalidation can lose earlier-page updates; accumulated replay also lacks a traversal-wide bound.).

### impl-1248 · 2026-10-29T18:01:01.505Z

Source1 M1 fix contract inventory before edits: local Neovim Client:snapshot callers are init.lua (all startup/closed reads), marks.lua, client request tests and shell-component regressions; API code hub.lua alone owns journal capture/retry/disconnect. Add optional per-call max_events/max_bytes and invalidate_on_overflow plus a fourth callback metadata value (bytes/invalidated), ignored by all existing callers. Only paged refresh_items opts in; normal snapshot retry, deadlines, callback arguments 1–3, requests and wire shapes remain unchanged. Tests cover old callers through shell-component and explorer cases; no CLI/Web/hub wire/persisted record/QA brief migration required. Whole traversal shares the existing 2048-event/2MiB defaults, passing remaining capacity to each page. Page overflow invalidates all collected rows and schedules a fresh first page. Per-page and aggregate event/byte controls are red at source1, while original 22 explorer cases remain green. M2 owners reproduced unchanged: lint-tiers reports test tier map is not sorted by path (startup-smoke before startup-task-pages-soak); test-docs reports each per-test document must be indexed exactly once.

### impl-1248 · 2026-10-29T18:02:08.539Z

Complete local snapshot consumer search additionally includes topic_view.lua, artifacts.lua, rulebook.lua and events.lua; these keep legacy opts and ignore the additive fourth callback metadata. Source1 investigation also identified the equivalent later-page timeout retry gap: a newer attempt may drop an event captured only by the earlier attempt even without overflow. Paged calls will invalidate on every retry (deadline or overflow), retaining ordinary per-read retries for all other callers. This also keeps paged traversals to one active journal, so replay plus active-page events share one aggregate bound.

### rev-34 · 2026-10-29T18:06:40.742Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1248-source2
commit: 8444d355fdac50bcced2f9d9e297cfb87ab997d8
scope: full
findings: [{"severity":"medium","text":"M3: invalidate_on_retry discards each valid late answer at the deadline, while complete traversal restart creates a new snapshot with its delay reset to SNAPSHOT_TIMEOUT_MS. Repeated healthy page latency above that initial bound can therefore prevent startup forever, losing the existing oldest-answer/backoff liveness behavior. Retain coherent late completion or traversal-level bounded retry/backoff; add small-timeout delayed-first/later-page controls across multiple deadlines, preserving aggregate journal/request bounds.","file":"nvim/lua/cland/hub.lua","line":226}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13909: M1 coherent bounded replay and M2 owning metadata resolved. Sole new M3 is late-answer liveness: invalidation mode drops pending answer and resets retry delay each traversal. Preserve aggregate/full-traversal correctness while allowing delayed valid first/later pages to complete; add deterministic short-timeout repeated-delay controls. Local evidence only, C1 runtime unverified, no Reviewer workload.

Criteria: C2 failed (Fixed initial deadline resets on every full traversal and discards valid late pages, so consistently slow reads can prevent startup indefinitely.).

### impl-1248 · 2026-10-29T18:08:46.302Z

M3 design update before edits: replace the paged retry-invalidation option with coherent_retry. One shared event capture spans a page's oldest/newest retry attempts; capture each pushed event once, keep the existing oldest-valid answer and bounded exponential backoff, and report the shared capture's byte count on completion. Overflow alone invalidates the entire traversal. Existing snapshot callers do not opt in, retaining their original independent journals. No new consumers or wire fields beyond the local snapshot inventory already recorded. New regression holds original first/later page replies beyond multiple retry rounds, changes an earlier-page row, asserts at most two pending attempts/one shared capture, then observes complete unique final rows from late original replies.
