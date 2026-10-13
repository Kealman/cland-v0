---
id: T-330
kind: task
title: "The card's fields: task.list and task.view carry the closing time, the criteria counts and a task's latest cland verify result, with the closing times backfilled by cland task migrate"
state: closed
status: done
criterion_seq: 8
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by:
  - T-328
topic: topic-208
branch: t/T-330-the-card-s-fields-task-list-and-task
created: 2026-10-13T14:04:09.431Z
updated: 2026-10-13T17:28:30.781Z
closed: 2026-10-13T17:28:30.188Z
---

## Summary

The hub gives each row what the card needs without a `task.view` per row. A `closed` time in frontmatter is written by close and merge and cleared by reopen. `task.list` summaries carry the criteria counts and, for a task, its latest `cland verify` result. The items closed before the field existed get their time once through `cland task migrate`.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.9 (the prototype's answers: the hub's fields). Decided in T-244, named by the prototype T-262 (`nvim/EXPLORER-PROTOTYPE.md` on `prototype/explorer`, points 13 to 15). ADR 0002: `closed` lives in the item file. GLOSSARY: Criterion, Card.

## What to build

**`closed` in frontmatter.** `Frontmatter` in `hub/src/tracker/item.ts` gains `closed?: string`, an ISO time.

- `parseItem` reads it and refuses a malformed time. `serializeItem` writes it after `updated`.
- Every hub write that closes an item sets it: `close` and `finishMerge` in `hub/src/tracker/tracker.ts`, and `edit` with `state: closed` or `status: done`. A close of a container sets it too.
- A reopen clears it.
- A hand edit that closes an item without `closed` keeps none. The file is the source of truth (ADR 0002).
- The index stores it in a new `tracker_items` column (`hub/src/tracker/index-db.ts`), added by the existing `alter table` upgrade path. `IndexedItem` carries it. `IndexDb.closedAt` reads it first and keeps its current fallbacks after it, so the archive rule in `hub/src/adapters/sessions.ts` gets the better time.

**The backfill.** `cland task migrate` gains one more part, `closed`, with its dry run.

- `planMigration` in `hub/src/tracker/migrate.ts` stays pure. It takes a map from item number to candidate closing times, with their source.
- `migrateOffline` in `hub/src/tracker/offline-migrate.ts` builds the map. The sources, in order: the landing receipt's `merged_at` (`tracker_merges`), the latest journal `task-written` record with op `close` (`readJournal` in `hub/src/hub/journal.ts`), then the committer time of the receipt's commit when it resolves in git.
- A closed item with no source is listed under `unresolved` and gets no `closed`. An item that already has one is skipped, so a rerun plans nothing.
- `Tracker.migrate` patches only the `closed` line, as it patches the other frontmatter fields. The dry run prints `closed T-<n>: <time> (receipt | journal | commit)`.

**Criteria counts.** `task.list` summaries carry `criteria: { total, done, verified, stale, failed }`.

- The counts follow the rule `nvim/lua/cland/criteria.lua` draws today: failed before verified, verified before stale, stale before done. A verified mark is current when its commit is the branch tip, as `annotateCriteria` in `hub/src/tracker/criteria.ts` decides. A landed task uses its receipt's tip. An epic uses `dev`.
- `IndexDb.put` already parses the criteria for `criteria_ids`. It stores the marks' summary too (done, failed and the verified commits per criterion), so a list reads no item file. The summary resolves `current` against the in-memory tip from `hub/src/tracker/freshness.ts`.
- `task.view` keeps its full `criteria` and adds the same counts.

**The latest verify result.** A task's summary and view carry `verify`: the latest `cland verify` job whose `item` is the task or whose `branch` is the task's branch.

- Its fields are the job id, its state, its result (`passed`, `failed`, `cancelled`, or null while queued or running), its head, its finish time, its artifact, and `cached` when the run was a cache hit.
- `Suites` in `hub/src/hub/suites.ts` keeps a map from item and branch to the latest job, updated where it saves a job. The tracker reads it through a lookup the dispatcher (`hub/src/hub/dispatch.ts`) passes at startup, as `useSessionIdentity` wires the core. This is production wiring, not a test seam.
- When a job for a task changes state, the dispatcher asks the tracker to announce that task once. The `task` event carries the new summary and no event text, so it updates clients and delivers nothing to sessions. The requester already gets the suite report.
- The announcement is coalesced once per tick. It reads one summary, never `this.list()`.

**Closing an epic closes its stages.** T-328 does it. This ticket only checks that the card's fields agree with it.

