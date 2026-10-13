---
id: T-199
kind: task
title: A lead's review or QA request reaches one verifier, not every holder of
  the role
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-199
parent: E-108
blocked_by: []
topic: topic-130
branch: t/T-199-a-lead-s-review-or-qa-request-reaches
created: 2026-10-10T17:03:52.868Z
updated: 2026-10-11T11:54:26.036Z
closed: 2026-10-11T11:54:26.994Z
---

## What to build

Since T-143 (37e693f) the Implementer clause tells the lead to send `review request T-<n>` to `reviewer`. Addressed by role, the hub delivers it to every live Reviewer: on 2026-10-10 impl-183's delta request at 0b5aa97 reached rev-10, rev-11 and rev-12, and rev-12 asked the Coordinator which one owns it. Two holds or two verdicts on one head are possible.

The request should reach one verifier: the item's previous reviewer when still live, otherwise one free pool member (crew policy `pool`, T-181). Either the hub resolves a role-addressed request to one holder, or the clause names the reviewer to pick and the tool exposes who that is.

## Acceptance criteria

- [x] C1. A lead's `review request` or `qa request` sent to the role is delivered to exactly one holder, the item's last reviewer (or QA) when live, otherwise a free one.
  - done: impl-199 · 2026-10-11T11:11:00.839Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-2 · 2026-10-11T11:16:35.759Z
- [x] C2. The sender sees which holder got it.
  - done: impl-199 · 2026-10-11T11:02:10.595Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-1 · 2026-10-11T11:07:31.332Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-2 · 2026-10-11T11:16:35.759Z
- [x] C3. A protocol test covers three live Reviewers and a repeat request on the same item.
  - done: impl-199 · 2026-10-11T11:02:10.822Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-1 · 2026-10-11T11:07:31.466Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-2 · 2026-10-11T11:16:35.759Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-199 · 2026-10-11T11:53:40.618Z
  - verified: rev-13 [reviewer] · run rev-13-20261011-199-3 · 2026-10-11T11:54:05.450Z

## Notes

Size S. Interim: the Coordinator told the leads to address the previous reviewer by name.

## Comments

### impl-199 · 2026-10-11T10:55:44.855Z

Implementing single-recipient verifier request routing at the hub send protocol seam. Tests will cover three live reviewers, sticky repeat requests, QA routing, and free-pool fallback; ordinary role messages retain broadcast behavior. Worktree created on dev.

### impl-199 · 2026-10-11T11:01:51.219Z

Protocol regression reproduced the three-Reviewer broadcast, then passed with single-recipient routing. Coverage now includes repeat requests before a hold and after a verdict, stopped previous verifier fallback, occupied/free pool members, QA verdict affinity, QA stage requests, and unchanged ordinary role broadcasts. Typecheck passes. No role clause or roles.toml changes; send tool description and workflow docs explain resolvedTo/empty.

### rev-13 · 2026-10-11T11:07:31.571Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261011-199-1
commit: 3abfe3f91c7b2ffb754c2bf73f45ef0298eadc77

Medium — hub/src/hub/core.ts:1821: last-verifier affinity reads file-ordered item.verdicts including source:file headers; a copied header with no writer can send fallback to a free holder instead of the live authentic prior verifier. A read-only extraction of the actual selector returns qa-2 for its genuine hub verdict, then qa-1 after appending a later file-only header. Use durable hub writer identity/order and cover copied/reordered comments.

C1 failed. C2/C3 separately verified with this run: resolvedTo and the three-Reviewer/repeat protocol assertions are supported. Independent typecheck and diff checks passed on clean pushed 3abfe3f. C4 remains pending; final readiness withheld. No edits or suite runs.

A-1203: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1203-t-199-review-at-3abfe3f-file-only-verdicts-break-prior-verifier-affinity.md records separate Standards/Spec reports and the isolated probe limits.

Criteria: C1 failed (File-only or copied last verdict headers displace the authenticated live prior verifier because affinity reads file-ordered item.verdicts rather than durable writer order.).

### impl-199 · 2026-10-11T11:11:22.231Z

C1 review finding fixed at a2762b1: affinity reads tracker_written_verdicts by durable insertion order and authenticated role/session identity, via a synchronous tracker routing accessor. Protocol regression moves real QA comments and appends a copied later header, waits for task.list indexing, and confirms actual qa-1 vs expected qa-2 red on old code, then green after the fix. verifier-routing 2/2 and typecheck pass. Origin/dev fetched/merged again (already current). C1 marked done again; corrected-head full suite will replace intentionally cancelled e5c89766/A-1207.

### rev-13 · 2026-10-11T11:16:35.759Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-199-2
commit: a2762b1a5dbc371f5e114bf109c5a7911268806c

No high, medium or low findings remain. Authenticated durable writer order and normalized identity now determine previous-verifier affinity; copied/reordered file headers no longer displace the live prior holder. The regression waits for indexed copied/reordered comments and asserts the authentic latest QA receives the request. Existing single-holder/free-pool behavior, resolvedTo, and three-Reviewer repeat coverage support C1–C3 at this exact head.

Independent typecheck and diff checks pass; local/pushed heads match clean a2762b1. C4 remains pending the fresh corrected-head full suite; A-1207 was intentionally cancelled on superseded 3abfe3f. A-1211: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1211-t-199-authenticated-verifier-affinity-at-a2762b1-c1-c3-clear.md records the separate axes. No reviewer edits or suite runs.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-199 · 2026-10-11T11:53:41.072Z

Final same-head full suite fda3f480 passed at a2762b1a5dbc371f5e114bf109c5a7911268806c: typecheck and npm test exit 0; 1443 tests, 1443 passed, zero failures/cancelled/skipped/todo. C4 marked done. Durable evidence A-1231: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1231-suite-fda3f480-1108-42cc-b211-2f97cce239bb-all-at-a2762b1.log. C1–C3 already freshly verified by rev-13; final C4 verification requested.

### rev-13 · 2026-10-11T11:54:05.450Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-199-3
commit: a2762b1a5dbc371f5e114bf109c5a7911268806c

No high, medium or low findings. C4 verified from complete same-head A-1231: typecheck passes, hub 1171/1171 plus Neovim 272/272, total 1443/1443, zero failures/cancellations/skips/todo, exit 0. Both verifier-routing regressions pass. C1–C3 same-head verification in rev-13-20261011-199-2 stands; all criteria are supported.

Clean local and pushed heads match a2762b1. No exception applied or additional tests needed. A-1232: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1232-t-199-final-c4-at-a2762b1-full-1443-1443-clear.md records separate axes and validation. No edits or reviewer suite runs.

Criteria: C4 verified.

### coord · 2026-10-11T11:54:26.036Z

Merged 4846a44b785a6e6ca9b03ec14c0e475903e4814c onto dev.
