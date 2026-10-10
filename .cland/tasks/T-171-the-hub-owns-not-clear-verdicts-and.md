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
blocked_by:
  - T-169
topic: null
branch: null
created: 2026-10-10T10:13:42.333Z
updated: 2026-10-10T16:59:13.531Z
---

## Parent

T-110 (Threads that read). A follow-up to T-169, decided by the stand-in on 2026-10-10, pending the human's confirmation (see T-130).

## What to build

The hub owns two more "needs you" kinds, each with a resolution rule, and counts them in `needsYou` and the inbox's now sections:
- **A verdict not clear.** It resolves when a newer clear verdict of the same kind lands on the item, or when the item closes.
- **A session died.** It resolves when the session is relaunched, stopped for good, or the human dismisses the row.

Until this lands, `needsYou` is asks + approvals + waiting topics only (T-169). Neovim keeps showing the hub's count and computes nothing.

## Acceptance criteria

- [ ] The hub keeps not-clear verdicts and deaths as now-layer inbox entries, with the resolution rules above, durable across restarts.
- [ ] `needsYou`, `cland inbox --json` and `hub status` count them while open and drop them on resolution.
- [ ] The inbox shows them in their own now section with a dismiss action for deaths.
- [ ] Frame-protocol tests cover each resolution path; a headless test covers the chip following the hub.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Blocked by T-169. Awaiting the human's confirmation of the rule (the question is on T-130).

## Comments

### coord · 2026-10-10T16:45:30.416Z

From T-190 self-review: T-134 keeps agent-to-agent verdict messages at watch (clear) and now (not clear), which diverges from spec §3.5 (agent-to-agent is background; agents raise only by addressing the human or asking). T-190 preserves the T-134 behaviour unchanged; T-171 decides the verdict-message level with the rest of the noise policy (under D16 the human acts on no individual verdict).

### coord · 2026-10-10T16:59:13.531Z

Candidate kind from T-198 (stand-in decision 2026-10-10): unread human-addressed messages in needsYou, resolved when read or answered. Settle with the human's open T-130 question on verdicts and deaths; nothing in v0.1 depends on it.
