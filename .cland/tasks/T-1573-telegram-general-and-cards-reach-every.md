---
id: T-1573
kind: task
title: "Telegram: General and cards reach every paired user"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1572
topic: topic-1353
branch: t/T-1573-telegram-general-and-cards-reach-every
created: 2026-10-31T23:47:53.814Z
updated: 2026-11-03T01:20:12.201Z
closed: 2026-11-03T01:20:12.201Z
---

## Summary

In users mode the Telegram remote mirrors General to every paired user's chat, and sends every ask and approval card to each of them. When one user answers, the card in every other chat folds with the answerer's name. A message from one user's chat is mirrored to the other chats with that user named, and is not echoed back to its own chat.

Hot files: `hub/src/remote/telegram.ts`, `telegram-outbox.ts`, `telegram-cards.ts` [Host: E-1534/E-1535 cards], `telegram-gap.ts`, `hub/src/remote/media.ts`, `hub/src/remote/cards.ts` [Host], `hub/src/remote/outbox.ts`.

## Acceptance criteria

- [x] C1. With two paired users on the test Telegram, a Coordinator line in General reaches both chats once each.
  - done: impl-1573 · 2026-11-03T00:00:34.939Z
  - verified: rev-35 [reviewer] · run rev-35-1573-final-1 · 2026-11-03T00:37:49.655Z · commit b0cbe213ec123053fbfcd7d77d2982ee9bbad829
- [x] C2. A Coordinator ask reaches both chats as a card, and an answer from one chat folds the other chat's card with a line naming the answerer.
  - done: impl-1573 · 2026-11-03T00:00:36.166Z
  - verified: rev-35 [reviewer] · run rev-35-1573-final-1 · 2026-11-03T00:37:49.655Z · commit b0cbe213ec123053fbfcd7d77d2982ee9bbad829
- [x] C3. A message one user sends from their chat reaches the other chat attributed to that user, and is not echoed to its own chat.
  - done: impl-1573 · 2026-11-03T00:00:36.670Z
  - verified: rev-35 [reviewer] · run rev-35-1573-final-1 · 2026-11-03T00:37:49.655Z · commit b0cbe213ec123053fbfcd7d77d2982ee9bbad829
- [x] C4. The outbox retries and gap recovery work per chat, so a failure on one chat does not hold back the other.
  - done: impl-1573 · 2026-11-03T00:17:13.983Z
  - verified: rev-35 [reviewer] · run rev-35-1573-final-1 · 2026-11-03T00:37:49.655Z · commit b0cbe213ec123053fbfcd7d77d2982ee9bbad829
- [x] C5. In single mode the Telegram remote's mirror, cards and outbox tests pass unchanged.
  - done: impl-1573 · 2026-11-03T00:00:37.149Z
  - verified: rev-35 [reviewer] · run rev-35-1573-final-1 · 2026-11-03T00:37:49.655Z · commit b0cbe213ec123053fbfcd7d77d2982ee9bbad829

## Comments

### impl-1573 · 2026-11-02T23:50:30.936Z

Shared seam plan (additive, single-mode preserved): RemoteStore.publicationPairings() enumerates active users-mode owners or legacy single pairing; cards.ts remotePublications(store, work) runs once per distinct chat/guild under withPairing, preserving scoped ownership through awaits. Both transports use it for General/card publications and fold closures; existing outcomeLine/approvalOutcomeLine already include outcome.by. Outbox gains optional availabilityKey so Telegram chat drains isolate availability without changing existing consumers. mirrorOut gains optional recipientUserId to suppress only sender echo and use named human attribution in users mode. Consumer search covers function/field names and importers across production, all test tiers, QA, skills/docs; inventory will be attached before edits.

### impl-1573 · 2026-11-02T23:59:10.326Z

Inventory addendum: RemoteStore.deliveryPairing(chat) is additive and used only by TelegramOutbox capture. It resolves detached feedback by destination, while scoped effects revalidate the admitted context and cannot acquire a reassigned owner; pairingFor's native admission API remains unchanged. New T1 reassignment regression covers the fence. allSettled refinement joins every destination, including a synchronous callback throw, before publishing failure.

