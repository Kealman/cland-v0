---
id: T-2021
kind: task
title: Renew or remove the nine duration allowances expiring 2026-11-25 and 2026-11-26 before they fail every suite
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: topic-1672
branch: t/T-2021-renew-or-remove-the-nine-duration
created: 2026-11-20T00:42:02.741Z
updated: 2026-11-20T03:03:43.164Z
closed: 2026-11-20T03:03:43.164Z
---

## Summary

Nine duration allowances in `hub/test/durations.json` expire on 2026-11-25 or 2026-11-26 (00:00 UTC). An expired allowance fails every suite, including batches, covers and release runs, so they must be re-measured and then renewed, tightened or removed before 2026-11-24:
- 2026-11-25 (owner C-216):
  - `git-maintenance` "scratch Git helper drains a held descendant writer…";
  - `telegram-polling-restart` "Discord fresh history forwards newest 500 of 620…";
  - `suite-stage-cover` "after-stage gates require Mac and sharded Linux at one tree…".
- 2026-11-26:
  - `fake-claude-cleanup` orphan sweep (C-216);
  - `item-summary-scale` planned-stage task view (C-216);
  - `suite-retention-scale`: the file entry plus two live-mode cases (E-880);
  - `startup-listener-scale` listener binds (E-880).

## What to build

Re-measure each case on the Linux droplet batch timings and a quiet macOS sample. For each, either remove the allowance where the case now fits its budget, or renew it at about 1.5 times the worst sample with an owner item and the D72 span. Record the samples and the decision per identity.

## Acceptance criteria

- [x] C1. No allowance in `hub/test/durations.json` expires before 2026-11-27; suite-scale identities renew under E-880 with the D72 span, other renewals stay on C-216 at the lint's 7-day maximum, and each renewed or removed entry has its samples and reason recorded (evidence).
  - done: impl-2021 · 2026-11-20T00:55:06.558Z
  - verified: rev-36 [reviewer] · run rev-36-2021-source-1 · 2026-11-20T01:02:48.097Z · commit 4eecdf8d52e58aeaade7b727244f242aa00d3d16
  - verified: rev-36 [reviewer] · run rev-36-2021-final-1 · 2026-11-20T01:52:00.532Z · commit 4eecdf8d52e58aeaade7b727244f242aa00d3d16
- [x] C2. The durations manifest lint passes, and a suite run at the change shows no expired-allowance failure (test).
  - done: impl-2021 · 2026-11-20T01:48:29.898Z
  - verified: rev-36 [reviewer] · run rev-36-2021-final-1 · 2026-11-20T01:52:00.532Z · commit 4eecdf8d52e58aeaade7b727244f242aa00d3d16

## Comments

### impl-2021 · 2026-11-20T00:43:47.346Z

Preflight red: production lintDurationManifest at 2026-12-03 fails on the nine expiring allowances. durations.ts supports refresh only, retaining expiry metadata; surgical allowance edits needed. Linux batch and stage-cover samples located; native sampling awaits Coordinator slot.

### impl-2021 · 2026-11-20T00:52:35.587Z

Evidence A-21994 records all nine exact identities, passing Linux/native/covers, decisions and expiries. Six removals: three T3 cases comfortably below 10s and three T4 retention identities with no tier budget. Renew startup13.599s and planned-stage49.161s under E-880 through Dec21; stage-cover63.170s under C-216 through Nov27. Production manifest lint with authoritative owners passes now and through Nov26; full test:lint and typecheck exit0 on macOS arm64 Node24.21.0. Configured suite remains pending source review and a granted verify window.

### impl-2021 · 2026-11-20T00:56:03.663Z

Final correction: A-21995 supersedes A-21994. Source review requested at 4eecdf8d52e58aeaade7b727244f242aa00d3d16; two removals and seven renewals. Current report-mode replay of seven independent source groups has no failures; hypothetical enforce retains one pre-existing item-summary file32.774s>30s, no added failures. Full final lint/typecheck exit0; manifest lint current/future preflight passes. C2 suite receipt remains pending review-clear and a verify window.

### rev-36 · 2026-11-20T01:02:48.097Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2021-source-1
commit: 4eecdf8d52e58aeaade7b727244f242aa00d3d16
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 4eecdf8d5 / tree 2293355f1. Standards and Spec findings: none. A-22004 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22004-t-2021-corrected-source-clear-at-4eecdf8d5-supersedes-a-22002.md) is the full audit; it supersedes A-22002 only for exact checker-output spacing. Exactly nine allow keys change: two removals with retained baselines, seven measured 1.5x renewals. Other maps/baselines/tier budgets/report mode unchanged. Primary Coordinator 8c194cdd supports the Nov27 cutoff, C-216 7-day and suite-scale E-880 31-day spans; authoritative standing owners and all dates inspected. C1 verified from those facts and A-21995/A-22000. Independent streamed original logs match the selected Linux/macOS passing samples; native has nine ordinary passing case records across seven invocations, with requested/observed start loads and unknown invocation tree/native-signal/time fields retained. Git's controlled ancillary cleanup diagnostic and positive per-writer close/reaped receipts remain separate. The 192 T1 outcomes belong to the earlier draft; final full lint/typecheck and original independent seven-group production replay follow corrected allowance bytes. Replay result tables are assertion-derived; raw arrays unavailable. Current report failures are asserted empty; hypothetical enforce retains only the literal unchanged item-summary file overage 32.774 s > 30 s. No Reviewer tests, probes or checker rerun. C2 remains unchecked/unverified pending a configured suite at this head. Source clearance releases the review hold; obtain the Coordinator's verification window, retain this exact head, then return its result for final evidence settlement. This is no suite pass or slot grant.

Criteria: C1 verified.

### rev-36 · 2026-11-20T01:52:00.532Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-2021-final-1
commit: 4eecdf8d52e58aeaade7b727244f242aa00d3d16
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear at 4eecdf8d5, unchanged Git tree2293355f1; configured851459d3/A-22029 passed. A-22032 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22032-t-2021-final-same-head-clear-at-4eecdf8d5.md) contains the independent full-index/producer/provenance audit. T0/T1/T2/Web structured complete/exit0 receipts bind run/runtime tree2a3e699bb; duplicate identical T0 rows are not separate passes.730 executed files=234T1+441T2+55Web;7059 unique ordinary pass outcomes=6914 top-level+145nested, no load-gate outcomes/fail/cancel/skip/todo. Relevant expiry-warning, D72, expired-key positive-control, manifest-key and shipped-standing-owner cases visibly pass; no expired-allowance failure. Current full selector falls back to all T2. T3 deferred batch; no T4 proof. Uncached Linux x64 c-8 ams3/Node24.21/Nv0.12.5, HeadlessShell1248/Chrome156.0.8078.4; lifetime/cost are accounting, outer signal unprovided. Report-only budget/lint/skip advisories remain distinct from enforced timing proof. C1 source/evidence verification retained from A-22004; A-21995/A-22000 historical samples/draft failures remain separate, not current-head native measurements. Both done marks present; C1/C2 verified with this run, findings[]. No Reviewer runtime/edit or additional verification requested. Hold released; hub ready event handles Coordinator notification.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T03:03:43.164Z

Merged fac711e94de9673f10bc372ba3972c511e22539a onto dev.
