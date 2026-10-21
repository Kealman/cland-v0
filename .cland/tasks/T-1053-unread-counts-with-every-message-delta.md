---
id: T-1053
kind: task
title: Unread counts with every message delta and one merged sessions projection
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-806
branch: t/T-1053-unread-counts-with-every-message-delta
created: 2026-10-21T14:04:14.662Z
updated: 2026-10-21T14:28:55.867Z
---

## Summary

Send a topic's unread count and last message time with every message delta, and give clients one merged sessions projection.

## Parent

E-413 (§3.3 "Unread counts" and "Merged session rows"; tracer step 2).

## What to build

A topic's `unread` (per human) and `lastMessageAt` travel with every message delta, so no client counts `message` frames. Sessions arrive as one projection per row: the process row with presence, the role, the item (a verifier's hold with +N, or a requested item marked as requested, per v0.1.2 §3.4), the state with its age and the command it waits on, the account and the usage. The two reads clients merge today (processes and presence) stay available for compatibility.

## Acceptance criteria

- [x] C1. A frame client's unread count and last message time for a topic follow three new messages from the deltas alone, and a `topic.read` resets the count (test).
  - done: impl-1053 · 2026-10-21T14:28:55.783Z
- [x] C2. A verifier's merged session row carries its hold with +N, a waiting row carries its state age and the command it waits on, and a row carries account and usage (test).
  - done: impl-1053 · 2026-10-21T14:28:55.815Z
- [x] C3. A presence or process change produces one merged row delta, not two partial ones (test).
  - done: impl-1053 · 2026-10-21T14:14:58.135Z
- [x] C4. `hub/README.md` describes `unread`, `lastMessageAt` and the sessions projection.
  - done: impl-1053 · 2026-10-21T14:14:58.169Z
  - verified: rev-23 [reviewer] · run rev-20261021-1053-source · 2026-10-21T14:18:27.267Z · commit b3ce2e336adb07c23ed33143e65a2314f1128f70

## Comments

### impl-1053 · 2026-10-21T14:14:49.358Z

Implemented the additive topic fields and merged session projection. TDD at the agreed T2 frame seam: unread started red (undefined !== 1), merged rows started red (snapshot supplies complete session rows), and snapshot-only subscribers started red (no session.row received), then each passed after implementation. New tests cover authoritative counts/times/read resets; verifier holds/+N and pending work; waiting command/state age; a named account and usage; one complete row per presence/process/hold change; fresh-snapshot equivalence; rename, disconnect and unknown-identity removals. Legacy process and presence reads/events retained. origin/dev merged before first review; reviewed candidate head will be b3ce2e336adb07c23ed33143e65a2314f1128f70. Per-item QA is not required (affected after-stage policy; no QA brief supplied).

### rev-23 · 2026-10-21T14:18:27.267Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1053-source
commit: b3ce2e336adb07c23ed33143e65a2314f1128f70
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8450 records complete11-file Standards/Spec audit against fixed devb4264fdd merged before review. No findings. Authoritative unread/lastMessageAt attach to message publication/reprojection; existing read/reset rules retained. Shared session composer combines process/presence/current holds/pending/stateSince/approval/account/usage; complete changed rows coalesce and replace/remove by stable key, with unknown names distinct. Snapshots share composition, numbered ring and feature delivery paths checked; compatibility process/presence retained. T2 frame tests preserve exact-boundary observers, fake time, fresh-snapshot equivalence, single-row fencing and removal assertions; wire equality/manifests/docs updated. C4 verified from README; C1–C3 await same-head queued execution/load receipts. A-8448 local targeted4/4/check claims are development evidence, no suite pass claimed. Proceed mode-free configured verification at unchanged reviewed head, then evidence review. No Reviewer runtime; affected after-stage QA remains separate.

Criteria: C4 verified.

### impl-1053 · 2026-10-21T14:26:55.899Z

Failed run 117424cc (A-8457) repaired at pushed head 3e2fc1659637c1593df179480ae85670585b210a. Existing topics-component exact-shape assertion now includes the required message-topic unread/lastMessageAt fields; the new named-account test injects accountReader to keep it in-process. No production source changes and no dev merge. Both affected T2 files pass 4/4 locally on macOS arm64; typecheck passes. Fresh source review requested before re-verification.

### rev-23 · 2026-10-21T14:27:34.955Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1053-evidence-red
commit: b3ce2e336adb07c23ed33143e65a2314f1128f70
scope: evidence
findings: [{"severity":"medium","text":"A-8457 enforced deepEqual expects bare id/title while actual message topic adds required unread0 and lastMessageAt. Update exact full expected contract against message.ts without weakening id/title/message/stage/ack assertions.","file":"hub/test/topics-component.test.ts","line":82},{"severity":"medium","text":"New named accounts.toml activates a real account probe: A-8457 log11098 T2 forbids child_process.spawn, stack accounts/poller.ts:208. Inject existing projectHub.accountReader to retain account/usage/waiting assertions within T2; report-only tripwire is not resource-policy clearance.","file":"hub/test/computed-sessions.test.ts","line":81}]
finding_counts: {"high":0,"medium":2,"low":0}

Historical failed evidence, not clear atb3ce2e33; A-8463 details A-8457/117424cc. Actual expected bare{id,title},actual includesunread0/lastMessageAt at11076–11094; new named-account fixture also emits report-only T2 native-spawn violation. Linux T1pass/interruptedT2fail,ordinary1969pass1fail plus20loadpasses,Webabsent. C1/C2failed; no final C3verification; C4docssource remains historical. Hostcheck809d055e reused; lint132/59,duration/ratchet/tripwire report-only,M1assertionenforced. Lead already submitted corrected3e2fc165; reviewing it next. No source/runtime pass atnewhead claimed; no Reviewer execution.

Criteria: C1 failed (A-8457 fails existing topics-component exact TopicRef contract at82 after required unread/lastMessageAt additions.), C2 failed (The new named-account T2 fixture launches native account polling (tier tripwire accounts/poller.ts:208); use existing accountReader seam.).
