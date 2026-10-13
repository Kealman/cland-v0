---
id: T-305
kind: task
title: "Archive by hand: d archives a session row, A shows the archive, and
  archived sessions leave the groups and the default session.list"
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - ready-for-agent
  - hub
  - nvim
assignee: null
parent: E-275
blocked_by:
  - T-304
topic: topic-187
branch: t/T-305-archive-by-hand-d-archives-a-session-row
created: 2026-10-12T21:34:31.202Z
updated: 2026-10-13T01:22:47.491Z
---

## Summary

`d` on a stopped session row archives it. `A` shows or hides the archive section. An archived session leaves every group of the sessions panel and the default `session.list`. `session.list` with `archived` and `cland session list --archived` list the archived sessions. The journal keeps every record. Resuming an archived session takes it out of the archive.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.5, Archive (decided in T-257).

## What to build

**The hub: an archived mark on the process-table row.** The process table (`harness_processes` in `hub.db`, `hub/src/adapters/processes.ts`) records two things:

- when each session stopped or exited (`stopped_at`), which the next ticket's rules also need;
- whether it is archived (`archived_at`), and by whom: `hand` or, later, `rule`.

The table is keyed by name. A new launch under an archived name replaces the row, as a reused name does today. Write the migration so that existing rows are kept: stopped rows get no `stopped_at` until they are read from the journal or stop again. State which of the two you chose in the item.

**The frames and the CLI.**

