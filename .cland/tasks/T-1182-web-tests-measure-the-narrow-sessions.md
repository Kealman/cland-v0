---
id: T-1182
kind: task
title: Web tests measure the narrow Sessions row before the phone layout switch lands
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
regression_of: T-1165
found_by: qa
topic: topic-909
branch: t/T-1182-web-tests-measure-the-narrow-sessions
created: 2026-10-23T16:06:39.496Z
updated: 2026-10-23T16:23:31.400Z
closed: 2026-10-23T16:23:31.400Z
---

## Summary

E-419 stage-1 QA (qa-s1-2026-10-23-1 at e53bc5a3, A-10096) failed web/test/sessions.test.ts "Sessions rows render merged facts, holds, waiting detail and physical selection keys": `P27 row is 52 px tall`, measured 88 px, at line 105, right after `page.setViewportSize({ width: 600 })`. The same test passed in both stage covers at that SHA. Since T-1165, the narrow row layout follows `[data-phone="true"]`, which React sets from `usePhone()` after the matchMedia change, so a measurement taken right after the resize can see the pre-switch layout.

## What to build

Make the narrow-row assertions wait until the page has switched to the phone layout (for example `[data-phone="true"]` on the shell) before measuring, in this test and in any other Web test that resizes across 640 px and then measures layout at once. Keep the single width seam; no second breakpoint in CSS.

## Acceptance criteria

- [x] C1. Every Web test that resizes across 640 px and then measures layout first waits for the phone-layout switch; the change lists each such test (Web test).
  - done: impl-1182 · 2026-10-23T16:10:57.793Z
  - verified: rev-23 [reviewer] · run rev-20261023-1182-final · 2026-10-23T16:18:51.145Z · commit fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84
- [x] C2. The Sessions merged-facts test passes 20 of 20 runs at two workers on macOS, with a parallel CPU load running (Web test).
  - done: impl-1182 · 2026-10-23T16:10:57.955Z
  - verified: rev-23 [reviewer] · run rev-20261023-1182-final · 2026-10-23T16:18:51.145Z · commit fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84

## Comments

### impl-1182 · 2026-10-23T16:07:59.175Z

Confirmed seam from item: sealed Web fixture/Headless Shell rendered phone switch and row geometry, retaining final layout assertions. Auditing all setViewportSize calls. Coordinator granted local exclusive stress window in topic-909; pre-fix reproduction precedes edits.

### impl-1182 · 2026-10-23T16:10:57.713Z

Implemented/pushed fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84: added bounded rendered data-phone=true waits in Sessions merged-facts and narrow session-actions. All eight cross-640 identities audited; existing rendered switch receipts in phone (2), plan (1), phone-more (3) already suffice. Detailed audit, pre-fix 88 !== 52 trace, 20/20 loaded macOS two-worker passes, and 30/30 neighboring Web tests are in A-10097: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10097-t-1182-red-green-loaded-sessions-proof-and-resize-audit/report.md. Web typecheck/static checks passed; no product/CSS change. Loaded proof identifies its exact working source and final Sessions blob. Fetched/merged origin/dev before first review (tracker-only fast-forward). qaPolicy affected/after-stage, no qaCriteria or per-item brief; source review then mode-free verification, E-419 stage QA routed by Coordinator.

### rev-23 · 2026-10-23T16:13:00.130Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1182-source
commit: fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1182 full source review
Headfa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84 / treea363aa2513603242668441e0c0a961cbc960e9d3, branch t/T-1182-web-tests-measure-the-narrow-sessions. Fixed base/parentdb59faa840e270e56712ce7ee33196030238ad70. Run rev-20261023-1182-source. Clear; findings[]; C1/C2 final marks pending configured same-head evidence and retained loaded-run attribution.

## Standards
Pass. Exactly two added Web test lines, no product/CSS change. Both use existing bounded pageUntil (until3000ms plus final predicate assertion) to observe rendered data-phone=true after crossing640 before geometry/actions; shared Shell usePhone drives the ancestor attribute used by Sessions CSS. MatchMedia remains as existing secondary assertion, not readiness. Sessions retains exact52px row, two-line alignment, width, role colour, waiting command and ordinary-row assertions. Session-actions retains page/Stop/Escape/physical action assertions. No sleeps, bound increases, assertion relaxation, second breakpoint or new test identity. Existing file tiers sufficient; diff check clean.

## Spec
C1 source audit pass: independently searched all setViewportSize/viewport declarations. Eight crossing identities listed in A-10097: Sessions merged facts and narrow session-actions need these new waits; phone boundary awaits rendered Areas/Phone areas; saved split awaits secondary detachment/Accounts restoration before geometry; Plan waits phone-only exact tree and restored Approve; three phone-more crossings await desktop-only view group/Graph button or Needs-you switch. Remaining shell/events/inbox/palette resize sites stay desktop or are pre-navigation; initial phone contexts await five rendered slots. No other crossing followed by an unguarded layout measurement found.
C2 retained evidence reviewed, final marking pending: A-10097 red-4.log actual `P27 row is52px tall;88 !==52` at old sessions.test.ts:105. Twenty green TAP logs each report exactly1pass/0fail/0cancel/0skip and clean fixture census after0/scratch hub stopped. Node whole-process durations1776.570250–1838.391500ms, not latency under a duration gate. run.mjs drives ten pairs of concurrent processes, one selected identity per process, each --test-concurrency=2 (two actual simultaneous test processes). Uses runnerFixtureEnvironment with disposable outerHOME/XDG/Git/account filtering plus isolated Web fixtures.

