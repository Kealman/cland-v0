---
id: T-140
kind: task
title: "The other events and the hygiene: topic, usage and artifact events, subtree subjects, digest now, coalescing, the digest cap, lifetimes, the events' limit and cland hub subscriptions"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-139
topic: topic-57
branch: t/T-140-the-other-events-and-the-hygiene-topic
created: 2026-10-10T01:52:18.585Z
updated: 2026-10-10T04:42:45.266Z
---

## Parent

T-108 (A quiet Coordinator), slice 3 of 6. Spec §3.9 (Tools, Delivery, Hygiene, The human).

## What to build

The remaining events: `topic` (waiting for human, closed), `usage` (a threshold crossed, with the subscription naming its own cost or token threshold) and `artifact` (created, shared). Subjects add a role and a node of the item tree with its subtree. `digest = "now"` delivers at once by steering where the adapter can and falls back to the next turn elsewhere. Hygiene: equal events on one subject within 60 seconds coalesce into one with a count; a digest holds at most 10 events and summarises the rest ("and 12 more"); subscriptions end with their subscriber; a subject's death closes the subscription with a final event; events have their own limit, a key of its own in `[hygiene]`, and never count against the messages limit. `cland hub subscriptions` lists every session's subscriptions for the human; the inbox shows none of them; the journal records event deliveries.

## Acceptance criteria

- [ ] A burst of equal events within 60 seconds arrives as one line with a count; an eleventh event in a digest is summarised.
- [ ] `digest = "now"` steers on the adapters that can and falls back to the turn on the others, proven per fake harness.
- [ ] A subscriber's stop ends its subscriptions; a subject's death sends a final event and ends the subscription.
- [ ] Events never count against the 30-messages limit, and their own limit applies.
- [ ] `cland hub subscriptions` lists them; the inbox shows nothing of them; the journal records event deliveries.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### impl-140 · 2026-10-10T04:00:05.150Z

Implementing the remaining subscription events, subjects, digest modes and lifecycle/hygiene on top of T-139. Starting with protocol and queue/storage behavior; verification will cover the frame protocol and fake adapters.

### impl-140 · 2026-10-10T04:17:52.843Z

Implementation committed and pushed to local origin at bd1ecd62e6204f72405c69c6316ae1995d0d1a39 (copied from git log -1). Typecheck and diff checks pass. Focused frame/MCP/CLI tests cover immutable per-recipient coalescing/caps across restart, the 60-second boundary, threshold persistence and deduplication, durable independent rate windows, final-event cleanup, subtree session facts and all three fake adapters. Root npm test is now running through the package's machine lock with Node v24.21.0 first on PATH.

### rev-67 · 2026-10-10T04:24:20.615Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-140-1
commit: bd1ecd62e6204f72405c69c6316ae1995d0d1a39

High: 0. Medium: 5. Low: 0.

Standards:
Medium — hub/src/hub/store.ts:502: deferred event publication can throw after commit into createArtifact's file-removal catch; actual shared-creation callback reopening an archived artifact reproduced an exception with the new index/post committed. Isolate post-commit faults (hub/README.md:983).
Medium — hub/src/hub/core.ts:358: separate turn/now recording and publication lets a first-group event logger fault prevent recording the second group; native probe retained only the turn recipient's event. Record full fan-out before publication and isolate faults.

Spec:
Medium — hub/src/hub/core.ts:1505: deleting an open topic leaves exact subscriptions and sends no final event; native probe returned topic null, one subscription and zero events. §3.9 terminal-subject rule.
Medium — hub/src/adapters/sessions.ts:102: restart seeds stopped/exited process rows without reconciling owned/exact subscription cleanup or final events; durable status precedes listener publication, so a crash leaves both subscriptions indefinitely. Native cold-start probe confirms it. §3.9 lifetimes and restart requirement.
Medium — hub/src/hub/core.ts:303 / hub/src/hub/topics.ts:84: descendant removal publishes after the tracker has lost its parent, so current ancestry excludes ancestor subtree recipients; native probe delivered the removed final fact only to the exact recipient. Preserve pre-removal ancestry for terminal fan-out.

Full two-axis review and reproducible Node v24.21.0 in-memory probes: A-417, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-417-t-140-review-partial-publication-and-terminal-subscription-gaps-at-bd1ecd6.md.

Bound recipient counts/caps, threshold/rate persistence, ordinary queue steering/fallback, frame/MCP/CLI and metadata/config paths reviewed. Exact instance keys agree: event_limit_max = 120; event_limit_window_minutes = 10. No suite run or file edits; suite validation remains with Implementer. Artifact byte removal is established from the existing cleanup catch, not a real file mutation. Standards: 2 medium; Spec: 3 medium.