### rev-36 · 2026-11-03T00:03:16.248Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1573-source-1
commit: 59df9f6cf47058e5ae7e31094c212402664ee1d2
scope: full
findings: [{"severity":"medium","text":"A users-mode gap send returning chat-local403 is rethrown through remotePublications/caughtUp into pollTelegram's global fatal path, stopping the transport for healthy chats despite the normal publication path exempting403. Keep destination failure local during gap recovery and prove healthy polling/cards/General continue.","file":"hub/src/remote/telegram-gap.ts","line":32},{"severity":"medium","text":"Gap matching and saved gap identity ignore the new payload.clandUserId. Reassigning the same native user/chat to another project owner lets the new owner publish/settle the former owner's missed jobs or reuse its pending gap. Bind gap ownership to captured project identity, preserving legacy wire/keys explicitly.","file":"hub/src/remote/telegram-gap.ts","line":10}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1573 full source review

Head59df9f6cf47058e5ae7e31094c212402664ee1d2; baseline986afe46b. Run rev-36-1573-source-1, scope full, result not clear.

## Standards

Medium — telegram-gap.ts:10 and shared gap.ts:8–17. New outbox intents capture clandUserId, and normal admission correctly compares it, but gap matching checks only native userId/chatId and persisted Gap contains only native user/chat. Under the supported reassignment exercised by the new RemoteStore regression, remove Alice's pairing and pair Bob to the same native identity. Alice's missed jobs still match Bob; a new Bob-owned informational send can mark Alice's captured jobs reported. An already saved gap is also accepted because its native user/chat still match. This bypasses the new durable owner fence for recovery/settlement (rule26). Capture and validate the project owner in users-mode missed-job selection and saved gap identity, retaining deliberate previous-shape/single-mode handling. Add reassignment controls for both fresh and retained gap checkpoints; a native identity match alone must not authorize settlement.

Other Standards checks: new enumeration is additive, deduplicates destination keys, scopes callbacks and uses allSettled so synchronous callback failure cannot release ownership before peers finish. deliveryPairing prevents scoped work acquiring a reassigned project owner. Consumer inventory A-16000/addendum names Telegram/Discord, shared outbox/mirror/cards, native admission, all test tiers, QA/docs and persisted shapes. Native input observers are armed before test actions; new T2 uses sealed fake Telegram and pacing-owner cleanup. Kept skill metadata change record and subsystem/test docs present. Existing single-mode test files are unedited.

## Spec

Medium — telegram-gap.ts:32 (telegram.ts:126; telegram-polling.ts:130). Chat-local403 is isolated on normal users-mode publication, but gap recovery explicitly rethrows403. remotePublications joins then rethrows it; #catchUpStep preserves fatal errors; pollTelegram rethrows it and the remote's #track marks the whole adapter blocked/aborts it. Thus a blocked paired chat with missed General can stop polling and delivery for the healthy paired chat. That violates C4 and the documented per-destination failure behavior. Distinguish a destination's gap failure from bot-level token/conflict/poll failures, retain its checkpoint/fence without falsely marking sent, and prove healthy native input, General and cards remain usable while that gap's403 persists. Current C4 test injects one503 and clears recovery, so it does not cover this boundary. Also exercise a blocked copy during global-outage card catch-up, whose callbacks currently preserve the same raw403 path.

C1/C2/C3 ordinary source paths appear implemented: General/card/closure publications enumerate paired destinations; sender-only echo suppression uses durable message.userId; outcome text comes from committed hub outcome; per-chat outbox keys and artifact dedupe scope are added. Tests cover ask/approval fold and first user unpaired. These are source observations, not executed coverage.

## Verification boundary

C4 failed for destination-wide fatal recovery and missing durable project-owner recovery identity. C1/C2/C3/C5 unverified. No source clear; fresh corrected-head review before queued verification. A-16016 targeted local observations are implementation-snapshot evidence, including explicitly predecessor preservation files; no full Linux/Web/tier claim accepted. QA full after-stage on E-1536. Reviewer ran no tests/browser and made no edits.

Totals: Standards1 medium, Spec1 medium; both findings recorded independently.

Criteria: C4 failed (Gap recovery can stop every chat on one destination403 and can settle a previous project owner's gaps after native-chat reassignment.).

### impl-1573 · 2026-11-03T00:05:12.300Z

A-16017 reproduced: fresh+retained reassignment tests both fail `Bob cannot publish Alice gap: 1 !== 0`; native blocked-gap test loses healthy input after remote.state records `bot blocked (403)`, confirming the global fatal escape. A long-outage test initially exposed fixture concurrent clock advancement; corrected that setup before classifying its product result. Shared-contract addendum before edits: gap.ts adds optional GapOptions.owner and saved Gap.owner; only Telegram opts in; Discord flushGap caller plus remote-neutral/discord-cards, telegram-gap/catchup fixtures and old saved records retain default behavior. Optional fake Telegram fault.chat_id targets a native destination; existing omitted field keeps method-wide fault semantics. Searches include QA E-1309, docs gateway-authority/remote-commands and all tiers, no client wire change.

### rev-35 · 2026-11-03T00:12:55.598Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1573-source-1
commit: 94cbc152695314067ee93a2485b1a672f6f9e2ce
scope: full
findings: [{"severity":"medium","text":"Every successful users-mode poll now awaits outbox.resume(), which Promise.all-joins every chat lane's drain. If chat A has a held/slow native send, the normal polling loop waits for A before issuing the next getUpdates, so subsequent native input/card answers from healthy chat B are blocked until A settles/times out. Per-chat queues do not isolate this poll barrier; gap fan-out can impose the same wait. Keep chat recovery independently lifecycle-owned without joining all destination work on ordinary successful polling. Add a held-A HTTP send with healthy B input/answer receipt before releasing A, excluding bot-wide flood-limit holds (C4).","file":"hub/src/remote/telegram.ts","line":125}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1573 corrected full source review at 94cbc152695314067ee93a2485b1a672f6f9e2ce. Previous review rev-36-1573-source-1/A-16017 read from tracker and artifact. Branch tip pinned. Source not clear: one medium remaining C4 finding, distinct from the two original findings.

## Standards

Original durable gap-owner finding is resolved in inspected source. New Telegram intents carry clandUserId; fresh missed-job selection requires the exact project owner in users mode. Gap.owner is additive, captured with each users-mode checkpoint, compared on read and after awaited send; settlement rechecks captured job membership and matching owner. Previous-shape ownerless users checkpoints do not grant settlement; single/Discord callers retain omitted-owner behavior. New fresh/retained/legacy and in-flight reassignment controls preserve Alice's missed jobs after Bob takes the same native identity.

Original403 fatal-recovery finding is also resolved: users-mode pending/uncertain and destination-local Telegram gap failures retain checkpoint/missed jobs while returning destination-local progress;401/409 still escape. Long-outage replacement-card publication uses destination-local transient handling. The new native403 gap and catch-up cases check healthy General, mapped cards, attributed input, no adapter disable and the blocked native attempt fence.

Other reviewed standards: shared remotePublications deduplicates destinations, scopes original pairings and joins all admitted callback work (including sync failure); deliveryPairing prevents a scoped effect acquiring a reassigned project owner. Single-mode key defaults and compatibility tests unchanged. Per-test/subsystem docs and kept skill CHANGES present. Shared GapOptions.owner consumer addendum covers Discord/neutral/gap fixtures and persisted prior shapes. New tests use fake clock, sealed Bot API and pacingOwner cleanup; no browser/provider.

## Spec

Remaining medium / C4 at telegram.ts125:
The unconditional users-mode await of #outbox.resume in #caughtUp creates a cross-chat poll barrier. TelegramOutbox.resume331–344 joins Promise.all of all lane.drain promises, and neutral Outbox.drain retains a lane's ownership until native send/retry finishes. pollTelegram calls and awaits caughtUp after a completed poll before returning to getUpdates. A held/slow chat A send therefore delays the next poll for healthy chat B. B may receive a concurrent outward General copy, yet later native input/card answers cannot be fetched until A settles or hits the HTTP deadline. A gap notification awaited through remotePublications can likewise retain the ordinary poll callback behind one destination.

This is a source causal trace, not an executed failure diagnosis. The existing new403 controls return native refusal promptly and do not cover a held/in-flight destination. Preserve bot-wide flood limiting, but keep per-chat recovery work independently owned/drained by shutdown rather than joining every chat on ordinary successful polling. Prove with a native held-A send (no shared flood delay), observe the next healthy B input/answer completion before releasing A, and retain final A settlement/stop cleanup assertions.

C1/C2/C3 ordinary paths inspected: General/card/closure enumerates current publication destinations independent of input context; native Telegram input/media retains owner through awaits; sender suppression is by durable message.userId; named outcomes use committed hub data; per-chat artifact/availability/gap keys isolate ledger records. Ask and approval multi-user tests include first user unpaired. C5 prior single-mode tests unedited; optional mirror recipient/default outbox key preserve old API. These remain source observations, no verified runtime marks.

Reported local T1/T2 preservation/static receipts are targeted implementation evidence. No queued/Linux/Web/full tier proof accepted. Reviewer ran no tests/typecheck/lint/browser and made no edits. C4 remains failed for the normal users-mode poll barrier; other criteria runtime-unverified. Fix and fresh source review before verification. Full after-stage QA remains separate.

Totals: Standards0 new findings (both original resolved); Spec1 medium.

A-16025: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16025-t-1573-corrected-source-review-cross-chat-polling-barrier.md

Criteria: C4 failed (Ordinary users-mode caughtUp awaits all destination lane drains; a held chat A send blocks the next poll for healthy chat B's native input/answers.).

### impl-1573 · 2026-11-03T00:15:33.184Z

A-16025 red reproduced in both held native General and held gap cases: no healthy input frame within1000ms until release, while held job remains sending. Final release/settlement/stop assertions passed, so the failure isolates poll coupling. Additive transport-only contracts before edits: TelegramOutbox.resume(chat?) filters resume/settlement to one destination; Telegram gap optional destination filter prevents ordinary per-chat workers joining peers. Consumers: TelegramRemote constructor/run/caughtUp and Telegram outbox pacing/catchup/card/approval/command tests; no shared Outbox/Gap/wire/default changes. Ordinary users-mode recovery will have one tracked owner per chat, drained by existing remote stop; global outage sequencing and single-mode behavior remain as reviewed.

### rev-35 · 2026-11-03T00:18:52.239Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1573-source-2
commit: b0cbe213ec123053fbfcd7d77d2982ee9bbad829
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 findings. A-16025's ordinary polling barrier is resolved by one tracked recovery worker per chat, destination-scoped resume/gap effects and immediate ordinary polling continuation. Existing stop aborts and joins those workers; held native General/gap tests require healthy input before release and retain durable settlement/cleanup assertions; separate stop test observes exact native close and durable unknown. Original gap owner/403 fixes remain intact. C1–C5 remain runtime-unverified pending exact-head queued evidence, including unchanged single-mode preservation cases. Reviewer executed no tests/browser and made no edits. Full review detail A-16038: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16038-t-1573-corrected-source-review-independently-owned-chat-recovery.md.

### rev-35 · 2026-11-03T00:37:49.655Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1573-final-1
commit: b0cbe213ec123053fbfcd7d77d2982ee9bbad829
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified, no findings. Exact-head3bb4456d/A-16046 exit0,4851 pass/zero fail/cancel/skip/todo. Independently streamed users10, shared-publications7, unchanged mirror-neutral5/cards62/pacing35/gap7/catchup11 and messenger4 timing passes; held-General/gap healthy-input-before-release and exact native-close/unknown-stop regressions all pass. Branch remains source-clear head. Uncached Linux x64 c-8 sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/Web completed,T3 deferred to batch,T4 unexecuted. Budgets/lint/ratchet/skip-reason checks report-only. QA full after-stage remains separate. Reviewer ran no tests/browser and made no edits. Named evidence/provenance A-16047: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16047-t-1573-final-evidence-fan-out-owner-fencing-and-chat-isolation.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-03T01:20:12.201Z

Merged 6fbf541214db96b2f3709e30c4621e26ca6e8571 onto dev.
