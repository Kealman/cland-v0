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
updated: 2026-10-10T01:06:54.165Z
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
