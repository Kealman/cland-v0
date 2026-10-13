---
id: T-169
kind: task
title: "The needs-you chip and inbox header show the hub's needsYou only: Neovim
  computes nothing (T-165 follow-up, 112 from notifications)"
state: closed
status: done
rank: 1300
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: E-110
blocked_by: []
topic: topic-77
branch: t/T-169-the-needs-you-chip-and-inbox-header-show
created: 2026-10-10T10:12:46.650Z
updated: 2026-10-10T10:31:04.531Z
closed: 2026-10-10T10:31:04.563Z
---

## Parent

T-110 (Threads that read). A follow-up to T-165 (merged fdadb7b) that the human reported on the live build on 2026-10-10, after an editor restart.

## What to build

The chip still reads "needs you 112", and the inbox header "112 need you", while the hub says `needsYou` 0. `cland inbox --json` shows asks 0, approvals 0, waiting 0 and notifications 427.

The cause is `state.needs_you()` (nvim/lua/cland/state.lua:315). It adds every `death` and every `not clear` verdict among all notifications. Notifications never resolve, so the count grows without bound.

The chip and the inbox header show the hub's `needsYou` and nothing else; Neovim computes nothing. Before the hub has said, the chip shows no number (or the last known value), never a local count.

## Acceptance criteria

- [ ] The chip and the inbox header read the hub's `needsYou` only (hub.status and inbox events); `state.needs_you()` adds nothing locally.
- [ ] A stub-hub test with hundreds of notifications of every kind (deaths, not-clear verdicts, clear verdicts, releases) and hub `needsYou` 0 asserts that both show 0, and that both follow the hub's value when it changes.
- [ ] THREAD-009/010 and the T-165 regressions are updated to this rule.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

High priority: a trust issue for the human. Size XS.

Spec v0.1 §3.5 lists "verdict not clear" and "session died" as now-layer inbox events. If they should count, the hub's `needsYou` must count them, with a resolution rule (an acknowledged death, a later clear verdict); Neovim must not. That is a separate decision.

## Comments

### impl-169 · 2026-10-10T10:15:04.224Z

Reproduced with `node --test --test-name-pattern='notification floods' nvim/test/shell.test.ts`: hub needsYou 0 plus 427 mixed notifications rendered chip/header 143. Count source is state.needs_you(): row lengths, waiting-topic fallback, death/failed-verdict additions; state.answered also decrements locally. Stub-hub UI seam is the brief’s pre-agreed regression seam. The cause is already identified and deterministically reproduced, so skipping speculative diagnosis probes.

### impl-169 · 2026-10-10T10:18:10.733Z

Committed implementation and regression updates as b1f3a72. Removed row/notification/topic counting and local answer decrement; nil remains unknown until hub supplies needsYou. Targeted flood regression, unknown/status/local-answer regression, THREAD-009 and THREAD-010 all pass; npm run typecheck passes. Full npm run test:nvim is waiting on the machine suite lock (pid 70715).

### rev-8 · 2026-10-10T10:21:53.677Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-169-1
commit: b1f3a727f36ca6e9f5b845c3dd873fa7b39d90eb

Low — nvim/README.md:32: old verdict/death count wording contradicts the hub-only needsYou contract and interim rule. Supplemental README-only 39ff92b delta was inspected by both axes and resolves this note.

No high or medium findings. Count writers copy numeric hub fields only; nil/omitted values are safe, local answers do not adjust the count, and startup/reconnect snapshot replay preserves subsequent inbox events. Native Lua probes passed unknown displays, 427 notifications with hub0 at80/120, local-answer/missing-field retention, and newer inbox replay over older status. A-561 reports targeted checks and typecheck passing; full Neovim suite remains pending in reviewed evidence. No reviewer edits or suites.

A-562: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-562-t-169-review-hub-owned-needs-you-count-clear.md

### rev-8 · 2026-10-10T10:22:35.465Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-169-2
commit: 39ff92bb5a7a181d199c16b2461fc6a096b2d8bf

No findings. The README-only delta resolves A-562's low documentation inconsistency. Standards and Spec are clear at current head 39ff92bb5a7a181d199c16b2461fc6a096b2d8bf. Prior production review, native probes, and targeted evidence carry forward because production Lua is unchanged. Full Neovim suite remains pending in reviewed A-561 evidence. No reviewer edits or suites.

A-563: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-563-t-169-current-head-review-clear.md

### impl-169 · 2026-10-10T10:30:44.889Z

Final validation on current clean head 39ff92bb5a7a181d199c16b2461fc6a096b2d8bf: npm run typecheck exit 0; locked npm run test:nvim exit 0, 209 passed / 0 failed / 0 skipped (160.33s run after 636.01s lock wait), Node v24.21.0 first on PATH. THREAD-009/010 and new flood/startup/status/local-answer regressions pass within full suite. Pushed current head to local origin; official review clear on this head in A-563. Final validation artifact records completion of A-561’s pending requirement.

### coord · 2026-10-10T10:31:04.531Z

Merged 2c40d93814bdf8146d6132382072f645de8787de onto dev.
