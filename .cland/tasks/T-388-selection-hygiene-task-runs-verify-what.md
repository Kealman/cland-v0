---
id: T-388
kind: task
title: "Selection hygiene: task runs verify what the diff selects, with package rules widened to Neovim-only for nvim/** and hub-only for everything else"
state: open
status: review
size: S
criterion_seq: 7
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: topic-247
branch: t/T-388-selection-hygiene-task-runs-verify-what
created: 2026-10-14T12:28:09.900Z
updated: 2026-10-14T12:43:13.158Z
---

## Summary

`chooseSuiteMode` replaces its narrow allowlists with package rules. A diff wholly under `nvim/**` runs Neovim-only. A diff touching protocol, contract, package, runner or shared test files runs full, as does one touching both packages. Anything else runs hub-only. The docs, the clauses and the QA skill stop telling task sessions to run `cland verify all`, as D29 requires.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 1; research #1 (`docs/research/test-speed.md` §3.3(a), §3.10 "D29 hygiene", §1 "Selection today").

## What to build

**The rules, in `hub/src/suite-selection.ts` `chooseSuiteMode`.** Today a positive allowlist admits only `hub/src/{tracker,adapters}`, ordinary `hub/src/cli` files and package-local tests to `hub-only`. Any change under `hub/src/hub`, `hub/src/executor`, `skills/`, `docs/` or `.agents/` runs full. The new order:

1. An empty path list, or a path with a `.` or `..` segment, gives `full`. This is unchanged.
2. Any path in the full set gives `full`:
   - the existing list: `hub/src/cli/crew.ts`, `hub/src/cli/role(s).ts`, `hub/src/adapters/contract.ts`, `nvim/lua/cland/hub.lua`, `nvim/lua/cland/state.lua`, `package.json`, `package-lock.json` and `tsconfig*.json`;
   - plus `hub/src/protocol.ts`;
   - plus the runner and selection modules: `hub/test/run-suite.ts`, `hub/src/suite-selection.ts`, `hub/src/suite-shards.ts` and `hub/test/shards.json`;
   - plus every hub file that `nvim/test/**` imports directly. Today that is `hub/test/harness.ts`, `hub/test/process-cleanup.ts`, `hub/src/protocol.ts`, `hub/src/tracker/{tracker,prefixes,plan,kinds,criteria}.ts`, `hub/src/init/config.ts`, `hub/src/hub/store.ts`, `hub/src/hub/visibility.ts` and `hub/src/hub/visibility-preferences.ts`. `selectPackageSuite` computes this list from `nvim/test/**/*.test.ts` import specifiers at selection time, with a small pure parser, so a new import widens the set without an edit. `chooseSuiteMode` stays pure: the list goes in as an argument with a default.
3. Paths in both `nvim/**` and anywhere else give `full`.
4. All paths under `nvim/**` give `nvim-only`.
5. Anything else gives `hub-only`: hub code, hub tests, `docs/`, `skills/`, `.agents/`, `.cland/` (tracker included) and root docs.

The smoke baselines (`HUB_SMOKE`, `NVIM_SMOKE`) and the integrated-`dev`-is-full rule stay as they are. The reason strings in `selectPackageSuite` name the rule that decided, for example `nvim test import hub/test/harness.ts`.

**The replay.** Add a test-side script, `hub/test/selection-replay.ts`, that runs `chooseSuiteMode` over the diffs of a commit range (`git diff --name-only <merge>^1 <merge>` per first-parent merge) and prints the split with one line per merge. The Implementer runs it over the 40 merges from `83b74c6` back to `f174d9c` before and after the change and posts both tables on the item.

**Docs, clauses and skills (D29).**

- `docs/agents/tests.md` currently opens with `cland verify all --report …`. Its first command becomes `cland verify --report <item-topic> --to <reviewer-name> --to <your-name>`, with one paragraph stating D29: task runs use the diff selection; `all` only when the selection or the Coordinator asks; full suites are the Coordinator's integrated `dev` runs per batch of about three merges, at stage and epic close, and before release.
- The Implementer clause in `hub/src/roles/default-roles.ts` (line 131, "Run full suites only with `cland verify [all|hub|nvim]`…") and the project's own `.cland/roles.toml` (line 91) say "Run verification with `cland verify --report …` and no mode; it selects from your diff (D29)".
- `.agents/skills/qa/SKILL.md` line 43 keeps `all` only for a brief that requires a full suite on a non-`dev` head, and says a run on `dev` is full anyway.
- In `hub/README.md` (Tests, "`npm test` and `cland verify --report <topic>` default to diff selection…"), the description of the conservative allowlists becomes a description of the package rules, with the computed import list.

## Acceptance criteria

- [ ] C1. `chooseSuiteMode` implements the five rules above in order, and `hub/test/suite-selection.test.ts` covers each rule with at least one path list, including a docs-only diff (hub-only), a `.cland/tasks`-only diff (hub-only), an `nvim/lua/cland/hub.lua` diff (full) and a `hub/test/harness.ts` diff (full).
- [ ] C2. The hub files imported by `nvim/test/**` are computed from the source at selection time, and a test proves that adding a new import of a hub file to an `nvim/test` file makes that hub file select full.
  - failed: rev-23 [reviewer] · 2026-10-14T12:39:50.246Z · note Source-derived dependencies omit literal backtick dynamic imports and helper export-from/export-star hub dependencies, allowing hub-only selection for shared modules.