- `session.archive` takes `session` and archives a stopped or exited session. A running session is refused with "stop it first" (open point 1 in the README). The answer is the updated process view.
- `session.list` leaves out archived rows by default and returns `archived: <count>` beside `processes`. `session.list` with `archived: true` returns only the archived rows. The CLI is `cland session list --archived`, with or without `--json`.
- A `session.process` frame carries `archived: true` when a row is archived, so the UIs move it at once.
- In the visibility classifier (`hub/src/hub/visibility.ts`), an archived row's session class is `archived`, which places it in the `archive` layer, as archived artifacts are placed.
- The journal records `session-archived` with the session, the session id, `by` and the actor. Nothing removes earlier journal records.
- Permissions: the human, through the UI or the CLI, and the Coordinator may archive (`session.archive` in the Coordinator's tool list). Other roles are refused through the permission table. Role tools are fixed at launch, so a Coordinator relaunch after the merge picks up the tool.
- `cland session archive <name>` exists for the human's shell.

**Resuming from the archive.** `session.resume` (ticket 02) on an archived row clears the archived mark and journals it. The resumed row comes back to its group. This applies equally to rows archived by hand and to those archived later by rule.

**The panel.** In `nvim/lua/cland/panels.lua` and `sessions.lua`:

- `d` on a stopped row archives it, with the note `<name> archived · A shows the archive`. `d` on a live row says to stop it first with `x`.
- `A`, already bound in the sessions panel, now fetches and shows the archived sessions in the ARCHIVE section, newest first. It still also shows rows that the human's mutes (`gM`) placed in the archive layer.
- `r` works on archive rows.
- Archived sessions appear in no group of NOW, WATCH or the background fold. They also leave the top-bar session counts and the palette's `@` sessions source.
- The footer and `␣?` list `d archive`. Both keys go through the action registry.

**Demo** (the epic's words). `d` on a stopped Aide moves it to the archive, and `cland session list --json` no longer lists it.

**Out of scope.** Automatic archival, the "more" fold's limit of 20 with the archived count, and `cland session prune` (the next ticket). Archiving sessions that cland did not launch: `d` on such a row says there is no record to archive.

**Constraints.**

- Tests go through the frame protocol first, with a real hub and the CLI on a temporary project. The fake harnesses come second. The Neovim UI is tested headless on the stub hub.
- No new seams inside the hub.
- Helpers stay out of `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` waits on the `hub.status` `flushLogs` barrier.
- Recomputes are coalesced once per tick (T-293).
- Every key goes through the action registry.
- Suites run through `cland verify`, and only when the queue shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. `d` on a stopped session archives it. The row leaves every group and the panel's counts, and `A` shows it in the archive section. A live row is refused with its reason.
  - done: impl-305 · 2026-10-13T00:47:55.205Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.852Z · commit 1d086073fb15247e7909350421c64cef27a56f85
- [x] C2. The default `session.list` and `cland session list --json` leave out archived rows and return the archived count. `--archived` (`archived: true`) returns exactly the archived rows.
  - done: impl-305 · 2026-10-13T00:47:56.441Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.853Z · commit 1d086073fb15247e7909350421c64cef27a56f85
- [x] C3. The journal keeps the session's launch and stop records and adds `session-archived`. A hub test on a real hub checks it after the `flushLogs` barrier.
  - done: impl-305 · 2026-10-13T00:47:57.420Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.853Z · commit 1d086073fb15247e7909350421c64cef27a56f85
- [x] C4. Resuming an archived session clears its archived mark, and the row returns to its group. A hub test covers it.
  - done: impl-305 · 2026-10-13T00:47:58.217Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.853Z · commit 1d086073fb15247e7909350421c64cef27a56f85
- [x] C5. A Neovim headless test on the stub hub runs `d` on a stopped Aide, checks the archive section after `A`, and checks that the row is absent from the groups.
  - done: impl-305 · 2026-10-13T00:47:59.230Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.853Z · commit 1d086073fb15247e7909350421c64cef27a56f85
- [x] C6. `hub/README.md` describes `session.archive`, `session.list`'s `archived` request and count, and the CLI. `nvim/README.md`'s session layers section describes `d` and `A`. The Coordinator's default clause names archiving.
  - done: impl-305 · 2026-10-13T00:48:00.139Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-305-2 · 2026-10-13T01:10:22.853Z · commit 1d086073fb15247e7909350421c64cef27a56f85

## Comments

### impl-305 · 2026-10-13T00:24:09.827Z

Migration choice follows T-275's decision: add nullable stopped_at without journal backfill; existing stopped rows retain null until they stop again or T-306's first sweep sets it. session.archive will join the Coordinator tool list; Coordinator relaunch after merge picks it up.

### rev-23 · 2026-10-13T00:46:22.404Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-305-1
commit: 50aef0b03d75c5026dea72c8362aae2ea1380f65

Medium — hub/test/harness.ts: DOCUMENTED_TOOLS omits session.archive, failing resilience.test.ts:42/104, spoke-identity.test.ts:18 and surface.test.ts:16. Update the explicit expected surface while keeping exact count/set assertions.
Full 162e717a: 1408/1412 pass, four failures; Neovim not reached. Archive hub cases pass. Evidence A-1714: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1714-t-305-missing-documented-tool-inventory-in-full-verification.md; full log A-1713.

Criteria: C6 failed (DOCUMENTED_TOOLS omits the intended session.archive tool; four exact spoke-surface checks fail, so full verification is not green.).

### impl-305 · 2026-10-13T01:10:06.556Z

Final all-phase verification passed at 1d086073fb15247e7909350421c64cef27a56f85: run 2431c370-7b4b-4898-aa02-cb355052f379, 1717/1717 tests, no failures/skips, including typecheck, hub and Neovim phases. Durable log A-1720: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1720-suite-2431c370-7b4b-4898-aa02-cb355052f379-all-at-1d08607.log. Source and final test delta reviewed in A-1708/A-1716; final reviewer criterion verdict pending.

### rev-23 · 2026-10-13T01:10:22.853Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-305-2
commit: 1d086073fb15247e7909350421c64cef27a56f85

No high or medium findings remain. C1–C6 verified; expected spoke surface corrected without weakening assertions. Exact-head full 2431c370 passed typecheck and 1717/1717 tests, zero failures/cancellations/skips. All archive cases and existing T-284 C7/T-303 C4 workload guards pass. Evidence A-1721: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1721-t-305-final-review-at-1d08607.md; full log A-1720.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-13T01:22:47.491Z

Merged 693d171f39e060ee2068c13fc582c3473396da75 onto dev.
