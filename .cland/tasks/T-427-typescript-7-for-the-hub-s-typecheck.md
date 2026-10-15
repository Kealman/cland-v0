---
id: T-427
kind: task
title: "TypeScript 7 for the hub's typecheck: adopt it when its output matches on the whole repository"
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-324
branch: t/T-427-typescript-7-for-the-hub-s-typecheck
created: 2026-10-14T16:43:34.573Z
updated: 2026-10-15T21:27:51.337Z
closed: 2026-10-15T21:27:51.337Z
---

## What to build

Found by the web-stack research (`docs/research/web-stack.md` on `research/web-stack`, section 3's side finding and the list's item 11): TypeScript 7.0, released on 2026-07-08 as a native port, typechecks today's hub clean in 1.6 s against 18 to 26 s for TypeScript 5.9 on this machine under load, and the web probe in 0.4 s against 4.8 to 5.8 s. Every verification runs `npm run typecheck` before its tests, so each run would save about 20 seconds. Decided in `docs/spec/v0.1.3.md` §3.5: adopt it when its output matches the current one on the whole repository.

- Add the TypeScript 7 compiler as a dev dependency beside 5.9.
- Run both over what the root `npm run typecheck` covers: the hub's `bin`, `src` and `test` (`hub/tsconfig.json`) and Neovim's `bin` and `test` (`nvim/tsconfig.json`).
- Compare their diagnostics on the clean tree and, in a scratch copy, on planted errors: at least one for each strict option in `hub/tsconfig.json` (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) and one for `allowImportingTsExtensions`. Matching means the same error codes at the same files and lines.
- When they match, switch the typecheck scripts in `package.json` and `hub/package.json` to TypeScript 7. TypeScript 5.9 stays for the two tests that import the compiler API (`hub/test/executor.test.ts` and `hub/test/tracker-container-source.test.ts`), since 7.0 ships no API.
- When they differ, record the differences on this item, keep 5.9, and report a follow-up to the lead.
- Time both compilers only when `cland verify queue` has no holder and no waiter (T-204).

A new dev dependency changes the lock file, so the droplet snapshot is prepared again once; the verification worker's typecheck step needs no change, since it runs `npm run typecheck`.

## Acceptance criteria

- [x] C1. A comparison table on this item shows both compilers' diagnostics on the clean tree and on each planted error, for the hub and the Neovim projects.
  - verified: rev-30 [reviewer] · run rev-20261015-427-source · 2026-10-15T20:56:59.412Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - verified: rev-30 [reviewer] · run rev-20261015-427-final · 2026-10-15T21:24:57.552Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - done: impl-427 · 2026-10-15T21:27:06.249Z
- [x] C2. When the diagnostics match, `npm run typecheck` runs TypeScript 7 over the whole repository, with its time before and after recorded on this item; otherwise the differences are recorded, 5.9 stays and a follow-up is filed.
  - verified: rev-30 [reviewer] · run rev-20261015-427-timing · 2026-10-15T21:05:25.487Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - verified: rev-30 [reviewer] · run rev-20261015-427-final · 2026-10-15T21:24:57.552Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - done: impl-427 · 2026-10-15T21:27:07.702Z
- [x] C3. The two tests that use the compiler API still pass on TypeScript 5.9.
  - verified: rev-30 [reviewer] · run rev-20261015-427-source · 2026-10-15T20:56:59.412Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - verified: rev-30 [reviewer] · run rev-20261015-427-final · 2026-10-15T21:24:57.552Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - done: impl-427 · 2026-10-15T21:27:09.483Z
- [x] C4. `hub/README.md` and `docs/agents/tests.md` name the compiler the typecheck uses and why 5.9 remains in the repository.
  - verified: rev-30 [reviewer] · run rev-20261015-427-source · 2026-10-15T20:56:59.412Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - verified: rev-30 [reviewer] · run rev-20261015-427-final · 2026-10-15T21:24:57.553Z · commit 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
  - done: impl-427 · 2026-10-15T21:27:11.652Z

## Comments

### impl-427 · 2026-10-15T20:52:48.124Z

Baseline: TypeScript 5.9.3 and stable native TypeScript 7.0.2 both exit 0 with no diagnostics on hub/tsconfig.json and nvim/tsconfig.json. Installed 7.0.2 as pinned npm alias typescript7 beside unchanged typescript 5.9.3. Scratch-copy comparison is running with strict/option probes and a full-project allowImportingTsExtensions=false control; timing awaits an empty verify queue per T-204.

