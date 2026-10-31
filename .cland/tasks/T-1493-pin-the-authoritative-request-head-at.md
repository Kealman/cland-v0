---
id: T-1493
kind: task
title: Pin the authoritative request head at verifier admission
state: open
status: review
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1269
branch: t/T-1493-pin-the-authoritative-request-head-at
created: 2026-10-30T19:25:08.372Z
updated: 2026-10-31T15:35:16.780Z
---

## Summary

Review and QA requests carry free text. The hub parses only `{item, kind}` from them and holds no authoritative head for the request, so pending-reservation retirement (T-1487) works on ordered request and verdict receipts, not on the commit a request was for. Pinning the request head at admission, from the claimant's pushed head or an explicit field, would allow head-exact and ancestry-aware retirement and freshness checks.

Origin: impl-1487's T-1487 scope note (2026-10-30). T-1487 kept the ordered-receipt design on purpose.

## Acceptance criteria

- [x] C1. A role-addressed review or QA request records the head it was admitted for, and pending retirement can compare a later verdict's commit with that head (same, descendant, or unrelated), with legacy text-only requests still accepted.
  - verified: rev-32 [reviewer] · run rev-20261031-1493-evidence1 · 2026-10-31T15:31:36.831Z · commit eb522d7bfb66b361bfcb5ff9c95dc7d375ebbce0
  - done: impl-1493 · 2026-10-31T15:33:46.694Z

## Comments

### impl-1493 · 2026-10-31T14:45:54.227Z

Contract inventory: verifierRequest parser consumers are core sendFromSession/sendFromHuman, launch/reuse briefs, rememberVerification and queue drain; dispatch Lead routing; Store pending lead routing. PendingVerification consumers: protocol and shared/wire conformance, server session projections, web/nvim pending displays (additive head ignored), routing/resolver tests and memory/inbox workload fixtures. Durable admission consumers: Store schema/migration and verifier-routing restart fixtures; receipt/accepted meta readers in core. lastVerifier consumers: core retirement/affinity and tracker/index wrapper. Shipped flow docs: implement skill, issue-tracker, review-and-qa, hub README; QA briefs/startup probes contain no direct private admission/receipt consumers. Plan: explicit full-SHA Head: line pinned in private admission storage before delivery; optional pending.head projection; legacy absent head retains ordered retirement; pinned requests retire only on proven same/descendant commits using existing asynchronous freshness ancestry cache.

### impl-1493 · 2026-10-31T14:51:44.916Z

Compatibility refinement: abbreviated, ambiguous or prose Head details stay accepted as legacy unpinned requests; only one standalone full-SHA Head field pins a request. Added a red-first legacy-prose request regression. Current touched-file run: 48/48 verifier-routing cases pass locally on macOS; typecheck passed. No browser, full local suite or remote verification executed.