**The CLI.** `cland task list --json` carries the three fields. `cland task view` prints a `closed` line, the counts and a `verify` line.

**Docs.**

- `hub/README.md`: the tracker section names `closed`, `criteria` and `verify` in view, list and events, and the `closed` part of `cland task migrate`.
- `docs/agents/issue-tracker.md` and its template: the `closed` field and the backfill.

**Dogfooding.** The live tracker needs the backfill once after this merges. `cland task migrate` runs with the hub stopped, so it rides a restart by the stand-in on a green integrated run and an empty queue (D24). The dry run is kept as an artifact, then the run, a commit on `dev` and `cland push`.

**Demo** (the epic's words, with the release's new prefix). `cland task list --under R-228 --json` gives each task its `closed`, `criteria` and `verify` without a `task view`.

**Out of scope.** The card that shows these fields (E-276). Switching the items panel's criteria fraction from `item_view.get` to the summary (E-276 reads the summary). `size`, `regression_of` and the verdict scope (tickets 04 and 05).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second. Suite jobs in tests use the fake runner the existing suite tests use (`hub/test/suite.test.ts`).
- The migration planner is pure and has its own unit tests beside `hub/test/migrate-plan.test.ts`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- The verify announcement is coalesced once per tick (T-293). A list reads no item file. No synchronous full tracker hydration per event (the T-321 lesson). A query-count regression pins both with many unrelated items.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. Item tests: `closed` parses, round-trips and refuses a malformed time. A hub test on a temporary project shows it written by `cland task close`, by `cland merge` and by an edit to `done`, and cleared by a reopen.
  - done: impl-330 · 2026-10-13T16:41:53.374Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C2. `task.list`, `task.view` and the `task` event carry `closed` from the index. `IndexDb.closedAt` returns it ahead of its fallbacks.
  - done: impl-330 · 2026-10-13T16:36:40.076Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C3. Planner unit tests cover the `closed` part: each source in order, an unresolved item, an item already carrying `closed`, and an empty plan on a rerun. A hub test runs `cland task migrate --dry-run` and the migration on a temporary project with receipts and journal records, and checks that only `closed` lines changed.
  - done: impl-330 · 2026-10-13T16:36:40.782Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C4. A hub test with a task holding done, current verified, stale and failed criteria shows the same counts in `task.list` as `task.view`'s criteria give. A list over 64 items reads no item file.
  - done: impl-330 · 2026-10-13T17:05:38.879Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C5. A verify job finishing for a task's branch sets `verify` in `task.list` and sends one `task` event to a subscribed UI with no event text. A subscribed session receives no delivery for it.
  - done: impl-330 · 2026-10-13T16:36:42.130Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C6. A query-count regression with 64 unrelated items: one verify job finishing stays under a fixed query bound and calls no full list.
  - done: impl-330 · 2026-10-13T17:05:40.433Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.578Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C7. The Implementer runs the dry run on a scratch copy of `dev`'s `.cland/tasks/`, journal and `hub.db`, and attaches its output to the item topic as an artifact. It names the source of each time and lists the unresolved items.
  - done: impl-330 · 2026-10-13T16:36:43.628Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-2 · 2026-10-13T16:42:46.553Z · commit 7667ff7d93ff7e548f1716e52abe164a98032d47
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-4 · 2026-10-13T17:06:23.879Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.579Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
- [x] C8. `hub/README.md` and `docs/agents/issue-tracker.md` with its template describe `closed`, `criteria`, `verify` and the `closed` part of the migration.
  - done: impl-330 · 2026-10-13T16:36:44.541Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-2 · 2026-10-13T16:42:46.554Z · commit 7667ff7d93ff7e548f1716e52abe164a98032d47
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-4 · 2026-10-13T17:06:23.879Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac
  - verified: rev-23 [reviewer] · run rev-2026-10-13-330-5 · 2026-10-13T17:28:19.579Z · commit 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac

## Comments

### impl-330 · 2026-10-13T16:18:53.544Z

Implementation plan: closed persistence/index and scratch-only migration first, then indexed criteria counts and Suites→dispatcher→tracker latest-result wiring. Tests use the ticket's frame/CLI, item and pure planner seams; no new harness hooks.

### impl-330 · 2026-10-13T16:38:20.122Z

Implementation committed/pushed at 267d9d16 after merging origin/dev ec1fe36d. Review assigned to rev-23. Targeted checks/typecheck/shard lint pass; 64-item completion regression measures 45 tracker queries, no full list or item reads, one terminal event. A-2005 records implementation/validation; A-2003 records scratch-only backfill (265 sourced closing times, 39 unresolved; preview/apply match, rerun no writes). Full verification waits for the clear source verdict; QA policy none/after-stage.

