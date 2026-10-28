---
id: T-1387
kind: task
title: "Outbound artifacts on Telegram: photos up to 10 MB, documents up to 50 MB, each artifact once per remote, and a line for anything larger"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1381
topic: topic-1141
branch: t/T-1387-outbound-artifacts-on-telegram-photos-up
created: 2026-10-27T23:37:27.927Z
updated: 2026-10-28T13:35:10.580Z
---

> Pending: the once-per-remote behaviour below is the Coordinator's recommendation awaiting the human's answer to ask 62b8d32f; do not launch before it is answered.

## Summary

A mirrored General message's artifacts follow it to Telegram:
- a PNG, JPEG, GIF or WebP image up to 10 MB goes as a photo;
- any other file up to 50 MB, HTML and diagrams included, goes as a document;
- folders, deleted files and anything larger go as a line with the name and the project-relative path.

Each artifact goes once per remote, captioned with the message's header, and a single artifact with a short text goes as the file captioned with the header and the text.

## What to build

**A messenger-neutral planner.** It takes a message and a messenger's limits (photo cap, document cap, caption length, image types). It returns the ordered sends:
- the text part, when it does not fit a caption;
- one file per artifact;
- a line per artifact that cannot go as a file.

The message's artifacts are `artifact` and `artifacts` deduplicated by id. Telegram's limits are 10 MB, 50 MB and 1024.

**On Telegram.**
- The outbox gains `sendPhoto` and `sendDocument` jobs. They hold the artifact id and the caption, never bytes. At send time they read the file, confined to `.cland/artifacts` with no symlink.
- Captions are plain text with no entities (the CRLF entity shift).
- One message's sends are enqueued together, so nothing interleaves.
- The once key is stored per remote with the artifact id, per the recommended reading in the assumptions (open). A replay, a restart or a duplicated field never sends a file twice.
- An outage marks file jobs missed like their message.
- The outbox's uncertainty rule applies: an upload that may have left is never resent.
- What the human sent from this remote is still not mirrored, files included.

**Shared contract:** none; the outbox payload is internal. Spec §3.6 (outbound artifacts) and §3.4; Q-1293 (once per remote).

## Acceptance criteria

- [x] C1. An agent's General message with a PNG and a PDF and a long text arrives as the text, one photo and one document, each captioned with the message's header and each sent exactly once, even though the message carries the PNG in both `artifact` and `artifacts` (test).
  - done: impl-1387 · 2026-10-28T11:50:27.648Z
  - verified: rev-32 [reviewer] · run rev-20261028-1387-evidence1 · 2026-10-28T13:00:24.853Z · commit b89d352747d26d45baab803a0e634d3154a3982f
- [x] C2. A single 2 KB note artifact with a one-line text arrives as one document whose caption is the header, a newline and the text, with no `caption_entities` (test).
  - done: impl-1387 · 2026-10-28T08:21:14.096Z
  - verified: rev-32 [reviewer] · run rev-20261028-1387-evidence1 · 2026-10-28T13:00:24.853Z · commit b89d352747d26d45baab803a0e634d3154a3982f
- [x] C3. A 60 MB artifact, made as a sparse file, arrives as one line naming its id, title, size and `.cland/artifacts/…` path with no absolute path, and a 12 MB PNG arrives as a document (test).
  - done: impl-1387 · 2026-10-28T08:21:14.438Z
  - verified: rev-32 [reviewer] · run rev-20261028-1387-evidence1 · 2026-10-28T13:00:24.853Z · commit b89d352747d26d45baab803a0e634d3154a3982f
- [x] C4. Restarting the hub while a file job is queued sends it once, and an upload the fake holds past its timeout is not resent (test).
  - done: impl-1387 · 2026-10-28T08:21:14.578Z
  - verified: rev-32 [reviewer] · run rev-20261028-1387-evidence1 · 2026-10-28T13:00:24.853Z · commit b89d352747d26d45baab803a0e634d3154a3982f
- [x] C5. An image uploaded through the web's `artifact.upload` path arrives captioned "you · message", while the same upload made via Telegram is not sent back to Telegram (test).
  - done: impl-1387 · 2026-10-28T08:21:14.709Z
  - verified: rev-32 [reviewer] · run rev-20261028-1387-evidence1 · 2026-10-28T13:00:24.853Z · commit b89d352747d26d45baab803a0e634d3154a3982f

## Notes

