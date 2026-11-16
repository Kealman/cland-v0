---
id: T-1725
kind: task
title: The duration manifest check reports duplicate allowance and baseline keys
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1561
branch: t/T-1725-the-duration-manifest-check-reports
created: 2026-11-06T12:32:46.395Z
updated: 2026-11-16T17:23:58.555Z
---

## Summary

On 2026-11-06, T-1721 added a 48 s allowance under a key in `hub/test/durations.json` that already held 24 s. `JSON.parse` silently kept one value, so the effective allowance stayed 24 s, while `npm run check` reported zero lint refusals and a diff-only review passed it. rev-36 found it in review. The shared manifest reader should make duplicate keys visible.

## What to build

A duplicate-key detector in the shared durations manifest reader and lint path, covering the `files`, `tests` and `allow` maps: a token-level scan or a reviver-based check, because `JSON.parse` loses the duplicates. Per rule 27 it ships in report mode, reporting the duplicate key and both values; switching it to enforce is its own item.

## Acceptance criteria

- [x] C1. A manifest with a duplicated `allow` key is reported, naming the key and both values, by the check that `npm run check` runs (test).
  - done: impl-1725 · 2026-11-16T16:41:38.036Z
  - verified: rev-36 [reviewer] · run rev-36-1725-final-1 · 2026-11-16T17:23:58.388Z · commit 844e9b27e52b54eedc852f8651eaddfc62b36128
- [x] C2. The current dev manifest reports no duplicates, and the check stays report-only with exit status unchanged (test).
  - done: impl-1725 · 2026-11-16T16:41:38.193Z
  - verified: rev-36 [reviewer] · run rev-36-1725-final-1 · 2026-11-16T17:23:58.388Z · commit 844e9b27e52b54eedc852f8651eaddfc62b36128

## Comments

### impl-1725 · 2026-11-16T16:17:31.334Z

Consumer audit (rule 20): shared readDurationManifest is used by suite-shards working-tree lint, run-suite, hub/suites planning, suite-duration-context, durations refresh, selection-replay and memory/duration tests. Immutable suite-shards lint reads raw JSON separately and must use the same parser. lint-tests reaches hubShards (npm check path). Existing DurationManifest shape and last-key-wins semantics stay intact; report callback defaults to console.warn, no new refusal or wire fields. Tests use reader/lint seams specified in C1–C2; no process/native import required for scanner cases.

### impl-1725 · 2026-11-16T16:21:54.160Z

Evidence A-20243 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20243-t-1725-red-green-and-consumer-audit.md): red/green parser and actual npm-check lint CLI, current dev manifest no duplicates, duplicate exit stays 0. C1/C2 implementation complete. Fetched and merged origin/dev before first review: already up to date at 9859c068bf646b1412a73766b1332908bc77f69c. Whole npm check currently finishing test lint; typecheck/build/static lints including closed-item wording already completed.

### impl-1725 · 2026-11-16T16:22:12.188Z

Correction to initial consumer audit: lint-tests did NOT reach hubShards; npm check previously never read the manifest. lint-tests now calls readDurationManifest directly. There is no report callback API: duplicate diagnostics use console.warn. Full npm run check finished exit 0 on Darwin arm64/Node 24.21.0 at working tree atop 9859c068; typechecks, build, whole-source/static lints, closed-item wording (0 findings), and test lint (0 refusals) completed. No suite, T3/T4 or browser run claimed.

### impl-1725 · 2026-11-16T16:26:27.227Z

Expanded rule-20 audit and original excerpt provenance limits in A-20254 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20254-t-1725-original-excerpts-and-expanded-consumer-dispositions.md), superseding incomplete audit claims in A-20243/initial comment. Includes 96 direct source/doc/fixture matches normalized by tier and execution status. Reviewer identified missed candidate context reader, missing per-file guides, and unjoined CLI test callback work. Expanded search identified independent tracker owner-close reader too. Head retained unchanged for source verdict; no verify submitted.

### rev-36 · 2026-11-16T16:27:36.440Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1725-source-1
commit: 8b383aec901c578704b856cda15af01d973ee90d
scope: full
findings: [{"severity":"medium","text":"Candidate working/immutable durationBudgetContext still JSON.parse's manifest text, bypassing the new shared duplicate policy; claimant confirms missed reader/no exemption. Use shared parseDurationManifest with report-only/last-key-wins controls at this injected seam, and explicitly dispose historical base/legacy and owner-close reader boundaries.","file":"hub/src/suite-duration-context.ts","line":44},{"severity":"medium","text":"New CLI test has no pre-acquisition whole-body owner joining pending scratchMachine/FS continuations before root disposal; commandIn owns only spawned children, and late root acquisition can miss cleanup snapshot. Claimant confirms no earlier join. Add shared work admission/fencing, late adoption and joined removal with owned held-work failure control; keep actual output/exit assertions.","file":"hub/test/duration-duplicates.test.ts","line":10},{"severity":"low","text":"New test has no per-file guide/index entry; existing suite-duration-budget guide omits new parser cases. Claimant confirms no alternate guide. Add both test-specific descriptions and refresh index per rule16.","file":"docs/agents/tests/hub-test-duration-duplicates.test.ts.md"}]
finding_counts: {"high":0,"medium":2,"low":1}

Not clear: two medium + one low; complete pass A-20255. Standards: new T2 fixture lifetime owner missing and test guides missing. Spec: candidate duration context bypasses shared duplicate diagnostics (confirmed dbeef7c1/e7185dca). A-20254 now retains original transcript excerpts,96-path accounting and honest candidate/raw-linkage limits; no runtime rerun requested. Static manifest scan found zero duplicate map keys and unchanged manifest. Release pin for consolidated reader/fixture/guidance correction; request fresh source review before configured verify.

