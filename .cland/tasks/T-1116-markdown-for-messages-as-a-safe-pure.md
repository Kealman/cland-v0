---
id: T-1116
kind: task
title: Markdown for messages as a safe pure parser
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-853
branch: t/T-1116-markdown-for-messages-as-a-safe-pure
created: 2026-10-22T15:16:12.285Z
updated: 2026-10-22T16:08:08.252Z
closed: 2026-10-22T16:08:08.252Z
---

## Summary

A pure module that parses one message's Markdown into a token tree the web renders as elements, so no raw HTML from an agent ever reaches the page. It has no React or browser dependency and runs in a parallel lane.

## Parent

E-417 (§3.4 and v0.1 §3.14 "Markdown per message"; the Risks constraint; part of tracer step 1).

## What to build

Each message is parsed on its own (v0.1 §3.14): headings, paragraphs, lists aligned under their text, quotes, tables kept as text, fenced code with its language label, inline code, bold, italic, links and bare http(s) addresses, and item ids (any configured prefix, `T-12`, `E-417`) as tokens of their own so a renderer keeps them whole and makes them links. An unclosed fence ends at the message's end and never spills into the next message; plain text is the fallback for anything the parser does not know. Raw HTML stays text. A link token carries only an `http` or `https` address; anything else (`javascript:`, `data:`, relative paths) becomes text. The parser is a hand-rolled subset with no new dependency, ported from the prototype's `thread/markdown.tsx` (`prototype/web-shell`, Q-405) but split so the parsing is pure TypeScript a unit test can import. The web's static checks refuse `dangerouslySetInnerHTML` and writes to `innerHTML` or `outerHTML` anywhere in the workspace's sources.

## Acceptance criteria

- [x] C1. The parser turns headings, paragraphs, lists, quotes, fenced code with its language, inline code, bold, italic, links and item ids into tokens, and an unclosed fence ends at the message's end (test).
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-1 · 2026-10-22T15:56:11.587Z · commit de2fdf9a2aa760b5b31bcb243c18d68526b7987e
  - done: impl-1116 · 2026-10-22T15:57:22.240Z
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-2 · 2026-10-22T16:04:39.000Z · commit 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f
- [x] C2. Raw HTML in a message stays a text token, and a link token is produced only for an `http` or `https` address (test).
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-1 · 2026-10-22T15:56:11.587Z · commit de2fdf9a2aa760b5b31bcb243c18d68526b7987e
  - done: impl-1116 · 2026-10-22T15:57:22.384Z
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-2 · 2026-10-22T16:04:39.000Z · commit 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f
- [x] C3. The web typecheck fails on `dangerouslySetInnerHTML` or an `innerHTML`/`outerHTML` write in the web sources, with a seeded fixture proving the check (test).
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-1 · 2026-10-22T15:56:11.587Z · commit de2fdf9a2aa760b5b31bcb243c18d68526b7987e
  - done: impl-1116 · 2026-10-22T15:57:22.678Z
  - verified: rev-26 [reviewer] · run rev-20261022-1116-final-2 · 2026-10-22T16:04:39.000Z · commit 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f

## Comments

### impl-1116 · 2026-10-22T15:17:49.671Z

Read E-417, v0.2 §3.4 and the Q-405 prototype parser. TDD seams proposed to supervising lead: pure parseMarkdown token contract (T1) and seeded typecheck safety guard (T0). No UI/dependency work; fenced language and configured item prefixes retained in the token API.

### impl-1116 · 2026-10-22T15:24:27.023Z

Implementation committed/pushed to territory at 3ba8aa71. All C1–C3 marked done. Six pure T1 parser contracts pass locally on macOS; npm run check passed (typecheck, seeded HTML-sink guard, build and static/test lint; lint report mode, zero refusals). No suite receipt yet: requesting source review before mode-free verification. QA policy is after-stage, no per-item QA criteria/brief.

### rev-26 · 2026-10-22T15:27:01.543Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-1
commit: 3ba8aa710aa8a0242ed76e50cbd096ca9744f725
scope: full
findings: [{"severity":"high","text":"M2: blockStart can recognize a line the specific block parser rejects (e.g. ``` followed by U+2028 plus payload). Fence (.*)$ fails, paragraph excludes blockStart, i never advances and parsing loops forever. Restore guaranteed plain-text fallback/progress and bounded separator regressions.","file":"web/src/markdown.ts","line":114},{"severity":"medium","text":"M1: node[('innerHTML')] = message bypasses the raw-HTML guard because the sink literal's immediate parent is a transparent wrapper. TS assertion/satisfies/non-null keys also evade it. Resolve static keys through wrappers and seed rejected fixtures.","file":"web/check-html.ts","line":17}]
finding_counts: {"high":1,"medium":1,"low":0}

