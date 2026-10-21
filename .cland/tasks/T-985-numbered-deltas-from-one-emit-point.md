---
id: T-985
kind: task
title: Numbered deltas from one emit point
state: open
status: in progress
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-983
topic: topic-791
branch: t/T-985-numbered-deltas-from-one-emit-point
created: 2026-10-20T16:50:00.467Z
updated: 2026-10-21T09:58:01.324Z
---

## Summary

Every model delta is numbered within the epoch where the core emits it, and a delta carries only what changed. A `task` delta carries the changed item and only the changed layers. The verification queue is pushed only when it changes. Each frame is serialized once per feature set.

## What to build

There is one emit point in the core for every model delta to clients, the tracker's `task` frames included. Whole-state frames (`inbox`, `presence`, the verification queue) replace, while `message`, `delivery` and `event` append. A pin or a mute sends the re-projected rows, never a bare invalidation. On a featured connection:
- a `task` delta carries the changed item and only the layers that changed, never the all-items layer map;
- the verification queue goes out only when its holder or waiters change, not about once a second.

A frame is serialized once per feature set, not once per client. Connections without features keep today's frames byte for byte.

## Acceptance criteria

- [ ] C1. After the snapshot, every model frame a featured connection receives carries the next sequence number with no gap, across tracker, topic, session and inbox changes (test).
  - failed: rev-26 [reviewer] · 2026-10-21T09:58:01.324Z · note Snapshot cursor equality races the real-clock startup inbox publication between snapshots (M3).
- [x] C2. A `task` delta to a featured connection carries the changed item and only the layers that changed (test).
  - done: impl-985 · 2026-10-21T09:54:17.589Z
- [x] C3. The verification queue is pushed only when its holder or waiters change, not while a run merely holds it (fake-clock test).
  - done: impl-985 · 2026-10-21T09:54:17.608Z
- [ ] C4. A pin or a mute sends the re-projected rows, not a bare invalidation (test).
  - failed: rev-26 [reviewer] · 2026-10-21T09:58:01.324Z · note Topic pin/mute omits inherited artifact rows; refresh scans unrelated history and emits an unbounded history frame (M1/M2).
- [x] C5. Each frame is serialized once per feature set, whatever the number of receiving connections (test counts serializations with three clients).
  - done: impl-985 · 2026-10-21T09:54:17.655Z
- [x] C6. Neovim's frames are unchanged: the recorded Neovim frame fixtures and the Neovim T2 tests pass without edits.
  - done: impl-985 · 2026-10-21T09:54:17.675Z
- [x] C7. `hub/README.md` documents the numbering, replace against append, and the slim `task` frames.
  - done: impl-985 · 2026-10-21T09:54:17.698Z

## Comments

### impl-985 · 2026-10-21T09:53:24.920Z

Implemented test-first at the E-412 frame seam. Model publications now share the core epoch/sequence, tracker changes enter the same emit point, slim task layers carry only differences, and serialized frames are shared per canonical feature set on every transport. Featured pin/mute updates contain re-projected retained rows; queue elapsed timing no longer triggers pushes. Local targeted macOS arm64 evidence before the final pre-review dev merge: connection-snapshot 9/9, suite-queue T1 4/4, Neovim client-component T2 4/4, unchanged committed frame catalog/slices. Root check passed (test lint report mode, zero refusals). Pre-review origin/dev merge changed only tracker/QA metadata and duration baselines; rechecking that head before requesting source review. Mode-free verification remains pending review; no full-suite pass claimed.

### rev-26 · 2026-10-21T09:58:01.324Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-985-source-1
commit: 54aee711b2277a516ead6e2b3e5300379b778d90
scope: full
findings: [{"severity":"medium","text":"M1: Topic pin/mute changes topic-owned artifact layers through Visibility.place's topic inheritance, but refreshVisibility includes artifact rows only for an artifact-surface choice. Featured clients retain stale already-loaded artifacts; emit all affected artifacts and compare pushed layers with fresh reads.","file":"hub/src/hub/core.ts","line":226},{"severity":"medium","text":"M2: A single session/artifact pin/mute synchronously reads every retained message in every topic, resolves attachments, then filters. Work grows with unrelated history, and affected history is serialized as one unbounded frame. Query affected rows first and publish bounded chunks while retaining historical row updates.","file":"hub/src/hub/core.ts","line":217},{"severity":"medium","text":"M3: Snapshot cursor equality uses a real-clock projectHub. useSessions arms the initial 250 ms inbox publication, so a legitimate model delta between the two async snapshots advances the cursor and fails this assertion under load. Use controlled clock/quiescent publications to isolate snapshot numbering.","file":"hub/test/connection-snapshot.test.ts","line":49}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source audit vs fixed dev cbc6c6230054b8c74b6f625c0ed6b28642759db9. Three medium findings: M1 core.ts:226 omits topic-owned artifact reprojections; M2 core.ts:217–221 reads/materializes all unrelated retained history before filtering and sends one unbounded visibility frame; M3 connection-snapshot.test.ts:49 compares snapshot cursors under a real clock despite the initial 250 ms inbox publication. Source-derived findings; no Reviewer tests or performance run. C1/C4 failed; other execution criteria unverified. Standards/Spec details and precise paths: A-8237, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8237-t-985-full-source-review-not-clear-at-54aee711.md. Changed source needs fresh source review before verification.

Criteria: C1 failed (Snapshot cursor equality races the real-clock startup inbox publication between snapshots (M3).), C4 failed (Topic pin/mute omits inherited artifact rows; refresh scans unrelated history and emits an unbounded history frame (M1/M2).).
