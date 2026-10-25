---
id: T-1028
kind: task
title: launcher-component free-text case times out waiting for Insert mode under load-gate pressure
state: open
status: review
size: S
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-882
found_by: cover
topic: topic-1037
branch: t/T-1028-launcher-component-free-text-case-times
created: 2026-10-20T20:13:05.016Z
updated: 2026-10-25T10:54:36.877Z
---

## Summary

`nvim/test/launcher-component.test.ts` "failed or empty model answers keep free text with a one-line reason" timed out waiting for Insert mode (`the launcher model field accepts Insert input: not within 15000 ms`, 15.33 s against its 2 s T2 budget) in the Linux stage cover 90cd4eeb at 44097bad (A-8033), while the load gate ran five repetitions of other Neovim files beside it. The test file and the launcher are unchanged since T-882, and the same case passed in stage cover 888e98da at 7c1aeae9 an hour earlier.

## What to build

Make the case wait on the state it asserts (the model field's mode or buffer state through a completion receipt, per rule 9) rather than a 15 s wall-clock poll, and check whether its 2 s T2 budget is realistic (T-882 history).

## Acceptance criteria

- [ ] C1. The case passes 20/20 under the load gate's parallel repetitions on a droplet, waiting on a state receipt, not a wall-clock poll (receipt named in the item).

## Comments

### coord · 2026-10-20T20:19:02.324Z

Flaky-rerun rule applied 2026-10-20 20:22Z: the case passed 5/5 alone on macOS arm64 locally at 44097bad (node --test --test-name-pattern, quiet machine); one resubmit of the Linux stage cover follows. Linux evidence of the flake: stage cover 90cd4eeb (A-8033).

### impl-1028 · 2026-10-25T10:34:46.539Z

Triage evidence A-11669 points at launcher-component.test.ts:208's Insert-mode eventually poll. Worktree inherited clean. Pre-agreed seam from C1: the existing T2 owned headless Neovim/recorded stub launcher case, observing native mode/buffer completion and the exact outbound session.launch.model. Plan: arm a bounded native completion receipt before opening/typing, retain free-text/reason/submitted-model assertions, prove the replaced wait's failure with a deterministic regression before making it pass. No production reply/schema/policy change intended.

### impl-1028 · 2026-10-25T10:42:21.064Z

Source ready at 1bee70f99226ff89b04ca86508f4428a4d449e18 (pushed origin task branch). A-11747 records native launcher-model-input/TextChangedI receipt, exact model/name/role/row/mode assertion, negative Normal-mode control, and local evidence. T2 launcher-component passed 12/12 on macOS arm64/pinned headless Neovim v0.12.5; owned case 0.304262s. Typecheck and tier manifest passed; test lint report-only (0 refusals), wording guard and diff check passed. New mapped T4 identity: nvim/test/launcher-input-load.test.ts::launcher Insert receipt holds 20/20 under parallel load, child launcher case 1 through 20, batches of 2; requires 20 case completions/40 input receipts with every original reason/popup/outbound assertion. Stress guard deliberately not run locally; source review then one mode-free droplet task verify supplies C1 evidence. C1 remains pending that receipt; QA scope none. No production/shared-contract change.

### rev-26 · 2026-10-25T10:44:30.752Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1028-source-1
commit: 1bee70f99226ff89b04ca86508f4428a4d449e18
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-11748, Standards0/Spec0. Native observer armed before keys requires exact TextChangedI name/role/model/row/Insert-mode receipt under separate 5s bound, retaining error/empty reasons, no popup and exact outbound model assertions. Shared owned recorded-client case remains T2; mapped T4 runs 20 independent native cases in pairs, requires all 20 completions/40 receipts, no extra T4 repetitions. Fixture drain-before-directory and sealed env retained; no product/wire/keymap/permissions change. A-11747 local summaries/Normal-mode sensitivity control are supplemental, not reproduced Linux flake or full raw/configured proof. C1 runtime pending and intentionally not claimant-done yet. Submit ordinary mode-free exact-head configured verify, preserve actual T4 20-child/40-receipt/no-skip proof and T2 timing; T4 has no budget/stanza, so >3s alone needs no allowance. Preserve original local receipt limits without transcription reruns.
