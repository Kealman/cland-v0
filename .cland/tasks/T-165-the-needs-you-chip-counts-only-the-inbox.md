---
id: T-165
kind: task
title: "The needs-you chip counts only the inbox's now-layer sections: no unread messages or notifications; one shared count with the inbox header"
state: closed
status: done
rank: 1310
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-110
blocked_by: []
topic: topic-74
branch: t/T-165-the-needs-you-chip-counts-only-the-inbox
created: 2026-10-10T09:19:59.837Z
updated: 2026-10-10T10:12:23.278Z
---

## Parent

T-110 (Threads that read). A bug the human reported on the live build, via the stand-in on 2026-10-10. It reverses part of T-136's decision.

## What to build

The top bar's "needs you" chip shows a growing count (98 on the live build), while the inbox says "nothing needs you" and lists no ask, approval or waiting topic. The chip must count exactly what the inbox's now-layer sections show (spec v0.1 §3.5, "The top bar counts now only"; v0 §5): asks, approvals, topics waiting for the human, verdicts not clear, and deaths. Notifications and unread now-layer messages are not counted.

T-136 added "unread now-layer messages" to the count; remove that part. The chip and the inbox's own header ("N need you") come from one function, so they can never disagree.

## Acceptance criteria

- [ ] The chip counts only the inbox's now-layer sections: asks (each once), approvals, topics waiting for the human, verdicts not clear, deaths.
- [ ] Unread messages and notifications never change the chip.
- [ ] The chip and the inbox header read from one shared count; a headless test asserts they agree after asks, approvals, a not-clear verdict, a death, resolutions and a stream of ordinary messages.
- [ ] With nothing in those sections, the chip reads "✓ needs you 0" and the inbox "nothing needs you".
- [ ] The QA cases for the top bar (THREAD-009/010) are updated to the corrected rule.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

High priority: a trust issue for the human. Size S.

## Comments

### impl-165 · 2026-10-10T09:21:23.656Z

Confirmed separate count paths: topbar reads attention.count(), inbox header reads state.needs_you(). The regression seam is the real headless Neovim shell driven by stub-hub message/inbox frames, as requested. Shared UI count will include asks, approvals, waiting topics, death and not-clear verdict rows; ordinary notifications/messages stay quiet.

### impl-165 · 2026-10-10T09:26:25.113Z

Candidate fd5f4c4 removes the independent unread attention projection. The regression first reproduced the exact 98-vs-empty mismatch, then passed through asks, approvals, waiting topics, not-clear verdict/death, ordinary notifications/messages and resolutions. Startup/refresh/reconnect with unread history also remains zero. THREAD-009/010 and typecheck pass. Standards self-review: no findings. Spec self-review: stale README count paragraph fixed; no remaining findings. Locked full Neovim suite is queued behind another suite.

### rev-67 · 2026-10-10T09:34:40.117Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-165-1
commit: fd5f4c452ea827f51307c76414978da22eb78683

No high, medium or low findings. Standards: clear; Spec: clear. Chip, inbox headers and empty state share state.needs_you(); all five requested inbox action kinds count, ordinary notes/messages and unread totals do not. Optimistic answer/dismiss updates and inbox snapshots use those same rows. Complete ten-file diff and unchanged inbox paths reviewed. Pinned native Neovim probe passed actual rendered agreement at unread98/198, all five actions, ordinary-note exclusion, resolutions/dismissals and stale aggregate exclusion after inbox load. New shell regressions cover actual 98-message frames and startup/refresh/reconnect; THREAD-009/010 match the corrected rule. No edits or suite repeat; full test:nvim remains separately queued.

Evidence: A-533, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-533-t-165-review-at-fd5f4c4-shared-now-count-clear.md.

### impl-165 · 2026-10-10T09:51:47.252Z

Final validation: npm run typecheck passed with Node v24.21.0; locked npm run test:nvim retry passed all 208 tests, no skips/failures (178.00s, 94.16s lock wait). First suite run passed 207/208; unrelated pre-existing board-rank test at thread.test.ts:529 failed once, passed immediately isolated, then passed in the unchanged full retry. A-529 documents the exact 98-vs-empty reproduction and implementation/self-review; A-541 preserves the first full-run log. Final head fd5f4c452ea827f51307c76414978da22eb78683 is pushed to origin and has current clear review verdict rev-67-165-1. All T-165 acceptance criteria are implemented and validated.

### coord · 2026-10-10T09:52:14.393Z

Merged fdadb7beaaa8156083ce342cb2d2156d57725ab6 onto dev.

### coord · 2026-10-10T10:11:50.023Z

Reopened 2026-10-10 ~10:12Z. The human still sees 'needs you 112' in the chip and the inbox header after the T-165 merge (fdadb7b) and an editor restart. The hub says needsYou 0, and the inbox shows asks 0, approvals 0, waiting 0, notifications 427.
Cause: state.needs_you() (nvim/lua/cland/state.lua:315) adds every 'death' and 'not clear' verdict among all notifications. Those never resolve, so the count grows without bound (112 of 427).
Fix: the chip and the inbox header show the hub's needsYou and nothing else; Neovim computes nothing. Add a stub-hub test with hundreds of notifications of every kind, hub needsYou 0, asserting the chip and the header show 0, and that the chip follows the hub's needsYou when it changes. Note for the spec: §3.5 lists 'verdict not clear' and 'session died' as now-layer inbox events. If they should count, the hub's needsYou must count them, with a resolution rule, not Neovim.
