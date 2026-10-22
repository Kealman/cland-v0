---
id: T-1132
kind: task
title: "The Sessions area: groups, rows and the unfolded row"
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
  - T-1147
topic: topic-860
branch: t/T-1132-the-sessions-area-groups-rows-and-the
created: 2026-10-22T15:16:15.097Z
updated: 2026-10-22T18:01:26.879Z
---

## Summary

The Sessions area shows the hub's merged session rows in the groups Yours, Waiting, Busy, Idle and Stopped with their counts and folds remembered per client, the rows of P22, and the selected row unfolded in place with what it waits on.

## Parent

E-418 (§3.2 the Sessions area, P22; v0.1 §3.11; v0.1.2 §3.4 and §3.5; tracer step 1).

## What to build

- **The header** carries each group's count (waiting, busy, idle, yours) and the archive toggle; Launch a session and New Aide join it in the launch slice.
- **The groups**, in order: Yours (the live Aides), Waiting, Busy, Idle and Stopped, each a fold with its count, its folded state remembered in this browser. Stopped shows the latest 20 with the count of the archived; `A` or the toggle shows the archived sessions (`session.list` with `archived`). A stopped Aide is under Stopped.
- **A row** (P22): the state glyph, the name, the role in its role colour, the harness, the model and the account, the item (the claim; a verifier's latest hold with its role and +N; a requested item dimmed until the hold exists, v0.1.2 §3.4), the state words with their age, and the usage (the cost, else the tokens).
- **Selection.** `j`, `k`, ↓ and ↑ move it; the selected row unfolds in place with what the session waits on (the pending approval's command in full, or the topic waiting for the human). The actions join the unfolded row in the actions slice. `gs` from an item lands on its session's row.

There is no Attach anywhere in the area. Rows come from the hub's merged session rows and their deltas; nothing merges sessions in the browser. The prototype's `web/src/sessions.ts` and `sessions/SessionsArea.tsx` on `prototype/web-shell` and Neovim's `state.lua` (`session_group`) define the grouping.

## Acceptance criteria

- [x] C1. With fake sessions in every state (an Aide, one waiting for approval, busy, idle and stopped), each of Yours, Waiting, Busy, Idle and Stopped lists its sessions with its count in the group and the header (Web test with the fake harness).
  - done: impl-1132 · 2026-10-22T17:21:52.924Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
- [x] C2. Idle folded stays folded after a reload, and folding sends no hub request (Web test).
  - done: impl-1132 · 2026-10-22T17:21:53.022Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
- [x] C3. A row shows the glyph, name, role, harness, model, account, item, state with its age and usage from the hub's merged row, with a verifier's hold and +N and a requested item dimmed (Web test).
  - done: impl-1132 · 2026-10-22T17:21:53.114Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
- [x] C4. The selected waiting row unfolds in place with its approval command in full, and no control in the area offers Attach (Web test).
  - done: impl-1132 · 2026-10-22T17:21:53.327Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
- [x] C5. Stopped lists at most the latest 20 with the archived count, and `A`, which `?` lists in Sessions, shows the archived sessions (Web test).
  - done: impl-1132 · 2026-10-22T17:21:53.416Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
- [x] C6. `web/README.md` gains a Sessions section with the groups, the row and the keys (docs).
  - done: impl-1132 · 2026-10-22T17:21:53.517Z
  - verified: rev-23 [reviewer] · run rev-20261022-1132-source · 2026-10-22T17:25:42.272Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final · 2026-10-22T17:35:50.938Z · commit 5d0175075741ab18ba9238edeb85f5fa93145c88
  - verified: rev-23 [reviewer] · run rev-20261022-1132-source-2 · 2026-10-22T17:50:21.736Z · commit b9ad283a78668bf2138eaeb4e24c224fe40dac23
  - verified: rev-23 [reviewer] · run rev-20261022-1132-source-3 · 2026-10-22T17:51:25.668Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0
  - verified: rev-23 [reviewer] · run rev-20261022-1132-final-2 · 2026-10-22T18:01:26.496Z · commit fd1c90510f7847e2b434397b992aad2b6207a2e0

## Comments

### impl-1132 · 2026-10-22T16:51:02.057Z

Test-first slice 1: web/test/sessions.test.ts uses the explicitly specified Web/fake-harness seam. Red on the T-1130 base: locator for Yours/my-aide timed out because SessionGroups is still a reserved slot. Implementing group projection and shared browser-only Fold next.

### impl-1132 · 2026-10-22T17:04:54.205Z

Implementation checkpoint 99141306 committed; merged origin/dev (including ec539bca shared area-slots duration allowance) before first source review. Non-archive targeted Web and static lint evidence are local macOS working-tree results, not a task verification receipt. Archive read is wired to T-1147’s documented additive merged rows field and remains blocked on that prerequisite; no verification enqueued.

### rev-23 · 2026-10-22T17:25:42.272Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1132-source
commit: 5d0175075741ab18ba9238edeb85f5fa93145c88
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-9385. Standards0/Spec0. Groups/counts/remembered folds, hub-row facts and requested dimming, selected waiting detail, physical navigation/gs and latest20/archive rows follow item scope. Archive consumes typed hub merged rows; no process/presence merge or Attach. Tests retain targeted boundary/final assertions and explicit enabled help labels; matching README verified C6. A-9379 local targeted evidence is qualified, no configured suite inferred. C1–C5 remain runtime-dependent pending exact-head mode-free verification with actual Web; after-stage QA separate.

Criteria: C6 verified.

### rev-23 · 2026-10-22T17:35:50.938Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1132-final
commit: 5d0175075741ab18ba9238edeb85f5fa93145c88
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, A-9391, A-9390/e201f65a exact source-clear5d017507. Parsed2510 ordinary tests/383 files pass; all T1/all hub+Neovim T2/actual Web pass. Five Sessions cases establishC1–C5 with accepted source; C6 docs refreshed. Group/fold, facts/full waits, stopped/archive andgs boundaries all pass; new maximum2.579s<4s trigger, no allowance required. Linuxx64 c-8lon1 workers2/Web4, host check2ab0e4ab reused/not repeated remotely. Web56.240s>40s report-only budget; generic diagnostics retained, no enforcing-budget/repetition/T3/T4/QA/full-cover claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-22T17:50:21.736Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1132-source-2
commit: b9ad283a78668bf2138eaeb4e24c224fe40dac23
scope: delta
findings: [{"severity":"low","text":"The area-module paragraph still calls Sessions an ID/title inventory and Header/SessionGroups empty slots; distinguish the now-implemented groups/header from still-pending strip/verify components.","file":"web/README.md","line":183}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source clear, A-9400; no high/medium findings. Both archive loader/thread cache survive connect resolution, both explicit help contracts retained, owned Sessions implementation/tests unchanged. C6 accurate Sessions section retained, with nonblocking L1 stale older foundation paragraph recorded. A-9399 local targeted summary is not configured evidence; C1–C5 require fresh same-head mode-free run. Any L1 edit changes the head and needs source review before verification.

Criteria: C6 verified.

### rev-23 · 2026-10-22T17:51:25.668Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1132-source-3
commit: fd1c90510f7847e2b434397b992aad2b6207a2e0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Documentation delta clear, A-9401. L1 resolved: foundation describes implemented header/groups, pending strip/verify and current page/drawer; archive state/refresh docs match code. Only README changed; prior full and merge audits retained. C6 verified at fd1c9051, C1–C5 await fresh configured same-head receipt. Parent targeted evidence remains labelled parent-head; no redundant execution needed for this prose correction.

Criteria: C6 verified.

### rev-23 · 2026-10-22T18:01:26.496Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1132-final-2
commit: fd1c90510f7847e2b434397b992aad2b6207a2e0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear, A-9406; A-9404/run51299c7b at fd1c9051. Parsed 2,525 ordinary tests/384 files pass; all T1/all hub+Neovim T2/actual Web complete. Five Sessions cases and Topics/palette/key-contexts/area-slots pass; C1–C6 verified with accepted source, prior low docs finding resolved. New maximum2.330s<4s trigger. Linuxx64 c-8lon1 workers2/Web4, host check37825f51 reused/not repeated remotely. Web55.310s>40s report-only budget; generic diagnostics retained, no enforcing-budget/repetition/T3/T4/QA/full-cover claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