Shared files: hub/src/remote/telegram.ts, hub/src/remote/telegram-outbox.ts, hub/src/remote/state.ts, hub/src/remote/media.ts

## Comments

### coord · 2026-10-28T05:05:33.064Z

The human accepted the Coordinator's recommendation in ask 62b8d32f (2026-10-28 05:04Z, 'Да, все три рекомендации'). The pending note at the top of this item is resolved: build the behaviour as written; the hold is lifted and the ticket launches with its stage.

### impl-1387 · 2026-10-28T08:12:27.219Z

Implementing at agreed production frame/fake Bot API seam. No wire contract change planned: messenger-neutral artifact planner, internal Telegram durable file payload and per-remote outbox keys. Existing mirrorOut exclusion retains Telegram upload echo suppression. Accepted once-ever decision includes later sent-above replies. Will not merge dev until Coordinator requests (shared Telegram lane ordering).

### impl-1387 · 2026-10-28T08:17:53.899Z

C4 uses the existing General outbox semantics: an upload whose timeout may have left is durably missed with its exact attempt outcome unknown (uncertain is the non-General/card state). Restart proof waits for the resumed startup poll after resume, stops the hub, then asserts one held request and exactly two earlier accepted file uploads. Queued file jobs remain general jobs so outage gap counting deduplicates their common message source. No change to the shared Outbox state machine.

### impl-1387 · 2026-10-28T08:19:57.043Z

Rule 16: no CLI flags, settings, role permissions or wire frames added; existing General/remote authority applies, so help and role clauses need no new lines. Updated hub/README.md, per-file test guidance/index and implement skill (CHANGES recorded). New file is T2. Local macOS Node v24.21.0 tests use production frames + loopback fake, no browser/platform. Six cases cover C1–C5 plus delivery-time symlink replacement. First red was sendRichMessage instead of sendDocument; later red exposed lost reattachment text and an unwanted empty-caption newline, both corrected. Linux timings remain unmeasured until verify; any >=3 s new case will be reported before ready.

### impl-1387 · 2026-10-28T08:21:07.080Z

Consumer inventory (delivery extension; no existing reply/list/schema/refusal or wire payload changes): production daemon→messengerFactory→TelegramRemote→TelegramOutbox; TelegramCards/TelegramPrompts retain send/edit/reaction APIs and legacy payloads; shared mirrorOut and RemoteState remain unchanged; Discord mirror/outbox callers remain unaffected. Persisted job readers: TelegramOutbox resume/prove, Telegram gap identity matcher and generic outbox/gap/status depth readers accept new native methods through existing params.chat_id and source. Tests/fixtures found by repository-wide rg (including tiers T3/T4): telegram-rendering, pacing and pacing-fixture, notices, approvals, cards, mute, polling-restart, polling-fixture, inbound, polling; remote-state, remote-neutral; discord messenger/messages/pairing. Existing old-payload regressions stay unchanged (no mandatory files callback for injected clients). Shipped guidance hits: implement skill and card/inbound/pacing test guides; new artifact guide updates the new behaviour. No QA brief/startup probe/web/Neovim consumer of internal Telegram job methods found. No mandatory client field added: older wire frames and injected remotes retain text-only operation without the optional artifact resolver.

### rev-31 · 2026-10-28T11:40:35.264Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1387-source1
commit: 54dccdcabbf33b9298c1d722ec845c96a58d2611
scope: full
findings: [{"severity":"high","text":"H1 Spec/security: artifactFile checks pathname components with lstat, then TelegramApi reopens params.path via openAsBlob. A leaf or parent replacement between validation and consumption can upload an outside file. Bind upload bytes/stream to an actually confined no-follow open; reuse the existing web-artifacts confinement boundary. Add a deterministic after-validation/before-consumption swap and authorized-file positive control.","file":"hub/src/remote/telegram-outbox.ts","line":245},{"severity":"medium","text":"M2 Spec: once-ever fencing is keyed by chat/current user/artifact, contradicting the accepted E-1311 decision that each artifact goes to a remote once ever. Re-pairing resets the fence and permits a second upload. Keep the per-messenger artifact fence independent of pairing and handle later references safely across destinations; preserve uncertainty/outage semantics and test replacement/restart.","file":"hub/src/remote/telegram-outbox.ts","line":65},{"severity":"medium","text":"M3 Spec: synchronous batch enqueue alone does not keep publication sends contiguous. The existing outbox comparator prioritizes a newly arrived card/edit ahead of remaining General artifact parts. Prove held-first-send plus concurrent card/publication ordering and preserve the required non-interleaving group, or obtain explicit Coordinator disposition for the conflict.","file":"hub/src/remote/telegram.ts","line":243},{"severity":"medium","text":"M4 Standards: Store cleanup is registered only after awaited projectHub succeeds; failed acquisition leaves the Store unowned. Held/resumed observers are also armed before intervening operations without immediate rejection retention and a shared cancel/join failure path. Register ownership before acquisition, reuse shared fixture ownership, and retain omitted/aborted setup controls proving stopped hubs/native close/closed Store/no pending observations or timers.","file":"hub/test/telegram-artifacts.test.ts","line":23}]
finding_counts: {"high":1,"medium":3,"low":0}