Criteria: C1 failed (Shared duplicate-reporting reader migration misses current working/immutable durationBudgetContext.), C2 failed (New report-only lint CLI regression lacks whole-work fixture acquisition/FS join before root disposal.).

### impl-1725 · 2026-11-16T16:33:49.531Z

Source-1 consolidated correction committed/pushed 6fe32ff8861129497fddd5a97d45f779173a871e and fresh exact-head review requested. A-20265 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20265-t-1725-source-1-correction-and-original-check-chunks.md) retains correction test excerpts + original final npm check tool-result objects. Current reader bypasses migrated; historical base/provenance only remain direct JSON.parse; whole-work fixture owner and held controls added; guides/index updated. Final npm check exit 0, source tree unchanged afterwards apart from commit. No verify or post-source-review dev merge.

### rev-36 · 2026-11-16T16:36:57.682Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1725-source-2
commit: 6fe32ff8861129497fddd5a97d45f779173a871e
scope: full
findings: [{"severity":"medium","text":"joinedWork registers raw t.after only; shared signalDirectoryCleanup/guardDirectoryRemoval can remove owned roots while its FS/acquisition continuation runs. No omitted signal owner, claimant7233e0e6. The local helper also duplicates fixtureWork's policy without its bounded incomplete-join outcome. Compose shared fixtureWork with pre-acquisition beforeDirectories and root guard/late adoption; retain root on incomplete join and keep CLI/held-work assertions.","file":"hub/test/duration-duplicates.test.ts","line":29},{"severity":"low","text":"Held controls await entered.promise without a separately named setup bound; the5s whole-case timeout is not that boundary. Use a named bounded entry observation while retaining release ownership and final write/continuation/ENOENT assertions.","file":"hub/test/duration-duplicates.test.ts","line":73}]
finding_counts: {"high":0,"medium":1,"low":1}

Not clear: one consolidated medium ownership finding + one low setup diagnostic; full pass A-20272. Source1 candidate-reader/tracker boundary and missing test guides/index are now resolved. joinedWork raw-after path still lacks shared signal/root-removal fence; claimant confirms no omitted owner. Use existing fixtureWork composition and shared cleanup phases, preserving late acquisition/held controls/actual CLI exit+warning assertions. A-20265 corrected candidate red/greens and terminal check excerpts remain candidate evidence, not configured-head proof. Pin released for consolidated repair and fresh source review before verification; no signal/provenance runtime experiment requested.

Criteria: C2 failed (Replacement CLI fixture work owner omits signal cleanup/root guard and duplicates shared join policy; pending FS work can race root disposal.).

### impl-1725 · 2026-11-16T16:41:39.467Z

Source-2 findings corrected/pushed 844e9b27e52b54eedc852f8651eaddfc62b36128, clean; fresh exact-head review requested. A-20275 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20275-t-1725-shared-fixture-owner-correction-receipts.md) retains original tool outputs and temporal/source limits. Shared fixtureWork + pre-acquisition beforeDirectories/root guard replace local join policy; named setup bound is below the case bound. Final targeted T2 3/3, hub typecheck 0; full npm check 0 with whole-source and closed-wording lints. No configured verify submitted.

### rev-36 · 2026-11-16T16:43:14.096Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1725-source-3
commit: 844e9b27e52b54eedc852f8651eaddfc62b36128
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards0/Spec0, all prior findings resolved. A-20279 reviews shared fixtureWork composition, pre-admission beforeDirectories signal/native ownership, late cleanup capture/root-removal guard, bounded incomplete joins retaining roots, and named setup waits with preserved actual CLI/held-write/ENOENT assertions. Working/immutable candidate and tracker readers share report-only duplicate parser; historical exemptions and per-test docs remain explicit. A-20254/65/75 preserve96-path dispositions, meaningful parser/context reds, prior/corrected candidate receipts and exact ordering/source-linkage limits. C1/C2 remain unverified until mode-free configured evidence at this head; proceed only in granted window.

### impl-1725 · 2026-11-16T17:22:42.906Z

Configured exact-head result eaac8ea3-a322-438b-acbc-a0b2b4d7bf75 / A-20309 green at 844e9b27e52b54eedc852f8651eaddfc62b36128 (tree a907b6e45211a69325f78aa44ab0b0ca8fc41109), uncached Linux x64 droplet c-8 sfo2, Node24.21.0, Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. T0/T1/T2/Web exit0; 6469 pass, 0 fail/cancel/skip/todo. Streamed exact finish-record audit separately confirms each of the six new parser/context/CLI/held-control case names has base:pass1 and load-gate:pass5, with no other finish outcome. T3/T4 unexecuted in this task receipt (T3 deferred to merge/integrated coverage). Budget notices remain report-only. Droplet lifetime1555s, cost$0.1080. Head/worktree remain unchanged and clean; awaiting Reviewer same-head evidence settlement.

### rev-36 · 2026-11-16T17:23:58.388Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1725-final-1
commit: 844e9b27e52b54eedc852f8651eaddfc62b36128
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified. A-20311 verdict + independent A-20310 confirm exact-head eaac8ea3/A-20309:6469 ordinary test/707file passes, separate240load tests/files, no nonpass/skip. Actual CLI report-only key/both-values/unchanged-exit case,14budget,6context,19owner-close cases and all six new base+5 names have positive finishes. All96 retained paths classified16 configured pass/13T3-T4 deferred/67source-helper-reference; full993manifest707passes269T3/17T4defer, no missing lower/Web receipt. Actual HeadlessShell1248/CfT156.0.8078.4, Linuxx64/Node24.21, uncached; hostT0/T1/T2/Web0. Report-only budgets/lint and all earlier candidate/failed/provenance/native/QA limitations retained; no additional run.

Criteria: C1 verified, C2 verified.
