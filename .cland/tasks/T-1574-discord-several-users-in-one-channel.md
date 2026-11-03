---
id: T-1574
kind: task
title: "Discord: several users in one channel"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1572
topic: topic-1354
branch: t/T-1574-discord-several-users-in-one-channel
created: 2026-10-31T23:47:54.017Z
updated: 2026-11-03T01:41:17.947Z
---

## Summary

In users mode the Discord remote tells paired users apart by Discord user id, in one channel or in several, and ignores unpaired members as in v0.3. General and cards go once per paired channel, and a card folds with the answerer's name on every copy.

Hot files: `hub/src/remote/discord.ts`, `discord-inbound.ts`, `discord-outbox.ts`, `discord-cards.ts` [Host: E-1534/E-1535 cards], `discord-commands.ts`, `discord-catchup.ts`, `hub/src/remote/cards.ts` [Host].

## Acceptance criteria

- [x] C1. Two users paired in one test Discord channel each have their messages and answers recorded as their own user.
  - done: impl-1574 · 2026-11-03T00:07:19.842Z
- [x] C2. A member of that channel who is not paired is ignored, and no message or answer of theirs reaches the hub.
  - done: impl-1574 · 2026-11-02T23:58:35.781Z
- [x] C3. General and each card are posted once per paired channel, and an answer by one user folds every copy with the answerer's name.
  - done: impl-1574 · 2026-11-02T23:58:37.000Z
- [x] C4. Users paired in two different channels each receive General and the cards in their own channel.
  - done: impl-1574 · 2026-11-03T00:14:37.148Z
- [x] C5. In single mode the Discord remote's tests pass unchanged.
  - done: impl-1574 · 2026-11-02T23:58:38.941Z

## Comments

### impl-1574 · 2026-11-02T23:50:22.416Z

Rule 20 consumer inventory before edits: DiscordRemote.receive/start/recovery and REST status callbacks; DiscordCards.publishInbox/history/replay/request/press; DiscordOutbox enqueue/admit/deliver/fold/artifact dedup; DiscordInbound cursor/media/receipt/reactions; catchDiscordHistory; DiscordCommands requests/help/inbox; gateway ingress/Pairing validation; RemoteStore pairingFor/withPairing/userPairings persisted readers. Searched field/function names and importers across hub/src, hub/test (including T3/T4), web/nvim/shared, docs/qa and shipped skills. Existing Discord test files and fakes remain single-mode compatibility consumers; new users-mode cases will be separate. Native/persisted shapes stay additive. Shared cards.ts/outbox.ts owned by lead T-1573.

### impl-1574 · 2026-11-02T23:58:41.731Z

Implementation complete at 35cd1c2d632c72d20174c8942d3e95b93e0e307b, pushed task branch. A-16014 contains changes, Rule20 inventory context and supplemental evidence. Final full npm run typecheck exit0 at this head; npm run test:lint exit0 (report-only122/59files, no refusals). New users cases2/2 pass; prior candidate unchanged messages30/30/cards70/70 are supplemental, exact-head full named preservation awaits queued verification. QA full after-stage. Fresh fetch/merge origin/dev up-to-date, merge-tree clean. T-1573 shared seam/refinement exclusively cherry-picked; subscribed, will merge dev after its landing per Coordinator then request delta review/verify.

