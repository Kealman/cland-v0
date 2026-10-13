---
id: T-316
kind: task
title: "The migration: cland task migrate renames, rewrites, retitles, seeds the four categories, retires the tech-debt label and reindexes"
state: open
status: review
criterion_seq: 10
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-269
blocked_by:
  - T-313
  - T-315
topic: topic-197
branch: t/T-316-the-migration-cland-task-migrate-renames
created: 2026-10-13T02:27:23.140Z
updated: 2026-10-13T09:22:42.516Z
---

## Summary

`cland task migrate` applies the plan its dry run prints. It renames the item files, writes each item's own id with its kind's prefix, rewrites `parent` and `blocked_by`, strips the kind words from titles, seeds Tech debt, Bugs, Follow-ups and Ideas, retires the `tech-debt` label and reindexes. It is refused while a merge or a tracker write is in flight, and a second run reports nothing to do. The slice proves that squash-merging an older task branch after the rename leaves the renamed files alone.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.1 (Migration, Titles) and §3.10 (the seeding, the `tech-debt` label). Decided in T-241 and T-245. ADR 0002: the item files are the source of truth, and the hub reindexes them.

## What to build

**Apply the plan.** `task.migrate` without `dryRun` applies the plan of T-313's planner (`hub/src/tracker/migrate.ts`). It runs as one operation in the tracker's serial queue (`hub/src/tracker/tracker.ts`), as `migrateQa` does. The dry run and the run share the planner, so they cannot drift apart.

- **Per renamed file**, rename it to its new name first (atomic `rename`), then write its new frontmatter in place through the usual temporary file. A crash between the two leaves one file at its new name with its old `id`. It never leaves two files for one number.
- **Per task file** that only has references rewritten, write it in place.
- **The seeding** converts the Tech debt container to `category` (T-216 becomes `C-216` here) and creates Bugs, Follow-ups and Ideas through the tracker's own create path, on the next numbers of the shared counter.
- **The label** `tech-debt` leaves every item. An item that carried it with no parent moves into Tech debt.
- **Reindex.** After the run the index matches the files. Clients receive the changed items coalesced once per tick, not one refresh per file (T-293). Canonical ids already come from the kind (T-314), so only Tech debt's id and the titles change on screen.
- **The journal.** One `task-migrated` record with the counts of each part and the caller, through the hub's log tap.
- **The answer** lists what changed in the dry run's format. `--json` gives the applied plan.

**Resumable and idempotent.** The run reads the tree again before it plans, so a half-applied tree gets only its remaining steps. A second run prints `nothing to do` and writes nothing.

**Refusals.** Each one writes nothing and names its reason:

- a merge in flight: a `cland merge` holding the territory lock, or a merge receipt prepared but not finished;
- a tracker write in flight: another operation in the tracker's queue or a pending criterion capture;
- a pending `cland sync` or `cland release` recovery;
- a caller other than the human's shell or the Coordinator;
- a call from a linked worktree: the command runs from the root's shell;
- a `[tracker] levels` without the `category` kind at the root. The reason names `cland update` and a hub restart.

**The CLI.** `cland task migrate [--dry-run] [--json]` in `hub/src/cli/task.ts`. T-313's requirement of `--dry-run` goes.

