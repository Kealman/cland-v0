---
id: T-313
kind: task
title: "The migration, dry run: cland task migrate --dry-run prints every rename, id, reference, title, seeded category and retired label, and writes nothing"
state: open
status: review
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-269
blocked_by: []
topic: topic-191
branch: t/T-313-the-migration-dry-run-cland-task-migrate
created: 2026-10-13T02:27:22.740Z
updated: 2026-10-13T03:28:15.145Z
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

- [ ] C1. Planner unit tests cover each part: renames for every non-task kind, tasks untouched, ids, `parent` and `blocked_by` rewrites, an unresolved reference, each stripped kind word in mixed case, `Research:` kept, a version-only release title, Tech debt from an existing container and created new, three new categories on the next numbers, the label removed everywhere and the unparented labelled item moved.
- [ ] C2. The planner gives an empty plan for a migrated tree and only the remaining steps for a half-migrated one.
- [ ] C3. A hub test on a temporary project with a real hub runs `cland task migrate --dry-run` and `--json`. It checks the printed plan, and that the item files and the index are unchanged. It also checks that the journal holds no migration or domain record (no `task-migrated`, no item change, no index rewrite), read after the `flushLogs` barrier. Ordinary audit entries for the calls themselves are allowed. (Edited 2026-10-13 by the Coordinator, answering impl-313's question.)
- [ ] C4. A hub test shows the frame refused for an Implementer session and allowed for the human and the Coordinator.
- [ ] C5. The Implementer runs the dry run on a scratch copy of `dev`'s `.cland/tasks/` and attaches its output to the item topic as an artifact. It shows `T-228 → R-228`, `T-107 → E-107`, `T-216 → C-216 Tech debt` and three new categories, and `git status` in the copy stays clean.
- [ ] C6. `hub/README.md`'s tracker section and `docs/agents/issue-tracker.md` describe `cland task migrate --dry-run` and what it plans.

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
