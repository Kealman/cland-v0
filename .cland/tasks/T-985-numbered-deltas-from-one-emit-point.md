---
id: T-985
kind: task
title: Numbered deltas from one emit point
state: closed
status: done
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
updated: 2026-10-21T10:29:34.560Z
closed: 2026-10-21T10:29:34.560Z
---

## Summary

Every model delta is numbered within the epoch where the core emits it, and a delta carries only what changed. A `task` delta carries the changed item and only the changed layers. The verification queue is pushed only when it changes. Each frame is serialized once per feature set.

## What to build

There is one emit point in the core for every model delta to clients, the tracker's `task` frames included. Whole-state frames (`inbox`, `presence`, the verification queue) replace, while `message`, `delivery` and `event` append. A pin or a mute sends the re-projected rows, never a bare invalidation. On a featured connection:
- a `task` delta carries the changed item and only the layers that changed, never the all-items layer map;
- the verification queue goes out only when its holder or waiters change, not about once a second.

A frame is serialized once per feature set, not once per client. Connections without features keep today's frames byte for byte.

## Acceptance criteria

- [x] C1. After the snapshot, every model frame a featured connection receives carries the next sequence number with no gap, across tracker, topic, session and inbox changes (test).
  - done: impl-985 · 2026-10-21T10:07:35.789Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C2. A `task` delta to a featured connection carries the changed item and only the layers that changed (test).
  - done: impl-985 · 2026-10-21T09:54:17.589Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C3. The verification queue is pushed only when its holder or waiters change, not while a run merely holds it (fake-clock test).
  - done: impl-985 · 2026-10-21T09:54:17.608Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C4. A pin or a mute sends the re-projected rows, not a bare invalidation (test).
  - done: impl-985 · 2026-10-21T10:13:25.689Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C5. Each frame is serialized once per feature set, whatever the number of receiving connections (test counts serializations with three clients).
  - done: impl-985 · 2026-10-21T09:54:17.655Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C6. Neovim's frames are unchanged: the recorded Neovim frame fixtures and the Neovim T2 tests pass without edits.
  - done: impl-985 · 2026-10-21T09:54:17.675Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
- [x] C7. `hub/README.md` documents the numbering, replace against append, and the slim `task` frames.
  - done: impl-985 · 2026-10-21T09:54:17.698Z
  - verified: rev-26 [reviewer] · run rev-20261021-985-source-3 · 2026-10-21T10:14:19.690Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
  - verified: rev-26 [reviewer] · run rev-20261021-985-final-1 · 2026-10-21T10:24:46.343Z · commit 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08

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

### impl-985 · 2026-10-21T10:07:35.838Z

Corrected M1–M3 at cd5a281dbd3ca1354e7ab86e04b50b8239fe91c9, tree 28f2d554ce400114451491fa56634fc669cdd1db. Topic-owned artifacts now re-project with pin/mute/toggle-off, compared to fresh reads. Indexed message/artifact references select history before decoding, with one-time migration/backfill, bounded keyset pages, byte/count-bounded frames and yields; legacy-only choices do not traverse history. Snapshot equality uses FakeClock. Targeted local macOS arm64: connection-snapshot T2 10/10, store T1 24/24, suite-queue T1 4/4; npm run check passed (test lint report mode, zero refusals). Raw stdout/exits retained in corrective checks artifact, original A-8235/A-8237 evidence preserved. No dev merged after first source review. Fresh source review requested before mode-free verification.

### rev-26 · 2026-10-21T10:10:13.303Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-985-source-2
commit: cd5a281dbd3ca1354e7ab86e04b50b8239fe91c9
scope: full
findings: [{"severity":"medium","text":"M4/C4: Topic visibility history selects only messages.topic, missing creation chips moved from topic A into a folder in topic B. resolveArtifact gives the chip B's effective topic, so pin/mute B changes its fresh projection while the retained A-thread message is never pushed. Include moved artifact creation references through an indexed bounded path and regress cross-topic move/toggle.","file":"hub/src/hub/store.ts","line":1510},{"severity":"low","text":"L1: message_artifact_refs has ON DELETE CASCADE by message_id but only the (artifact_id, seq) primary index. Message pruning/deletion must scan the whole child table per removed message. Add a message_id-leading index to retain bounded deletion lookup work.","file":"hub/src/hub/store.ts","line":106}]
finding_counts: {"high":0,"medium":1,"low":1}

Reworked full source review: original M1/M2/M3 cases resolved with topic artifact rows, indexed bounded history chunks/legacy fast path and FakeClock. Remaining medium M4 at store.ts:1510 selects only stored message topic, missing artifact creation chips whose resolved artifact moved from A into a folder in B; topic B pin/mute changes the A-thread chip on fresh reads but emits no replacement. Low L1 at store.ts:106: add message_id index for ON DELETE CASCADE, avoiding per-message child-table scans during prune. Source-derived findings, no Reviewer tests. C4 failed; no verification marks in this not-clear pass. A-8246 raw local targeted/check receipts audited with provenance limits. Full Standards/Spec audit: A-8252 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8252-t-985-reworked-source-not-clear-at-cd5a281d-moved-creation-chips.md.

Criteria: C4 failed (Topic projection selection misses retained creation chips moved into a folder in another topic; fresh reads change layer but no replacement message row is pushed (M4).).

### rev-26 · 2026-10-21T10:14:19.690Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-985-source-3
commit: 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, completing reworked design audit. M4 resolved: topic affected-artifact CTE includes moved files in destination folders, unions/deduplicates reference and thread keys and limits before body decoding; cross-topic move pin/mute/toggle regression compares complete pushed rows with fresh old-thread history. L1 fixed by message_id-leading FK child index. Original M1/M2/M3 remain resolved; bounded chunks, legacy fast path, fake model clock and source semantics unchanged. C7 source-verified; C1–C6 await post-source same-head task evidence including actual Neovim T2 for C6. No nvim source/fixture edits, no post-review dev merge, diff check clean. A-8262 raw targeted/check receipts audited as local macOS implementation-tree evidence, not task/Web gate. Full Standards/Spec audit A-8266 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8266-t-985-corrected-source-clear-at-2d1f8ef9.md. No remaining findings.

Criteria: C7 verified.

### rev-26 · 2026-10-21T10:24:46.343Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-985-final-1
commit: 2d1f8ef910b3e609d6ae51c23d78ea60cf343a08
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

No findings. Final same-head evidence audit A-8277 supplements source-clear A-8266. A-8273/run 3fc1e12a passed 2,237 ordinary tests plus 45 separate load repetitions on Linux x64 c-8 lon1 droplet (Node24.21/Neovim0.12.5, two machine workers). All T1 and all-T2 fallback executed across hub and Neovim. Each of nine new/renamed owned identities passed 5/5; maximum owned load observation 0.372452s. C1 continuity, C2 slim layers, C3 fake-clock change-only queue, C4 complete/bounded placement projections and C5 per-feature serialization established by matching ordinary and repeated cases. C6 includes 314/314 Neovim tests in 38 files and an independently empty nvim/ source/fixture diff against pinned base cbc6c623. C7 remains current source-established documentation. Host check reference 58a27587 was not repeated remotely. Duration/test lint/ratchet report-only; Web explicitly NOT RUN for missing Linux libraries/T-993, T3/T4 not run. No browser or after-stage QA pass claimed. All C1–C7 verified at unchanged reviewed commit.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-21T10:29:34.560Z

Merged aeae1f25cca0c0e9d99d0575b339e06856d0ef58 onto dev.