### impl-427 · 2026-10-15T20:53:46.532Z

C1 comparison receipt: A-3344 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3344-t-427-complete-compiler-diagnostic-receipt.json); reproduction script A-3343 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3343-t-427-reproducible-compiler-comparison-script.mjs). Full configs run in a git-archive scratch copy at 338f3b25, with the installed compiler dependencies symlinked; no repository source/config was altered to obtain parity. Compare sorted diagnostic (file, line, code) tuples, ignoring wording/order/column. 5.9 exits 2 on diagnostics; native 7 exits 1; both exit 0 clean.

In the table, H = hub/test/typecheck-parity.ts, N = nvim/test/typecheck-parity.ts. Each row was independently observed at the same file/line in both compiler outputs; the planted file combines the probes in one full-project compile.

| Project / probe | TypeScript 5.9.3 | TypeScript 7.0.2 |
| --- | --- | --- |
| hub clean: bin/src/test | none | none |
| Neovim clean: bin/test | none | none |
| hub strict implicit any | H:2 TS7006 | H:2 TS7006 |
| Neovim strict implicit any | N:2 TS7006 | N:2 TS7006 |
| hub strict null | H:3 TS2322 | H:3 TS2322 |
| Neovim strict null | N:3 TS2322 | N:3 TS2322 |
| hub exactOptionalPropertyTypes | H:4 TS2375 | H:4 TS2375 |
| Neovim exactOptionalPropertyTypes | N:4 TS2375 | N:4 TS2375 |
| hub noUncheckedIndexedAccess | H:5 TS2322 | H:5 TS2322 |
| Neovim noUncheckedIndexedAccess | N:5 TS2322 | N:5 TS2322 |
| hub noImplicitOverride | H:7 TS4114 | H:7 TS4114 |
| Neovim noImplicitOverride | N:7 TS4114 | N:7 TS4114 |
| hub erasableSyntaxOnly | H:8 TS1294 | H:8 TS1294 |
| Neovim erasableSyntaxOnly | N:8 TS1294 | N:8 TS1294 |
| hub verbatimModuleSyntax | H:1 TS1484 | H:1 TS1484 |
| Neovim verbatimModuleSyntax | N:1 TS1484 | N:1 TS1484 |
| hub .ts import allowed | no TS5097 | no TS5097 |
| Neovim .ts import allowed | no TS5097 | no TS5097 |
| hub allowImportingTsExtensions=false | H:1 TS5097; 1,282 total diagnostics, every tuple matches | H:1 TS5097; same 1,282 tuples |
| Neovim allowImportingTsExtensions=false | N:1 TS5097; 485 total diagnostics, every tuple matches | N:1 TS5097; same 485 tuples |

Decision: adopt pinned stable 7.0.2 via the typescript7 npm alias. Both package scripts invoke its bin/tsc explicitly to avoid the 5.9/7 executable-name collision. Root npm run typecheck passes after the switch. The original typescript@5.9.3 import/API dependency remains unchanged. Docs updated for C4. C2 timing still awaits the required empty verify queue; C3 API test files await the Mac test window.

### impl-427 · 2026-10-15T20:55:33.192Z

C3 targeted whole-file runs under the Mac test-window rules passed with the unchanged typescript@5.9.3 import: hub/test/executor.test.ts 3/3 (A-3345) and hub/test/tracker-container-source.test.ts 4/4 (attached receipt). Load was below 15 and the local suite slot/test window was free before each file. Native root npm run typecheck also passes. Source committed at 532b7cf9e1f7b045242d1cb2ddb5794b9724660b; git fetch origin && git merge origin/dev reports already up to date. No test source changes.

### rev-30 · 2026-10-15T20:56:59.412Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-427-source
commit: 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
scope: full

Source review T-427 clear at 532b7cf9e1f7b045242d1cb2ddb5794b9724660b, fixed point 338f3b25f75442b8a6e278fa056736d9171e0826. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

Standards: five-file scope is limited to two typecheck scripts, the pinned compiler dependency/lock and two compiler documentation sections. Both scripts invoke node_modules/typescript7/bin/tsc explicitly, avoiding the shared npm tsc bin name. Hub workspace hoists to the existing root node_modules layout; root continues checking both projects and preserves && failure propagation. Installed package metadata/launcher confirm typescript7 version 7.0.2 exposes bin/tsc, while typescript 5.9.3 retains lib/typescript.js. Lock comparison changes only hub dependency metadata and adds alias/native platform packages at 7.0.2, including Darwin arm64 and Linux x64; existing typescript 5.9.3 and other dependency entries are unchanged. Normal droplet preparation/candidate dependency refresh uses npm ci without omitting optional dependencies. Whitespace check clear.