Full source not clear; A-9205 audits fixedf35f5e2b→3ba8aa71/treeb235b4f3 plus prototype/spec and Coordinator HTTP/HTTPS-only correction. Standards0;Spec2 findings: high M2 parser progress, medium M1 guard wrappers. Remaining token contract/pure boundary/test tiers/docs reviewed with no further findings. A-9202 narrative local precommit6/6/check evidence is supporting only; raw original receipts requested without reruns, no configured/exact-head runtime proof inferred. No criteria verified. Fix both and request fresh pushed-head source review before mode-free verification; stage QA separate.

Criteria: C1 failed (Unsupported fence input containing U+2028/U+2029 can leave the parser index unchanged and loop forever instead of returning plain-text fallback.), C3 failed (Direct literal bracket writes with parenthesized or TS-wrapped raw-HTML sink keys are not refused.).

### impl-1116 · 2026-10-22T15:29:27.440Z

Corrected head 20345afd committed/pushed after not-clear rev-20261022-1116-source-1; no dev merge. M1 wrapped bracket keys now resolved across transparent TS wrappers; M2 empty-body fallback always consumes a line. Seven T1 contracts and npm run check pass on macOS local in the source tree committed at 20345afd (lint report mode, zero refusals). A-9207 preserves original precommit stdout/provenance limits; A-9209 preserves correction receipts, source hashes and native timings. Fresh review requested before configured verification.

### rev-26 · 2026-10-22T15:30:32.270Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-2
commit: 20345afd4ad024d7a91c978f29f83df019f95deb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-9213 incorporates first audit A-9205. M2 resolved by unconditional fallback consumption with literal U+2028/U+2029/following-paragraph assertions. M1 resolves all transparent TS wrappers and uses actual path syntax, with rejected bracket/computed-prop fixtures; safe ordinary strings/comments retained. Standards0;Spec0; no other source findings. A-9207/A-9209 original development receipts retain explicit precommit/red limits. Corrected parser/guard/test hashes independently match committed blobs,7/7 localmacOS/check0 supporting evidence; no whole dirty-tree or configured pass inferred. AllC1–C3 await mode-free verification at unchanged20345afd. Lead notified C1/C3 claimant done marks need restoration. Any head change needs fresh source review; stage QA separate.