### impl-140 · 2026-10-10T04:32:06.585Z

Addressed A-417 publication and terminal classes in the working delta. Event fan-out/coalescing and its allowance now share one transaction before isolated post-commit observer/transport/log callbacks; real artifact creation and SQLite-abort regressions pass. Terminal publication/cleanup is shared by session stop/restart, item close/removal/reparenting, topic close/deletion, with pre-change tracker ancestry and durable stopped-session checkpoints. Targeted files and typecheck are running; queued root suite was canceled before lock acquisition as directed. Rebase waits for T-141 to land.

### impl-140 · 2026-10-10T04:35:01.194Z

A-417 correction delta committed/pushed at dfbd7d9a584038f83b729591ede1f4b018b237d2, copied from git log -1. Durable artifact A-421 describes all five fixes and targeted evidence. Typecheck/diff checks pass; artifact lifecycle 18/18, subscriptions 14/14, all hygiene cases pass across the broad run plus corrective subtree/restart run (an idle-source-specific test wait was fixed). Awaiting T-141 merge for the one rebase and final root suite; no full suite started.

### rev-67 · 2026-10-10T04:38:28.855Z

verdict: review
result: not clear
by: rev-67 [reviewer]
run: rev-67-140-2
commit: dfbd7d9a584038f83b729591ede1f4b018b237d2

High: 0. Medium: 1. Low: 0.

Spec:
Medium — hub/src/adapters/sessions.ts:102: terminal recovery runs before eventSteering is installed at :104, so a persisted digest now subscription for a running Codex/OpenCode watcher records the recovered final event as turn. Native cold-start probe: subscriptions [], final event digest turn, deliverable pending 0. Initialize capabilities before reconciliation; §3.9 requires now delivery where steering is supported.

All five A-417 findings are resolved. Reran native memory probes: both mode groups survive logger faults; actual reopened-artifact registration returns after commit; deletion closes exact subscriptions with final fact; startup cleanup completes; removal reaches former ancestor using new previousAncestry. Standards: 0 remaining. Spec: 1 medium.

Now-delivery retry check with production Core/Store/Sessions and deferred adapter admission: reconnects during injection, duplicate acks and flushes before/after confirmation produce one admission, one transport, injected stage and zero uninjected rows. No added duplicate admission found. Spoke ID dedup and existing uncertain/manual retry policy remain intact.

This covers the full item at dfbd7d9, carrying unchanged A-417 checks forward. No suite or file edits; targeted suite evidence in A-421 read only. Upcoming T-141 rebase excluded.

Evidence and runnable probes: A-422, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-422-t-140-full-item-re-review-at-dfbd7d9-cold-recovery-downgrades-digest-now.md.

### impl-140 · 2026-10-10T04:41:06.487Z

A-422 startup ordering correction committed/pushed at cb875074e4c9be5e2f708f5e439ae2c9d676aeed, copied from git log -1. Project factory now installs core callbacks/steering and all three adapters before terminal-row/launch recovery; resume/watch follows. Cold frame/fake-Codex regression reproduced the prior held event and now passes immediate injection plus one consumed final input across two restarts. Typecheck/diff checks pass. Durable artifact posted in topic-57; rebase and root suite remain held pending T-141 merge.

### rev-67 · 2026-10-10T04:42:45.224Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-140-3
commit: cb875074e4c9be5e2f708f5e439ae2c9d676aeed

Clear — high 0, medium 0, low 0. Covers the full item at cb87507; unchanged A-417/A-422 checks carried forward.

A-422 is resolved: hub/src/adapters/sessions.ts:103 installs steering/callbacks before recovery; hub/src/adapters/index.ts:64 reconciles terminal rows after all three adapters are registered; daemon resume follows. Native cold probe now records digest now with one pending row, and repeated recovery creates one final event.

Immediate retry probe remains one admission/one transport, injected stage, zero uninjected rows under reconnects during injection, duplicate acks and flushes before/after confirmation. All five original A-417 findings remain resolved; publication transactions, post-commit isolation, shared terminal handling and ancestry metadata unchanged.

Standards: 0 remaining findings. Spec: 0 remaining findings. Native memory probes under Node v24.21.0 only; fake-Codex regression and A-423 evidence read, no suite or file edits. Future T-141 rebase excluded.

Evidence A-424: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-424-t-140-full-item-clear-review-at-cb87507.md.
