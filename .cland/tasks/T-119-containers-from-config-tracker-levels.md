---
id: T-119
kind: task
title: "Containers from config: [tracker] levels replaces the hard-coded container kinds; a container with open children cannot close"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-118
topic: topic-44
branch: t/T-119-containers-from-config-tracker-levels
created: 2026-10-09T21:56:19.667Z
updated: 2026-10-10T00:56:58.683Z
---

## Parent

T-107 (v0.1 release and status), slice 2 of 6. Spec §3.1 (Levels, Parenting rule, Closing a container, Tools).

## What to build

Container kinds come from `levels` in `.cland/config.toml`, `[tracker] levels = ["release", "epic"]` by default, ordered top-down. They replace every hard-coded container kind in the hub, the item parser and the CLI; the sizing counted about twenty sites. Leaf kinds stay fixed: `task`, `question` and `spec`. `map` stays outside the ladder, and its children are questions. The parenting rule from slice 1 now reads the configured levels. An item file whose kind is neither a configured level nor a leaf is refused when indexed, with a notice naming the file. It is never dropped silently.

Closing a release or an epic with open children is refused by the hub, with no force flag. The refusal names the open children. `cland init` writes the default `[tracker] levels`, and `cland update` keeps a changed value.

## Acceptance criteria

- [ ] With the default config, behaviour matches slice 1. In a scratch project with `levels = ["release", "epic", "feature"]`, a feature under an epic is accepted, and a feature under a release is refused.
- [ ] An item file with an unknown kind is refused when indexed, with a notice, and the rest of the tracker still loads.
- [ ] Closing the v0.1 release item, or an epic, with open children is refused and names them; with all children closed it succeeds.
- [ ] No container kind is hard-coded outside the config defaults, which a test proves, for example by a search over `hub/src` in the test suite.
- [ ] `cland init` writes the levels; `cland update` keeps a changed value; `hub/README.md` documents `[tracker] levels`.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Risk from the sizing: the hard-coded kinds are spread across the hub, so sweep them all in one change, and do not convert them one example at a time (A-96, class G). Defaults against instances: this project's `.cland/config.toml` does not inherit a new default, so list the exact line it needs in your report, and the Coordinator commits it.

## Comments

### impl-119 · 2026-10-09T23:01:55.078Z

Implementation started: configured hierarchy and unknown-kind indexing through the existing hub/CLI seams; queued close guard naming open children; init/update defaults and Neovim predicates. Retain approved map question/task children and spec leaf behavior.

### impl-119 · 2026-10-09T23:07:41.865Z

Configured third-level CLI/MCP/frame behavior is green; close and state-edit refusals name open children and preserve files. Unknown-kind startup/hand-edit indexing now posts Agents refusal notices and removes stale indexed kinds; this test is green. Top-level metadata, empty ladders, invalid config fallback, queue ordering, init/update and Neovim coverage are being completed.

### impl-119 · 2026-10-09T23:13:26.073Z

Review fix head 4b74070f4dd2a7a76c40a6f8d7bfa85c468ac700, pushed to origin. Internal spec review found task.import could close an existing open container over open children; a real frame regression reproduced it, then passed with checks after latest-file read and before rename. Source guard scans hub/src, hub/bin and Neovim Lua; the only script exception is the already-run repository-specific migrate-v01-release.ts, approved by Coordinator. Typecheck passed; full suite will use the final review head.

### rev-65 · 2026-10-09T23:17:26.395Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-1
commit: 4b74070f4dd2a7a76c40a6f8d7bfa85c468ac700

High: 0. Medium: 3. Low: 0.

Medium — hub/src/tracker/tracker.ts:1085: re-importing an open container as closed while removing its container label changes the incoming kind to task, so #checkClose skips its open children and commits the close; guard the existing container and prevent kind conversion leaving children under a leaf (Spec §3.1).

Medium — hub/src/tracker/tracker.ts:420 and :507: every parse failure now evicts the indexed row, contrary to hub/README.md:831; malformed child frontmatter removes an open child from the close check and allows its parent to close. Evict unconfigured kinds while preserving the last indexed version for other parse failures (Standards).

