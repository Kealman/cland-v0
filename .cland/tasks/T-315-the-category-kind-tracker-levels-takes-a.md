---
id: T-315
kind: task
title: "The category kind: [tracker] levels takes a root kind beside the release, cland task create --kind category works, and unscheduled means no parent"
state: open
status: review
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-269
blocked_by:
  - T-314
topic: topic-196
branch: t/T-315-the-category-kind-tracker-levels-takes-a
created: 2026-10-13T02:27:23.006Z
updated: 2026-10-13T08:55:49.351Z
---

## Summary

`category` becomes a container kind at the root beside the release. `[tracker] levels` takes a list at a level, the parenting rule takes categories on create, on link and on a kind edit, and `cland task create --kind category` works. An item in a category is not unscheduled: unscheduled now means no parent at all.

## Parent

T-269: Prefixes and categories. Spec: `docs/spec/v0.1.2.md` §3.10 (A container kind) and §2 (Unscheduled narrowed). Decided in T-245. GLOSSARY: Category, Unscheduled. ADR 0006: a category is a node at the root beside the releases, led by the Coordinator.

## What to build

**The ladder.** `[tracker] levels` takes a list at a level: `levels = [["release", "category"], "epic"]`. A plain string is a level of one kind, so `["release", "epic"]` still parses.

- `configuredLevels` in `hub/src/tracker/kinds.ts` parses both forms. Kind names stay unique across the ladder and exclude the leaf kinds and `map`.
- Two kinds whose prefixes collide are refused, naming both. The prefix is the kind's first letter (`hub/src/tracker/prefixes.ts`, T-313).
- The first kind of the first level is the release. It alone carries a version and can be the current release.
- Every other kind of the first level is a root kind. It has no parent, no version, no status and no rank, and it takes the children a release takes.

**One reader for the ladder.** Many sites read the flat list today: `levels[0]` for the release, `levels[1]` for the planning container, `levels.includes(kind)` for "is a container". Replace them with one small reader in `kinds.ts`, for example a `Ladder` with `top`, `planning`, `containers`, `roots` and `levelOf(kind)`. Move every caller to it:

- `hub/src/tracker/item.ts`: `parentingRefusal`, `versionRefusal`, `rankable`;
- `hub/src/tracker/tracker.ts`: the many `this.levels` sites, `isPlanContainer`, `kinds`;
- `hub/src/hub/dispatch.ts` (near lines 406 and 437), `hub/src/hub/server.ts` (`topLevel`), `hub/src/hub/visibility.ts`, `hub/src/hub/daemon.ts`;
- `hub/src/crew.ts`: `leads` names container kinds and refuses a root kind other than the release, since the Coordinator leads the categories (ADR 0006).

**The parenting rule.** A root kind takes no parent. A kind at a level takes any kind of the level above it, so an epic takes a release or a category. A leaf (`task`, `question`, `spec`) takes any container. A map keeps its own rule. The rule holds on `task.create`, `task.link` and a kind edit. Existing trees stay readable, as today.

**Closing a category.** A category closes only when it has no open children, like any container. It needs no QA demo, which belongs to the planning level.

**The default and the config.** `DEFAULT_LEVELS` becomes `[["release", "category"], "epic"]`.

- `cland init` writes it in `[tracker]` (`renderConfig` in `hub/src/init/config.ts`, with the comment above it updated).
- `cland update` keeps a project's values, as it does today. It rewrites `levels` only when it holds the old default `["release", "epic"]`, and its report says so. Any other ladder is kept and named in the report.
- The hub reads the config at start, so a running hub takes the new ladder after a restart.

**`hub.status`.** `tracker.levels` keeps the flat list of each level's first kind, so older clients keep working. A new field, for example `tracker.ladder`, carries the nested form. `HubStatus.tracker` in `hub/src/protocol.ts` and the stub hub (`nvim/test/stub-hub.ts`) learn it.

**The CLI.** `cland task create "Docs" --kind category` makes a category. `--version` on a category is refused, and so is `--parent`. `cland task create "Fix X" --parent C-<n>` files a task into it. `cland task close C-<n>` is refused while it has open children. `cland task list --kind category` lists the categories.

**Unscheduled means no parent.**

- Neovim: `items.unscheduled(it)` in `nvim/lua/cland/items.lua` is an open, not-done item with no parent. `is_level` and `is_container` read the ladder, so a category is a container. `open_releases`, `scopes` and `cycle_scope` keep to the release kind: a category is not a release scope.
- At release scope, items in a category leave the panel's unscheduled fold. T-318 adds their count line.
- The hub: no surface calls an item in a category unscheduled. The Coordinator keeps the merges of items outside any Lead's subtree (`dispatch.ts` near line 441), categories included.