### rev-35 · 2026-11-03T00:03:57.578Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1574-source-1
commit: e7c86952ae10ba5c23e57cf393d4865a82d35e98
scope: full
findings: [{"severity":"medium","text":"Startup still checks only legacy discord.history, but users-mode catch-up persists discord.history:<channel>. After an interrupted frozen REST batch, a valid saved Gateway session can RESUME without READY; #beginHistory never runs and #finishRecovery only finishes replay, leaving the channel batch and its unprocessed users' inputs stranded until a later fresh Identify. Inspect pending histories for paired channels through the shared key policy before startup recovery. Add an interrupted users batch/restart with saved discord.session retained and assert exact input/actor receipts; the current tests explicitly clear discord.session, masking this path (rule20/C1).","file":"hub/src/remote/discord.ts","line":152}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1574 full source review at e7c86952ae10ba5c23e57cf393d4865a82d35e98. Replaces35cd1c2d request; independently pinned task tip and checked sole delta restores single-mode gap sender filtering. Source not clear, one medium finding.

## Standards

One medium persisted-reader migration gap (rule20): discord.ts152 still reads legacy discord.history while catchDiscordHistory now writes channel-qualified keys via discordChannelKey at24/46. The per-channel storage policy is shared, but this startup consumer was missed. Existing v0.3 keys should remain supported for single mode while users-mode recovery reads its own channel keys.

Shared remotePublications from T-1573 deduplicates guild/channel destinations and preserves AsyncLocal pairing context, with Promise.allSettled retaining every admitted destination until completion. Outbox availability key is additive/defaults to old key; channel General/artifact/publication reservations preserve single-mode keys. No dependency or browser added. Tests remain sealed T2 fake gateway/hub with native receipts and durable message mappings; shared helper T1 tests use memory Store.

## Spec

Medium / C1: persisted user inputs can remain unprocessed across restart.
- Users-mode catchDiscordHistory stores a frozen batch under discord.history:<channel>.
- run startup checks only discord.history (152). With only scoped pending records, it does not call #beginHistory.
- A retained valid Discord session takes Resume, yielding RESUMED rather than READY. READY is the other #beginHistory trigger (164–167).
- #finishRecovery awaits the default already-resolved #history and takes the non-fresh finishReplay path, so the frozen pending REST batch is not dispatched.
- Such REST-history messages can predate the saved READY sequence and need not be in the subsequent gateway replay. They stay stranded until a later fresh Identify.
No runtime probe executed. New discord-users.test.ts explicitly nulls discord.session during restart, forcing READY and hiding the missed pending-batch consumer. Add a durable frozen-batch barrier before interruption, retain the saved session on restart, confirm Resume and exact-once attributed receipts for pending users/channel inputs.

Otherwise inspected C1–C4 paths: native input/reaction uses exact channel/member pairing; actor proof flows through gateway's durable pairing; publication recipients are enumerated independent of input context and deduplicated by channel; same-channel echo suppression covers any paired sender, other-channel mirroring uses project name; source IDs/artifact reservations/cursors/availability are channel scoped; closures walk mapped card copies. Slash inbox stays in invoking pairing context. C5 source compatibility: old Discord single-mode tests unedited, optional mirror recipient defaults retain old behavior, amended gap matcher restores channel+sender test in single mode. Runtime C1–C5 evidence still pending.

Read actual Coordinator e60d46a1/126bf60d in topic1354: shared dependency T-1573 lands first; then merge its squashed dev version, take dev shared files in conflicts, fresh delta source review and mode-free verification before ready. This review does not waive that order or authorize verification on this pre-landing head.

Reported A-16014 targeted/static evidence is supplemental. Reviewer ran no tests/typecheck/lint/hub/browser and made no edits. No queued/Linux/Web receipt exists for this head. Full after-stage QA unchanged.

Verdict not clear, C1 failed for pending users input recovery path. Other criteria left runtime-unverified. Fix and fresh source review; dependency merge later still needs delta review. Standards1/Spec1 refer to the same unique medium finding.

A-16018: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16018-t-1574-source-review-channel-history-recovery-on-resume.md

Criteria: C1 failed (Users-mode channel-scoped frozen history is not detected at startup; a valid Gateway Resume can leave pending users' inputs undispatched.).

### impl-1574 · 2026-11-03T00:05:48.952Z

Review finding A-16018 reproduced red at the exact missing boundary: both generated frozen-history cases failed 'frozen history durable receipts after Resume: not within 1500 ms'. Tests first observe both users' durable frozen channel batches + held input, interrupt/resumably stop without clearing discord.session, require native Resume, then exact-once attributed native→hub receipts and no fresh Identify. Startup now uses hasDiscordHistory over discordChannelKey, same key policy as catch-up. Entire discord-users.test.ts4/4 green on local macOS Node24.21.0 candidate tree; source/docs/checks follow before fresh review. No queued verification claimed; dependency landing order unchanged.

### rev-36 · 2026-11-03T00:09:09.608Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1574-source-2
commit: bc75a455136aad69331900774c0382e133e208d2
scope: full
findings: [{"severity":"medium","text":"Users-mode per-channel history/gap/card recovery failures still reject the single shared recovery promise. A403 from one paired channel reaches DiscordSocket's rejected dispatch and run()->#failed()->stopWith(), disabling every channel despite the constructor's users-mode403 exemption and documented channel isolation.","file":"hub/src/remote/discord.ts","line":200}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1574 corrected source review

Headbc75a455136aad69331900774c0382e133e208d2. Prior source rev-35-1574-source-1/A-16018 at e7c86952ae10ba5c23e57cf393d4865a82d35e98. Run rev-36-1574-source-2, scope full, not clear.

## Standards

The A-16018 startup consumer gap is resolved. hasDiscordHistory enumerates paired publication destinations and uses discordChannelKey, the same policy as the history writer; legacy single-mode key remains. Correction changes only discord-state/discord startup, new tests and guides. Shared T-1573 files remain untouched. Existing single-mode tests are unchanged. Consumer/source review of additive shared publication/mirror/availability contracts carried forward; runtime marks remain pending.

The two new Resume regressions observe both exact native identities in durable frozen batches and a held topic.send before interruption. They retain the session persisted by resumable stop, require native Resume, then assert exact-once hub/user/native mappings, cleared batches, validResume and no extra Identify. This proves the previously missing boundary rather than substituting fresh READY. Sealed fake gateway only; no real Discord/browser. A-16020 reports red on prior source and corrected local4 plus unchanged cards70; those are targeted, not queued verification receipts.

## Spec

Medium — hub/src/remote/discord.ts:200. Per-channel recovery still shares a fatal aggregate. A paired channel losing permissions makes catchDiscordHistory's getChannel/listMessages reject403; remotePublications joins peers then rejects #history. #finishRecoveryWork awaits that rejection. DiscordSocket turns the rejected READY/RESUMED dispatch into connection completion rejection, and run catches it and calls #failed -> stopWith, which persists disabled=true and aborts the whole adapter. The users-mode REST callback's403 exemption only prevents setting #fatal; it does not prevent this generic terminal path. Gap recovery at217 and card recovery can reach the same aggregate rejection boundary.

Consequently one unavailable channel disables the other users' channels on fresh/history recovery, contradicting the new documented per-channel failure behavior and C4's independent destinations. Keep destination failures scoped through history/gap/card recovery; distinguish token/gateway faults that really stop the bot. Retain failed-channel durable ownership/checkpoints and let healthy native history, input, General and cards complete. Add a bounded two-channel permission-loss/restart control requiring continued healthy native/durable receipts and an enabled adapter; do not merely assert that the healthy REST callback ran once before the aggregate failure.

The startup finding is closed, but this remaining recovery isolation issue blocks source clear. C4 failed; C1/C2/C3/C5 runtime-unverified. No tests or probes executed by Reviewer; source path trace only.

## Dependency and evidence boundary

Coordinator-required order remains T-1573 landing, mandated dev merge taking its shared files, new delta source review, then same-head verification. This review authorizes no pre-dependency run. QA full after-stage. Reviewer made no source edits.

Criteria: C4 failed (One paired channel's403 during history/gap/card recovery can disable the whole adapter and stop healthy channels.).

### impl-1574 · 2026-11-03T00:12:39.740Z

A-16023 isolated with native channel-scoped fake faults: history403 and gap-warning403 both reproduced 'healthy replacement card after peer403: not within1500ms'; card403 control already continued. Corrected users-only destination recovery catches permission failure/typed incomplete warning after checking cancellation/global fatal; shared bot credential failures retain terminal handling. Failed gap checkpoint/source remain, definitively refused warning retries with same durable source, unknown sends stay fenced. All7 users cases green including healthy history/live input/General/new cards and restored original gap reported. Rule20 search: recoveryWarning consumers only discord history overflow/gap closures; new typed failure remains internal to Discord state/outbox/remote, legacy error message preserved. Fake adds optional path/content fault selectors; method-only matching retained. Full typecheck clear; final targeted/lint follow before rereview.

### rev-36 · 2026-11-03T00:16:33.224Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1574-source-3
commit: 9a3eab66a42c09d01f6c6d196c01f61128fa7855
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1574 recovery isolation source review

Head9a3eab66a42c09d01f6c6d196c01f61128fa7855. Run rev-36-1574-source-3, scope full, source clear, findings none. Carries earlier full source review with bc75a4551 correction checked completely.

## Standards

No findings. One destination wrapper now owns users-mode history/gap failure classification, checks cancellation and recorded global fatal state first, and catches only403/404 or the explicitly channel-bound incomplete-warning result. Unsupported/global failures still propagate. Shared publication/gap modules remain unchanged for T-1573 ownership. New internal failure class and consumers documented in A-16028; fake path/content fault selectors are additive and preserve method-only callers. Single-mode branch keeps its previous failure propagation. Existing Discord test files remain unchanged.

Positive non-delivery governs warning retry: only all-dropped prior jobs permit a new users-mode warning job under the original source; sent or unknown attempts retain their existing fence. Missing warning receipt raises DiscordRecoveryIncomplete, so flushGap retains the exact checkpoint and missed sources. Native refusal is not counted as a delivered warning.

## Spec

A-16023 isolation finding resolved. Users-mode history and gap callbacks catch destination failures before they can reject the shared READY/RESUMED recovery. Healthy peers complete, recovery holds release, and ordinary native input/General/cards remain usable. Existing card403 handling already leaves a durable dropped receipt and remains covered. The earlier pending-history startup-reader fix and valid Resume regressions are preserved.

Three new cases select channel-local history, gap-warning and card native403 by exact route/content, preventing an unrelated mirrored history send from consuming the fault. They require healthy channel durable history and live input, replacement and new card mappings, General native receipts, and enabled adapter. Gap case additionally asserts the failed checkpoint/missed job remain, restarts after permission restoration and requires the original source become reported with checkpoint cleared. Red-first history/gap failures and seven corrected local outcomes are reported in A-16028; no Reviewer test run and no queued evidence inferred.

C1–C5 remain runtime-unverified. Coordinator-required sequence still applies: T-1573 lands first; merge its dev version/shared files as directed; fresh delta source review; then same-head mode-free verification. This source verdict does not waive that dependency or authorize a pre-merge verification run. QA full after-stage. No tests/probes/browser or source edits by Reviewer.

### rev-36 · 2026-11-03T01:41:17.947Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1574-delta-source-1
commit: d674909741c056ce5bb1e2f8748eb30bc2ae60ca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1574 authorized merge delta source review

Headd674909741c056ce5bb1e2f8748eb30bc2ae60ca; parents9a3eab66a42c09d01f6c6d196c01f61128fa7855 and20c4f9511fc19922efc14c023763d454993a694d. Run rev-36-1574-delta-source-1, scope delta; clear, findings none.

## Standards

Read Coordinator e60d46a1/126bf60d/e67916fe: T-1573 lands first, merge squashed dev shared files, rerun three Discord controls, delta review, then verify. This merge satisfies that source prerequisite. Independently compared remote/cards,state,neutral outbox,mirror and remote-publications tests against20c4f9511: identical. No parallel shared implementation retained. cards' async callback wrapper now also contains synchronous destination throws before allSettled aggregation. Discord own mode decisions use authoritative store.usersMode rather than inferring mode from currently paired users; channel keys remain scoped even when pairing enumeration changes.

## Spec

No findings. Prior frozen-history Resume and destination403 recovery fixes are retained; own production delta is only authoritative mode queries in channel key/recovery retry/REST classification. Shared gap options.owner remains optional, so Discord's intentionally channel-scoped ownership/matcher and legacy single-mode key behavior remain compatible. Telegram's new owner fences and per-chat recovery arrive intact from dev. Both transport documentation sections survive the merge.

Incoming changes also include landed T-1593 shared native Host operations (already reviewed at identical source by this Reviewer), T-1541 raw coverage cleanup and T-1624 Secure-cookie policy. The merge introduces no conflict-resolution redesign in these modules; their selected integration/consumer checks belong to the fresh queued run. No assertion weakening found in Discord source/tests against prior source-clear9a3eab66a.

C1–C5 remain runtime-unverified at this head. Reported exact-head users7/cards70/messages30/typecheck/lint are targeted supplemental observations; fresh same-head mode-free verification is required, with named outcomes and retained required native evidence for deferred files. This is not an all-tier task request; remaining T3/T4 follow queue/batch selection. Full stage4 QA follows landing. Reviewer ran no tests/probes/browser and made no source edits.
