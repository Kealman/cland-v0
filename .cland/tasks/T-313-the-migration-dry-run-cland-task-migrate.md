---
id: T-313
kind: task
title: "The migration, dry run: cland task migrate --dry-run prints every
  rename, id, reference, title, seeded category and retired label, and writes
  nothing"
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-269
blocked_by: []
topic: topic-191
branch: t/T-313-the-migration-dry-run-cland-task-migrate
created: 2026-10-13T02:27:22.740Z
updated: 2026-10-13T04:23:40.950Z
closed: 2026-10-13T04:23:36.478Z
---

## Summary

`cland task migrate --dry-run` shows the whole prefix migration before anything moves. It prints every file rename, every rewritten `id`, `parent` and `blocked_by`, every title change, the categories it would seed and the items that would lose the `tech-debt` label. It writes nothing. The planner it is built on is pure, so T-316 applies the same plan.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.1 (Migration, Titles) and §3.10 (the seeding). Decided in T-241 and T-245.

## What to build

**The prefix table.** A new module `hub/src/tracker/prefixes.ts` owns the kind prefixes. This ticket creates it, and T-314 builds resolution on it.

- The prefix is the kind name's first letter, uppercased: `R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec, `C-` category.
- It exports `prefixOf(kind)` and a pure parser that reads `<letter>-<n>`, `<letter>-<n>` in lower case, or a bare number into `{ prefix, n }`. A letter that is no kind's prefix (for example `A-12`, an artifact) is not an item reference.
- A configured kind outside the seven takes its first letter as well. T-315 refuses a ladder whose prefixes collide.

**The planner.** A new pure module `hub/src/tracker/migrate.ts`, items in and a plan out. Its input is every item file (name and parsed `Item`) and the next free number of the shared counter (`IndexDb.highWater()` in `hub/src/tracker/index-db.ts`). Its output is a plan object with these parts:

- **Renames.** Every item whose kind is not `task` gets its kind's prefix. `T-107-<slug>.md` becomes `E-107-<slug>.md`. The slug stays as it is, so the rename only swaps the prefix. Tasks keep `T-`, so their files keep their names.
- **Ids.** The item's own frontmatter `id` takes the same prefix as its new file name.
- **References.** Every `parent` and every `blocked_by` entry is rewritten to its target's prefix, in every item file, tasks included. A reference to a number no file carries stays as written and is listed as unresolved.
- **Titles.** A title loses a leading kind word followed by a colon, in any case: `Epic:`, `Release:`, `Spec:`, `Question:`, `Map:`, `Task:`. `Research:` and every other word stay. `Epic: X` becomes `X`. A release whose title is only its version keeps the version: `Release: v0.1.1` becomes `v0.1.1`.
- **Tech debt.** The source is the open container with no parent titled `Tech debt`. In this repo it is T-216. It converts to the kind `category` and the id `C-216`. Its children keep their place, and their `parent` reads `C-216`. A project with no such container gets Tech debt as a new category, like the other three.
- **New categories.** Bugs, Follow-ups and Ideas, in that order, take the next numbers of the shared counter. Each is planned as a new file `C-<n>-<slug>.md` with kind `category`, state `open` and an empty body.
- **The label.** `tech-debt` leaves every item that carries it, closed items included. An item that carried it with no parent moves into Tech debt. An item with a parent keeps its parent.
- **Nothing else.** Bodies, comments, `topic`, `branch`, `created`, `updated` and every other field stay as they are.

A tree that is already migrated gives an empty plan. Each part is idempotent on its own, so a half-applied tree gives only the remaining steps. T-316 relies on that for a rerun after a crash.

**The frame.** A new frame `task.migrate` with `dryRun: true` in `hub/src/protocol.ts`. The dispatcher (`hub/src/hub/dispatch.ts`) hands it to a tracker method in `hub/src/tracker/tracker.ts`. That method reads every item file through the tracker's serial queue, as `migrateQa` does, and calls the planner. It writes no item file, no index row and no journal record.

- Only the human's shell and the Coordinator may call it. Check the caller's role in the dispatcher, as `crew.set` does (`dispatch.ts` near line 1325). Other roles are refused with the reason. No role's tool list changes.

