---
id: T-1988
kind: task
title: Retire the 2026-11-18 duration allowances for T-1646 and T-1984's synthetic-tracker cases by making their fixture setup cheap, before they expire on 2026-11-25
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1882
blocked_by:
  - T-1646
  - T-1984
topic: topic-1641
branch: t/T-1988-retire-the-2026-11-18-duration
created: 2026-11-18T20:41:33.453Z
updated: 2026-11-19T02:50:46.032Z
---

## Summary

On 2026-11-18 three exact-case C-216 duration allowances were added so the hub CPU fixes could land quickly. All expire 2026-11-25, and an expired allowance fails every suite (T-1879).
- T-1646 C1: `hub/test/tracker-summary.test.ts` "ten moving branches in a 1650-item tracker …", 8.5 s (droplet 5.553 s).
- T-1646 C2: the item-summary-scale responsiveness case, 19 s (local 8.9 s, ×1.4 droplet ratio).
- T-1984 C1: `hub/test/stage-closure-component.test.ts` "unrelated freshness answers do not fan out to stage-cover dependents", 16 s (droplet 10.381 s).
Each time goes into building a 1,500–1,650-item synthetic tracker, not the asserted work.

## What to build

Build these synthetic trackers cheaply: one owned transaction with reused prepared statements (T-1807's corpus went from 8.6 s to under 1 s this way), or a shared seeded fixture per file. Keep every work-count bound, oracle and behaviour bound unchanged, then remove the three allowances.

## Acceptance criteria

- [ ] C1. Each of the three cases runs under its normal duration budget on a droplet verify, with its assertions unchanged (evidence).
- [x] C2. The three allowances are removed from `hub/test/durations.json` before 2026-11-25 (test: the duration lint passes without them).
  - done: impl-1988 · 2026-11-19T02:50:18.550Z

## Comments

### coord · 2026-11-19T02:34:03.237Z

Reported by impl-1952 during T-1952 (2026-11-19): the generated-stanza paragraph in docs/agents/tests.md tells you to name the nearest open container as the allowance owner. Admission refuses epic owners and requires a standing container such as E-880; the lint said "duration allowance has epic owner E-1883 ... use a standing container". The printer guidance this item adds must name a standing container, and the docs paragraph should match.

### coord · 2026-11-19T02:34:25.811Z

Correction to my earlier comment: the printer and docs mismatch is filed as its own item, T-1993 (Bugs). T-1988's scope is unchanged.

### impl-1988 · 2026-11-19T02:44:34.874Z

Implementation: each churn file owns a separate scratch root and single-consumer tracker/hub; seed/acquisition/initial warm refresh are file setup, observed moved-tip refresh and all 40 reply rounds remain in callbacks. Coordinator confirmed this scope in 70fd9651. Stage case batches 16 file writes and uses shared seedTransaction around public rescan, restoring methods before settlement observation. Existing assertions/work-count/oracle/behaviour bounds unchanged. Shared helper consumers searched: tipChurnFixture only tracker-summary and item-summary-scale; seedTransaction only fixture and stage case; no production/wire contract changes. Three exact allowances removed, unrelated allowances untouched. Local darwin/arm64 Node24.21: full tracker-summary 23/23, file4.531s (case0.106s); item-summary-scale4/4, file19.323s (case0.915s); stage-closure11/11 file5.490s (case2.392s). These are targeted local evidence, no browser, not droplet criterion proof. Broken controls: broad invalidation fails summary bound 3300>100 (hydrated8400>400); per-answer fan-out fails 1500>1; three 1100ms delayed task.view replies fail p95 at1118.466ms. All temporary production edits restored. Lint/typecheck and source review pending; droplet verification awaits source verdict/window.

### impl-1988 · 2026-11-19T02:49:29.083Z

Local evidence published after the shared scan-and-publish helper's positive-control scan: A-21502, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21502-t-1988-local-fixture-validation-and-broken-controls.md. Final source typecheck passed. Individual cases also pass in reverse file order with separate roots/processes; artifact records case and whole-file scopes, platform, ambient loads and expected broken controls. No droplet or browser evidence claimed. Current origin/dev fetched and merged again, already up to date. Final test:lint rerun is still completing; source review follows it. C1's droplet evidence remains pending.