Coordinator86ced13a explicitly reserved local Mac when local queue none, authorized exactly two yes loaders and narrow Sessions file, literalPID cleanup. Report records loaders68203/68204, red1–3pass then4fail,20greens under same load, literal kill then ps no rows/loader shell exit. Loaded state was e53bc5a3 plus Sessions wait, before second wait and tracker-only fast-forward; independently verified final Sessions SHA256 c902a4062f2985753b6b2493b5f4776d0b0c194723c1116ab22f42b260fea30a equals reported tested blob. e53bc5a3→db59faa8 diff is tracker-only. This is targeted identity evidence, not20runs of full committed tree. Per-process exit/loader command stdout are reported outside TAP; preserve their original session records as supplementary evidence, no transcription reruns.

Neighbors raw log30/30 across sessions/actions/phone/phone-more/plan at two-worker invocation, clean censuses; Web typecheck/colour/tokens/HTML/oxlint/hooks output retained. Local Darwin arm64 Node24.21.0, pinned Headless Shell; no configured suite/Linux/T3/integrated or enforced duration claim yet.

Proceed with mode-free verify at exactfa38b1f9; preserve original launcher/exit/loader-closure receipts without rerunning for transcription. Reviewer only read source/log/hub traffic and computed file hash from Git; no tests/browser/GUI/edits/merge. No per-item QA brief/criteria; affected after-stage E-419 QA separate. Standards0; Spec0.

### rev-23 · 2026-10-23T16:18:51.145Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1182-final
commit: fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1182 final evidence review
Head fa38b1f9ed08c0ee52c3a4ed8a6587219cc43d84 / tree a363aa2513603242668441e0c0a961cbc960e9d3, branch t/T-1182-web-tests-measure-the-narrow-sessions. Run rev-20261023-1182-final. Clear; findings[]; C1/C2 verified.

## Standards
Same-head source audit A-10098 carries forward: two bounded rendered phone-commit waits only, original geometry/action assertions intact, no product/CSS/breakpoint change. Branch/tree lookup and hub verify head agree. Fresh mode-free fd510e30-1663-40cf-adde-399c88f50b51/A-10100 exits0; raw ordinary finish records1005test passes/167file passes, no failures/skips/cancellations. Actual all T1(132files) and complete Web(35files) run; T2 is empty web-only compatibility phase, not hub/Neovim T2 coverage. No T3/T4; T3 deferred by task policy. No load-gate scope finish records; generic five-repetition header establishes no configured repetitions. Separate macOS loaded proof below supplies C2, not this ordinary Linux run.

Linux x64 c-8 lon1 cland-v0-3bae6d0d, Node24.21.0/Neovim0.12.5, workers2/Web4; lifetime256s/$0.0178. Host gate209119a231bdb8631cc62319afa084f1de4e1874 reused, not remotely repeated. Actual T1phase49.82s, emptyT2compat0.03s, Web116.70s; per-test sums and projected wall are not observed phase wall. Generic duration/lint/ratchet diagnostics remain report-only (132lint findings59files;3missing file baselines), retained overages not claimed resolved. Changed existing Web identities pass: narrow session-actions1.675408549s and merged-facts2.956253427s. No new identity or allowance change.

## Spec
C1 verified through full source audit plus same-head configured Web: Sessions merged-facts waits for rendered data-phone=true before52px/two-line geometry; narrow session-actions waits before narrow interactions. All eight cross640 identities audited in A-10097 independently checked against Git: remaining phone boundary/saved split/Plan/threephone-more paths already observe rendered layout replacement/restoration; other resize sites stay desktop/pre-navigation. No second CSS breakpoint.

C2 verified through A-10097 raw20TAP passes plus A-10099 original process/loader transcript, with explicit source equivalence. Red4 actual `P27 row is52px tall;88 !==52`, old source e53bc5a3, earlier threepass. Green20/20 each1pass/0fail/0cancel/0skip, clean fixture census and stopped scratch hubs. Ten pairs of concurrent selected-test processes, each Node --test-concurrency=2, local macOS Darwin arm64 Node24.21.0 isolated pinned Headless Shell/sealed runner environment. Exactly two yes loaders68203/68204; Coordinator86ced13a authorized exclusive narrow window and queue checks. A-10099 transcribes existing tool records without rerunning: red exits0/0/0/1, all20green process exits0 and runner exit0, loader start PIDs, literal kill, ps no rows, original loader shell exit0. Neighbor30/30, build/static-check exit0 receipts retained. Earlier build invocation typo failed before tests; not counted.

Loaded source was e53bc5a3 plus Sessions wait, before adjacent session-actions wait/tracker-only fast-forward; not20runs of the full final committed tree. Final Sessions SHA256 independently matched c902a4062f2985753b6b2493b5f4776d0b0c194723c1116ab22f42b260fea30a. Product unchanged, e53→db59 diff tracker-only. This source-attributed targeted identity proof satisfies requested loaded behavior; exact-head configured result independently passes both changed identities. Native whole-process durations1776.570250–1838.391500ms are not latency/duration-enforcement claims.

Reviewer only read existing source/logs/hub traffic and computed Git-file hash; no test/stress/browser/GUI/edits/merge. No per-item QA criteria/brief; affected E-419 after-stage QA separate. Standards0; Spec0.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T16:23:31.400Z

Merged 1eab7e7ce28ff6b2bf431d5ed9b87510fa1eaee4 onto dev.