C1 verified: task comment contains the comparison table; A-3343 reproducible script and complete A-3344 receipt inspected. Both full configs are clean (zero diagnostics, exit 0). Planted source in each project produces matching file/line/code tuples for strict implicit-any, strict-null, exactOptionalPropertyTypes, noUncheckedIndexedAccess, noImplicitOverride, erasableSyntaxOnly and verbatimModuleSyntax. The import probe is accepted with allowImportingTsExtensions true and emits matching TS5097 with it false. Independent comparison of receipt arrays confirms exact equality: seven planted diagnostics per project; disabled-import control 1282 hub and 485 Neovim diagnostics. Diagnostic exits differ (5.9 exits 2, 7 exits 1) but both are nonzero, matching the item's diagnostic-code/file/line definition. Script parses all noncontinuation output and compares sorted tuples, rather than trusting a success label. Receipt archives fixed point 338f3b25; only the five reviewed config/lock/docs files differ at this head, with all checked TS source and configs unchanged.

C3 verified: unchanged compiler API imports remain 'typescript', resolving pinned 5.9.3. Complete targeted whole-file receipts A-3345 executor3/3 (5.491s) and A-3346 tracker-container-source4/4 (1.503s) are green, natural completion, no failures/cancellations/skips. The installed 7 alias has no compiler API main, so retaining the original API dependency is material.

C4 verified: hub README and docs/agents/tests.md correctly name 7.0.2, explicit alias invocation, root hub+Neovim scope versus hub-only workspace, and 5.9.3's two API consumers. No performance number is asserted before measurement.

C2 deliberately unverified: scripts implement the conditional compiler switch after matching diagnostics, and current root typecheck is reported green, but before/after timing still awaits the item's fully empty verify queue requirement. Source clearance does not waive that measurement condition. Arrange it with lead T-427/Coordinator, record both compiler times and admission evidence on the item, then submit one exact-head no-mode/no-executor cland verify as requested. Timing alone need not change source/head. Final evidence clearance remains pending timing and acceptable same-head suite receipt. No per-item QA criteria. No Reviewer tests, installs, edits, merges or provider actions.

Criteria: C1 verified, C3 verified, C4 verified.

### impl-427 · 2026-10-15T21:03:47.510Z

C2 before/after timing completed at unchanged reviewed head 532b7cf9e1f7b045242d1cb2ddb5794b9724660b under Coordinator decision 24f51182 (remote holders do not consume the Mac window) and the granted exclusive Mac window. Script A-3354 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3354-t-427-alternating-compiler-timing-script.mjs); full receipt A-3355 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3355-t-427-six-compiler-timings-with-queue-and-load-receipts.json).

Method: git-archive of the reviewed HEAD in a scratch directory, same node_modules and source/configs, alternate original root/hub npm typecheck scripts (5.9.3) and reviewed scripts (7.0.2). Each root command checks both full projects. macOS arm64, Node v24.21.0. Before every repetition, local:none, 1-minute load under 15, no targeted tests. Queue monitored during each repetition; no local holder appeared. All six exit 0. Times include npm overhead and queue monitoring. Original tsc resolves to retained 5.9.3, native scripts explicitly name typescript7/bin/tsc.

| Repetition | Compiler | Root typecheck seconds | Queue start/end | 1-minute load start/end |
| --- | --- | --- | --- | --- |
| 1 | 5.9.3 | 5.826 | local: none / local: none | 3.305 / 3.280 |
| 2 | 7.0.2 | 0.872 | local: none / local: none | 3.280 / 3.338 |
| 3 | 5.9.3 | 5.689 | local: none / local: none | 3.338 / 3.551 |
| 4 | 7.0.2 | 0.896 | local: none / local: none | 3.551 / 3.551 |
| 5 | 5.9.3 | 6.868 | local: none / local: none | 3.551 / 3.586 |
| 6 | 7.0.2 | 0.984 | local: none / local: none | 3.586 / 3.539 |

Median before 5.826 s; after 0.896 s; about 6.50x faster, saving 4.929 s (84.6%) per root typecheck in this window. No source/head change for evidence. Exclusive window released in Agents with 'T-427 timing done'. Submitting same-head no-mode/no-executor cland verify after source-clear review.

### rev-30 · 2026-10-15T21:05:25.487Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-427-timing
commit: 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
scope: evidence

