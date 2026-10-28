---
id: T-1405
kind: task
title: "The mirror renders Discord's Markdown: tables, deep headings, rules, task boxes and ||, no pings, fence-safe numbered splits and silent notes"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1400
topic: topic-1148
branch: t/T-1405-the-mirror-renders-discord-s-markdown
created: 2026-10-27T23:38:46.826Z
updated: 2026-10-28T15:06:27.835Z
closed: 2026-10-28T15:06:27.835Z
---

## Summary

General messages arrive in Discord's Markdown. Tables become code blocks, and deep headings, rules, task boxes and `||` are rewritten. Splits fall at 2000 code points, re-open code fences and are numbered "n/m". No mention pings anyone, progress notes and hub notices arrive silently, and a conversion error never drops a message.

## What to build

**The converter** in `discord-render.ts`:
- a table becomes a fenced code block with aligned columns;
- a heading deeper than `###` becomes a bold line;
- a rule becomes a line of `─`;
- task boxes become ☐ and ☑;
- `||` is escaped so that it shows no spoiler.

**The splitter.** It cuts at block boundaries within 2000 code points, leaving room for the header and the "n/m" mark. A fenced block across a cut is closed and re-opened with its language. A conversion error falls back to plain text.

**Silence and authors.** Silent messages, which are progress notes and hub notices (`mirrorOut`'s `silent`), carry `SUPPRESS_NOTIFICATIONS`. Every create and every edit keeps the empty `allowed_mentions`. Authors come from `mirrorOut`: "you" from a workbench and "you (Telegram)" from the other remote.

The fake checks the 2000 code points and reports pings.

Spec §3.4 (Discord rendering, splitting, silence); Q-1293 (the rewrites the human accepted); research rules 19 and 20.

## Acceptance criteria

- [x] C1. An agent's report with a table, a level-4 heading, a rule, task boxes and `||` arrives with the table in a code block, the heading as a bold line, and the rule, boxes and `||` rewritten (test).
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final · 2026-10-28T11:08:03.792Z · commit bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final2 · 2026-10-28T13:56:51.936Z · commit fb01c31d4c4b06ccecc9a714911c3b9a40152988
  - done: impl-1405 · 2026-10-28T14:26:21.315Z
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-3 · 2026-10-28T14:42:30.972Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-4 · 2026-10-28T14:56:25.786Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
- [x] C2. A message containing `@everyone`, a role mention and a user mention pings nobody on the fake, on its create and on its edit (test).
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final · 2026-10-28T11:08:03.792Z · commit bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final2 · 2026-10-28T13:56:51.936Z · commit fb01c31d4c4b06ccecc9a714911c3b9a40152988
  - done: impl-1405 · 2026-10-28T14:26:21.731Z
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-3 · 2026-10-28T14:42:31.648Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-4 · 2026-10-28T14:56:25.786Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
- [x] C3. A 4500-code-point message with a fenced block across a cut arrives as parts numbered "1/3" to "3/3", each within 2000 code points, with every fence closed and re-opened with its language (test).
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final · 2026-10-28T11:08:03.792Z · commit bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final2 · 2026-10-28T13:56:51.936Z · commit fb01c31d4c4b06ccecc9a714911c3b9a40152988
  - done: impl-1405 · 2026-10-28T14:26:22.138Z
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-3 · 2026-10-28T14:42:31.900Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-4 · 2026-10-28T14:56:25.786Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
- [x] C4. Progress notes and hub notices arrive with `SUPPRESS_NOTIFICATIONS` while other messages notify, and a workbench message shows "you" and a Telegram one "you (Telegram)" (test).
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final · 2026-10-28T11:08:03.792Z · commit bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final2 · 2026-10-28T13:56:51.936Z · commit fb01c31d4c4b06ccecc9a714911c3b9a40152988
  - done: impl-1405 · 2026-10-28T14:26:22.400Z
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-3 · 2026-10-28T14:42:32.295Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-4 · 2026-10-28T14:56:25.786Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
- [x] C5. A message the converter cannot handle arrives as plain text and is never dropped (test).
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final · 2026-10-28T11:08:03.792Z · commit bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
  - verified: rev-34 [reviewer] · run rev-34-20261028-1405-final2 · 2026-10-28T13:56:51.936Z · commit fb01c31d4c4b06ccecc9a714911c3b9a40152988
  - done: impl-1405 · 2026-10-28T14:26:22.819Z
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-3 · 2026-10-28T14:42:32.536Z · commit 166b2937e846d8509398a2244c8cf860ea08afca
  - verified: rev-26 [reviewer] · run rev-20261028-1405-evidence-4 · 2026-10-28T14:56:25.787Z · commit 166b2937e846d8509398a2244c8cf860ea08afca

## Notes

Shared files: discord.ts (General out), new hub/src/remote/discord-render.ts

## Comments

### impl-1405 · 2026-10-28T10:30:37.170Z

Consumer inventory: DiscordRemote publish is production outbox.send caller; discord-messages.test.ts calls send and seeds historical intents. Persisted intents read by DiscordOutbox replay; new silent field optional, old mapping retained. DiscordApi create/edit and fake mention/size checks unchanged. mirrorOut used by Telegram/Discord and mirror.test.ts: unchanged. Searched production, all hub/test tiers, qa briefs, docs and shipped skills: no frame/list/schema change. New split job sources retain original message in mapping; historical payload regression remains in discord-messages.test.ts.

### impl-1405 · 2026-10-28T10:34:38.603Z

Coordinator decision recorded: render/fallback before durable enqueue and persist rendered bytes; replay does not render again. C1–C5 done at 092d008a1; source review requested from reviewer. Inventory correction: neutral mirror coverage lives in hub/test/remote-mirror.test.ts (the earlier mirror.test.ts shorthand was not a literal filename).

### impl-1405 · 2026-10-28T10:34:44.025Z

Exact neutral mirror consumer filename from rg -l mirrorOut hub/test: hub/test/remote-neutral.test.ts. It is unchanged; this supersedes both earlier filename references.

### rev-34 · 2026-10-28T10:38:54.582Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source1
commit: 092d008a126d9a542f8b3b7307c8e18034447381
scope: full
findings: [{"severity":"medium","text":"M1 Standards: new test file has no tier-map entry, blocking unchanged verification admission; add its sorted T2 row.","file":"hub/test/discord-render.test.ts","line":1},{"severity":"medium","text":"M2 Spec: awaiting drain per part leaves the remaining rendered suffix unsaved during the first native request; stop/restart loses it and later sources can interleave. Persist the complete group before delivery.","file":"hub/src/remote/discord.ts","line":80}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at the exact reviewed head. Standards M1 and Spec M2 are detailed in A-13208, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13208-t-1405-source-review-1-tiers-and-multipart-durability.md. C3 failed; other run-dependent criteria remain unverified. Reviewer ran no tests/probes/browser. Lead subsequently reproduced M2 at the first held native create with `1 !== 3` durable jobs (0fbc4d69); fix/replacement source review pending before verification.

Criteria: C3 failed (Multipart source is not fully durable before native delivery; stopping during the first create can lose parts 2/3.).

### rev-34 · 2026-10-28T10:42:40.088Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source2
commit: 06ca56384ce8601b88e843ba24b879b810e1fd05
scope: full
findings: [{"severity":"medium","text":"M3 Standards: fixture cleanup closes its injected Store before projectHub's stop/drain barrier; an early failure leaves DiscordRemote/outbox accessing closed storage. Pre-own cancellation and subject/recovered drainage before Store/fake/root disposal; cover omitted/aborted held setup while preserving all semantic assertions.","file":"hub/test/discord-render.test.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

M1 sorted T2 registration and M2 transactional complete-group enqueue are corrected in source. One remaining medium Standards finding M3; no remaining Spec finding. Artifact records full review/limits. Crash replay is a consistent SQLite snapshot component model, not native process-death evidence. No configured verification or Reviewer test ran; no criteria verified. C3 currently lacks a restored claimant done mark as well. Fresh source review required after ownership correction.

Criteria: C3 failed (Multipart regressions close the injected Store before subject drainage on failure; fixture ownership must be corrected.).

### rev-34 · 2026-10-28T10:46:37.668Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source3
commit: 7c1cd3971e4795f17211cc584964fe96c2baf731
scope: full
findings: [{"severity":"medium","text":"M3 remains for partial startup: owner close runs hub?.stop concurrently with unresolved projectHub; it can observe undefined, then close Store after the late acquisition settles without stopping that subject. Fence/stop late acquisition before tracked startup settles; prove held startup cancellation and Store-open-until-stop.","file":"hub/test/discord-render.test.ts","line":28}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards M3 held-I/O cleanup corrected, but partial-startup acquisition remains unsafe; Spec0 additional findings. Audit A-13217 records the exact ownership trace and limits. No production change, M1/M2 corrected; no Reviewer execution or configured proof. Fresh source review required before verification.

Criteria: C3 failed (Regression fixture lacks a late subject-acquisition shutdown fence when cleanup races pending hub startup.).

### rev-34 · 2026-10-28T10:48:54.888Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source4
commit: bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear, Standards0/Spec0. A-13219 records complete-group persistence and all fixture corrections. M1 sorted T2 map; M2 transactional entire group before native drain; M3 subject/recovered ownership with late-acquisition abort stop/join before tracked startup settles and Store closes. Actual held-subject control retains stop-before-Store-close assertions; existing order/replay/mapping and omitted/aborted setup checks preserved. C1–C5 claimant done, all runtime-unverified. Snapshot replay is a component model, not native process kill evidence. No Reviewer execution. Configured exact-head verification and original-record audit remain necessary for final review.

### rev-34 · 2026-10-28T11:08:03.792Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-final
commit: bba1a195cc6249a97c9050d85f64d8e8ff19fb3a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified. A-13235 independently audits original A-13231 at exact source4 head:3885 ordinary passes/499files,80 separate load(55task/25site). All11 rendering/ping/split/silence/fallback/paragraph/group-order/snapshot/cleanup identities pass base+5/5load; maxbase.443064163s/maxload.537855719s, no new3s allowance. Existing nonce/old-intent recovery18/18,API25/25 including mention positive control,neutral mirror5/5 and help/docs guards pass. Snapshot is component SQLite crash-persistence model, not native hub death/restart. T0host,T1,all fallbackT2,Web complete;T3/T4 unrun;Web0newfiles/0repetitionsrequired. Linuxc8nyc1 Node24.21/Neovim0.12.5 isolatedCHS156.0.8078.4/v1248; prepared hosttreec8f63a39 reuse/not repeated Linux typecheck. Budget/lint134 warnings report-only;997s/$0.0693 accounting notwall. No Reviewer execution/provider/stageQA claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1405 · 2026-10-28T11:08:25.219Z

Ready reported to Coordinator at bba1a195c: source4 and final evidence clear, C1–C5 verified. Mode-free droplet verify 73973138 passed configured T0/T1/T2/Web, 3885 ordinary passes; task 11 base plus55 load passes. T3/T4 unrun; budgets report-only; crash snapshot is component model. A-13231 original log, A-13235 final audit. Fresh fetch origin/dev9d09b243 and merge-tree clean tree dc2c05c5297; no head change. Claim retained until merge.

### rev-34 · 2026-10-28T13:37:31.064Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source5
commit: fb01c31d4c4b06ccecc9a714911c3b9a40152988
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 merge delta clear; Standards 0 / Spec 0. A-13304 records both parents and manual outbox resolution: recovery availability retained in send and applied transactionally before complete-group enqueue/drain; bytes, silence, mappings and old intents preserved. Incoming health/resume/stop hooks retained; renderer/test/exchange owner unchanged. Sorted T2 and complete help expressions checked. C1–C5 marks stale; no runtime criteria verified. A-13303 local reds remain unreproduced, not passing evidence. Independently read Coordinator 458a875b: one configured run allowed; if late-acquisition identity fails on droplet, stop/report for filing, no retry or bound change. Predecessor A-13235 remains historical only. No Reviewer execution.

### rev-34 · 2026-10-28T13:56:51.936Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-final2
commit: fb01c31d4c4b06ccecc9a714911c3b9a40152988
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final2 clear; C1–C5 verified. A-13324 independently audits original A-13321 / 210487c2 at source5 head: 3929 ordinary passes / 501 files, 80 separate load passes (55 task / 25 site). All 11 render/group/replay/cleanup cases pass base plus 5/5 loads; late acquisition .104125344s base / .343470566s load max, so Coordinator 458a875b's conditional stop/report was not triggered. Prior local drainage reds remain unreproduced, not retrospectively green or causally resolved. API 26 / messages 18 / messenger 31 / neutral 5 and help/docs guards pass, including merged REST recovery/notice controls. T0 host / T1 / all fallback T2 / Web complete; T3/T4 unrun. Linux c-8 sfo2, Node 24.21 / Neovim .12.5, isolated CHS 156.0.8078.4 / v1248; host tree 81d76eba reused, not Linux typecheck. Budgets/lint report-only; 1015s / $0.0705 accounting. Snapshot is component proof, not native SIGKILL. No Reviewer execution/provider/stage QA claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-26 · 2026-10-28T14:26:14.378Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1405-source-delta-6
commit: 166b2937e846d8509398a2244c8cf860ea08afca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13342 authorized second dev merge delta clear, Standards0/Spec0. Sole manual skill conflict retains complete Discord rendering and Telegram album entries exactly once; all parent CHANGES provenance retained. T-1405 implementation/test/guide/tiers/durations byte unchanged from final-clear fb01c31d4. Whole merge incorporates landed Telegram/T-1423 shared changes; not a claim that first-parent delta contains only docs. C1–C5 runtime marks stale; no criteria newly verified. Refresh done and obtain one prescribed mode-free same-head run, then original-record final review. Prior A-13303 local reds remain red/unreproduced; retain Coordinator458a875b stop/report condition. No automatic retry/full run requested.

### impl-1405 · 2026-10-28T14:41:15.457Z

Run39c1dc54 at166b2937e failed Web inbox.test.ts selected request/message unfold at89:12: expected /read/, actual ✓ general · left Inbox. T0/T1/T2 passed; Web1failure; T3/T4 unrun. Shared-defect candidate reported to lead, Bugs provisional S. Holding diagnosis/retry pending Coordinator shared fix. Original A-13347.

### rev-26 · 2026-10-28T14:42:34.184Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1405-evidence-3
commit: 166b2937e846d8509398a2244c8cf860ea08afca
scope: evidence
findings: [{"severity":"medium","text":"Original configured A-13347/run39c1dc54 failed: expected /read/ but actual '✓ general · left Inbox' in the physical-d selected-row case. This unchanged Web assertion is T-1430; Coordinator's one resubmit does not make the original failed run clear.","file":"web/test/inbox.test.ts","line":89}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13348 original-record audit:3933 ordinary identities=3932pass/1Webfail,80 separate load passes, zero unfinished. All11 rendering cases base+5/5 pass; C1–C5 individually verified under this run, no failed task criterion. Late-acquisition passes; earlier conditional failure not triggered. Overall evidence NOT CLEAR per failed-run clause. T0/T1/T2 green, Web red, T3/T4 unrun; host reuse/report-only limits retained. Coordinator02715ff6 separately authorizes one unchanged-head resubmit09a70607 for T-1430; assess fresh result when available. No extra retry/source edit/full run requested.

### rev-26 · 2026-10-28T14:56:25.787Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1405-evidence-4
commit: 166b2937e846d8509398a2244c8cf860ea08afca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13353 final current-head original-record audit clear, Standards0/Spec0. Authorized single resubmit09a70607/A-13351:3933 ordinary passes,80 separate scoped load passes,zero fail/cancel/skip/unfinished. All11 rendering cases base+5/5; C1–C5 freshly verified. Max task base0.315501612/load0.462512254s; late acquisition passes. Prior Inbox identity nowpass1.280838691s, but original A-13347 remains failed/T-1430 and earlier A-13303 local reds remain unreproduced. T0/allT1/fallbackallT2/Web completed Linux c-8lon1 CHS156/revision1248; T3/T4unrun,host gate reused,budgets/lint report-only,snapshot component limits retained. No further edit/retry/all requested; Coordinator enqueue/landing separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1405 · 2026-10-28T14:56:51.031Z

Ready reported at166b2937e. Final current-head review clear A-13353, C1–C5 verified; authorized resubmit09a70607/A-13351 passed3933 ordinary T0/T1/T2/Web plus80loads (55task). Failed A-13347/T-1430 retained, no diagnosis claim; T3/T4 unrun, report-only/host-reuse/component limits. Fresh origin/devcfcd0c61 fetch and merge-tree clean4e997710. No further edits/execution; claim retained until merge.

### coord · 2026-10-28T15:06:27.835Z

Merged f7fd8892306bf6c360627703d8a964bedd796af9 onto dev.