**The CLI.** `cland task migrate --dry-run [--json]` in `hub/src/cli/task.ts`, with its usage line in `TASK_USAGE`.

- The plain output prints one line per change, grouped: renames, ids, references, titles, categories, labels, moves. For example `rename T-107-epic-v0-1-release-and-status.md → E-107-epic-v0-1-release-and-status.md` and `parent T-301: T-216 → C-216`. A last line gives the counts.
- `--json` prints the plan object.
- An empty plan prints `nothing to do`.
- Until T-316 lands, `--dry-run` is required. Without it the command says the migration itself is not built yet and exits 1.

**Demo** (the epic's words). On a scratch copy of the live tracker, the dry run lists `T-228` becoming `R-228`, `T-107` becoming `E-107`, T-216 becoming the category Tech debt and three new categories, and `git status` stays clean.

**Out of scope.** Applying the plan (T-316). Resolving any prefix in the hub (T-314). The `category` kind in `[tracker] levels` (T-315): the planner names the kind `category` without the hub accepting it yet.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second.
- The planner is pure and has its own unit tests beside the frame tests.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293).
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. Planner unit tests cover each part: renames for every non-task kind, tasks untouched, ids, `parent` and `blocked_by` rewrites, an unresolved reference, each stripped kind word in mixed case, `Research:` kept, a version-only release title, Tech debt from an existing container and created new, three new categories on the next numbers, the label removed everywhere and the unparented labelled item moved.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.861Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:19.615Z
- [x] C2. The planner gives an empty plan for a migrated tree and only the remaining steps for a half-migrated one.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.862Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:20.315Z
- [x] C3. A hub test on a temporary project with a real hub runs `cland task migrate --dry-run` and `--json`. It checks the printed plan, and that the item files and the index are unchanged. It also checks that the journal holds no migration or domain record (no `task-migrated`, no item change, no index rewrite), read after the `flushLogs` barrier. Ordinary audit entries for the calls themselves are allowed. (Edited 2026-10-13 by the Coordinator, answering impl-313's question.)
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.862Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:21.096Z
- [x] C4. A hub test shows the frame refused for an Implementer session and allowed for the human and the Coordinator.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.862Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:21.610Z
- [x] C5. The Implementer runs the dry run on a scratch copy of `dev`'s `.cland/tasks/` and attaches its output to the item topic as an artifact. It shows `T-228 → R-228`, `T-107 → E-107`, `T-216 → C-216 Tech debt` and three new categories, and `git status` in the copy stays clean.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.862Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:22.296Z
- [x] C6. `hub/README.md`'s tracker section and `docs/agents/issue-tracker.md` describe `cland task migrate --dry-run` and what it plans.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-313-1 · 2026-10-13T04:22:57.862Z · commit b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c
  - done: impl-313 · 2026-10-13T04:23:23.300Z

## Comments

### impl-313 · 2026-10-13T02:32:30.384Z

Implementation uses planMigration(files, nextNumber, containers) as a pure field-level delta. Prefix parsing is isolated in prefixes.ts. The new frame is CLI-only like crew.set, with an explicit Coordinator/human boundary and authorization rechecked after queued reads; no MCP role tool list changes.

### impl-313 · 2026-10-13T02:33:54.752Z

C3 clarified by Coordinator decision 514a8ffe: the item files and tracker index must be unchanged and no migration/domain record may be written. Ordinary audit entries remain required and are allowed, including task.migrate and hub.status flushLogs. No journal special case was added.

### impl-313 · 2026-10-13T02:39:32.326Z

Implementation and targeted checks complete (five pure planner tests plus one real-hub/real-spoke/CLI test). Docs and shard manifest updated. C5 evidence is A-1752, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1752-t-313-dry-run-on-a-scratch-copy-of-dev-complete-plan-and-clean-git-status.txt. Fetched and merged origin/dev before final verification; requesting review and queuing full suite.

### impl-313 · 2026-10-13T02:43:12.743Z

Review fixes at 49f7a506eff95ed29d6bce8fc4a132204a7fb561: open root seed recognition uses cleaned titles, avoiding duplicate Bugs from Epic: Bugs and replacing a closed Tech debt root with a new open category. Added focused coverage and preserved empty rerun. Forbidden-code assertion now narrows the harness result before reading code, fixing the initial full-suite typecheck stop. All six planner tests and the real-hub test pass. origin/dev freshly fetched and already merged; re-requesting review and full verification.

### impl-313 · 2026-10-13T03:28:15.145Z

Full run 548be9d8 passed typecheck and 1420/1421 tests. Its sole failure was T-119's compiler source guard, because the new modules duplicated container literals. Fixed by deriving built-in reference kinds through kindsFor(DEFAULT_LEVELS), preserving the same parser/planner behavior and configured kinds. The source guard (three tests) and all six planner tests pass. Pushed 390d6510183b57a482f331da62f1b3bd0671466d after freshly merging origin/dev; re-requesting review and full suite.

### impl-313 · 2026-10-13T03:52:03.545Z

Full result c3244fb1 / A-1774 at 390d651 passed typecheck and 1420/1421 tests, including all migration and compiler-source guard tests. The sole failure is events-quiet.test.ts:68: ERR_INVALID_STATE database is not open, stack ProcessTable.all → Sessions.list → dispatch.ts:203 pending Immediate during fixture teardown. Reported the scope blocker to lead T-313; awaiting ownership/decision before changing shared shutdown code. Notified impl-312 that this run completed and will not submit a new suite before its protected slot ends.

### impl-313 · 2026-10-13T04:00:31.375Z

Coordinator authorized shared shutdown fix within T-313 (decision 1f3b5ea9). Standalone commit 64cb036b9467454065b437f270896323cc68b954 is pushed and posted in Agents for T-308/T-312 cherry-picks. Production changes only shutdown order in serveProject.stop and hub.close. A deterministic real-hub regression fails on isolated origin/dev e1710827 with the original ERR_INVALID_STATE/database is not open stack and passes with the fix. Complete events-quiet (5 tests) and targeted daemon shutdown (2 tests) pass. Red/green evidence A-1777: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1777-shared-shutdown-regression-deterministic-dev-failure-and-fixed-pass.md. Awaiting impl-312's protected-slot end before fetching/merging origin/dev and requesting the final exact-head full run.

### impl-313 · 2026-10-13T04:09:47.640Z

The second Linux shutdown path was not covered by 64cb036. Follow-up shared commit ffced58a80974ba968ddcd9aa95accdb614992e5 is pushed and posted to Coordinator/T-312/T-308 in Agents. A new deterministic real-frame status-change regression reproduces the exact HubCore.eventsProject → InboxBoard → ProcessTable stack at 64cb036 and passes after moving HubCore.close before adapter closure/async shutdown drains. A-1783 records the evidence. Freshly merged origin/dev at b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c; events-quiet and real-hub migration checks pass on that synced head. Protected slot ended; requesting review and submitting full verification.

### impl-313 · 2026-10-13T04:22:30.151Z

Final full verification fdcc4084-b639-43d1-87d8-159c27a195bf is green at b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c: typecheck and all 1736 tests pass, zero skips. Durable log A-1790: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1790-suite-fdcc4084-b639-43d1-87d8-159c27a195bf-all-at-b4911f4.log. rev-23 notified to finalize the C1–C6 review; impl-312 notified directly of run completion for its next authorized Linux slot. Retaining claim until merge.

### rev-23 · 2026-10-13T04:22:57.862Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-313-1
commit: b4911f4096bbe303ff3b24b1f6705bfbf4f42e1c

No high or medium findings remain. C1–C6 verified from corrected migration/source and scratch evidence plus exact-head full fdcc4084: typecheck and 1736/1736 tests pass, zero failures/cancellations/skips. Planner/real dry-run/typed kind guard and both shared shutdown regressions pass. Evidence A-1791: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1791-t-313-final-review-at-b4911f4.md; full A-1790, scratch A-1752. Implementer done marks were unchecked at the pre-verdict read.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-13T04:23:40.950Z

Merged 108cf641971fba48c6983c26c02d076cc6b6dbbe onto dev.