Full source1 A-13257: Standards 1 medium M4 (Store/observer ownership before acquisition and failed setup); Spec H1 high (lstat path check then openAsBlob pathname reopen permits symlink substitution), M2 medium (once-ever per-remote key incorrectly pairing-scoped), M3 medium (batch enqueue does not prevent card/edit dispatch interleaving). Complete merged source reviewed; inbound queue/maxUploadMb and optional outbound resolver preserved. E-1311 accepted once-ever decision confirmed, no approval hold. Local merged-tree 6/32/62 claims are not configured/Linux evidence. Consolidate controls/fixes, push and request fresh full source review before mode-free verify. Keep dev base unless Coordinator directs; no per-item QA, Coordinator full all remains required.

Criteria: C1 failed (Once-ever file delivery resets after pairing replacement, and card priority can interleave an artifact publication's native parts.).

### impl-1387 · 2026-10-28T11:50:23.718Z

Source1 fixes H1/M2–M4 consolidated, same dev base 4c8f16189. H1 extracts existing WebArtifacts no-follow opening into hub/artifact-file.ts; Telegram checks descriptor type/cap and reads at most cap+1 bytes with cancellation into transient Blob before API consumption, finally closes FD. Added leaf/parent API-boundary swaps with authorized digest positive controls (both red before fix). M2 messenger artifact fence ignores pairing, recognizes earlier persisted file jobs, and only replies by native id in the same destination; replacement/restart controls red at two uploads then green at one. M3 persisted batch marker keeps started publication contiguous; held-first-send + concurrent ask/card and later General proved native card interleaving red before fix. M4 pre-registered pacingOwner owns Stores/acquisition/observers; omitted/aborted startup controls prove exact native close, stopped acquired hub, closed Store, zero observations and timers.
Consumer supplement for extracted opener/optional native Blob: production WebArtifacts→web-edge and TelegramOutbox→TelegramApi; existing web-artifacts-unit/telegram-api path-only regressions retain old interfaces and optional open injection. No wire fields/permissions changed. Per-file docs, README and implement guidance updated. Local macOS Node24.21.0 changed telegram-artifacts file: 13/13 pass (latest total 19.43s under host load, no Linux or baseline claim); typecheck/test:tiers/wording/diff checks pass. Existing unchanged API/web tests deferred to configured verify under local changed-file-only load restriction.

### rev-31 · 2026-10-28T11:53:36.326Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1387-source2
commit: 53855f166447ae2a3dc42a1d2d2fd2f2d4b7bdd2
scope: full
findings: [{"severity":"medium","text":"M4 follow-up, Standards/rule 9: pacingOwner.observe adds ownership but no deadline; passing its signal overrides the fake helpers' default 5 s timeout. Bare awaits for held/resumed receipts (125/132/205), and ready/held receipts before injected-clock triggering (275–277), lack independent setup bounds. Missing receipt/preparation failure can strand the control before cancellation/drainage. Add separately armed bounded observation plus cancel/join and an omitted exact-receipt control, retaining native close/Store/hub/timer assertions.","file":"hub/test/telegram-artifacts.test.ts","line":125}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13267 full source2: Standards 1 medium / Spec 0. H1 descriptor-bound no-follow reader, M2 messenger artifact fence across pairing/restart and safe native reply destination, and M3 persisted started-batch dispatch priority resolve source1 production findings. M4 Store/observer ownership is corrected, but cancellation ownership does not supply independent setup deadlines; the passed owner signal replaces helper defaults. Local reported macOS 13/13/typecheck/tiers remains separate from absent Linux/configured evidence. C1 claimant done restoration retained, all runtime verification pending. Correct remaining bounded-receipt issue, push and request fresh source review before mode-free verify; stable dev base, no per-item QA, Coordinator separate full all before enqueue.

### impl-1387 · 2026-10-28T11:55:38.115Z

Source2 remaining M4 fixed without runtime/dev changes: each owned native receipt is now armed with an independent test-scaled 5 s deadline at observation creation. Its finally cancels and joins the raw observer. Preparation is separately bounded before fixture acquisition and rejects on earlier fixture failure; late acquisition/stopped receipts also have bounds. New omitted-exact-receipt control holds actual getMe but expects an impossible exact request id. Expiring its separate receipt clock aborts acquisition before the hub setup clock advances and reaches exact TCP close, native server/connection/handler drainage, stopped hub, closed Store and zero timers/observations. Local macOS Node24.21.0 at changed tree: 14/14 artifact cases pass (latest file wall 8.05 s, not Linux/baseline evidence); typecheck/test:tiers/diff checks pass. Runtime behavior remains the source2-reviewed version; configured/Linux verification still pending.

### rev-32 · 2026-10-28T12:42:23.998Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1387-source3
commit: b89d352747d26d45baab803a0e634d3154a3982f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13284 full source3 clear,Standards0/Spec0. Rechecked full4c8f16189...head scope and A-13257/A-13267 H1/M2–M4. Descriptor-bound no-follow/capped/cancelled Blob upload preserves extracted WebArtifacts behavior; messenger-scoped once-ever artifact fence follows human62b8d32f across pairing/restart with safe native reply targets; persisted started-batch priority preserves publication order. Remaining M4 now has independently armed observation/preparation/late-acquisition/stopped bounds,cancel+join of raw native observers,and omitted exact-id control driven by its separate clock before hub setup time,retaining close/Store/hub/census/timer assertions. C1–C5 source tests/docs/skill provenance/consumer inventory intact; runtime criteria remain unverified. Local14/14 Darwin/typecheck/preflight claims are not configured/Linux evidence. Run mode-free configured verify at this unchanged head then original-record final review; Coordinator's separate full-all landing gate remains,no per-item QA. Reviewer read only,no tests/browser/probes.

### rev-32 · 2026-10-28T13:00:24.853Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1387-evidence1
commit: b89d352747d26d45baab803a0e634d3154a3982f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence clear; Coordinator full-all af9b7f7e still pending/separate landing gate. A-13289 independently audits original fda0d0e3/A-13287 at unchanged source3 head:3913 ordinary passes/498files+95 separate load passes,zero nonpassing outcomes/unfinished starts. All14 artifact cases ordinary+5/5(70 task samples),max ownload1.298428905s; C1–C5 exact native file/text/caption/byte/fallback/restart/uncertainty/echo assertions confirmed. Once-ever pairing/restart,descriptor leaf/parent swaps,contiguous publication and three independent setup/drain controls pass; unchanged WebArtifacts-unit2/API27/Web-artifact14 cases pass. Host T0 candidateef1692e reused separately,Linux c-8lon1 T1/allT2fallback/Web complete,isolated Shell156/1248,budgets/lint report-only,no T3/T4 selected. C1–C5 verified from this configured receipt; no full-cover/enqueue claim. Head stays frozen until Coordinator full result; reviewer read only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-32 · 2026-10-28T13:35:10.580Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1387-delta1
commit: 629e84f75bf3ca6c763bf6df2a643f465bba2f66
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, zero findings; A-13302 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13302-t-1387-authorized-integration-delta-at-629e84f75-clear.md). Checked both parents, Coordinator dfba9015/42271bcb authorization, combined conflict and seven overlapping paths. messenger persistence retains files? plus discordNotice transition; daemon preserves both. Outbound opener/planner/Telegram implementation/all14 task tests and guide byte-identical to source3 b89d3527; prior H1/M2–M4 remain resolved. Other incoming paths match landed dev, additive guidance/provenance/tier/doc composition retained. No Reviewer executions. C1–C5 old runtime marks remain b89d3527 only; same-head mode-free configured evidence required at629e84f75. Coordinator expressly carries old full-all af9b7f7e/A-13294 for this mechanical resolution; actual prior log T0–T3/Web with8skips and no separate T4 phase, not new-head coverage. Keep head unchanged; further source change needs new review before verification. No final readiness or new-head runtime marks in this source pass.