Medium — hub/test/tracker-container-source.test.ts:29: reintroducing `if (labels.includes('release')) return 'release'` in kindOfLabels passes the guard because neither literal gets a recognized container context; broaden the source guard and show this mutation fails (Spec acceptance criterion).

Evidence: A-254, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-254-t-119-review-of-4b74070-three-medium-findings.md. Pinned actual-method/pure-module probes used in-memory file/index ports and reproduced all three; no suite or repository edits. Reviewed full change against 9ddfd79, including d03e8b3 and 4b74070. Standards: 1 finding, worst medium. Spec: 2 findings, worst medium.

### impl-119 · 2026-10-09T23:26:11.972Z

Review delta reproduced and fixed all three rev-65 findings: removed import labels cannot bypass close; malformed child files retain their last known rows and refuse close by filename, while only unknown kinds evict; source guard rejects planted importer label literals. Close refreshes known child files in the tracker queue. Typecheck, tracker-async 29/29, native-boundary 29/29 and source-guard 2/2 pass; final levels regression rerun pending.

### impl-119 · 2026-10-09T23:30:26.289Z

Review fixes committed/pushed; git log -1 head 263c1bcfc2940aa30780dcd4d87b6385e2fd8ebc. A-260 records delta, decisions/config line, and targeted evidence at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-260-t-119-review-delta-at-263c1bc.md. Final targeted checks: typecheck, levels 11/11, async 29/29, native-boundary 29/29, source guard 2/2; internal Standards and Spec clear. Full suite pending official delta clearance.

### rev-65 · 2026-10-09T23:35:16.118Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-2
commit: 263c1bcfc2940aa30780dcd4d87b6385e2fd8ebc

High: 0. Medium: 2. Low: 1.

Medium — hub/src/tracker/tracker.ts:927: refresh selects only previously indexed children; a known item hand-reparented from null to T-1 before close, ahead of watcher admission, is never read, so T-1 closes over its disk child. Kind-only conversion also commits T-1 as a leaf with that child. Discover/refresh relationship changes before validating closure and kind changes. This precedes the accepted final check→rename window.

Medium — hub/test/tracker-container-source.test.ts:21/:32: module-gated kind-context recognition still accepts `const container = item.kind === 'release'` in hub/src/hub/dispatch.ts; protect kind predicates throughout scanned production sources. The importer label mapping is now caught, but the full source-guard acceptance criterion remains incomplete.

Low — hub/src/tracker/tracker.ts:927/:938/:948: possible Duplicated Code/Feature Envy (heuristic): repeated full index.list hydration loads unrelated labels/blockers for every refresh/check; share a direct-child query. No timing breach demonstrated.

Original A-254 failures are resolved: import label removal refuses, malformed rows remain and block by filename, closed children prevent kind conversion, hand conversion logs a warning, and old label-mapping literals are detected. Actual pinned virtual-port probes confirmed the two new mediums; known-child reopening during temp write correctly refuses, preserves the parent and cleans the temp file. No suite or edits; full item covered against 9ddfd79, carrying unchanged checks forward.

Standards: 1 low. Spec: 2 medium. Evidence A-265: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-265-t-119-review-of-263c1bc-child-discovery-and-source-guard-gaps.md.

### impl-119 · 2026-10-09T23:40:29.968Z

Second review delta: replaced indexed-child selection with one final async directory scan reading all task parents, shared by close/edit/import/merge-close. Any unreadable file blocks and is named; an unindexed disk reparent is included. Old repeated hydration/unreadable-parent cache removed; index-only hand-warning queries direct children. Context-based source guard is global across scanned modules, with dispatch comparator refusal and release frame acceptance. Levels 13/13, source 4/4 and async29/29 pass; final targeted/typecheck checks finishing. Queued npm suite on 263c1bc cancelled via its runner, exit143.

### impl-119 · 2026-10-09T23:42:06.723Z

Second review fixes committed/pushed; head copied from git log -1: 87a1e08a46b3d8258a8ba0622e421a5c409e7aa9. A-267 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-267-t-119-disk-child-discovery-and-source-guard-at-87a1e08.md records disk-wide discovery, source-context guard, narrowed defaults exemption and regressions. Typecheck, levels13/13, async29/29, native29/29, source5/5 pass; internal review clear. Worktree clean. Full suite awaits official delta clearance.

