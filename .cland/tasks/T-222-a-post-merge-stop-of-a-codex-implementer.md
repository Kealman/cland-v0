---
id: T-222
kind: task
title: A post-merge stop of a Codex Implementer is recorded as a death, and
  `cland session stop` refuses on its process identity
state: closed
status: done
criterion_seq: 3
labels:
  - ready-for-agent
assignee: impl-222
parent: E-229
blocked_by:
  - T-147
topic: topic-147
branch: t/T-222-a-post-merge-stop-of-a-codex-implementer
created: 2026-10-11T10:48:25.372Z
updated: 2026-10-11T19:23:09.351Z
closed: 2026-10-11T19:23:09.665Z
---

## What happened

On 2026-10-11 the Coordinator ran `cland session stop impl-174` (about 10:18Z) and `cland session stop impl-188` (about 10:32Z) right before `cland merge`. Both refused with: `could not stop "impl-…": its process identity cannot be verified; it is still watched`.

Both sessions ended right after their merges anyway. The hub logged `harness-exited`, a "died" death notification, and role-revoked "its harness exited". Earlier post-merge stops (impl-182, impl-191, impl-209, impl-208) logged `harness-ended` and `session-stopped`. Both merges landed fine. Observed by cland-impl's health check at 10:47Z.

## Why it matters

Under D17, deaths are warn-level events. A clean post-merge stop counted as a death pollutes that signal. The refusal also means the stop-before-merge step no longer works for these sessions.

## What to build

Find out why the process identity check fails for these Codex sessions: pid reuse, a re-exec, or a launcher pid differing from the harness pid. Make the post-merge stop (T-182's per-item stop after merge) and `cland session stop` classify the exit as a stop, not a death.

## Acceptance criteria

- [x] C1. A protocol test: a Codex fake Implementer, stopped after its item merges, logs `session-stopped` with no death event.
  - done: impl-222 · 2026-10-11T18:32:04.071Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T222-1 · 2026-10-11T19:22:50.557Z · commit e29bb18b33147617b6b3583cad5fadf822f63465
- [x] C2. `cland session stop` on a live Codex Implementer succeeds, or names a real cause when it refuses.
  - done: impl-222 · 2026-10-11T18:32:04.365Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T222-1 · 2026-10-11T19:22:50.557Z · commit e29bb18b33147617b6b3583cad5fadf822f63465
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-222 · 2026-10-11T19:22:27.711Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T222-1 · 2026-10-11T19:22:50.558Z · commit e29bb18b33147617b6b3583cad5fadf822f63465

## Comments

### coord · 2026-10-11T13:41:34.737Z

More data (2026-10-11 13:46Z): impl-221 was idle and mid-session, with no merge. The first 'cland session stop impl-221' refused with 'process identity cannot be verified; it is still watched'. A retry 5 s later stopped it cleanly. So the refusal looks transient (an identity probe racing something), not specific to post-merge.

### coord · 2026-10-11T14:20:11.674Z

Another case (2026-10-11 14:07Z): stopping impl-219 for its merge logged 'impl-219 died' at 14:07:12, then 'stopped' at 14:07:17. The stop was classified as a death first.

### coord · 2026-10-11T14:46:08.431Z

Related: T-147 ('Session stop refuses under load: process identity cannot be verified') already covers the stop-refusal half of this item. Treat them together when either is picked up.

### impl-222 · 2026-10-11T18:27:59.043Z

Baseline 405e62a includes T-147. Scratch protocol test (Codex fake Implementer launched on item, item merged with default stop_after=merge) passed: session-stopped, no harness-exited, no session-death in Agents, no death notification in inbox. Expanding to manual and post-merge stops across all three fake harnesses before deciding whether an additional fix is needed.

### impl-222 · 2026-10-11T18:32:03.734Z

T-147 already removes the reproduced failure. Added 12 protocol cases (manual CLI and post-merge × Codex/Claude Code/OpenCode × graceful/forced) and extended the controlled descendant-exit race to both manual and post-merge, asserting D17 user-visible death absence and requested-stop role revocation. Pre-T-147 source mutation reproduces post-merge process-identity refusal; exact restoration passes both race tests. No runtime changes needed. Targeted matrix 13/13 and extended race 2/2 passed; typecheck passed. Fetched/merged origin/dev before final suite; review request and full suite next.

### impl-222 · 2026-10-11T19:22:27.874Z

Final hub-owned full suite 1f5f621a-5b29-4737-a611-3f2aa9173950 passed at e29bb18b33147617b6b3583cad5fadf822f63465: all exit 0; tests 1541, pass 1541, fail/cancelled/skipped/todo 0. Includes typecheck and full hub/Neovim suites. Durable log A-1357: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1357-suite-1f5f621a-5b29-4737-a611-3f2aa9173950-all-at-e29bb18.log. C3 marked done; review verdict pending.

### rev-17 · 2026-10-11T19:22:50.558Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261011-17-T222-1
commit: e29bb18b33147617b6b3583cad5fadf822f63465

No findings (high/medium/low); Standards and Spec clear. C1/C2 verified by the real manual CLI and post-merge protocol matrix plus controlled descendant-exit race, asserting session-stopped and no death log/journal, Agents event or inbox warning. T-147's shared fix resolves the reproduced identity race; A-1342 documents red/green cause evidence. C3 verified from A-1357: exact reviewed head, typecheck and full suite pass 1541/1541, zero failures/cancellations/skips, exit 0. Review A-1344 records code assessment; final review artifact created in this topic.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T19:23:09.351Z

Merged 0326a815328499ccda13a6cb80c11275ec80d017 onto dev.
