---
id: T-314
kind: task
title: "Any prefix resolves: the hub, the CLI, the MCP task tools, the plan
  parser and gi take any kind prefix by its number, and every surface shows the
  kind's own"
state: closed
status: done
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-269
blocked_by:
  - T-313
topic: topic-193
branch: t/T-314-any-prefix-resolves-the-hub-the-cli-the
created: 2026-10-13T02:27:22.874Z
updated: 2026-10-13T07:29:16.625Z
closed: 2026-10-13T07:29:16.004Z
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

- [x] C1. A hub test on a temporary project with a real hub writes an epic file as `T-<n>` and views it as `E-<n>`, `R-<n>`, `T-<n>`, `e-<n>` and `<n>`. Each shows the same item headed `E-<n>`. `cland task list --json` shows every kind with its own prefix. An unknown number is refused, and `A-<n>` is refused as not an item id.
  - done: impl-314 · 2026-10-13T07:27:38.493Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C2. `task.create` writes the kind's prefix in the id and the file name, and one counter serves every prefix: after a hand-written `E-500` file, the next item is 501. A kind edit keeps the number and renames the file to the new prefix.
  - done: impl-314 · 2026-10-13T07:27:39.013Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C3. A hub test writes a lead claim, a topic binding, a subscription and a plan against an epic as `T-<n>`, restarts the hub, and shows each still matching `E-<n>`. `send` to `lead E-<n>`, a `review request E-<n>` first line and `subscribe` on subtree `E-<n>` route as they did with `T-<n>`.
  - done: impl-314 · 2026-10-13T07:27:39.336Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C4. Plan lanes accept any kind prefix, and an approved plan stays approved across the change.
  - done: impl-314 · 2026-10-13T07:27:39.665Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C5. Two files with one number index once, and `task-duplicate-number` is logged with both names. The test reads `hub.log` after the `flushLogs` barrier.
  - done: impl-314 · 2026-10-13T07:27:39.987Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C6. A Neovim headless test on the stub hub puts the cursor on `T-<n>` in a thread and presses `gi`. The item view of `E-<n>` opens. `A-12` in a thread is not taken as an item, and every kind prefix is highlighted.
  - done: impl-314 · 2026-10-13T07:27:40.310Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca
- [x] C7. `docs/agents/issue-tracker.md` (and its template `skills/templates/docs/agents/issue-tracker.md`), `hub/README.md`'s tracker section and `nvim/README.md`'s motions section describe the prefixes, resolution by number and the canonical id.
  - done: impl-314 · 2026-10-13T07:27:40.640Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-314-5 · 2026-10-13T07:29:08.359Z · commit b361200804ecac7150b9f6afec03bfd476e6d8ca

## Comments

### impl-314 · 2026-10-13T04:38:51.310Z

Implemented numeric indexed resolution, canonical kind ids and edges, shared creation counter, kind-edit file renames, duplicate-number preference/warnings, old hub-state lookup keys without startup rewrite, routing/subscription/plan parsing and Neovim prefix consumers. Added real daemon/spoke/CLI and headless Neovim regression coverage; preparing first queued verification after merging latest origin/dev.

### rev-23 · 2026-10-13T04:48:12.564Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-314-1
commit: d631897202a6c927506bcb9007d6ca1d629275b7

High — hub/src/tracker/tracker.ts:1273: exact-key override lookup ignores accepted numeric aliases and can bypass required stage QA.
Medium — hub/src/tracker/tracker.ts:1268: displayed parent prefix changes invalidate unchanged legacy stage QA hashes.
Medium — hub/src/hub/core.ts:515: every task event scans all cached items and performs indexed resolutions per unrelated item.
Medium — hub/src/hub/core.ts:2037: affinity reads T-n while both assignment paths write canonical E-n/R-n keys.
Medium — hub/src/hub/core.ts:1717; hub/src/roles/handover.ts:55: legacy lead:T-n records are missed by canonical lead:E-n queries.
Medium — hub/src/tracker/tracker.ts:832: stable T-n deletion misses canonical plan candidate/error keys, retaining an orphan plan candidate.
Evidence and two low advisory notes: A-1798 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1798-t-314-review-findings-at-d631897.md). Stub-hub shebang fixed at this head. Cancelled suites are not green evidence.

Criteria: C1 failed (Per-event default-item scans break bounded lookup work; removal leaves canonical plan caches behind.), C3 failed (Legacy Lead records and non-task verifier assignment affinity use inconsistent prefix keys.), C4 failed (Mixed-spelling overrides can bypass stage QA, and canonical parents invalidate unchanged legacy stage hashes.).

### rev-23 · 2026-10-13T04:55:23.788Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-314-2
commit: ee3fc91fb7210e4c5601c0896efb6182000114dd

