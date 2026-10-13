---
id: T-331
kind: task
title: "Size and regressions: tasks carry a required size from XS to XL and an optional regression_of, through the CLI and MCP, and the clauses and skills ask for both and for a Summary"
state: closed
status: done
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by:
  - T-330
topic: topic-211
branch: t/T-331-size-and-regressions-tasks-carry-a
created: 2026-10-13T14:04:09.540Z
updated: 2026-10-13T19:30:23.565Z
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

- [x] C1. Item tests: `size` parses each class, refuses another value and refuses a size on an epic. `regression_of` parses on a task and is refused on other kinds. Both round-trip, and a file without them reads unchanged.
  - done: impl-331 · 2026-10-13T17:46:40.701Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.397Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C2. On a temporary project with a real hub, `cland task create "x" --kind task` and `cland task create "x"` are refused naming `XS, S, M, L or XL`. `--kind epic --size S` is refused. `--size S --regression-of T-<n>` on a landed task shows both fields in `cland task view` and `--json`.
  - done: impl-331 · 2026-10-13T17:46:41.014Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.397Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C3. Through a real spoke, MCP `task.create` without `size` gets the same refusal. `task.edit` changes a size. `task.link` sets and clears `regression_of`. An open target, a non-task target and the item itself are each refused with their reason.
  - done: impl-331 · 2026-10-13T17:46:41.299Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.397Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C4. `task.list` and the `task` event carry `size` and `regression_of` from the index.
  - done: impl-331 · 2026-10-13T17:46:41.599Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.397Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C5. The clauses state the filing rule and the report rule. The roles snapshot tests pin the text. Every role's delivered clause stays at least 512 bytes under 8192, for the defaults and for this repo's `.cland/roles.toml`.
  - done: impl-331 · 2026-10-13T17:46:41.891Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.397Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C6. The `to-tickets` and `plan-epic` skills ask for a size, a `## Summary` and `--regression-of` for rework. `skills/PATCHES.md` records the vendored patch, and `hub/test/skills-tracker.test.ts` passes with the new text.
  - done: impl-331 · 2026-10-13T17:46:42.184Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.398Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
- [x] C7. `hub/README.md`, `docs/agents/issue-tracker.md` with its template and `GLOSSARY.md` describe the size classes, the refusal, `regression_of` and the `## Summary` rule.
  - done: impl-331 · 2026-10-13T17:46:42.473Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-1 · 2026-10-13T17:48:54.057Z · commit 6fc0eb83b90efb84d6d16f1598d4cb01ca100b42
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-3 · 2026-10-13T18:40:12.197Z · commit 93eebe9bbb1da7edee89f82bb24c5ebd39fa10c7
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-5 · 2026-10-13T18:59:07.401Z · commit 0f96f5abacb14d038a1ab4706147147ecfea4d6a
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-7 · 2026-10-13T19:16:07.559Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81
  - verified: rev-23 [reviewer] · run rev-2026-10-13-331-8 · 2026-10-13T19:30:11.398Z · commit 854c2095154d5024cb3a5af7e13adaa8dd388d81

## Comments

### impl-331 · 2026-10-13T17:39:05.164Z

Implemented required task size at the shared request layer and indexed size/regression fields through CLI and MCP. Mechanical fixture sweep is isolated in b54c404a (77 files). Targeted tracker and real-spoke checks pass. Offline --sizes JSON backfill has scratch dry-run, byte-preserving apply, no-write rerun, invalid-assignment refusals and old-id resolution coverage; live apply remains the Coordinator's restart step. Finishing clause/skill documentation and bounded-list checks before source review.

### rev-23 · 2026-10-13T17:48:54.057Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-1
commit: 6fc0eb83b90efb84d6d16f1598d4cb01ca100b42

No high, medium, or low source findings. Separate fixture sweep preserves assertions/harness/bounds. Required size stays at the request layer; task-only parse/edit/index fields and numeric landed regression validation/clearing match scope. Explicit offline assignment safeguards, clause compression and skills patch reviewed. C7 docs verified; C1–C6 await complete same-head full evidence, including headroom/skills guards. Wait for E-268 END before submission. Evidence A-2020: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2020-t-331-full-source-review-clear-at-6fc0eb83.md.

Criteria: C7 verified.

### rev-23 · 2026-10-13T18:37:26.680Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-2
commit: 6fc0eb83b90efb84d6d16f1598d4cb01ca100b42