### rev-65 · 2026-10-09T23:47:03.505Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-3
commit: 87a1e08a46b3d8258a8ba0622e421a5c409e7aa9

High: 0. Medium: 2. Low: 0.

Medium — hub/src/tracker/tracker.ts:918: fail-fast Promise.all releases the failed scan's tracker admission while sibling reads/parses are pending; a following queued write commits before a held scan read settles. Drain all started reads before propagating the filename refusal (A-96 partial-failure class; queued-read/drain contract).

Medium — hub/test/tracker-container-source.test.ts:34/:36/:50: operational variable/helper-name exemptions still suppress definite item-kind comparisons; `const LIFECYCLE_KINDS = items.filter(item => item.kind === 'release')` and `const clearPublicationReceipt = (kind: Kind) => kind === 'release'` both pass. Flag .kind/Kind comparisons irrespective of surrounding names, retaining operational vocabulary allowances.

Pinned virtual-port probes reproduced both. Pre-scan reparented children now correctly block close/leaf conversion using one directory pass, no index.list call, old parent intact and temp cleaned. Known-child reopening and malformed/unknown filename refusals also pass. Original importer/dispatch mutations are caught and frame.type release is allowed. The previous whole-index cost low is resolved by disk snapshots/direct-child warning queries.

Cost: one listing + N async reads/parses and O(N) snapshot/pending-read memory per relevant operation; K import transitions may scan K times. No measured timing breach. Custom initiative→feature tests cover parenting/close and both Neovim predicates. Full item reviewed against 9ddfd79, carrying earlier unchanged checks forward; no suite or file edits.

Per Coordinator clarification, disk edits during scan through rename are accepted and are not findings; README should name that full window. Standards: 1 medium. Spec: 1 medium. Evidence A-270: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-270-t-119-review-of-87a1e08-scan-drain-and-guard-exemption-findings.md.

### impl-119 · 2026-10-09T23:50:39.191Z

Third review fixes committed/pushed at git log -1 head 57148b7dea3e633168dd8c94bab583a077c6a66c: allSettled drains scan reads and aggregates failed files before queue release; definite-kind comparisons override operational-name exemptions; README records accepted scan-plus-rename edits. A-271: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-271-t-119-scan-draining-and-definite-kind-guard-at-57148b7.md. Typecheck, async30/30, affectedlevels4/4, source6/6 pass; internal residual review clear. Superseded suite cancelled exit143; waiting T120 landing for single rebase and combined-container status check.

### rev-65 · 2026-10-09T23:54:37.997Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-4
commit: 57148b7dea3e633168dd8c94bab583a077c6a66c

High: 0. Medium: 1. Low: 0.

Medium — hub/test/tracker-container-source.test.ts:46–48/:72: definite-kind detection checks explicit declaration annotations but misses inferred/destructured bindings. The actual pinned guard accepts `const LIFECYCLE_KINDS = (kind: Kind) => { const value = kind; return value === 'release'; };` and `const clearPublicationReceipt = (item: {kind: Kind}) => { const {kind: value} = item; return value === 'release'; };`. Both compare inferred Kind values with a default-level literal and return no failures, contrary to the Coordinator's any-Kind-typed-value requirement. Follow bindings/inference and plant these mutations; this remains the original guard class.

Scan-drain medium resolved: with one held read and two failures, actual-method virtual-port probes keep both refusal and the next queued write pending with zero renames. After release, both failed filenames are reported, the parent stays unchanged, temporary files are cleaned and the following write commits. Original direct typed/.kind guard bypasses now fail. README names the accepted scan-plus-rename interval, which is not a finding.

Full item reviewed against 9ddfd79, carrying earlier unchanged checks forward; no suite or file edits. Standards: 0 findings. Spec: 1 medium. Evidence A-272: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-272-t-119-review-of-57148b7-scan-drain-resolved-inferred-kind-guard-gap.md.

### impl-119 · 2026-10-10T00:04:03.534Z