### rev-26 · 2026-10-22T15:32:16.353Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1116-evidence-1
commit: 20345afd4ad024d7a91c978f29f83df019f95deb
scope: evidence
findings: [{"severity":"medium","text":"Configured run386ad4a3/A-9216 could not obtain c-8 capacity in lon1,nyc1,sfo2; runtime execution unavailable. Host check passed, but no T1/T2/Web pass exists. This is an execution-evidence blocker, not an observed parser assertion failure."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-9217 audits original A-9216 and hub failure envelope at unchanged20345afd. Host check/seeded guard passed, report-only lint132/59/zero refusals; runtime counts/platform unavailable, projections not passes. No criterion failed on observed behavior; no source defect or head change established. Allcriteria remain unverified pending executable configured evidence. Already-admitted retry71dc102d is separate; historical386ad4a3 remains failed/unavailable.

### impl-1116 · 2026-10-22T15:37:01.697Z

Shared-fix merge authorized by Coordinator da3c70d4: origin/dev brought eacb0e27 (web/test/items.test.ts fixture) and tracker records only, producing pushed head de2fdf9a. Actual A-9229 failure: "The input did not match the regular expression /S1/" on closed E-416 row. Prior local T1/T2 passed, Web failed; no overall passing receipt. C1–C3 all remain done. Delta source review requested; no verification until clear at new head.

### rev-26 · 2026-10-22T15:39:16.924Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-3
commit: de2fdf9a2aa760b5b31bcb243c18d68526b7987e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized shared-fix delta source clear; A-9236 incorporates corrected full audit A-9213. Coordinator da3c70d4 independently read. Only non-tracker change is web/test/items.test.ts; exact donor blob5c716efb, no branch edit. Fixture owns planned epic/stage facts under copied current release, preserving assertions/identity; parser/guard/tests unchanged. Standards0;Spec0. Historical A-9229/71dc102d stays failed: actual /S1/ assertion atitems.test.ts:30 against closedE-416,localDarwinarm64,T1/allT2exit0,Webexit1,2449pass/1fail; seven parser ordinary+5/5 pass and local seededguard positive checks retained, not overall green. A-9216 remains pre-runtime capacity unavailable. C1–C3 await mode-free configured evidence at unchangedde2fdf9a; executor authority Coordinator-owned, stage QA separate.

### rev-26 · 2026-10-22T15:40:29.483Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1116-capacity-evidence-2
commit: de2fdf9a2aa760b5b31bcb243c18d68526b7987e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-9241/44ca9abd independently read at source-clearde2fdf9a. Hub result quotes pre-runtime c-8 unavailable inlon1,nyc1,sfo2; original host check includes passing seededHTMLguard and zero lint refusals, diagnostics report-only. Runtime counts/platform/health unavailable, projections not executed tests. Configured acceptance unavailable/not clear, no criterion assertion failure or new source defect established; allC1–C3 remain unverified. Source-clear remains valid. Already-admitted7a215d67 is a separate pending receipt under Coordinator executor flow; no Reviewer retry authorization.

### impl-1116 · 2026-10-22T15:55:41.757Z

Exact-reviewed-head verification green: run 7a215d67, A-9262, head de2fdf9a2aa760b5b31bcb243c18d68526b7987e. Local executor darwin arm64, Node v24.21.0, Neovim v0.12.5: auto exit 0, 2453/2453 tests passed, no failures/skips/cancellations. T0 check plus all T1, fallback all T2 in both packages and Web completed; load gate five sequential repetitions per new test. Budgets/test lint report-only (warnings retained). T3 deferred to periodic dev/integrated occasions, absent configured batch tiers. Authorized local capacity fallback after pre-runtime remote refusal 44ca9abd/A-9241 (also initial A-9216). Awaiting Reviewer's final evidence verdict; no merge.

### rev-26 · 2026-10-22T15:56:11.587Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-final-1
commit: de2fdf9a2aa760b5b31bcb243c18d68526b7987e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-9265 audits originalA-9262/run7a215d67 atsource-clearde2fdf9a/treee2f30279. LocalDarwinarm64 Node24.21/Nvim0.12.5,workers4(Web2,load2):T0localcheck/T1/allfallbackT2hub+Neovim/Web exit0,2453ordinarypasses/zero fail/cancel/skip. C1/C2 sevenparser contracts pass ordinarily and each has5distinctloadpasses with explicit5/5,maxload0.002759583s,including separator-progress and hostileHTML/scheme cases. C3 actualseededHTMLguard passes inlocaltypecheck with ECMAScript-onlyparser check; sourceguard wiring/wrapperfix retained. SharedItems Webparent nowpasses8.543554875s. Standards0;Spec0. Genericlint/duration/ratchet report-only132/59/zerorefusals,three missing baselines. ActualWeb26.36s,queue701.94s separate; noLinuxruntime,T3/T4,renderer-safety/fullcover/stageQA claim. HistoricalcapacityunavailableA-9216/A-9241 andoldWebfailureA-9229 retained;afterstageQA separate.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-26 · 2026-10-22T15:57:55.263Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-4
commit: 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev-merge delta source clear; A-9266 audits both parents/combined conflict under Coordinator92b4cedf. Solemanualresolution implement-skill metadata keeps allentries/bothT-1116+T-1109; bothbodyblocks/docs retained. Owned parser,guard,T1contracts,package/typecheck/tsconfig unchanged. Incoming approvedT-1104/T-1109 andCoordinatoroutageconfig are context; no task-local executor edit. Standards0;Spec0. HistoricalA-9262 remains localmacOS2453/2453,T0/T1/allT2/Web/sevenparser5/5 atoldde2fdf9a, not merged-head evidence. AllC1–C3 await freshmode-free verification atunchanged5c57b44b; record actual executor/fallback, genericdiagnosticmodes and phase limits. Changed head needs new source review; after-stageQA separate.

### impl-1116 · 2026-10-22T16:03:57.637Z

Post-conflict exact-head verification green: 138d638a/A-9273 at 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f. Configured droplet request automatically fell back locally on c-8 unavailability (same run; no duplicate submission). Actual local darwin arm64, Node v24.21.0, Neovim v0.12.5: auto exit 0, 2463/2463 passed, no failures/skips/cancellations. T0 check, all T1, fallback all T2 both packages and Web completed. Timing and lint diagnostics report-only; eight would-fail duration lines retained in receipt, not claimed as meeting budgets. T3/T4, Linux and stage QA not claimed. Awaiting final same-head Reviewer verdict; branch clean and no merge performed.

### rev-26 · 2026-10-22T16:04:39.000Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-final-2
commit: 5c57b44b9579f70e21d2ad7aa0a732ef6aa0f64f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-9274 audits originalA-9273/run138d638a atsource-clear5c57b44b/tree3b600347. Hub explicitlyfellbackfromunavailablec-8 tolocalDarwinarm64 Node24.21/Nvim0.12.5,actualworkers4(Web2,load2). Hostandlocalcheck retained; seededHTMLguard passes,zero lintrefusals. T0localcheck/T1/allfallbackT2hub+Neovim/Web exit0,2463ordinarypass/zero fail/cancel/skip. Sevenparser identities eachordinarypass+5distinctloadpasses with explicit5/5,maxload.001988459s; C3guardfixtures/wiring retained. Standards0;Spec0. Genericlint/tier/duration/ratchet report-only132/59,fourmissingbaselines,Neovimdurationwarnings retained;noenforcedtier-budgetclearance. ActualWeb37.17s,noLinuxruntime/T3/T4/fullcover/renderer-security/stageQAclaim. Historicalreceipts retained;afterstageQA separate.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-22T16:08:08.252Z

Merged efb731534414d90310f5a2548e0874cf93d3c89e onto dev.