Medium — hub/src/hub/core.ts:591: removed children have no indexed ancestry, so the cached child alone cannot route the terminal notice to its parent Lead.
Medium — hub/test/tracker-levels.test.ts:246: the feature fixture creates F-1-container.md but reads E-1-container.md; the later notice still expects T-1.
All six original A-1798 blocking findings are addressed in source, with new regression coverage. Evidence A-1802 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1802-t-314-correction-review-at-ee3fc91-terminal-routing-and-fixture-paths.md). A-1801 stopped before tests; complete c137ae11 at this head remains pending.

Criteria: C3 failed (Ancestry-only default cache loses the surviving parent Lead when a child is removed.), C2 failed (Configured feature kind-change regression reads E-1 instead of F-1 and retains a stale T-1 notice path.).

### rev-23 · 2026-10-13T05:49:01.396Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-314-3
commit: 9cf0adba00bf0f32d651b9e9ec5860d1d2232a37

Medium — hub/test/task-prefixes.test.ts:114: spoke send omits message; routed.message.to throws before the routing regression completes.
Medium — hub/test/tracker-levels.test.ts:328: correct Q-4/T-3 child refusal fails a regex requiring the former file ordering.
Source/integration remain clear (A-1812/A-1815), but full fceebc7d / A-1817 exits 1 with 1447/1449 hub tests; no Neovim phase. Preserve exact recipients and both child identities/gates while correcting the test contracts. Evidence A-1818 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1818-t-314-final-verification-blocked-by-two-test-contracts-at-9cf0adb.md).

Criteria: C3 failed (Required legacy routing test reads a message field omitted by spoke send and fails before completing.), C2 failed (Configured container gate test requires an incidental child order changed by canonical file prefixes.).

### impl-314 · 2026-10-13T05:49:19.248Z

A-1817 completed hub verification at 9cf0adb: 1447 pass / 2 test-contract failures; Neovim did not run. Corrected the new legacy routing assertion to inspect the actual recipient’s spoke delivery, and retained both open-child names/IDs independently of filename ordering. Product source is unchanged. The next full run waits for the protected T-275 QA slot; original dev close-gate case will be checked alone before resubmission.

### rev-23 · 2026-10-13T06:36:46.153Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-314-4
commit: 63f5e6ba7a62cd70961a8923a4028523ddbfcb94

High — nvim/lua/cland/thread.lua:74: state is an unimported nil global; rendering an item reference throws and prevents the C6 legacy thread/gi test from starting.
Exact-head full f9b29855 / A-1825 passes typecheck and all 1449 hub tests, but Neovim has 119 failures out of 308 (total 1638/1757). No skips/cancellations. C6 and QA THREAD screens expose the same missing dependency; other remaining failures need inspection after the fix. Evidence A-1826 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1826-t-314-neovim-verification-failure-at-63f5e6b.md). Earlier source-clear assessment corrected by runtime evidence.

Criteria: C6 failed (Thread item highlighting calls state.item_number without importing cland.state, breaking rendering and gi coverage.).

### impl-314 · 2026-10-13T07:06:05.385Z

A-1834 completed both phases: all 1449 hub and 307/308 Neovim cases passed, including C6. The sole unchanged layer-filter test read an empty panel after a fixed 100 ms pause. Original dev and branch both pass that case alone. Coordinator authorized shared fix b361200: wait for loaded plan/items, requested filter and exact rendered inclusion/exclusion state; all assertions unchanged. Corrected layers.test.ts passes 14/14 (A-1835). Refreshed origin/dev is already integrated; full verification is resubmitted.

### impl-314 · 2026-10-13T07:27:41.144Z

Final full verification 15cd72c2 at b361200804ecac7150b9f6afec03bfd476e6d8ca is green: typecheck and 1757/1757 tests, zero fail/skip/cancel. Durable log A-1843. C1–C7 implementation marks are recorded; final reviewer verification is pending. Source and standalone shared panel wait are reviewed clear (A-1831/A-1836). Task branch is pushed and clean; claim retained for merge.

### rev-23 · 2026-10-13T07:29:08.359Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-314-5
commit: b361200804ecac7150b9f6afec03bfd476e6d8ca

No high or medium findings remain. Standards and Spec clear; C1–C7 checked at b361200804ecac7150b9f6afec03bfd476e6d8ca. Full cland verify 15cd72c2 / A-1843 passes hub/Neovim typecheck and all three phases: 1757/1757, zero failures/cancellations/skips/todos. Numeric resolution, canonical creation/kind edits, legacy routing/state, mixed plans/stage hashes, duplicate warning, C6 navigation/highlights, required docs and retained regressions pass. Source/shared-fix evidence A-1831/A-1836; final criteria/evidence A-1844 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1844-t-314-final-review-clear-c1-c7-at-b361200.md). Earlier failed/cancelled evidence is superseded.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-13T07:29:16.625Z

Merged deb88d3abf17498e82919075f2d081be08cb9327 onto dev.