Rebased once onto dev 7e3797d with T-120 and T-125. Compiler type-checker guard now follows inferred/destructured Kind aliases without new call-site Kind casts. Combined regression covers custom-container status refusal and status transitions on close/kind conversion/reopen. Internal review exposed watcher status migration skipping the conflicting hand-kind-change warning; reproduced by the existing regression and moved the warning before migration. Targeted verification in progress; no full suite pending.

### impl-119 · 2026-10-10T00:05:16.751Z

Rebased/fixed head copied from git log -1: b4c9d4a9e08102dc8e16e026d087ad37ade373a3, pushed to local origin. A-278 records integration, decisions/config line and targeted results: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-278-t-119-rebased-compiler-guard-and-status-integration-at-b4c9d4a.md. Typecheck passed; levels14/14, status11/11, async30/30, source2/2 passed. Internal review clear after watcher status-migration warning fix. Full suite pending official delta clearance.

### rev-65 · 2026-10-10T00:07:53.598Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-5
commit: b4c9d4a9e08102dc8e16e026d087ad37ade373a3

High: 0. Medium: 1. Low: 0.

Medium — hub/test/tracker-container-source.test.ts:52/:59–62: compiler guard accepts `kind == 'release'`, `kind != 'release'`, `['release'].includes(kind)` and `new Set(['release']).has(kind)`. The operator list omits loose equality, and membership checks only a Kind-bearing receiver, missing a Kind argument against a literal collection. Actual pinned TypeScript-checker probes return [] for each with zero virtual sample semantic diagnostics. These retain Kind and do not use the accepted any/unknown/cast exception; cover ordinary operators and both membership orientations.

Previous inferred/destructured Kind aliases now fail. T-120 integration is clear: actual #write callback order refresh→precommit→rename→index→committed preserves precommit scans and post-index claims; parser/status normalization remains task-only. Actual resumed watcher migration now emits the conflicting parenting filename warning before migration returns. Earlier scan-drain, disk discovery, malformed/unknown handling, custom-level, init/update and Neovim checks carry forward.

Full item reviewed against dev 7e3797d; no suite or edits. Standards: 0 findings. Spec: 1 medium. Evidence A-280: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-280-t-119-rebased-review-of-b4c9d4a-semantic-predicate-guard-gaps.md.

### impl-119 · 2026-10-10T00:10:04.956Z

Guard-only review delta committed/pushed at 41484da847a90fc8b657eed3110867191b1dad90. Equality ==/!=/===/!== and includes/has in both orientations covered; array/Set/Map receiver literals and initializer aliases tested against Kind arguments, with operational release counterparts accepted. Source2/2, typecheck pass. Superseded b4c9d4a suite cancelled while queued via runner, exit143. No new full suite pending until official delta verdict.

### rev-65 · 2026-10-10T00:11:44.830Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-119-6
commit: 41484da847a90fc8b657eed3110867191b1dad90

High: 0. Medium: 1. Low: 0.

Medium — hub/test/tracker-container-source.test.ts:44/:57–61/:69–70: ordinary operand/binding forms still bypass the guard. Actual pinned compiler probes accept `kind === ('release')`, `const literal = 'release'; kind === literal`, and `const vocabulary = { values: ['release'] }; vocabulary.values.includes(kind)` with [] and zero sample semantic diagnostics. flag only handles bare literal AST nodes; collection traversal ignores property initializers. Kind remains typed, with no any/unknown/casts. Normalize operands and follow ordinary literal/property bindings, then plant these cases; this remains the required predicate class.

A-280's four examples now fail, along with Set/Map and identifier aliases. Operational frame equality and array/Set/Map membership stay accepted. Accepted Map-value overflagging is not a finding. Production is unchanged, so prior status/callback/watcher, scan-drain, indexing, configured hierarchy, init/update and Neovim clearance carries forward. Full item covered against 7e3797d; no suite or edits.

Standards: 0 findings. Spec: 1 medium. Evidence A-285: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-285-t-119-review-of-41484da-ordinary-literal-and-property-binding-gaps.md.

### impl-119 · 2026-10-10T00:15:17.676Z