### rev-23 · 2026-10-13T16:41:17.764Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-330-1
commit: 267d9d16aab37cd1c6724eb63a8626d15b3fbec3

Medium — hub/src/tracker/tracker.ts:1851,2223 uses closed ??= on open→closed, retaining a previous closing timestamp after a hand reopen. Set a fresh time on that transition and preserve already-closed retry times; cover close/edit/merge. No other source blockers found; indexed counts, silent latest verify wiring, scratch backfill A-2003 and docs reviewed. Full verification pending after a corrected source verdict. Evidence A-2006: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2006-t-330-source-review-not-clear-retained-closing-time.md.

Criteria: C1 failed (An accepted hand reopen retaining closed causes subsequent hub close/merge/edit-to-done to retain the old closing time instead of writing the new transition time.).

### impl-330 · 2026-10-13T16:42:08.445Z

Review C1 correction pushed as 7667ff7d: actual open→closed transitions replace a hand-retained stale closed time; already-closed retries remain idempotent. Real-hub regression went red→green across close/edit done/edit closed, and the merge regression with retained old time passes. Typecheck/diff check pass; source re-review requested before verification.

### rev-23 · 2026-10-13T16:42:46.554Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-330-2
commit: 7667ff7d93ff7e548f1716e52abe164a98032d47

No high, medium, or low source findings remain. Actual open→closed transitions overwrite retained timestamps; already-closed retries preserve them. Real close/edit/merge regressions retain existing coverage. Original complete source assessment A-2006 remains applicable; scratch backfill A-2003 and docs establish C7/C8. C1–C6 await complete same-head full verification. Evidence A-2007: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2007-t-330-corrected-source-review-clear-at-7667ff7d.md.

Criteria: C7 verified, C8 verified.

### rev-23 · 2026-10-13T16:59:41.843Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-330-3
commit: 7667ff7d93ff7e548f1716e52abe164a98032d47

Medium — hub/test/inbox-workload.test.ts:144 matches old closedAt SQL, yielding zero instead of one; update recognition while keeping exact lookup/batch/count assertions. Medium — hub/src/tracker/tracker.ts:1588 / index-db.ts:261 adds redundant per-row criteria reads; full stage-landing workload now exceeds its fixed bound (10174 > 10000), requiring diagnosis/optimization without raising it. A-2009 fails two tests and does not reach Neovim. Specific verify C6 guard passed at 46 queries; no criterion failure inferred, C1–C6 final verification pending, C7/C8 retained. Evidence A-2010: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2010-t-330-exact-head-full-verification-not-clear-workload-guards.md.

### rev-23 · 2026-10-13T17:06:23.879Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-330-4
commit: 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac

No high, medium, or low source findings remain. Counts reuse parsed criteria from the selected row via private WeakMap, preserving wire shape/precedence and eliminating duplicate SELECTs. Archive tracer recognizes closed-first SQL; exact one-lookup, stage ceilings and card no-full-list/file/one-event guards remain. Tracker-only dev delta reviewed; C7/C8 refreshed. C1–C6 await complete same-head full verification after restart admission. Evidence A-2012: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2012-t-330-workload-correction-source-clear-at-86ea5dba.md.

Criteria: C7 verified, C8 verified.

### impl-330 · 2026-10-13T17:28:04.171Z

Full same-head verification 18e2c42b passed at 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac: 1830/1830 tests, zero failures, including hub and Neovim. Durable log A-2015: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2015-suite-18e2c42b-052f-4505-b347-e94e4ded1535-all-at-86ea5db.log. Awaiting the Reviewer's final criterion verdict; claim retained.

### rev-23 · 2026-10-13T17:28:19.579Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-330-5
commit: 86ea5dbacce23b73eab85d9f9e50cbd5472a30ac

No high, medium, or low findings remain. Source A-2007/A-2012, scratch A-2003 and complete exact-head A-2015 establish C1–C8: close lifecycle/backfill, indexed counts, latest silent verify projection and bounded workload. Typecheck/all phases pass 1830/1830 with zero skips/cancellations. Retained-time and workload regressions pass; completion 45 queries/no full lists/files/one event. Evidence A-2016: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2016-t-330-final-exact-head-review-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-13T17:28:30.781Z

Merged 207eb7c7d5536c364cd38dff4c1242f5eea9bd6b onto dev.