Timing evidence T-427 clear at unchanged source-reviewed 532b7cf9e1f7b045242d1cb2ddb5794b9724660b. C2 verified; final overall suite review remains pending running verification 79226bcf.

Coordinator 24f51182 explicitly interprets T-204 as Mac load isolation: remote holders do not block timing; local:none, one-minute load below15 and no other targeted file are required, with three alternating repetitions each and restart if local:coord appears. Coordinator e6774e66 grants the exclusive window. These decisions are independently confirmed in topic history.

A-3354 timing script and complete A-3355 receipts inspected. Head, versions, platform Darwin arm64/Node24.21.0, before/after queue/load and mid-run local-holder observations are recorded. All six repetitions exit0, no interruption, no local holder or waiters at the boundaries; remote holders are explicitly allowed by the ruling. Local load3.28–3.59. Script alternates old root npm typecheck scripts with current explicit native alias scripts in an archived same-head scratch copy. The retained npm tsc link resolves to typescript/bin/tsc (5.9.3), so the before label does not accidentally invoke the alias.

Independent median calculation: TypeScript5.9.3 times5.825657541/5.689471083/6.868390959 seconds, median5.825657541; native7.0.2 times0.871537958/0.896489459/0.983567959, median0.896489459, approximately6.50x on this Mac/window. Both root commands check hub and Neovim projects. This is the observed window measurement, not a guaranteed speedup on every host. Before/after table is recorded on the item.

C1/C3/C4 exact-head source/API evidence stands in A-3347. Running no-mode verify79226bcf fell back locally by authoritative hub notice; preserve its actual execution platform and await its completed result before final clearance. No Reviewer tests, installs, edits, merges or provider actions.

Criteria: C2 verified.

### impl-427 · 2026-10-15T21:23:54.602Z

Same-head verification 79226bcf-1a43-4159-9bf3-b74fb65456bc passed at reviewed head 532b7cf9e1f7b045242d1cb2ddb5794b9724660b: auto selected full because package configuration changed; 2,227/2,227 tests pass, no failure/cancellation/skip. Hub chose local fallback because remote slots were full. Executor darwin arm64, Node v24.21.0, Neovim v0.12.5, workers 4. Log A-3375: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3375-suite-79226bcf-1a43-4159-9bf3-b74fb65456bc-auto-at-532b7cf.log. Source/timing criteria were already verified; final review now has the green same-head receipt. No head change or additional verification submission.

### rev-30 · 2026-10-15T21:24:57.553Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-427-final
commit: 532b7cf9e1f7b045242d1cb2ddb5794b9724660b
scope: evidence

Final evidence review T-427 clear at 532b7cf9e1f7b045242d1cb2ddb5794b9724660b. No high, medium or low findings. Exact-head source review A-3347 and timing review A-3360 stand.

A-3375 /79226bcf-1a43-4159-9bf3-b74fb65456bc is actual local Darwin arm64 after hub fallback, not a Linux receipt. Full selection completes typecheck, hub and full Neovim:2227 pass, zero failures/cancellations/skips, exit0. Duration1170.09s, peak one-minute load17.52. The log explicitly shows root npm typecheck using typescript7/bin/tsc for both hub and Neovim projects. There is no hard duration-budget failure; duration-regression notices are informational.

C1 reverified: table on item plus A-3343/A-3344 reproducible full-config clean/planted parity evidence matches file/line/code tuples for all required strict/import probes in both projects. C2 reverified: native root command now succeeds in the full run, and A-3355 alternating timing under Coordinator24f51182/e6774e66 isolation rules establishes the recorded5.826s→0.896s median in that Mac window. C3 reverified: original typescript5.9.3 API dependency remains separate from the alias; both compiler API consumers pass in this full run, corroborating A-3345/A-3346 targeted3/3+4/4. C4 unchanged docs correctly describe compiler choice and retained API version.

The task requires whole-repository parity, timings, API compatibility and docs; it does not require a separate Linux receipt. No Linux installation or timing result is claimed here. Platform-specific native packages are pinned in the reviewed lock, with actual Linux deployment/integrated coverage left to normal downstream gates.

Evidence /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3375-suite-79226bcf-1a43-4159-9bf3-b74fb65456bc-auto-at-532b7cf.log. No per-item QA criteria. No Reviewer tests, installs, edits, merges or provider actions. Changed-head integration/conflict resolution needs delta review.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-15T21:27:51.337Z

Merged bd2fdba441da7926256c50049044a65474ca5592 onto dev.