**The risk: an older task branch after the rename.** Item files are renamed under open task branches. Task branches are cut from `dev`, so their trees still hold the old names. The squash in `hub/src/territory.ts` (`merge-tree --write-tree` of the branch onto the root's `dev`) must leave the renamed files alone. Prove it with a hub test on a temporary project with a territory:

1. Claim a task, so it gets its branch and worktree from `dev` with the old file names. Commit a code change on the branch and push it to `origin`.
2. Run `cland task migrate` on the root, commit the result on `dev` and publish it with `cland push`, as the Coordinator would. `cland merge` refuses an unpublished `dev`.
3. Land the task through `cland merge` with its verdicts in place.
4. Check that `dev` holds no file under an old name, that every renamed file is byte for byte as the migration wrote it, and that the merged task's own file carries its merge record.

A second case commits an edit to an old-named container file on the branch. The merge either applies the edit to the renamed file or is refused with `merge-conflict` naming it. It never leaves two files for one number. T-314's duplicate guard reports it if one appears.

**Dogfooding: not run by this ticket.** The ticket never runs the migration on the live tracker. After it merges, the Coordinator runs it on `dev`, under D24's conditions: a green integrated run and an empty suite queue.

1. `cland update` takes `[tracker] levels` to the new default.
2. The stand-in restarts the hub.
3. `cland task migrate --dry-run`, read and kept as an artifact.
4. `cland task migrate`.
5. Commit the renamed files on `dev` and publish with `cland push`.

Open task branches need no rebase, as the test above proves.

**Demo** (the epic's words). On a scratch copy of the live tracker, the run matches its dry run, and a second run reports nothing to do.

**Out of scope.** Rewriting ids anywhere but the item files' frontmatter: bodies, comments, the journal, artifacts, topics, branches and worktrees keep their `T-` ids. Renaming task files. The clauses and skills (T-317).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. A crash is simulated by preparing a half-migrated tree by hand, not by a hook in the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293).
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A hub test on a temporary project runs `cland task migrate --dry-run --json`, then `cland task migrate --json`, and shows the applied plan equal to the dry run's. The files, the index and `cland task list --json` agree afterwards.
  - done: impl-316 · 2026-10-13T09:22:33.634Z
- [x] C2. A second run prints `nothing to do` and writes nothing. A tree half-migrated by hand completes on the next run with no duplicate number.
  - done: impl-316 · 2026-10-13T09:22:34.076Z
- [x] C3. A hub test shows each refusal: a merge in flight, a tracker write in flight, an Implementer caller, a linked worktree and a ladder without `category`. None writes a file.
  - done: impl-316 · 2026-10-13T09:22:34.645Z
- [x] C4. `git diff --stat` after the run shows renames and frontmatter changes only. Every body and every comment is byte for byte unchanged.
  - done: impl-316 · 2026-10-13T09:22:35.641Z
- [x] C5. The squash test above passes in both cases.
  - done: impl-316 · 2026-10-13T09:22:36.539Z
- [x] C6. The journal holds one `task-migrated` record with the counts, read after the `flushLogs` barrier.
  - done: impl-316 · 2026-10-13T09:22:37.187Z
- [x] C7. The Implementer runs the dry run and the run on a scratch copy of `dev`'s `.cland/tasks/` and attaches both outputs to the item topic as one artifact. They match, and a second run reports nothing to do.
  - done: impl-316 · 2026-10-13T09:22:38.049Z
- [x] C8. `hub/README.md`'s tracker section and `docs/agents/issue-tracker.md` (and its template) describe `cland task migrate`, its refusals and what it leaves alone.
  - done: impl-316 · 2026-10-13T09:22:39.464Z
- [x] C9. `cland task migrate` runs with the hub stopped, working on the item files and hub.db directly, and refuses while a hub answers on the project. `hub/README.md` and `docs/agents/issue-tracker.md` give the live-tracker procedure: stop the hub, `git tag pre-migration` on dev, copy `.cland/hub.db` beside it, run the migration, restart the hub on the migrated tree, relaunch every role session (their clauses and briefs carry T- ids). They also give the rollback, the tag plus the hub.db copy, restorable in minutes. A test on a temporary project runs the migration with the hub stopped and shows the refusal with a hub running.
  - done: impl-316 · 2026-10-13T09:22:40.847Z
- [x] C10. After the migration on a scratch copy, every old `T-<n>` id the human types or reads still resolves to its item: `cland task view` and the other CLI task commands, the MCP task tools, topic bindings, journal rows and the inbox rows naming items, and `gi` in a thread. A hub test with a real hub restarted on the migrated tree covers each surface. The explorer inherits the same resolver when it lands (T-276).
  - done: impl-316 · 2026-10-13T09:22:41.692Z

## Comments

### coord · 2026-10-13T02:28:39.925Z

C9 and C10 added 2026-10-13 at the stand-in's request (D24). C9 runs the migration with the hub stopped. Its in-flight refusals in C3 therefore read the on-disk state, meaning merge locks and tracker write locks, not a hub frame. The CLI refuses while a hub answers. Reconcile C3 with C9 that way, and state it in the item.

### impl-316 · 2026-10-13T09:09:43.333Z

Implementation follows C9: preview and apply run with the hub stopped; C3 checks the on-disk merge/tracker locks and recovery state. Tests use the prescribed CLI/frame/territory seams on temporary projects only; the live tracker will not be migrated.
