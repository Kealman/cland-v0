---
id: T-1926
kind: task
title: A Codex session receives an already-answered review request again and again, with the same stale progress notes
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1772
branch: t/T-1926-a-codex-session-receives-an-already
created: 2026-11-16T22:29:11.865Z
updated: 2026-11-25T08:49:09.862Z
closed: 2026-11-25T08:49:09.862Z
---

## Summary

A Codex Reviewer session (rev-38, launched 2026-11-16 22:25Z, no reconnect since) received one accepted review request, msg 5b257321-d065-4e3f-8377-49fb8b3e3933 for T-1677, at least four more times after it had recorded its source verdict rev-38-1677-source-2 and its reply e0356476-922d-411c-b047-1bb502979405. Each redelivery repeated the same five stale progress notes. No duplicate verdict was written, but each repeat costs the session a turn and risks a second review.

## Evidence

- Reviewer report 42efa3c5-236b-47a5-ac97-b82db8a8748a in topic-1570; relayed by impl-1677 (msg 0a2a00ca-c2aa-4bf9-bea3-21fdbd9f94e4).
- Related but distinct: T-1651 (replays after the Coordinator's Claude harness reconnects) and T-1924 (Claude turn receipts that time out). This case is a Codex session without a reconnect.

## Acceptance criteria

- [x] C1. A delivery the recipient has answered (reply_to or a recorded verdict naming it) is not delivered again to that session; a regression with a Codex fixture session reproduces the repeat before the fix (test).
  - done: impl-1926 · 2026-11-25T04:47:46.480Z
  - verified: rev-35 [reviewer] · run rev-35-1926-evidence-3 · 2026-11-25T07:48:10.884Z · commit 9ed6c32f0e9e9a1b8b89d8fece8ad2eb2de42024
- [x] C2. Progress notes already digested into a turn are not re-sent with a later redelivery (test).
  - done: impl-1926 · 2026-11-25T04:47:46.669Z
  - verified: rev-35 [reviewer] · run rev-35-1926-evidence-3 · 2026-11-25T07:48:10.884Z · commit 9ed6c32f0e9e9a1b8b89d8fece8ad2eb2de42024

## Comments

### coord · 2026-11-16T23:39:21.429Z

More evidence (reviewer report 67d51ce9-aed9-449d-a851-2a38b863808c, relayed by impl-1677 in topic-1570, 23:39Z): the identical request 5b257321-d065-4e3f-8377-49fb8b3e3933, with the same five old progress notes, kept arriving at rev-38 after its final clear rev-38-1677-final-1 (A-20427) and after it had moved on to the newer T-1924 review. `verification.decline` on it returned exactly "request is not your current accepted pending reservation". So the hub no longer treats it as rev-38's pending review, yet keeps delivering it. The replay therefore comes from the delivery path, outside the review reservation; likely related to T-1924's diagnosis (delivered rows re-entering the retry through `uninjected`), though rev-38 is a Codex session, not Claude. No retry, workaround or duplicate verdict was made.

### impl-1926 · 2026-11-25T02:37:17.158Z

Consumer audit before delivery-policy change: Store uninjected/isUninjected and deliveryMessage/markInjected (store.ts and store.test.ts); Sessions retry/held-delivery/in-flight finally paths (adapters/sessions.ts; inject-stalled and codex-delivery tests); HubCore sendFromSession and clearPendingVerification; tracker verdict callback in serve.ts; spoke ack and native adapter confirmation; protocol delivery-stage consumers in web/nvim and old-wire clients. Plan keeps existing wire shapes and uses existing injected receipt for an authenticated recipient's persisted reply or exact accepted verification verdict. Docs: docs/hub/identity-and-delivery.md. No CLI/help/config changes. Additional regression will protect unrelated recipient and unrelated progress notes.

### impl-1926 · 2026-11-25T02:43:02.251Z

Consumer audit follow-up: verifier-routing.test.ts case 'idle before an inject becomes uncertain preserves verification reservations' asserts delivered after the recipient's persisted verdict. Migrate that expected stage to injected for verification=true; keep operational unanswered=false delivered and one-attempt assertion. Existing codex-delivery uncertain-retry test now sends its reply after explicit retry, because a reply is a positive receipt.

### rev-35 · 2026-11-25T02:52:18.712Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1926-source-1
commit: e51c0f43df11fdc8403a586008a54aed1959095f
scope: full
findings: [{"severity":"medium","text":"New verdict/reply cases bound only scratch-root setup; admission-only subsequent step calls and raw/cached resource cleanup lack full setup/body observations and positive-close/restoration/repair fences.","file":"hub/test/codex-delivery.test.ts","line":20},{"severity":"medium","text":"Verdict settlement reads only latest item/kind acceptance. Later recipient/head acceptance overwrites the earlier receipt; after a hold cleared pending metadata, that earlier recipient's late matching verdict leaves its attempted delivery and digest replayable.","file":"hub/src/hub/core.ts","line":2066}]
finding_counts: {"high":0,"medium":2,"low":0}

A-23208: both gaps confirmed in retained-source answers. Existing verifier-routing stage migration is appropriate and still preserves reservation until verdict/unanswered delivered branch. Hold positively released for consolidated per-request settlement+supersession regression and owned bounded/close-gated fixture correction. Partial local importer receipts remain partial; fresh corrected committed source review before verify.

Criteria: C1 failed (Earlier accepted request can remain replayable after later acceptance supersedes the global receipt; new regression ownership/bounds incomplete.), C2 failed (Superseded earlier delivery's held progress can remain replayable with its root; new reply/verdict controls need complete observation and close fences.).

### impl-1926 · 2026-11-25T02:59:59.415Z

A-23208 corrections: M2 replaces latest global routing-receipt lookup with bounded pages of exact pending attempted roots joined to existing verification_acceptances and admitted delivery session identity; old global metadata remains for routing consumers. Added supersession regression: second recipient accepts same item after first holds it; first late verdict settles original root/progress, second remains pending. Store T1 crosses 32-row page and fences wrong identity/kind/head, unattempted and queued rows. M1 new delivery-case.ts composes existing stageCase with separate load-scaled full setup/body and per-operation bounds; uses required-resource context and positive close/root/restoration guards. Retained fixture cleanup retries rejected close instead of caching rejection. Actual partial ProcessTable constructor failure, cancellation with held fake injection, and rejected Sessions.close/removal/restoration/repair controls all pass. No schema/wire shape/role/command changes. Additional consumers: Store.verificationFacts shared acceptance ledger unchanged; new unconfirmedVerificationRequests only core.clearPendingVerification and Store tests. Tracker verdict callback is hub/server.ts (correcting earlier serve.ts shorthand).

### rev-35 · 2026-11-25T03:08:23.639Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1926-source-2
commit: 6e0ad0b1c0f8df930b1e623be581b99e5e23dbfc
scope: full
findings: [{"severity":"medium","text":"Confirmation runs only for new reply/verdict events. Persisted answered-but-still-pending roots from before the fix remain eligible in uninjected/retry without bounded persisted-receipt reconciliation; no new receipt event is required to trigger their old replay.","file":"hub/src/hub/core.ts","line":2064}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23216: prior M1/M2 resolved by deliveryCase required-close controls and per-request acceptance ledger. Remaining M3 is historical answered-state recovery, confirmed source-only. Hold positively released for bounded indexed persisted-receipt reconciliation and restore/no-new-receipt control, preserving exact identity/head/digest fences, fixture owners and accepted verifier-routing migration. No configured run yet; fresh corrected source review required.

Criteria: C1 failed (Already answered persisted rows can replay after upgrade/restore when no new receipt is written; historical positive-receipt reconciliation missing.), C2 failed (Held progress on those historical answered roots remains replayable with the old root; no restore/no-new-receipt regression covers it.).

### impl-1926 · 2026-11-25T03:10:18.109Z

M3 consumer audit before adding recovery seam: retry entry and in-flight finally paths in adapters/sessions.ts; Store deliveries/readers and indexed messages_reply_to/from_session_id, verification_acceptances; persisted authenticated tracker_written_verdicts (index-db.ts), Tracker and TopicItems adapter. Existing verificationFacts/lastVerifier retirement/routing consumers retain their contracts. Plan adds dedicated exact-identity verdict receipt lookup/page ports rather than changing their shapes; no wire/CLI change. Fake old-hub restore tests will plant only own disposable fixture database after all first-generation writers close, never live hub.db.

### rev-35 · 2026-11-25T03:26:07.044Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1926-source-3
commit: ea3a670d8f1d6377dee8152ebb90a5a00d2f1cae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23223: capped bar f67b5907/Coordinator335a0575 met. Exact attempted answered root reconciles persisted captured reply/authenticated verdict before native retry; linked progress settles without new answer, restore controls require zero old attempts. Authority and bounded/checkpointed ancestry fences retained; M1/M2 ownership/supersession controls and stage migration unchanged. Wider reconciliation remains follow-up scope. Source hold released; C1/C2 final runtime marks pending one same-head configured result and verifier-routing/consumer coverage.

### rev-35 · 2026-11-25T04:38:27.704Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1926-evidence-1
commit: ea3a670d8f1d6377dee8152ebb90a5a00d2f1cae
scope: evidence
findings: [{"severity":"medium","text":"Same-head configured run fd9eb3a6 fails the native reply/state consumer: native timeout recorded as uncertain: not within 30000 ms (A-23255:51930). This blocks final evidence settlement; attribution is pending, not a proven source or load diagnosis.","file":"hub/test/codex-adapter.test.ts","line":725}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear on exact-head configured evidence; A-23257 retains full audit. Durable result code1/cause empty, complete T0(two)/T1/T2 exit0 and T3 exit1, Web/T4 unexecuted. Sole test failure codex-adapter at line725 is the named 30s observation, not a proven owner deadline or budget cause. All12 new identities base+5/5 loaded and positive routing/Store/delivery files are retained, but do not settle the failed run; C2 stays unverified. Prior source clear and capped round3 bar remain unchanged. Audit freeze positively released by this verdict for Coordinator df8f0dfe's exactly two isolated single-case comparisons at ea3a670d8/dev5dbc6af5c, pinnedNode24/load<8. Preserve failed evidence, report native outcomes/slot release to Coordinator; any attribution/correction and new configured window follow that decision. No duplicate configured submission authorized here.

Criteria: C1 failed (Configured native Codex reply/state consumer failed waiting for inject-uncertain; retain A-23255 red pending Coordinator-authorized head/dev comparison.).

### impl-1926 · 2026-11-25T04:44:08.905Z

Configured failure attribution/second contract change: A-23255 failed native missing-result case. Supported Node24/macOS unchanged-source comparison: ea3a670d8 red, pinned dev5dbc6af5c green; preliminary baseline Node25 excluded and rerun under24. git log -S exact old title traced its introduction to dee14dc583/T-692: native missing-result classification retained real while permutations moved down; C5 required no behavior claim dropped. Old title 'a missing native turn-start result becomes uncertain after its accepted turn replies' now 'a missing native turn-start result stays uncertain unless its exact recipient replies'. Coordinator approved b6e1fc71. One binary fixture keeps native no-reply uncertainty and proves exact authenticated reply-to-input confirms the other root; final stages/one attempt per input retained. Native case1/1 green, no production change. Frozen old duration identity is retained as historical evidence, not renamed/reused. No new configured run until fresh source review and verify window.

### rev-35 · 2026-11-25T04:50:10.070Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1926-source-4
commit: 9ed6c32f0e9e9a1b8b89d8fece8ad2eb2de42024
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23261 records explicit agreement with BOTH behavior changes under capped C1/C2 bar. T-692/dee14dc583/C5 native classification purpose is conserved: first missing-result input requires exact authenticated replyTo and injected stage; distinct second missing-result input suppresses pong, observes durable native inject-uncertain and stays delivered; later accepted native turn barriers durable final stages/one-appearance assertions. Fake loseOnce is keyed by full text, so both faults actually apply. Prior verifier-routing verification?injected:delivered change remains agreed, with pre-verdict reservation and unanswered delivered assertions intact. Four-file correction only; production, resolved M1/M2/M3 and twelve prior controls unchanged. Exact-title census finds old title only as historical guide quote; obsolete duration identity removed without copying timing/allowance. Reported local revised native1/1/typecheck/lint do not establish current Linux proof. C1/C2 final verification remains pending a new exact-head configured receipt; A-23255/A-23257 stay failed old-head evidence. Source hold released; claimant may request Coordinator verify window, no duplicate run authorized here.

### rev-35 · 2026-11-25T06:13:08.192Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1926-evidence-2
commit: 9ed6c32f0e9e9a1b8b89d8fece8ad2eb2de42024
scope: evidence
findings: [{"severity":"medium","text":"Required configured execution is incomplete: durable code143/deadlineExpired true/cause run timeout75m with secondary package closure incomplete. T0/T1/T2/T3/mappedT4 complete0, Web unfinished. This is an evidence gate, not a new source or functional assertion failure.","file":"A-23295"}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear on incomplete configured evidence; A-23296 retains independent paired audit. Structured result b27c3801 explicitly confirms run timeout75m, secondary packageClosure incomplete/nativeExit143. Revised native contract passes3.45606579s at42201, full codex-adapter14/14; all12 new controls base+5/5 loaded and Store/delivery/routing files positive, mappedT4guard pass. No completed assertion failures. Paired9523 basepass/12skip+60loadedpass, known3F2 excluded; rawcompleted9598. Four Web files/seven raw records unfinished, no Web completion receipt; positive38Web files do not complete the phase. C1/C2 remain unverified, with no functional failure or new source bar inferred. Source clear A-23261 unchanged; oldA-23255 staysred. Audit hold released only; CoordinatorT-2100/run-limit hold remains. Keep source fixed and await human/Coordinator finish decision; no retry/probe/allowance/correction authorized here.

### rev-35 · 2026-11-25T07:48:10.884Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1926-evidence-3
commit: 9ed6c32f0e9e9a1b8b89d8fece8ad2eb2de42024
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified, unchanged capped source4 bar. A-23325 independently audits A-23324/run7a631548: durablecode0/causeempty, complete T0(two)/T1/T2/T3/mappedT4/Web, zero unfinished, c16/4 explicitworkers. All12 new authority/restore/hold/supersession/reply/ownership identities base+5/5 loaded; revised native answered/unanswered contract pass3.589434519s, fullnative14/14, Store34/delivery26/stalled31/routing83/native-routing1 pass, mappedT4guardpass. Paired9620basepass/12skip+60loadedpass, known3F2 excluded. PositiveT1 247/T2 448/T3 248/T4 1/Web55;26 otherT3 and17 otherT4 unexecuted. LinuxNode24.21/Headless1248v156, cacheunknown; sourcea5f05.../verification345c829... literal distinct identities. Both behavior migrations remain explicitly agreed; wider reconciliation stays follow-up. PriorA-23255red andA-23295timeout remain history. No new finding/sourcechange/allowance/run requested; audit hold released for normalreadiness/merge gate.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T08:49:09.862Z

Merged 3ad39cff160d4a18de27c1dfb2c4dee0add121a2 onto dev.
