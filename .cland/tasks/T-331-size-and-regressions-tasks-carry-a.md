---
id: T-331
kind: task
title: "Size and regressions: tasks carry a required size from XS to XL and an optional regression_of, through the CLI and MCP, and the clauses and skills ask for both and for a Summary"
state: open
status: planned
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by:
  - T-330
topic: null
branch: null
created: 2026-10-13T14:04:09.540Z
updated: 2026-10-13T17:28:31.509Z
---

## Summary

A task carries a `size`, an ex-ante class from `XS` to `XL` set by whoever files it, and an optional `regression_of` naming the landed task it reworks. `task.create` refuses a task without a size and names the classes. The clauses and the `to-tickets` and `plan-epic` skills ask for the size, a `## Summary` of one to three sentences and, for rework, the `regression_of` link.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.12 (What the hub records) and §3.9 (Summary). Decided in T-255 and T-244. Research: `docs/research/model-performance.md` on `research/model-performance`, sections 7 and 8. ADR 0002: both fields live in the item file.

## What to build

**The fields.** `Frontmatter` in `hub/src/tracker/item.ts` gains two optional fields, on tasks only.

- `size`: one of `XS`, `S`, `M`, `L`, `XL`. `parseItem` refuses another value and refuses a size on any other kind. `serializeItem` writes it after `status`.
- `regression_of`: an item reference. `serializeItem` writes it after `blocked_by`. `#viewOf` and the summaries show it with the target's canonical prefix, as `parent` is shown.
- Files without them stay readable. Nothing rewrites existing files.
- The index stores both in new `tracker_items` columns (`hub/src/tracker/index-db.ts`). `IndexedItem` carries them, so `task.list`, `task.view` and the `task` event show them without a file read.

**The required size.** `handleTaskRequest` in `hub/src/tracker/requests.ts` refuses `task.create` of kind `task` without `size`. The refusal reads `a task needs a size: XS, S, M, L or XL`. A size on another kind is refused, naming the kind.

- The check sits at the request layer, the one place both the CLI and MCP reach. `Tracker.create` itself still accepts a task without a size, so `cland task import-github` and the hub's own callers keep working. See the README's open points.
- `task.edit` takes `size` on a task. It changes the class and never clears it.

**`regression_of`.** `task.create` and `task.link` take `regression_of`. `task.link` also takes `none` to clear it.

- The target resolves by any prefix (`T-`, `E-` or a bare number). It must be a task, closed, with a landing receipt on `dev` (`IndexDb.mergeReceipt`). It must not be the item itself.
- Each refusal names its reason.
- `CreateInput` and `LinkInput` in `hub/src/tracker/tracker.ts` carry it.

**The CLI.** In `hub/src/cli/task.ts`: `--size` on `create` and `edit`, `--regression-of T-n` on `create` and `link`, with their `TASK_USAGE` lines. `cland task view` prints `size` and `regression_of`.

**MCP.** In `hub/src/spoke/task-tools.ts`: `size` with its enum on `task.create` and `task.edit`, and `regression_of` on `task.create` and `task.link`. The `task.create` description says a task needs a size. The spoke only reshapes. The hub validates.

**The test sweep.** Hub tests that create a task through a frame, the CLI or an MCP tool add a size. There are about 400 such sites in about 60 files. Do it as one mechanical commit of its own, apart from the feature commits, so the review reads the feature alone.

**The clauses.** In `hub/src/roles/default-roles.ts` and this repo's `.cland/roles.toml`:

- The Coordinator's and the Aide's filing rule: a task gets `--size`, a `## Summary` of one to three sentences, and `--regression-of T-n` when it reworks landed work.
- The Lead's, the Implementer's, the Reviewer's and QA's report rule from T-317: a find reported for filing names its size class.
- Keep each addition to one short sentence. The Coordinator's delivered clause sits about 8 bytes under its budget once T-322 lands (7672 of 7680 bytes, the 512-byte reserve under 8192). Cut as many bytes elsewhere in the same clause as this ticket adds. T-322's guard in `hub/test/roles.test.ts` measures every role's delivered clause.

**The skills.**

- `to-tickets` is vendored. Patch it so each ticket carries a size class, a `## Summary` and, for rework, `--regression-of`. Record the patch in `skills/PATCHES.md`.
- `plan-epic` is cland's own. The tickets it cuts carry the same three.
- `docs/agents/issue-tracker.md` and its template describe `--size`, the classes, `--regression-of`, and the `## Summary` rule. `GLOSSARY.md` gains a Size entry: an ex-ante class of a task, set when it is filed. _Avoid_: estimate, points.

**Relaunch.** The MCP tool schemas and the clauses change. Role sessions take tool lists and clauses at launch, so they relaunch after the merge, the Coordinator included.

**Dogfooding.** When this lands, the Coordinator backfills `size` on the open tasks of the current release and of the categories in one pass with `cland task edit T-n --size <class>`, and commits it on `dev`. Every ticket filed after it carries a size and a `## Summary`.

**Demo** (the epic's words). `cland task create "x" --kind task` is refused naming the classes, and `--size S --regression-of T-<n>` lands both fields in `task view`. The epic names T-254, which is still open on `dev`. The demo uses a landed task instead, for example T-321.

**Out of scope.** The verdict scope (T-332). Showing the fields on the card (E-276). Ranking or measuring by size (§3.12 leaves the measurement out of this build). A size on containers, questions, specs or maps.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). MCP refusals go through a real spoke. The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`. The sweep edits call sites, not the harness.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293), with no synchronous full tracker hydration per event (the T-321 lesson). The new fields come from index columns, so a list reads no item file.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Every role's delivered clause stays at least 512 bytes under 8192 (T-322).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Item tests: `size` parses each class, refuses another value and refuses a size on an epic. `regression_of` parses on a task and is refused on other kinds. Both round-trip, and a file without them reads unchanged.
- [ ] C2. On a temporary project with a real hub, `cland task create "x" --kind task` and `cland task create "x"` are refused naming `XS, S, M, L or XL`. `--kind epic --size S` is refused. `--size S --regression-of T-<n>` on a landed task shows both fields in `cland task view` and `--json`.
- [ ] C3. Through a real spoke, MCP `task.create` without `size` gets the same refusal. `task.edit` changes a size. `task.link` sets and clears `regression_of`. An open target, a non-task target and the item itself are each refused with their reason.
- [ ] C4. `task.list` and the `task` event carry `size` and `regression_of` from the index.
- [ ] C5. The clauses state the filing rule and the report rule. The roles snapshot tests pin the text. Every role's delivered clause stays at least 512 bytes under 8192, for the defaults and for this repo's `.cland/roles.toml`.
- [ ] C6. The `to-tickets` and `plan-epic` skills ask for a size, a `## Summary` and `--regression-of` for rework. `skills/PATCHES.md` records the vendored patch, and `hub/test/skills-tracker.test.ts` passes with the new text.
- [ ] C7. `hub/README.md`, `docs/agents/issue-tracker.md` with its template and `GLOSSARY.md` describe the size classes, the refusal, `regression_of` and the `## Summary` rule.
