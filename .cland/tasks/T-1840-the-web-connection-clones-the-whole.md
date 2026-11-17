---
id: T-1840
kind: task
title: The web connection clones the whole retained askCards map on every card delta and inbox publication
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: topic-1580
branch: t/T-1840-the-web-connection-clones-the-whole
created: 2026-11-12T22:58:19.834Z
updated: 2026-11-17T05:58:25.725Z
closed: 2026-11-17T05:58:25.725Z
---

## Summary

The web connection clones the entire retained `askCards` Map on every card delta and every inbox publication, so each card change costs work proportional to all retained cards (about 1,950 on this project today). Found aside by T-1827, whose new active sign-in index removed the per-render history scan it added but left this older publication copy as it was.

## What to build

Card deltas and inbox publications in the web connection update only the cards they touch, without copying the whole retained card map, while every consumer (the inbox, the hosts view's sign-in rows, the remotes cards) still sees the same cards and the same order. A work-count test bounds the per-delta work independently of the retained card count.

## Acceptance criteria

- [x] C1. One card delta and one inbox publication do work bounded independently of the number of retained cards, shown by a work-count test with 2,000 retained cards (test).
  - done: impl-1840 · 2026-11-17T02:15:43.531Z
  - verified: rev-35 [reviewer] · run rev-35-1840-final-1 · 2026-11-17T03:16:20.444Z · commit 308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c
  - verified: rev-35 [reviewer] · run rev-35-1840-final-3 · 2026-11-17T04:58:53.390Z · commit 8387a4628322c1a2fafbae84dc4950811de7609c
- [x] C2. The inbox, the hosts view's sign-in rows and the remotes cards render the same cards in the same order before and after the change (test).
  - verified: rev-35 [reviewer] · run rev-35-1840-final-3 · 2026-11-17T04:58:53.390Z · commit 8387a4628322c1a2fafbae84dc4950811de7609c
  - done: impl-1840 · 2026-11-17T04:58:58.528Z

## Comments

### impl-1840 · 2026-11-17T02:14:29.281Z

Consumer audit: ReadonlyMap<string, AskCard> and wire ask/message/inbox frames remain unchanged. Searched askCards across shared, hub/src, web/src, hub/test, web/test, qa and shipped skills. Production consumers: connection.ts delta/message/history/inbox ingestion and reconnect reconciliation; InboxArea.tsx, inbox-visit.tsx; HostsView.tsx (lookup plus map identity effect); MessageBlock.tsx (topic and remote cards). Tests: hub/test/web-area-state.test.ts; Web asks.test.ts, hosts-view.test.ts including previous wire shape, remotes.test.ts. QA reference E-1537-stage-2 is historical evidence. Persistent snapshots preserve get/has/size and insertion-ordered iteration, with fresh identity for changed cards. No shared wire/schema migration required.

### rev-36 · 2026-11-17T02:24:22.409Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1840-source-1
commit: 31744153c4c30e4b14e49eea1eea3e7c69c519b0
scope: full
findings: [{"severity":"medium","text":"C2 requires rendered cards/order across Inbox, Hosts sign-in rows and remote cards. The new native-Map/caller lookup comparison renders none of them; existing planned Web cases cover individual cards and remote status/pairing/approval/text/voice, not multiple retained AskCards in rendered order. Claimantaa9f9980/A-20543 confirms no full three-surface proof. Add meaningful actual-render regression coverage preserving old wire, terminal/reconnect and existing assertions; data-order equality alone is not rendered evidence.","file":"hub/test/web-area-state.test.ts","line":281}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear A-20544. Standards0/Spec1medium missing C2 rendered-order coverage, claimantconfirmed. Persistent radix source and C1 T1 work-count seam accepted: bounded UTF16paths, immutable versions, nativeMap order/API, both retained-copy sites removed; C1unverified pending configured evidence. No demonstrated production render defect. A-20543 preserves full consumer boundary ledger and original commands/completion/raw/hash/tree/native limits, corrects development lint interval/final guide linkage;14/14T1/localtyping/lint positives are not exact-head configured/Web proof. Required existing Web names planned, rendered-order missing. No schema/UI/key/dependency change or Reviewer runtime. C2failed; holdreleased for meaningful rendered multi-card/order coverage and fresh committed source review before window/verify.

Criteria: C2 failed (No test directly establishes same retained cards and rendered order across all three named surfaces; current Map oracle is not rendering coverage.).

### rev-35 · 2026-11-17T02:35:03.777Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1840-source-2
commit: 7058d8c4fc2181500c6a2aec8263058bef8dddf1
scope: full
findings: [{"severity":"medium","text":"The new rendered-order callback has no whole-sequence owner before webFixture acquisition. Existing close/context-finally hooks cover already-returned resources, but do not join setup/body or adopt late root/hub/browser/context acquisitions before cancellation cleanup.","file":"web/test/hosts-view.test.ts","line":678},{"severity":"medium","text":"The stale inbox republication has no positive consumption receipt: push returns after route.send and assertSurfaces reads cards/order that already matched before the push, so C2 can pass without that publication being processed.","file":"web/test/hosts-view.test.ts","line":744}]
finding_counts: {"high":0,"medium":2,"low":0}

Fresh source review not clear; A-20554. Standards medium at hosts-view.test.ts:678: the new callback is not fenced/joined before webFixture acquisition; returned-resource/native-close/context-finally hooks do not adopt late acquisitions or join its complete setup/body on cancellation. Spec medium at :744: final stale inbox push has no uniquely changed rendered receipt; existing cards/order can satisfy assertSurfaces before the exact republication is consumed. Lead 2cbdaa04 confirms both boundaries absent. Actual three-surface DOM order/text/provenance coverage otherwise improves on A-20544. Reviewed prior source basis and unchanged AskCards/connection/T1 implementation; accepted C1 design remains intact, C1 unverified. A-20549 filtered browser case and later lint positives remain precommit/development observations with browser-metadata/raw/hash/signal limits; no configured verification. C2 failed. Consolidate fixes and request fresh source review before verification.

Criteria: C2 failed (New rendered-order callback lacks pre-acquisition whole-sequence ownership, and final stale inbox republication has no positive consumption receipt before unchanged assertions.).

### rev-35 · 2026-11-17T02:43:31.064Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1840-source-3
commit: 308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated source review clear; A-20563. Both A-20554 mediums resolved: caseDeadlines enrolls shared ownership before acquisition and owns the complete webFixture/preparation/pageCase continuation with proxied late cleanup and root adoption; final inbox publication carries a unique flattened-row preview observed by a bounded waiter armed before push and retained positive assertion before all card/order checks. Actual Inbox/Host/remote render assertions, production C1 radix design, T1 tests, individual/terminal/reconnect/previous-wire controls and shared helpers remain unchanged. C1/C2 remain unverified test criteria pending configured same-head evidence. A-20560/A-20562 retain filtered browser1/T2owner5 positives and aggregate typecheck/lint0, with precommit source linkage, package-metadata browser facts, raw/hash/signal/scan-control limits and report-only advisories. No dev merge, Reviewer runtime or full verification claim.

### impl-1840 · 2026-11-17T03:09:57.280Z

Configured run 6d52172c-386a-4154-9d21-0c79e7cc90dd (A-20585), exact task head 308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c/effective tree 554725d4118e8d005e827702c4921ae3e6b5fc5c: T0/T1 exit 0; all-T2 fallback exit 1 only doctor-hosts.test.ts C1/C6 expected [] actual GET droplets and account/keys. Coordinator attributed to T-1930 and allowed one same-head retry. Linux x64 droplet c-8 ams3, Node24.21.0, lifetime1007s cost0.0699USD. Web unexecuted/browser identity unknown; no configured full pass. Awaiting retry T0 window, source unchanged.

### rev-35 · 2026-11-17T03:16:20.942Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1840-final-1
commit: 308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c
scope: evidence
findings: [{"severity":"medium","text":"Configured A-20585 fails the known T-1930 doctor startup-inventory assertion (two GETs versus []), leaving Web and C2's required same-head rendered-order proof unexecuted; no new T-1840 production defect is demonstrated.","file":"hub/test/doctor-hosts.test.ts","line":89}]
finding_counts: {"high":0,"medium":1,"low":0}

First configured evidence not clear; A-20588. A-20585 matches unchanged clean source-clear head. Sole ordinary failure is doctor-hosts C1/C6 at 15844/32947–32976: exact two startup GETs versus [], matching known T-1930. No new T-1840 source defect inferred. C1 verified from 2000-card work-count ordinary pass10890 plus five load-gate passes; C2 failed for missing configured Web receipt. Parsed 5806 ordinary passes/one fail,607 positive files/one fail, separate240 load positives. T0/all224T1 pass; T2 has383 passing files/one failed/44 unexecuted, not all428 completed. Web/allT3/allT4 unexecuted. Provenance33124 pins normalized tree554725d4118e8d005e827702c4921ae3e6b5fc5c,uncached Linux x64/Node24.21/Nvim0.12.5,browser null. Report-only advisories and historical provenance limits retained. Existing Coordinator retry disposition is unchanged; no extra retry/head change or Reviewer runtime authorized by this review.

Criteria: C2 failed (Configured Web/rendered-order evidence is unexecuted because T2 stopped on the known T-1930 doctor assertion; this is incomplete evidence, not a demonstrated T-1840 rendering failure.).

### impl-1840 · 2026-11-17T03:57:43.672Z

Authorized same-head retry 93559fdd-b67a-4e7e-91ef-a05a00ae1873 (A-20601) failed only the same Coordinator-attributed T-1930 doctor-hosts C1/C6 provider-call race. T0/T1 exit0, all-T2 fallback exit1, Web unexecuted; Linux x64 droplet c-8 ams3 lifetime992s cost0.0689USD. Exact task head308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c unchanged/clean. Retry authorization consumed. Holding for Coordinator-posted T-1930 shared fix; no further diagnosis, source changes or verification submissions.

### rev-35 · 2026-11-17T03:58:48.409Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1840-final-2
commit: 308016c3bb8d5d30441ca2e3ebfdf4dfa8afb74c
scope: evidence
findings: [{"severity":"medium","text":"The authorized same-head retry again fails known T-1930 doctor startup inventory (two GETs versus []), so Web/C2 rendering proof remains unexecuted; no new T-1840 source defect is shown.","file":"hub/test/doctor-hosts.test.ts","line":89}]
finding_counts: {"high":0,"medium":1,"low":0}

Retry evidence not clear; A-20602. A-20601 at unchanged clean source-clear head again records the exact two-GET versus [] doctor failure at32946–32974, test15835/file15921. T0/all224T1 pass; T2 has383 positive files/one failed/44 unexecuted. Ordinary5806 pass/one fail plus separate240 load positives; Web/allT3/allT4 unexecuted. C1 remains verified, with ordinary10888 plus five load work-count passes; C2 evidence remains incomplete. Provenance33122 pins same normalized tree554725d4118e8d005e827702c4921ae3e6b5fc5c, uncached Linux x64/Node24.21/Nvim0.12.5, browser null. Advisory gates and earlier provenance limits retained. The one authorized same-head retry is consumed per lead; hold source for Coordinator-posted shared fix, no further run/head change inferred. No Reviewer runtime/edit.

Criteria: C2 failed (Second configured receipt stops on known T-1930 before Web; required same-head rendered-order evidence remains incomplete, not a demonstrated rendering failure.).

### rev-35 · 2026-11-17T04:34:24.440Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1840-source-4
commit: 8387a4628322c1a2fafbae84dc4950811de7609c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized identity-only delta clear; A-20616. Candidate is one separate cherry-pick directly atop source-cleared308016c3b. Independent git-show byte comparison and SHA256 equal landed20202e0c9 (4c6b99962aa1f3cd6c6acdf9f5d0e761cb47a91273418fb6a2320bd9f069f907); only doctor-hosts test/guide changed and both match landed bytes. Own production/tests/guides and ancestor commits unchanged; clean tree, no dev merge. Standards/Spec findings none within requested scope. A-20614 local Mac/Node24.21 targeted T2 11/11 remains qualified native transcription, not configured proof. No new criterion verification: older C1 mark stale at changed head, C2 still awaiting configured Web. Prior failed receipts and all raw/hash/signal/browser/advisory limits retained. Source clear permits requesting Coordinator window; no window or further head change granted. No Reviewer runtime/edit.

### impl-1840 · 2026-11-17T04:57:56.794Z

Configured same-head run dab1cd92-45a3-4fe8-8ba7-78556a358b65 (A-20633) exit0 at8387a4628322c1a2fafbae84dc4950811de7609c/effective treeeaa269ba630b46a4d8b241da6f8497fd669017ba. T0/T1/all-T2 fallback/Web complete,6543pass0fail0cancel0skip0todo. C1 generated work-count case ordinary pass plus5/5load; C2 generated three-surface rendered-order case pass at log36029. Linux x64 droplet c-8 ams3, Node24.21.0, Headless Shell1248 Chrome for Testing156.0.8078.4; lifetime1204s cost0.0836USD. Report-only lint/budget findings retained. T3/T4 unexecuted here, T3 reported in merge batch. Reviewer settling same-head final evidence; head unchanged/clean.

### rev-35 · 2026-11-17T04:58:53.390Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1840-final-3
commit: 8387a4628322c1a2fafbae84dc4950811de7609c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20634. Run dab1cd92/A-20633 matches clean source-clear8387a4628 and normalized verification treeeaa269ba630b46a4d8b241da6f8497fd669017ba. C1 ordinary10851 plus five load passes/proof11111; C2 actual Inbox/Hosts/remote rendered-order case36029/file36033 pass; previous-wire case35627 pass. Doctor former blocker both token variants15779/15788/file15858 pass. Parsed6543ordinary test/707file passes, separate220load test/file positives, no failure/cancel/skip. T0/all224T1/all428T2 fallback/55Web exit0;269T3/17T4 unexecuted. Uncached Linuxx64/Node24.21/Nvim0.12.5 droplet; actual browser34979/provenance37543 HeadlessShell1248/CfT156.0.8078.4. Delivered accountingc8ams3,2workers1204s/$0.0836 is provider lifetime, not test wall. Report-only lint/budget/ratchet/skip checks and historical precommit/raw/hash/signal/scan limits retained. Older failed receipts remain historical incomplete results. Standards/Spec findings none; C1/C2 verified. No Reviewer runtime/edit or integrated/T3/T4/QA claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T05:58:25.725Z

Merged 04d1f6a0f3a7ef4cfb6bea77cbf15cd80ffc74de onto dev.
