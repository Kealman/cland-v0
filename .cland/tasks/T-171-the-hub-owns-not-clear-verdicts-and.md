---
id: T-171
kind: task
title: The hub owns not-clear verdicts and deaths in needsYou, each with a resolution rule
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by: []
topic: null
branch: null
created: 2026-10-10T10:13:42.333Z
updated: 2026-10-11T06:36:41.917Z
---

## Parent

T-115 (Visibility and artifacts). Rescoped 2026-10-11 by the human's decision D17 (T-130).

## What to build

A not-clear verdict and a session death are information, not "needs you". needsYou means "the human must react", so these never count in the top-panel counter or in needsYou.

- The hub tags a not-clear verdict and a session death as **warn-level events** in the shared classifier (T-190): watch layer, with a warn severity in the event data.
- The inbox and the event log show them with a warn marker (an icon or an equivalent glyph), sorted with the other events, with no dismiss or resolution rule.
- needsYou, `cland inbox --json` counts and `hub status` stay asks, approvals and waiting topics only (T-169).

## Acceptance criteria

- [ ] Not-clear verdicts and session deaths reach the inbox and the event log as warn-level events with a marker, and they never change needsYou.
- [ ] Frame-protocol tests cover both event kinds and their severity, and a headless test covers the inbox marker and the unchanged chip count.
- [ ] Docs (docs/visibility.md, nvim/README.md) describe the warn level.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. The earlier design (now-layer entries with resolution rules) is withdrawn by D17. The T-134 verdict-message exception folds into this warn level.

## Comments

### coord · 2026-10-10T16:45:30.416Z

From T-190 self-review: T-134 keeps agent-to-agent verdict messages at watch (clear) and now (not clear), which diverges from spec §3.5 (agent-to-agent is background; agents raise only by addressing the human or asking). T-190 preserves the T-134 behaviour unchanged; T-171 decides the verdict-message level with the rest of the noise policy (under D16 the human acts on no individual verdict).

### coord · 2026-10-10T16:59:13.531Z

Candidate kind from T-198 (stand-in decision 2026-10-10): unread human-addressed messages in needsYou, resolved when read or answered. Settle with the human's open T-130 question on verdicts and deaths; nothing in v0.1 depends on it.
