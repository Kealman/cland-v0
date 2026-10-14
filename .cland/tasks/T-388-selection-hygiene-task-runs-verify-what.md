---
id: T-388
kind: task
title: "Selection hygiene: task runs verify what the diff selects, with package rules widened to Neovim-only for nvim/** and hub-only for everything else"
state: open
status: planned
size: S
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: null
branch: null
created: 2026-10-14T12:28:09.900Z
updated: 2026-10-14T12:28:22.998Z
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
- [ ] C3. The replay over the 40 merges `83b74c6`..`f174d9c` runs full on at most 25 (37 before), and both tables (before and after) are posted on the item with one line per merge.
- [ ] C4. Measured: the phases a `nvim-only` selection runs (hub smoke plus the Neovim phase), run through `node hub/test/run-suite.ts` with that selection in `CLAND_SUITE_SELECTION` on an empty verify queue, finish in under 3 minutes (a full run is about 15); the duration line is posted on the item, and the live check after merge is the epic's demo.
- [ ] C5. Every existing `suite-selection.test.ts` assertion that still applies keeps its meaning; each changed expectation is listed in the review request with the rule that changed it.
- [ ] C6. `docs/agents/tests.md`, the Implementer clause in `default-roles.ts` and `.cland/roles.toml`, and the `qa` skill no longer prescribe `cland verify all` for task runs, and state D29's split between task runs and integrated `dev` runs.
- [ ] C7. `hub/README.md` (Tests) describes the package rules, the full set and the computed import list, and the reason strings name the deciding rule.
