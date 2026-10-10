---
id: T-122
kind: task
title: "Rank: a sparse rank field on tasks and epics, cland task rank, lists sorted by rank then id, the Coordinator's next-item rule; the high label retires"
state: open
status: in progress
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-118
topic: topic-49
branch: t/T-122-rank-a-sparse-rank-field-on-tasks-and
created: 2026-10-09T21:56:37.730Z
updated: 2026-10-10T01:21:34.779Z
---

## Parent

T-107 (v0.1 release and status), slice 5 of 6. Spec §3.2 (Rank orders siblings).

## What to build

A task or an epic carries `rank`, a sparse integer such as 10, 20 and 30, that orders it among the items with the same parent. `cland task rank T-n --top`, `--before T-m` and `--after T-m`, and the matching MCP tool, renumber only what they must. Every list sorts by rank, then id, in the CLI, the MCP tools and the `task` events. The Coordinator clause reads: the next item is the lowest-ranked unblocked `planned` task in the current release. The current release is the open release with the lowest version. The `high` label retires from the tracker's vocabulary and the clauses. Items that carry it are not rewritten by hand: the ticket ranks them to the top among their siblings once, through the hub, and reports what it moved.

## Acceptance criteria

- [ ] `cland task rank T-n --top` makes T-n first among its siblings; `--before` and `--after` place it relative to a sibling; only the needed items get new ranks, which a test with a dense rank range proves.
- [ ] Ranking against an item with another parent is refused.
- [ ] `cland task list`, the MCP `task.list` and the items in `task` events are ordered by rank, then id.
- [ ] The Coordinator clause in the default roles states the next-item rule; the `high` label is gone from `docs/agents/triage-labels.md` and the clauses. List the exact `.cland/roles.toml` lines in your report.
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` document rank.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Rank writes ride the tracker's single queue (T-77). It can run in parallel with slices 2 to 4, rebasing once on the item parser.

## Comments

### impl-122 · 2026-10-10T00:58:29.414Z

Implementing rank through the existing hub protocol/CLI seam prescribed by T-107, including dense minimal renumbering, parent refusal, shared ordering and queue checks. Post-restart high migration will use the hub only.

### impl-122 · 2026-10-10T01:06:54.165Z

Sparse, dense and configured-level moves now pass targeted protocol/CLI tests; sibling rank/parent changes and revoked grants at a held native write refuse stale plans. Added shared rank-order fixture and idempotent CLI high migration. Live high labels currently belong to closed T-67 (parent T-20) and T-68 (parent T-19); migration remains pending merge/restart.

### rev-65 · 2026-10-10T01:21:34.779Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-122-1
commit: 2a37178e9f4b39974d53c5b982e310d66d580c09

High: 0. Medium: 4. Low: 0.

Medium — hub/src/tracker/tracker.ts:1153–1157/:1179: sibling fingerprint/write setup and failure formatting escape resumed scopes after file awaits, so request-budget accounting misses synchronous work.

Medium — hub/src/tracker/rank.ts:13–40: cubic candidate-window search blocks request handling; the pinned pure 500 equal-sibling middle insertion took about 475 ms before I/O. A-324 records the cost; Coordinator accepted a linear outward scan and a count/time regression.

Medium — hub/src/tracker/rank.ts:36–41: with T-1…T-4 ranked zero, moving T-1 after T-2 rewrites T-2=-19 and T-1=-9, although changing T-2 alone while preserving T-1=0 gives the requested order. Preserve the moved rank when its rewrite is unnecessary.

Medium — hub/bin/migrate-high-rank.ts:26–29: multiple high siblings are processed without the revised preflight refusal; rank success followed by label-removal failure can change their intended order on retry. Count every labelled item, open or closed, and refuse multi-high parents before any mutation, as Coordinator decided in 169de645.

Actual pinned mutation probes pass dense neighbor-first writes, body/comment preservation, final-only siblings events, rank/parent/grant race refusals with temp cleanup, and scan draining. Shared comparator/fixture, resolved id×10 ranks, configured rankable kinds and next-item clause are otherwise clear. Migration/config remain post-merge Coordinator follow-ups; exact roles.toml clause and tools-array changes are in A-326. No suite or edits.

Full item against 568520b. Standards: 2 medium. Spec: 2 medium. Evidence A-326: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-326-t-122-full-review-of-2a37178-ranking-and-migration-findings.md. Combined fix head is pending.