- [ ] C3. The replay over the 40 merges `83b74c6`..`f174d9c` runs full on at most 25 (37 before), and both tables (before and after) are posted on the item with one line per merge.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-388-2 · 2026-10-14T12:43:13.158Z · commit 5c5a6490d219fcb9fe1b86539bcbe8cb5328d54f
- [ ] C4. Measured: the phases a `nvim-only` selection runs (hub smoke plus the Neovim phase), run through `node hub/test/run-suite.ts` with that selection in `CLAND_SUITE_SELECTION` on an empty verify queue, finish in under 3 minutes (a full run is about 15); the duration line is posted on the item, and the live check after merge is the epic's demo.
- [ ] C5. Every existing `suite-selection.test.ts` assertion that still applies keeps its meaning; each changed expectation is listed in the review request with the rule that changed it.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-388-2 · 2026-10-14T12:43:13.158Z · commit 5c5a6490d219fcb9fe1b86539bcbe8cb5328d54f
- [ ] C6. `docs/agents/tests.md`, the Implementer clause in `default-roles.ts` and `.cland/roles.toml`, and the `qa` skill no longer prescribe `cland verify all` for task runs, and state D29's split between task runs and integrated `dev` runs.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-388-2 · 2026-10-14T12:43:13.158Z · commit 5c5a6490d219fcb9fe1b86539bcbe8cb5328d54f
- [ ] C7. `hub/README.md` (Tests) describes the package rules, the full set and the computed import list, and the reason strings name the deciding rule.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-388-2 · 2026-10-14T12:43:13.158Z · commit 5c5a6490d219fcb9fe1b86539bcbe8cb5328d54f

## Comments

### coord · 2026-10-14T12:33:03.303Z

Coordinator decision on C3 (2026-10-14 12:33Z, asked by impl-388): the replay of the prescribed rules gives full 28 / hub-only 7 / nvim-only 5, not ≤25. One refinement is allowed: a diff whose only shared-path change is hub/test/shards.json, with the runner unchanged, selects hub-only. Every other full path stays. C3 is met by the measured replay result if it is ≤28 and each remaining full is justified by its deciding file in the artifact. The research's ≤25 was an estimate. Deeper cuts belong to T-394 (coverage selection) and T-374 (shard map).

### impl-388 · 2026-10-14T12:34:35.954Z

Implementation uses ordered package rules and source-derived imports through Neovim test helpers, stopping at hub boundaries (Coordinator clarification a6a70264). Per Coordinator decision 71f374f0, shard-manifest changes alone use package rules; other shared safety paths stay full. Replay reproduces baseline full 37 / hub-only 2 / nvim-only 1 and final full 26 / hub-only 9 / nvim-only 5. Both 40-row tables, with deciding file/rule, are posted as artifacts; C3's original ≤25 estimate was corrected by the Coordinator to measured ≤28. Selection tests and clause/QA tests pass; C4 will be measured once after source review, on an empty queue, as expressly authorized.

### rev-23 · 2026-10-14T12:39:50.246Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-388-1
commit: 56cc2c9d2d3105bf352ae3a1ad6ede1316fa193e
scope: full

Medium — hub/src/suite-selection.ts:72: literal() excludes no-interpolation template dynamic imports, so an imported hub module can incorrectly select hub-only.
Medium — hub/src/suite-selection.ts:74: helper re-export dependencies are ignored, so a test importing a barrel helper does not widen its hub dependency to full.
All eight changed files reviewed. Package rules, shard refinement, 40-row replay (26 full under revised ≤28), changed expectations and D29 docs otherwise match scope. C4 timing and merge verification remain pending corrected source clearance. Evidence A-2360: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2360-t-388-source-review-incomplete-dependency-parsing.md.

Criteria: C2 failed (Source-derived dependencies omit literal backtick dynamic imports and helper export-from/export-star hub dependencies, allowing hub-only selection for shared modules.).

### impl-388 · 2026-10-14T12:41:30.860Z

Fixed both C2 findings from rev-2026-10-14-388-1 at pushed head 5c5a6490: literal backtick dynamic imports now enter the shared set, named/star/type helper re-exports are followed, and interpolated dynamic imports fail closed to full. Parser and admission regressions added; 61/61 selection tests pass, hub typecheck and diff check pass. Replay remains 26 full / 9 hub-only / 5 Neovim-only. New source review requested before any suite or C4 measurement.

### rev-23 · 2026-10-14T12:43:13.158Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-388-2
commit: 5c5a6490d219fcb9fe1b86539bcbe8cb5328d54f
scope: full

Corrected source clear; no high or medium findings. Literal backtick imports and helper named/star/type re-exports are collected; interpolated templates fail closed to full with a reason. Added parser/admission cases retain helper cycles, hub boundary and existing assertions. C3 replay remains 40 rows, 37/2/1 → 26/9/5 under Coordinator's revised ≤28 criterion; C5 accounting and C6/C7 docs/clauses are source-established. C1/C2 await exact-head verification; C4 awaits the explicitly authorized empty-queue Neovim-only timing check. Use no-mode cland verify under D29. Evidence A-2368: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2368-t-388-corrected-source-clear-at-5c5a6490.md.

Criteria: C3 verified, C5 verified, C6 verified, C7 verified.
