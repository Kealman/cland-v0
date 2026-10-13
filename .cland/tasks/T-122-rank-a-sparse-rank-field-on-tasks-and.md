---
id: T-122
kind: task
title: "Rank: a sparse rank field on tasks and epics, cland task rank, lists
  sorted by rank then id, the Coordinator's next-item rule; the high label
  retires"
state: closed
status: done
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: E-107
blocked_by:
  - T-118
topic: topic-49
branch: t/T-122-rank-a-sparse-rank-field-on-tasks-and
created: 2026-10-09T21:56:37.730Z
updated: 2026-10-10T02:17:43.083Z
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

### impl-122 · 2026-10-10T01:27:55.698Z

Rebased once onto origin/dev after T-121 landed; task.hold and task.rank surfaces coexist. Head c7b17456cee33306b08f78b7e657024ff9a15c4f from git log -1. Rebase checks: rank 16/16, levels 14/14, ready 23/23, root typecheck passed. Both internal rebase-delta reviews clear. Root suite queued under the machine lock. A-327 records exact instance roles.toml old/new lines and the post-merge, post-restart high-label migration command.

### rev-65 · 2026-10-10T01:29:00.634Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-122-2
commit: c7b17456cee33306b08f78b7e657024ff9a15c4f

High: 0. Medium: 1. Low: 0.

Medium — hub/src/tracker/tracker.ts:1238 (also :1261, :1264, :1267, :1272): planning, fingerprinting, write setup and dispatch split one post-await continuation into separate resumed measurements; post-write update and next dispatch split likewise. Their combined cost can exceed the request budget without being recorded. Actual pinned rank + RequestGuard with simulated 150 ms planning and 150 ms fingerprinting logs zero slow requests for a continuous 300 ms stretch. Consolidate each continuation into one scope through its next I/O dispatch (A-96/README).

The three other baseline findings are resolved: exact A-324 500-neighbor cost is now about 0.2 ms; the 500-total tie changes the proven minimum of 249 neighbors and preserves the moved rank; migration refuses multiple labelled siblings in all states before writing and retries failed label removal without another rank write. Actual pinned mutation/race/read-drain probes pass on c7b1745. Rank and readiness share the queue without a reentrant wait; hold/rank rebase resolutions preserve both surfaces. No suite or edits.

Full item against 0da2b6e, including the 5915e13 fixes. Standards: 1 medium. Spec: 0 findings. Evidence A-332: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-332-t-122-full-review-of-c7b1745-residual-split-request-timing.md.

### rev-65 · 2026-10-10T01:35:52.353Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-122-3
commit: a8c3e2a060f4de82a710f25a32728a9a31da9ef7

High: 0. Medium: 0. Low: 0.

A-332 timing finding resolved at hub/src/tracker/tracker.ts:1240/:1275: planning through first dispatch and each post-write update through next dispatch share continuous resumed scopes. Exact A-332 probe and the post-write/next-dispatch probe each record one simulated 300 ms slow request here; c7b1745 records none. No remaining split adjacent callbacks found on the reviewed rank path.

Actual pinned dense writes, rank/parent/grant race refusals and read draining pass. Later-dispatch failure preserves the committed neighbor, preserves the moved file, reports the exact committed prefix and emits no final siblings event. Full-item conclusions from A-332 remain clear: shared ordering, configured kinds, linear planner/minimum 249-neighbor tie, moved-rank preservation, singleton migration and rank/ready queue integration. Coordinator instance configuration/restart/migration follow-ups remain as documented in A-326/A-327. No suite or edits.

Full item against 0da2b6e. Standards: 0 findings. Spec: 0 findings. Evidence A-334: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-334-t-122-full-review-of-a8c3e2a-clear.md.

### impl-122 · 2026-10-10T01:50:02.853Z

Final head a8c3e2a060f4de82a710f25a32728a9a31da9ef7 committed and pushed to local origin; worktree clean. Root typecheck passed. One complete root npm test on this head passed: hub 811/811 and Neovim 139/139, zero failures. Timing regressions verify a single300 ms resumed slow request for each continuous150+150 ms stretch. Final internal Standards/Spec reviews clear. A-340 holds the full-suite log; A-341 holds final implementation locations, exact instance role-line changes and migration command. Instance configuration and live high migration remain Coordinator steps after merge and hub restart.

### coord · 2026-10-10T01:50:10.872Z

Merged 140f05b8c96a6bfeb6d46badbfb16194ca44dfe8 onto dev.

### coord · 2026-10-10T01:50:30.201Z

Merged by the Coordinator through `cland merge T-122`, after `cland push`: squash 140f05b on dev.
Gate: review rev-65-122-3 clear on a8c3e2a. Earlier rounds:
- rev-65-122-1 (A-326, A-324): timing, a cubic dense plan, an unnecessary write to the moved item, and multi-high migration;
- rev-65-122-2 (A-332): continuous work split across separate timing scopes.
Decisions:
- rank applies to tasks and to the configured levels below levels[0];
- a missing rank is the implicit id × 10, with no rewrite;
- events carry the resolved rank, and only the final rank event carries the ordered `siblings`, with no full snapshot;
- the planner is linear (a 500-way tie changes 249 neighbours, the minimum);
- the high migration refuses more than one high item per parent, open or closed, and uses no journal.
Full suite on a8c3e2a: 811 hub and 139 Neovim, exit 0 (A-340); handover A-341.
Project instance: the Coordinator next-item clause and the `task.rank` grant are committed next. The migration `node hub/bin/migrate-high-rank.ts` runs after the next hub restart, for T-67 under T-20 and T-68 under T-19, and its result is recorded here.

### coord · 2026-10-10T02:17:43.083Z

Migration run after the restart (hub pid 95981, dev b693783 and later): `node hub/bin/migrate-high-rank.ts` moved T-67 to the top of T-20 (rank 670 to 520) and T-68 to the top of T-19 (680 to 200), each a single write, and retired both `high` labels. A rerun reported `{"moved":[],"retired":[]}`, and `task list --label high` is empty. Committed and pushed as d818701.
