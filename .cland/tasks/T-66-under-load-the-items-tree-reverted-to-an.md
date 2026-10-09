---
id: T-66
kind: task
title: "Under load the items tree reverted to an earlier snapshot after live updates: a late full list overwriting newer events?"
state: closed
labels:
  - slice-1
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-34
branch: t/T-66-under-load-the-items-tree-reverted-to-an
created: 2026-10-09T08:58:42.263Z
updated: 2026-10-09T18:39:01.683Z
---

## Parent

Part of T-19. Seen by qa-6 on 2026-10-09 during T-50's QA (branch 4c1f7cd, whose change is in the Codex adapter and touches no Neovim code), with the machine's load average above 140 (six Implementers, Reviewers and QA running suites at once).

## What happened

The full `npm test` failed once in nvim/test/shell.test.ts, the case "the tree follows task events: a claim, a new item, a removed file": the screen never showed T-13 gone within 10000 ms. The failure's screenshot showed the initial item list restored (T-13 present again, T-14 absent, T-7's claim absent) after earlier assertions in the same case had seen the updates applied. The isolated rerun (`node --test --test-name-pattern='the tree follows task events' nvim/test/shell.test.ts`) passed. A similar one-off failure hit the hub suite on main after T-49's merge at 07:52Z (not captured).

## Suspicion

A late answer to a full `task.list` (or an index rebuild) arrives after newer `task` events were applied and overwrites the tree with the older snapshot; under load the ordering flips. If so, the items panel must apply a snapshot only when it is newer than the events already applied (a sequence or timestamp from the hub), or re-apply the events after it.

## Acceptance criteria

- [ ] The race is reproduced at the stub-hub seam (a delayed snapshot after events) and the tree keeps the newer state
- [ ] `nvim/README.md` says how snapshots and events are ordered
- [ ] `npm run typecheck && npm test` pass

## Comments

### coord · 2026-10-09T09:06:45.969Z

Second occurrence, 09:05Z: impl-53's full suite on t/T-53-cland-init-territory (no Neovim change) failed the same case, "the tree follows task events" waiting for T-13's removal at shell.test.ts:1142, under the same load; the isolated rerun passed. Two sessions, two branches, same symptom: the race is in the items panel's handling of a late snapshot, not in any branch under test.

### impl-66 · 2026-10-09T18:06:02.102Z

Reproducing first at the assigned stub-hub seam: defer task.list, apply task events, then release the old list. Auditing other Neovim snapshot/event consumers before choosing the ordering rule.

### impl-66 · 2026-10-09T18:11:21.728Z

Confirmed red twice before production edits (~1.3s): delayed task.list restores deleted T-13 and drops new T-14/claim. Client journal/replay now passes that case and an already-reflected snapshot + request failure case. Audit: topic.list, session.list, hub.status and artifact.list share the overwrite; applying the journal there. inbox.list already prefers latest whole inbox event; hub.status needsYou also needs replay. Adding overlapping topics request coverage.

### rev-6 · 2026-10-09T18:21:54.388Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-66-1
commit: 5d478b48db86c2d665454fc348d205bd59b37dd5

Medium — nvim/lua/cland/hub.lua:340: every pending snapshot retains a deep copy of every live event without a cap or request deadline; a still-connected unanswered task.list retained 10,000 then 20,000 unrelated messages in the read-only probe. Bound recording size/lifetime and release ownership while ignoring late answers on expiry/overflow.

Medium — nvim/lua/cland/init.lua:44: preserving the entire cached topic row for an intervening message discards fresh reconnect baseline fields. Probe: cached unread=5/old title/open plus one message becomes 6; an answer with unread=10/fresh title/waiting for agent leaves 6/old/open. Replay only changed fields and deduplicate message counts against the fresh baseline.

Item claim/add/removal/rename and stable-id session rename are idempotent; failure/disconnect cleanup works. Both typechecks and diff check passed. No full suite run, as requested. Separate review axes and standalone probes: A-153 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-153-t-66-review-rev-6-66-1-at-5d478b4.md).

### impl-66 · 2026-10-09T18:28:01.954Z

Review fix round committed at 1cf752b94aa8fefb0d9fabed86fb6445391aef73. Reproduced cached topic title restoration, 100 unrelated recorded frames, and no cap retry on the prior head. Added filtered 30s/2048-event/2MiB recordings with cancelled old callbacks; topic replay now starts from fetched metadata/counts, deduplicates ids and uses an authoritative refetch for equal/unknown timestamp inclusion. Added deadline, event cap, byte cap, reconnect metadata and equal-watermark cases. All 11 targeted shell tests and typecheck passed. Prior full suite was interrupted through its own cwd-verified runner and cleaned up; starting one full suite on this fixed head.

### rev-6 · 2026-10-09T18:32:06.796Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-66-2
commit: 1cf752b94aa8fefb0d9fabed86fb6445391aef73

Standards: clear. Spec: clear. No high or medium findings in 5d478b4..1cf752b.

Both rev-6-66-1 findings are resolved: filtered recordings enforce deadline/event/byte bounds, cancel old callbacks and ignore late answers; topic replay keeps fresh baseline metadata and deduplicates message counts. Read-only A-153 reruns and updated probes confirm the reconnect outcome (fresh title/status, unread=11), 20,000 irrelevant frames retaining zero bytes/events, cap/deadline cancellation, disconnect before retry, and equal/unknown timestamp refetches. Other panels replay event entities/fields rather than cached rows.

Both typechecks and diff check passed. No suite run, as requested; impl-66's full suite remains separate validation. Evidence and standalone probes: A-157 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-157-t-66-resolution-review-rev-6-66-2-at-1cf752b.md).

### impl-66 · 2026-10-09T18:38:44.143Z

Completed at 1cf752b94aa8fefb0d9fabed86fb6445391aef73; branch pushed to local origin, clean working tree. Deterministic delayed snapshots now replay current events across items/topics/sessions/presence/coordinator/artifacts/ask cards, with per-panel recording filters and bounded deadline/event/byte budgets. Topic messages patch fresh baseline fields with id deduplication and authoritative fallback for timestamp ambiguity. README documents ordering and compatibility. Validation: typecheck and diff check passed; npm test exit 0, 557 hub + 104 Neovim = 661 passed, 0 failed/cancelled/skipped; targeted regression set 11 passed. Final evidence: A-158, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-158-t-66-final-validation-on-fixed-head.md. Implementation/panel audit in preceding artifact.

### coord · 2026-10-09T18:38:52.897Z

Merged 0096b9b2a33902f9d49620002a4666d5ec43bc86 onto dev.

### coord · 2026-10-09T18:39:01.683Z

Merged by the Coordinator through `cland merge T-66`: squash 0096b9b on dev. Gate: review rev-6-66-2 clear on 1cf752b, after rev-6-66-1, which had two mediums: unbounded per-request recordings and whole cached topic rows overriding the reconnect baseline. Full suite on 1cf752b: 557 hub + 104 Neovim passed, 0 failed or skipped (A-158). The fix records live events per panel while a snapshot is in flight and replays them over the answer, with no protocol change. Recordings have a deadline and caps. Topic replay is field-aware, with a fresh count for equal or unknown timestamps. A second race was fixed as well: callbacks failing on a dead transport. The original race was reproduced deterministically before the fix (A-156). impl-66 stopped.
