---
id: T-222
kind: task
title: A post-merge stop of a Codex Implementer is recorded as a death, and `cland session stop` refuses on its process identity
state: open
status: backlog
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: T-229
blocked_by:
  - T-147
topic: null
branch: null
created: 2026-10-11T10:48:25.372Z
updated: 2026-10-11T17:48:38.477Z
---

## What happened

On 2026-10-11 the Coordinator ran `cland session stop impl-174` (about 10:18Z) and `cland session stop impl-188` (about 10:32Z) right before `cland merge`. Both refused with: `could not stop "impl-…": its process identity cannot be verified; it is still watched`.

Both sessions ended right after their merges anyway. The hub logged `harness-exited`, a "died" death notification, and role-revoked "its harness exited". Earlier post-merge stops (impl-182, impl-191, impl-209, impl-208) logged `harness-ended` and `session-stopped`. Both merges landed fine. Observed by cland-impl's health check at 10:47Z.

## Why it matters

Under D17, deaths are warn-level events. A clean post-merge stop counted as a death pollutes that signal. The refusal also means the stop-before-merge step no longer works for these sessions.

## What to build

Find out why the process identity check fails for these Codex sessions: pid reuse, a re-exec, or a launcher pid differing from the harness pid. Make the post-merge stop (T-182's per-item stop after merge) and `cland session stop` classify the exit as a stop, not a death.

## Acceptance criteria

- [ ] A protocol test: a Codex fake Implementer, stopped after its item merges, logs `session-stopped` with no death event.
- [ ] `cland session stop` on a live Codex Implementer succeeds, or names a real cause when it refuses.
- [ ] `npm run typecheck && npm test` pass.

## Comments

### coord · 2026-10-11T13:41:34.737Z

More data (2026-10-11 13:46Z): impl-221 was idle and mid-session, with no merge. The first 'cland session stop impl-221' refused with 'process identity cannot be verified; it is still watched'. A retry 5 s later stopped it cleanly. So the refusal looks transient (an identity probe racing something), not specific to post-merge.

### coord · 2026-10-11T14:20:11.674Z

Another case (2026-10-11 14:07Z): stopping impl-219 for its merge logged 'impl-219 died' at 14:07:12, then 'stopped' at 14:07:17. The stop was classified as a death first.

### coord · 2026-10-11T14:46:08.431Z

Related: T-147 ('Session stop refuses under load: process identity cannot be verified') already covers the stop-refusal half of this item. Treat them together when either is picked up.
