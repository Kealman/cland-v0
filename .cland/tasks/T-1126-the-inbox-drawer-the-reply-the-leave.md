---
id: T-1126
kind: task
title: The inbox drawer, the reply, the leave rule and the archive
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
  - T-1124
topic: topic-894
branch: t/T-1126-the-inbox-drawer-the-reply-the-leave
created: 2026-10-22T15:16:14.159Z
updated: 2026-10-23T06:29:41.110Z
---

## Summary

The drawer follows the selected inbox row with its topic's thread, scrolled to the row's message, and a one-line reply on `r`; an answered row stays folded until the human leaves the inbox and then shows in the archive on `A`.

## Parent

E-417 (v0.1.2 §3.7; §3.4 the answered ask and the inbox's leave rule; P19, P38; tracer step 3).

## What to build

With an inbox row selected the drawer shows the thread of its topic (the thread of the topics ticket, with its folds and cards), scrolled to the row's message, and at its foot the composer in its one-line form addressed to the row's sender; `r` focuses it. The drawer has Split and Close as elsewhere. A row that leaves the inbox because it was answered, approved, replied or read stays in place folded to its outcome (P38) while the human stays in the Inbox area, so rows never move under a finger; leaving the area drops them. `A` shows the inbox archive: what left in the last seven days and why, from the hub's departures. The archive line closes the list below the events line and stays when every section is empty.

## Acceptance criteria

- [x] C1. Selecting a row shows its topic's thread in the drawer scrolled to the row's message, and `r` sends a one-line reply the fake sender receives (Web test).
  - done: impl-1126 · 2026-10-23T06:28:37.770Z
- [x] C2. An ask answered from the inbox stays folded with its outcome while the Inbox is shown, and after leaving and returning it is gone from its section (Web test).
  - done: impl-1126 · 2026-10-23T06:28:37.877Z
- [x] C3. `A` lists the answered ask in the archive with why it left, and the archive line stays when every section is empty (Web test).
  - done: impl-1126 · 2026-10-23T06:19:21.568Z

## Comments

### impl-1126 · 2026-10-23T05:56:12.727Z

Baseline build passed on local Darwin arm64 at initial branch. Read E-417 decisions/spec/boards and Neovim leave_visit: leaving for a non-Inbox surface clears both completed rows and selection; moving among Inbox rows or its panel/full views retains them. Test seams are specified by the brief: sealed Web browser + fake-sender public frames, with physical-code key routing. Waiting for T-1125 landing before edits.

### impl-1126 · 2026-10-23T06:19:34.205Z

C1–C3 implemented, marked done and pushed at 31b9ffe5b3f1569915dde758a0b3e0fc4c134710. First full source review requested from reviewer in topic-894. Durable implementation/targeted-check evidence A-9872: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9872-t-1126-implementation-and-targeted-evidence-at-31b9ffe5.md. Local Darwin arm64 targeted checks and root check passed; full mode-free receipt remains pending source review. After-stage QA policy, no per-item brief. Project rule proposal posted to the supervising lead in topic-894.

### rev-23 · 2026-10-23T06:24:15.357Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1126-source
commit: 31b9ffe5b3f1569915dde758a0b3e0fc4c134710
scope: full
findings: [{"severity":"medium","text":"InboxDetail retains cached full Entry after visit removal, and no-topic approval renders cached ApprovalRecord directly. Split pending approval, focus non-Inbox, peer-close: stale pending controls survive. Resolve retained identity against current native facts/recovery; cover peer updates.","file":"web/src/InboxArea.tsx","line":166},{"severity":"medium","text":"r only focuses local drawer ref, but split suppresses that drawer; InboxDetail has no reply handler. Support selected-row reply focus in still-open split and assert exact sender/replyTo with a pre-armed bounded focus observer.","file":"web/src/InboxArea.tsx","line":77}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear, complete M1/M2 in A-9874; no lows. Shared Thread/Composer/visit/archive/docs and existing regression audit otherwise complete. Split native facts and split reply routing need corrections; C1/C2 failed, C3 runtime pending. Local A-9872 is supporting implementation-tree evidence, not configured pass. Preserve raw receipts, fix test-first and request fresh source review before verify. After-stage QA separate.

Criteria: C1 failed (Physical r silently fails while the selected reply thread is split because only the suppressed local drawer ref is focused.), C2 failed (Retained split native approval entry can keep stale pending controls after leaving Inbox and a peer closes it.).

### impl-1126 · 2026-10-23T06:28:53.033Z

Addressed source findings M1/M2 at pushed head 5f0058f3c2fc8be9dbbc6aaee0ba6740a46b2cc8; fresh source review requested. Both public Web regressions reproduced old failures then passed: native split detail follows current authorization/outcome after leaving Inbox, and physical r focuses/sends while split remains open. Corrected evidence A-9876: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9876-t-1126-corrected-source-and-regressions-at-5f0058f3.md. Required targeted files and root check passed locally, report-only lint 0 refusals. Full verification still held for clear source review.

### rev-23 · 2026-10-23T06:29:41.110Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1126-source-2
commit: 5f0058f3c2fc8be9dbbc6aaee0ba6740a46b2cc8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full corrected source clear, no findings. A-9877: M1 retained native id resolves current approvalCards/recovery; split peer-revalidation/closed archive regression covers stale episode. M2 list r reaches matching split page, detail r reaches own composer; pre-armed bounded focus observers and exact fake-sender reply_to receipt remain with split open. Original A-9874 audit and other drawer/visit/archive/docs behavior stand, no dev merge. A-9876 local supporting checks are not configured runtime evidence. C1–C3 pending exact-head mode-free verification; preserve raw receipts and inspect new Web timing samples. After-stage affected QA separate.
