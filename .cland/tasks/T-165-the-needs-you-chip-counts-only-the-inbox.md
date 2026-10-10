---
id: T-165
kind: task
title: "The needs-you chip counts only the inbox's now-layer sections: no unread messages or notifications; one shared count with the inbox header"
state: open
status: in progress
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
updated: 2026-10-10T09:21:23.656Z
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