Medium — hub/test/permissions.test.ts:127 omits size from the allowed Coordinator create case; required-size validation refuses it and aborts permission/audit coverage. Add size while retaining all allowed/refused/Agents/audit assertions and forbidden-case precedence checks. A-2024 fails 1/1521 and does not reach Neovim; no product criterion failure inferred, C1–C6 final verification pending, C7 retained. Evidence A-2025: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2025-t-331-full-verification-not-clear-permission-fixture-missing-size.md.

### rev-23 · 2026-10-13T18:40:12.197Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-3
commit: 93eebe9bbb1da7edee89f82bb24c5ebd39fa10c7

No high, medium, or low source findings remain. Three permission-table create fixtures now supply size, preserving allowed/refused/notice/audit assertions. Product source unchanged; incoming tracker/QA/spec amendments reviewed without feature scope change. A-2020 assessment applies; C7 refreshed, C1–C6 await complete same-head full evidence. Evidence A-2027: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2027-t-331-permission-fixture-delta-source-clear-at-93eebe9b.md.

Criteria: C7 verified.

### rev-23 · 2026-10-13T18:54:10.778Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-4
commit: 93eebe9bbb1da7edee89f82bb24c5ebd39fa10c7

Medium — nvim/test/shell.test.ts:1675 searches/folds before reconnect snapshots render; A-2029 shows E486 and a later folded unscheduled (1). Preserve fresh-row and zero snapshot/pending assertions with a readiness wait. Unchanged dev test; Coordinator df6e96b9 requires standalone shared fix/delayed replay proof. Full result 1842/1843, one failure, both packages/typecheck ran. No product criterion failure inferred; C1–C6 final verification pending, C7 retained. Evidence A-2030: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2030-t-331-full-verification-not-clear-reconnect-readiness-race.md.

### rev-23 · 2026-10-13T18:59:07.401Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-5
commit: 0f96f5abacb14d038a1ab4706147147ecfea4d6a

No high, medium, or low source findings remain. Standalone shared 7d9bb4d reviewed separately: heading readiness precedes original search/fold; fresh-row and zero snapshots/pending assertions retained. Cherry-pick identical; other incoming changes tracker-only. A-2032 dev/head delayed red and green support the fix. C7 refreshed; C1–C6 await complete same-head full evidence. Evidence A-2034: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2034-t-331-shared-reconnect-wait-and-source-delta-clear-at-0f96f5ab.md.

Criteria: C7 verified.

### rev-23 · 2026-10-13T19:12:48.388Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-6
commit: 0f96f5abacb14d038a1ab4706147147ecfea4d6a

Medium — nvim/test/inbox-actions.test.ts:108 selects Give an answer after connection alone, before inbox row readiness; A-2035 throws missing Give an answer. Preserve free answer, failed draft/target, needs-you and exact frames while fixing the inherited shared test (Bugs, S). Typecheck/both packages ran, 1842/1843 pass, one fail; no product criterion failure inferred. C1–C6 final verification pending, C7 retained. Evidence A-2036: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2036-t-331-full-verification-not-clear-inbox-row-readiness.md.

### rev-23 · 2026-10-13T19:16:07.559Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-7
commit: 854c2095154d5024cb3a5af7e13adaa8dd388d81

No high, medium, or low source findings remain. Shared 7fd169d4 separately clear: row readiness before original selection/r, preserving free-answer, failed draft/target, needs-you and exact frames. Cherry-pick matches, remaining dev delta tracker-only; A-2037 delayed red/green supports the fix. Product source unchanged; C7 refreshed, C1–C6 await complete same-head full evidence. Evidence A-2039: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2039-t-331-shared-ask-row-wait-and-source-delta-clear-at-854c2095.md.

Criteria: C7 verified.

### rev-23 · 2026-10-13T19:30:11.398Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-331-8
commit: 854c2095154d5024cb3a5af7e13adaa8dd388d81

No high, medium, or low findings remain. Complete exact-head A-2042 plus source assessments establish C1–C7: size/regression validation and indexed fields, CLI/MCP compatibility, clauses/headroom, skills and docs. Typecheck/all phases pass 1843/1843, zero skips/cancellations. Permission and shared readiness regressions pass; completion 47 queries/no full lists/files. Evidence A-2043: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2043-t-331-final-exact-head-review-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-13T19:30:23.565Z

Merged c5a7a89c26d18aac343132cb88f2ac454aed3de2 onto dev.