### rev-32 · 2026-10-31T14:53:28.028Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261031-1493-source1
commit: d9a9b40aab053d2ed7138f59efdb7248fd5da880
scope: full
findings: [{"severity":"medium","text":"M1: strict malformed/duplicate Head throw also runs in retained-message acknowledgement, queue drain and Store.pendingReview. Previously valid short/ambiguous Head prose can abort legacy readers/queue maintenance. Keep legacy parsing compatible and pin only unambiguous explicit full SHA; retain persisted legacy/fresh positives and migrate refusal docs. Reported c968 fix is outside this head.","file":"hub/src/hub/verifier-request.ts","line":19},{"severity":"medium","text":"M2: only latest verifier/latest accepted-request receipt is checked for coverage. A covering A/descendant receipt followed by unrelated B hides already-served proof, so delayed A acceptance or unsettled ancestry can reserve served work. Preserve monotonic bounded covering facts and add covering-then-unrelated verdict/request controls across delay/restart.","file":"hub/src/hub/core.ts","line":1889}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full source not clear A-14890, M1/M2 only. Read-only source inference, no Reviewer execution. Additive pin/projection/native-default behavior and async ancestry seam otherwise align. A-14884/local47 routing greens are summaries, not configured proof. Reported c968b6637 compatibility fix plus pending M2 correction need one fresh exact-head replacement; no verification before source clear. Preserve prior assertions/red receipts and keep retirement facts bounded/indexed.

Criteria: C1 failed (Legacy Head prose can throw, and latest-only retirement can recreate pending work after an earlier covering receipt.).

### impl-1493 · 2026-10-31T14:57:43.282Z

Source1 findings addressed in successor: M1 exact full-SHA field only, malformed/duplicate prose remains unpinned; seeded NULL-admission restart matrix retains human/authorized/unrelated sender cases. M2 red-first delayed covering-then-unrelated controls failed with: earlier covering receipt retires delayed request: not within 15000 ms (4/4 original controls). Replaced latest-only pinned retirement with deferred indexed pages (32 per producer), durable per-message cursors and positive coverage reason; accepted-request ledger retains identities across restart. Existing freshness contains settled-only option keeps transient failures unknown. Added same/descendant and verdict/accepted-request restart matrix plus cross-page proof after 40 unrelated verdicts. Contract inventory addition: verificationFacts wrappers and indexed accepted receipt ledger are private; freshness contains optional settledOnly defaults false for existing stage-cover consumers, preserving their API behavior. Core owns/cancels background immediates before Store closes.

### rev-32 · 2026-10-31T15:04:20.344Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261031-1493-source2
commit: ecad3d0738d91aff48e378d52234b719b3735695
scope: full
findings: [{"severity":"medium","text":"M3: one unknown ancestry fact freezes a full producer page/cursor and prevents scanning later exact-head covering verdicts or accepted requests. Separate bounded unresolved retry from forward scanning; cover >32 unavailable predecessors followed by exact proof and unknown-only negative, including reopen.","file":"hub/src/hub/core.ts","line":1907},{"severity":"medium","text":"M4: missing Git object/tip becomes false in fixed ancestry cache; coverage then durably advances past potentially covering proof. Later object availability cannot reconsider it. Preserve unavailable/definitively unrelated distinction and retry missing-object facts; cover later availability and reopen.","file":"hub/src/tracker/freshness.ts","line":363}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source2 not clear; consolidated A-14909. M1 legacy prose/recovered-NULL compatibility closed; M2 ledger/checkpoint correction partially closes latest-only loss but leaves M3/M4. Static source findings, no Reviewer runtime reproduction. Component tests retain existing authority assertions and appropriate seams; no independent Standards finding. No further findings pending from this pass. Fix together, request new exact-head source review before configured verification.

Criteria: C1 failed (Monotonic retirement still hides exact coverage behind unresolved pages and permanently skips missing-object ancestry facts (M3/M4).).

### impl-1493 · 2026-10-31T15:09:12.156Z

Source2 M3/M4 correction: red-first tests failed with later exact receipt reached beyond unavailable page: not within 15000 ms (verdict/request positives), and arrived descendant object retires saved request: not within 15000 ms (arrival/reopen). Forward cursors now advance independently from a durable deduplicated unresolved-pair queue with rotating 32-row retry pages. Conservative verification ancestry has a separate fixed cache key: both objects must resolve and merge-base must return a positive fact; missing objects/null ancestry throw into retryable unknown, never checkpointed false. Existing stage-cover mode stays unchanged. Updated docs/skill and tests for request-object, covering-object and ancestry availability, arrival and reopen, unknown-only and definitive unrelated controls. Local macOS touched routing file 75/75 and typecheck passed; final lint in progress. No full local suite, browser or native Git runs.

### rev-32 · 2026-10-31T15:11:58.846Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1493-source3
commit: eb522d7bfb66b361bfcb5ff9c95dc7d375ebbce0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, A-14917. M1–M4 closed at source: legacy NULL stays unpinned; indexed monotonic receipt history retained; separate durable retry pages permit forward coverage progress; conservative verification ancestry resolves both objects and positive merge-base under an isolated cache mode, preserving stage-cover defaults. New exact-after40-unavailable and object/ancestry-arrival/reopen controls retain unknown-only/definite-unrelated assertions. No remaining Standards/Spec finding. C1 runtime verification pending; one unchanged-head mode-free configured verify then original-record final evidence review. No Reviewer execution or full-all request.

### rev-32 · 2026-10-31T15:31:36.831Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1493-evidence1
commit: eb522d7bfb66b361bfcb5ff9c95dc7d375ebbce0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-14945 from a02f0750/A-14940 and source3/A-14917. All 4,477 ordinary test passes and 519 files pair, no adverse/unmatched facts. Routing 75 ordinary passes; 37 new generated identities each once plus five passing repetitions (185 separate repetitions). Exact fresh reviewer/QA pins, same/descendant/unrelated retirement, legacy NULL/prose, queued restart, monotonic history, >32 unavailable pages and object-arrival/reopen controls establish C1. Selected T4 one base pass, no repetitions; T0/T1/all fallback T2/T4/Web complete, no T3 phase. Footer candidate hash reproduced; Linux droplet and Headless Shell1248, host gate reused. Three live-arrival cases 4.09–4.26s exceed report-only T2 2s; no enforce/budget clearance or allowance inferred. Lint/ratchet/skip-reason checks report-only; no skips. No source change or Reviewer execution.

Criteria: C1 verified.

### impl-1493 · 2026-10-31T15:33:34.435Z

Coordinator-authorized merge after final evidence1 clear: a27fee4a29c4b44b065bf8597f63e669fc83c1c9 merges origin/dev b126dff13d3b2931dda67374cbfd5264350f6258 into reviewed eb522d7bf. Only conflict resolutions were appended implement skill and hub README sections; both sides retained verbatim. Item-owned hub/src, shared/wire and verifier-routing test have no diff from eb522d7bf. npm run typecheck passed at merged head; touched verifier-routing.test.ts 75/75 passed locally macOS. Searched hub/test and nvim/test for changed section headings and distinctive prose: no direct matching expectations. Original full configured receipt remains A-14940 at eb522d7bf, final evidence A-14945. No new mode-free verify per Coordinator decision 432b26b9; Coordinator owns planned verify all at merged head. Requesting merge-delta review.

### rev-32 · 2026-10-31T15:34:44.062Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261031-1493-delta1
commit: a27fee4a29c4b44b065bf8597f63e669fc83c1c9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, A-14950. Tree 42c8d643eeba9f09ff90ad049210c75de4c1ad78; parents eb522d7bf + b126dff13. Item-owned runtime, wire and routing test bytes unchanged from source3. README/implement append resolutions retain each new section; incoming nonconflict files exact dev parent. A-14948 reports merged-head local typecheck/routing 75/75 and prose searches; summary is not raw configured evidence. Original A-14940/A-14945 remain predecessor-only with report-only overruns and native/platform limits. C1 current-head runtime pending Coordinator432b26b9's required verify all; no new mode-free or final-ready claim.

### impl-1493 · 2026-10-31T15:35:16.780Z

Source-clear build handed to Coordinator for directed verify all: pushed a27fee4a29c4b44b065bf8597f63e669fc83c1c9, delta clear A-14950. Fresh origin/dev fetch b126dff13d3b2931dda67374cbfd5264350f6258; merge-tree exit 0 and tree 42c8d643eeba9f09ff90ad049210c75de4c1ad78, no conflicts; clean worktree. Merged-head local typecheck and 75/75 targeted routing tests pass. Merged-head full verification/final runtime evidence remain Coordinator-owned and pending; predecessor configured receipt A-14940 and final evidence A-14945 are not relabelled as merged-head results. No new mode-free verify. Claim retained until merge.
