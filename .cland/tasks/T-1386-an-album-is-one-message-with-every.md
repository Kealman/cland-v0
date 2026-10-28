---
id: T-1386
kind: task
title: An album is one message with every attachment, stored before the offset is confirmed, and a hub killed mid-album loses nothing
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1385
topic: topic-1150
branch: t/T-1386-an-album-is-one-message-with-every
created: 2026-10-27T23:37:27.669Z
updated: 2026-10-28T11:45:53.624Z
---

## Summary

Items sharing one `media_group_id` become one human message with all their attachments, in order, captioned with the album's first non-empty caption. Each item joins the durable group before its update is confirmed. A hub killed between items finishes the album after its restart, with nothing lost and nothing doubled.

## What to build

The media queue gains groups. An item with a group id joins the open queue entry for that chat and group, inside the same durable write that lets its update be confirmed. The group closes in one of two ways:
- no item has arrived for 2 seconds under the injected clock;
- the chat's next update outside the group arrives.

A closed group becomes one `artifact.upload` with every file in Telegram's order. The ingress id is the group's first message, and every item's chat message is mapped to the one cland message, for replies and receipts.

An item over the download cap is left out, and the reply names it. The other items still arrive. A restart recovers open and closed groups, and closes an open group by the same 2-second rule measured from the restart. The group key is opaque, so E-1312 can reuse grouping for Discord's several attachments per message. Spec §3.6 (albums), §3.9.

## Acceptance criteria

- [x] C1. A three-photo album on the fake arrives as one General message with three artifacts in the album's order and the first item's caption as its text (test).
  - done: impl-1386 · 2026-10-28T11:39:32.390Z
- [x] C2. A hub stopped after the album's second update is confirmed, and restarted before the third, posts one message with all three artifacts, and the fake shows every update confirmed exactly once (test).
  - done: impl-1386 · 2026-10-28T11:45:00.977Z
- [x] C3. A four-item album with one 25 MB document arrives as one message with three artifacts, and the chat gets one reply naming the oversized file (test).
  - done: impl-1386 · 2026-10-28T11:39:43.145Z

## Notes

Shared files: hub/src/remote/media.ts, hub/src/remote/telegram.ts, hub/src/remote/state.ts

## Comments

### impl-1386 · 2026-10-28T11:35:21.455Z

Rule 20 consumer inventory (rg MediaQueue|MediaInput|media.queue across hub/web/nvim/shared/docs/.agents, plus Telegram handler/offset/map callers): media.ts owns persisted queue reads/writes; telegram.ts produces queue items and consumes them; telegram-inbound.ts owns upload ingress + feedback; telegram-polling.ts confirms only after handler completion; state.ts provides transactions and message maps. Tests: telegram-inbound.test.ts queue/recovery/held-I/O cases, telegram-polling.test.ts offset registry cases, telegram-api.test.ts fake albums; fakes/telegram/fake-api.ts emits media_group_id. Docs: inbound test guide, hub README, implement skill media guidance. No web/nvim/shared wire or startup/QA/other-tier consumer reads queue records. Add optional group/items/closed/time fields retaining legacy file/text records; old-wire text and single-media regressions remain. No protocol/permission/offset reply-shape change.

### rev-34 · 2026-10-28T11:44:02.625Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1386-source1
commit: f8fccd11acfe7f85bba6be72b591b47eab61e03b
scope: full
findings: [{"severity":"medium","text":"M1 Standards: restart stops after local offset3, before observing exact native getUpdates(offset3) confirmation; arm/await matching fake poll receipt before stop, retaining final assertions.","file":"hub/test/telegram-inbound.test.ts","line":765},{"severity":"medium","text":"M2 Spec: member maps are written only after upload result. A committed upload with lost result plus unavailable original files cannot repair maps on restart because recovery re-downloads before consulting durable ingress; files-empty completion discards group. Recover all member maps/feedback from trusted durable ingress first and add lost-result/file-removal control.","file":"hub/src/remote/telegram-inbound.ts","line":74}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; StandardsM1/SpecM2 in A-13260. Read task implementation against merge's dev parent, not tracker-only first-parent diff. Transactional joins/ordered group/quiet close and legacy shape support source-visible; remaining recovery and boundary controls required. C2 failed,C1/C3runtimeunverified; no Reviewer execution. Graceful component restart is not native SIGKILL coverage; localmacOSclaimsnotconfiguredLinux. Separate pre-existing feedback-admission S/Bugs reported aside. Fresh corrected-head source review before verification; Coordinator all gate remains separate.

Criteria: C2 failed (Native confirmation-before-stop is not observed; committed-upload/lost-result restart can lose album-member mappings when original files are unavailable.).

### rev-34 · 2026-10-28T11:45:53.624Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261028-1386-source2
commit: 8a20bec7ff46ab05f5f56c4bb6c4a584ca905301
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; Standards0/Spec0. A-13262 audits M1 exact pre-armed native offset3 confirmation before stop and M2 trusted durable ingress lookup before downloads, transactional member-map/feedback repair. Actual dropped-success result plus committed history, expired originals and no-redownload assertions retained alongside original album/oversize/legacy coverage. No new wire authority; old optional shapes retained. C1–C3 claimantdone, runtime-unverified. Graceful component restart notSIGKILL; localmacOS claimsnotconfiguredLinux proof. No Reviewer execution. Same-head mode-free run/final original-record audit required; Coordinator full-all gate separate.