Final guard head e6bf9b69be17daadccbf45e4c7e5aaf5847611ff committed/pushed. Both operands checked by compiler types, with inline array/Set/Map literal fallback; parentheses/const/as-const and prior direct samples covered. Mutable variable/object widening is the approved exclusion, documented in header. Source2/2/typecheck pass on committed head. Existing full runner verified still queued after commit; log renamed for e6bf9b6. Final levels output pending capture; no production changes since cleared integration.

### rev-65 · 2026-10-10T00:16:27.147Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-119-7
commit: e6bf9b69be17daadccbf45e4c7e5aaf5847611ff

High: 0. Medium: 0. Low: 0.

Clear under the Coordinator's final type-based guard rule. Actual pinned compiler probes reject parenthesized/reversed comparisons, const literal bindings, inferred/destructured Kind aliases, all equality forms, switch cases, inline array/Set/Map membership and literal-preserving as-const collections/property receivers/aliases. Operational counterparts remain accepted.

Earlier mutable-array/object/Set bindings whose level literals widen away are now deliberately accepted under the explicit exception in 1e5bab06 and 4efc27d4; their as-const counterparts fail. Any/unknown/type-erasing casts and accepted Map-value overflagging are not findings. The guard header names the widening boundary.

Production is unchanged, so A-280's status/callback/watcher integration and earlier scan-drain, indexing, hierarchy, importer, init/update and Neovim clearance carry forward. This verdict covers the full item against 7e3797d. No suite, repository typecheck or edits; focused virtual compiler sample diagnostics are explained in the artifact.

Standards: 0 findings. Spec: 0 findings. Evidence A-288: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-288-t-119-final-guard-review-of-e6bf9b6-clear.md.

### impl-119 · 2026-10-10T00:25:23.538Z

Environment investigation stopped per Coordinator; no source changes. A-297 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-297-t-119-environment-findings-and-deferred-cli-storage-imports.md) records environment, same-warning baseline/T119 evidence A-293, older eager CLI→storage chains and proposed no-SQLite-load/no-warning guard for separate tech debt. Explicit NVM24 asks CLI run passes4/4; final code head remains e6bf9b69be17daadccbf45e4c7e5aaf5847611ff clean/pushed. Coordinator's replacement full suite owns merge evidence; local superseded suite cancelled exit143.

### impl-119 · 2026-10-10T00:37:24.006Z

Article fix committed/pushed at 9c3cb01980e491736d3709d76cffe3ab62003c65. Shared kindWithArticle chooses a/an by first letter and covers worktree, parenting, close and version phrases. Existing worktree assertions preserved; configured initiative/feature regression red then green. Explicit NVM24 targeted worktrees9/9, levels14/14, source2/2 and typecheck pass; internal review clear. Full package suite starts on this committed head using NVM24 PATH.

### rev-65 · 2026-10-10T00:42:47.210Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-119-8
commit: 9c3cb01980e491736d3709d76cffe3ab62003c65

High: 0. Medium: 0. Low: 0. Standards: clear. Spec: clear.

Full item against 7e3797d; carries forward rev-65-119-7 / A-288 for unchanged behavior. The six-file article delta restores “an epic”, handles configured “an initiative” and “a feature”, and preserves the worktree, parenting, close and version refusal meanings. The helper introduces no default-level literal comparison under the agreed guard rule. Original worktree assertions remain unchanged; the configured regression checks both articles and no worktree creation.

Read-only pinned in-memory probes passed; no suite was run. Evidence: A-311, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-311-t-119-article-helper-review-of-9c3cb01-clear.md.

### impl-119 · 2026-10-10T00:56:58.683Z

Implementation complete on 9c3cb01980e491736d3709d76cffe3ab62003c65. Configured container kinds now cover the parser, hub, CLI and Neovim; queued close and kind changes scan disk children and fail closed. Regression tests and source guard included. Final root npm test exit 0: hub 770/770, Neovim 123/123; both typechecks passed with explicit nvm v24.21.0. Final log A-316: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-316-t-119-full-hub-and-neovim-suite-passes-on-9c3cb01.log. Official review rev-65-119-8 clear; awaiting Coordinator merge.
