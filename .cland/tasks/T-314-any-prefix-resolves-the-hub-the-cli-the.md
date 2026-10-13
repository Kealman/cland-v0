---
id: T-314
kind: task
title: "Any prefix resolves: the hub, the CLI, the MCP task tools, the plan parser and gi take any kind prefix by its number, and every surface shows the kind's own"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-269
blocked_by:
  - T-313
topic: null
branch: null
created: 2026-10-13T02:27:22.874Z
updated: 2026-10-13T02:27:33.986Z
---

## Summary

An item's number is its identity, and its prefix follows its kind. The hub finds an item by its number whatever prefix is written, so `T-107` in a journal line, a message or a thread still leads to the epic. Every answer the hub gives carries the kind's own prefix, so the workbench and the CLI show `E-107` before any file is renamed. New items are written with their kind's prefix from one shared counter.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.1 (The number is the identity, Any prefix resolves). Decided in T-241.

## What to build

**Resolution by number.** `normalizeId` in `hub/src/tracker/item.ts` turns `T-`, `t-` or a bare number into `T-<n>` today. It becomes resolution by number:

- Any of the kind prefixes from `hub/src/tracker/prefixes.ts` (T-313), in any case, or a bare number, resolves through the index to the item with that number. The index already stores the number in `tracker_items.n`.
- The answer is the canonical id: the item's kind prefix and its number.
- An unknown number keeps today's not-found refusal. A prefix that is no kind's prefix, such as `A-12`, is not an item id.
- `idNumber` reads the number whatever the prefix.
- Replace the ad-hoc parse in `Core.#rememberVerification` (`hub/src/hub/core.ts`, T-303's `[A-Za-z]+-` match and its linear `list().find`) with the shared resolver.

**Canonical ids come from the kind.** The index computes each item's canonical id from its kind and number, whatever the file's `id` says. Before the migration, the epic in `T-107-epic-v0-1-release-and-status.md` with `id: T-107` already reads `E-107` in `task.view`, `task.list`, the `task` events and `hub.status`. Its `parent`, its `blocked_by` and its children's `parent` show canonical ids too. The ancestry in `cland task view`'s header reads `R-228 › E-269`.

**Item files of any prefix.** `FILE_NAME` in `item.ts` accepts any kind prefix. The sites that build an id from a file number take the number only (`tracker.ts` near lines 677 and 791).

- Two files carrying the same number are a conflict. The hub indexes the one whose prefix matches its kind and logs `task-duplicate-number` with both names. `cland task view` on that number shows the warning. This is the guard for T-316's risk: a stale branch must never bring back a second file for one number unnoticed.

**New items.** The shared counter (`IndexDb.allocate`) hands out a number and no longer a `T-` id.

- `task.create` writes the kind's prefix in the frontmatter `id` and in the file name. `cland task create "X" --kind epic` writes `E-<n>-x.md`.
- The counter takes the highest number over files of every prefix.
- A kind change through `task edit --kind` keeps the number. It renames the file to the new prefix and writes the new `id` in the same write. References in other files keep the prefix they were written with and resolve by number.

**Hub state written with old ids.** The hub's tables keep item ids as they were written: claims, holds, plans, merge receipts and written verdicts in `hub/src/tracker/index-db.ts`, topic bindings, subscriptions and pending verifications in `hub/src/hub/store.ts`, and the items of the process table. A row written as `T-107` must match the epic `E-107`.

- Either read them by number, or rewrite them once to canonical ids at hub start. The Implementer picks one and states it in `hub/README.md`.
- Nothing scans a table per event or per view (T-293).

**The sites that parse `T-` today.** Each accepts any kind prefix and compares by number:

- `hub/src/address.ts` (the `@lead T-<n>` tag) and `hub/src/hub/core.ts` (the `lead T-<n>` address near line 1948, the `review request` and `qa request` first lines near line 1996, request subjects near line 2406);
- `hub/src/hub/dispatch.ts` (request routing near line 400, suite recipients near line 536);
- `hub/src/subscriptions.ts` (item and subtree targets);
- `hub/src/tracker/plan.ts` (lane ids);
- `hub/src/territory.ts`, `hub/src/territory-release.ts` (worktree names, release trailers), `hub/src/cli/qa-fixture.ts`, `hub/src/roles/handover.ts` and `hub/src/hub/merge.ts`.

Tasks keep `T-`. Task branches `t/T-<n>-<slug>`, worktrees `.cland/worktrees/T-<n>`, release trailers and the lanes of plans do not change.

**The plan parser.** Lane items accept any kind prefix and match the epic's children by number. A plan's hash stays the hash of its text as written, so an approved plan stays approved.

**The CLI and the MCP tools.** The usage text in `hub/src/cli/task.ts` and the tool descriptions in `hub/src/spoke/task-tools.ts` name `<id>` with any kind prefix instead of `T-<n>`. Every output prints canonical ids.

**Neovim.** The prefix table reaches Neovim through `hub.status`, for example as `tracker.prefixes`, so Neovim keeps no second copy.

- `state.item(id)` in `nvim/lua/cland/state.lua` resolves any kind prefix by number to the canonical item.
- `token()` in `nvim/lua/cland/motions.lua` reads only kind prefixes, so an artifact id such as `A-12` no longer reads as an item.
- `item_marks` in `nvim/lua/cland/thread.lua` highlights every kind prefix.
- `gi` on `T-107` opens the item view of `E-107`, keyed by the canonical id.
- `graph.lua`'s `open`, the validators in `ui.lua` (`current_release`, plan receipts), `qa.lua` and the `agents_log.lua` filter accept any kind prefix.

**Demo** (the epic's words). `cland task view E-107`, `R-107` and `T-107` show the same epic headed `E-107`, and `gi` on `T-107` in a thread opens it.

**Out of scope.** Renaming the existing files (T-316). The `category` kind (T-315), though `C-` already parses. Rewriting ids in bodies, comments, the journal, artifacts, topics or branches: they keep their `T-` ids for good and resolve through any prefix.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second. The Neovim UI is tested headless on the stub hub (`nvim/test/stub-hub.ts`), read with `screenstring()`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293). Resolution by number uses the index, never a scan of every item per call.
- Every key and action goes through the action registry.
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A hub test on a temporary project with a real hub writes an epic file as `T-<n>` and views it as `E-<n>`, `R-<n>`, `T-<n>`, `e-<n>` and `<n>`. Each shows the same item headed `E-<n>`. `cland task list --json` shows every kind with its own prefix. An unknown number is refused, and `A-<n>` is refused as not an item id.
- [ ] C2. `task.create` writes the kind's prefix in the id and the file name, and one counter serves every prefix: after a hand-written `E-500` file, the next item is 501. A kind edit keeps the number and renames the file to the new prefix.
- [ ] C3. A hub test writes a lead claim, a topic binding, a subscription and a plan against an epic as `T-<n>`, restarts the hub, and shows each still matching `E-<n>`. `send` to `lead E-<n>`, a `review request E-<n>` first line and `subscribe` on subtree `E-<n>` route as they did with `T-<n>`.
- [ ] C4. Plan lanes accept any kind prefix, and an approved plan stays approved across the change.
- [ ] C5. Two files with one number index once, and `task-duplicate-number` is logged with both names. The test reads `hub.log` after the `flushLogs` barrier.
- [ ] C6. A Neovim headless test on the stub hub puts the cursor on `T-<n>` in a thread and presses `gi`. The item view of `E-<n>` opens. `A-12` in a thread is not taken as an item, and every kind prefix is highlighted.
- [ ] C7. `docs/agents/issue-tracker.md` (and its template `skills/templates/docs/agents/issue-tracker.md`), `hub/README.md`'s tracker section and `nvim/README.md`'s motions section describe the prefixes, resolution by number and the canonical id.
