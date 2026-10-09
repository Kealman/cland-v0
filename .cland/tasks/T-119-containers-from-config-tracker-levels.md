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
updated: 2026-10-09T23:42:06.723Z
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