**Demo** (the epic's words). A scratch project creates the category "Docs", files a task into it with `--parent C-n`, and the task is not unscheduled.

**Out of scope.** The migration and the seeding of the four categories (T-316). The clauses and skills that file into categories, and `idle_from` (T-317). The count line (T-318). The explorer's categories root (T-276). A rank for categories.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second. The Neovim UI is tested headless on the stub hub (`nvim/test/stub-hub.ts`), read with `screenstring()`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293).
- Every key and action goes through the action registry.
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. Config tests parse `[["release", "category"], "epic"]` and `["release", "epic"]`, and refuse duplicate kinds, a leaf or `map` as a level, a malformed level and two kinds with one prefix. `cland init` writes the new default. `cland update` rewrites the old default, keeps a custom ladder and reports both.
  - done: impl-315 · 2026-10-13T07:50:26.570Z
- [x] C2. A hub test on a temporary project shows the parenting rule with a category on create, link and kind edit: a category takes no parent, an epic and a task go under it, and a category under a release is refused.
  - done: impl-315 · 2026-10-13T07:50:26.975Z
- [x] C3. A hub test shows that a category refuses a version, a status and a rank, closes only with no open children, and needs no QA verdict to close.
  - done: impl-315 · 2026-10-13T07:50:27.263Z
- [x] C4. `cland task create "Docs" --kind category` and a task created with `--parent C-<n>` work through the CLI, and `cland task list --kind category` lists the category.
  - done: impl-315 · 2026-10-13T07:50:27.556Z
- [x] C5. `hub.status` carries the nested ladder beside the flat `levels`. `crew.toml` `leads` refuses `category`. The existing `tracker-levels` and `tracker-hierarchy` tests pass unchanged on the flat form.
  - done: impl-315 · 2026-10-13T08:04:10.641Z
- [x] C6. A Neovim headless test on the stub hub shows a task in a category absent from the release scope's unscheduled fold, and an item with no parent still in it.
  - done: impl-315 · 2026-10-13T08:41:35.858Z
- [x] C7. `docs/agents/issue-tracker.md` (and its template) describes the category kind, the parenting rule with categories and the narrowed unscheduled. `hub/README.md` describes the ladder and `hub.status`. The `[tracker]` comment in `cland init`'s config describes the list at a level.
  - done: impl-315 · 2026-10-13T07:50:28.431Z

## Comments

### impl-315 · 2026-10-13T07:34:00.600Z

Implementing the nested ladder reader across tracker, hub and crew consumers. Flat hub.status levels stay compatible; category roots are excluded from release scopes and unscheduled now means no parent. Tests and init/update run only against temporary projects.

### impl-315 · 2026-10-13T07:36:39.265Z

Coordinator decision (41187c57): preserve existing epic scope cycling. The ticket's release-kind restriction applies at the root level: only the first root kind is a release scope; category and other root peers never cycle. Broader scope interaction belongs to the explorer epic.

### impl-315 · 2026-10-13T08:03:34.051Z

Full suite 685c2188 at 6cad72b: typecheck passed, 1453/1454 hub tests passed. A-1853 shows the sole failure at lead-permissions.test.ts:50: the obsolete 'unscheduled' diagnostic assertion. The focused command reproduced it red (3.2s), then passed green (4.1s) after updating the expected message and adding a forbidden response-code assertion. No production behavior changed. The next full suite waits for impl-282's reserved diagnostic-slot END.

### rev-23 · 2026-10-13T08:03:50.087Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-315-1
commit: 6cad72bbae80d015795ac4292ae64d0ab627ceb3

Medium — hub/test/lead-permissions.test.ts:50 expects the old Coordinator/unscheduled diagnostic, so the intentional “outside a release subtree” refusal fails the compatibility run before Neovim. Update the expected wording while preserving every permission/subtree assertion. No other source blocker found. Evidence A-1854: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1854-t-315-review-at-6cad72b-stale-lead-diagnostic-assertion.md; exact-head A-1853 passed typecheck and 1453/1454 tests, zero skips/cancellations; final full verification remains pending.

Criteria: C5 failed (Compatibility verification is blocked by lead-permissions.test.ts:50's stale refusal-message assertion; the exact-head full run stops before Neovim.).

### rev-23 · 2026-10-13T08:39:48.970Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-315-2
commit: 084ff280c7856ff67e947478a49cb1eac04ca449

Medium — nvim/test/shell.test.ts:1375,1622,1654,1840 still expects parented map children in unscheduled; move their glyph/claim/event/snapshot assertions to map/all views while preserving exact counts, deletion, failed-snapshot and journal checks. Medium — nvim/test/shell.test.ts:2166 expects items.backlog override on parentless T-13; use a parented backlog fixture while retaining watch/dimming/count assertions. No additional product blocker; category headless and all hub tests pass. A-1860: 1758/1763, five Neovim failures, no skips/cancellations. Evidence A-1861: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1861-t-315-full-result-review-five-stale-neovim-shell-expectations.md.

Criteria: C6 failed (Full Neovim integration has five stale shell expectations for parented map children and a parentless backlog override fixture; preserve their coverage while adapting to no-parent unscheduled.).

### impl-315 · 2026-10-13T08:41:36.897Z

A-1860: all hub tests passed; five Neovim shell cases retained old no-container semantics. The focused five-test command reproduced 0/5 passing, then passed 5/5 in 2.0s after test-only adaptations: map/all views preserve glyph/claim/grouping and delayed-snapshot uniqueness/deletion/journal coverage; the board claims scoped task T-13 and keeps the stub's current tracker source in sync with its emitted events; the backlog-override fixture has a release parent and retains watch/dim/count checks. C6 restored done. Fresh full run waits for impl-282's container-proof slot END.
