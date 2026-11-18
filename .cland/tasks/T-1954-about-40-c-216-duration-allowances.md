---
id: T-1954
kind: task
title: About 40 C-216 duration allowances expire 2026-11-23 00:00 UTC (plus four on 2026-11-24); renew with current evidence or replace before they fail every suite
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1611
branch: t/T-1954-about-40-c-216-duration-allowances
created: 2026-11-18T00:26:52.896Z
updated: 2026-11-18T03:29:44.028Z
closed: 2026-11-18T03:29:44.028Z
---

## Summary

Periodic dev T3 6cc0ea11 at 85a289f6d (2026-11-18 00:26Z) warns "duration allowance expiring within 5d" for about 40 allowances owned by C-216 that expire 2026-11-23 00:00 UTC. They cover claude-code-remote, host-agent-restart, host-destroy/relaunch/restart/revoke/survival/tunnel-outage/watchdog natives, login-add/capacity/card-signin/resignin/signed-out/snapshots, scenarios/integrated-v04, session-native-lifecycle, state-paths-lint, suite-timeouts and web hosts-view. Four more expire 2026-11-24: T-1576's, two of T-1935's and T-1660's. T-1939 removes T-1660's. An expired allowance fails every suite that runs its test (T-1879), so after 2026-11-23 every batch, verify and cover would go red.

## What to build

For each expiring allowance, decide with current timings from the latest green covers and dev T3 runs (A-20923 Linux, A-20929 macOS, A-20961): renew it with a new expiry and an updated reason citing the measured worst sample (cap 1.5x), or drop it where the test now fits its budget. Keep owners on open containers. File follow-ups only where a test needs a real speed fix.

## Acceptance criteria

- [x] C1. No allowance in hub/test/durations.json expires before 2026-12-08, and each renewed entry's reason cites the run and worst sample it was sized from (test: the duration lint and a scan for expiry dates).
  - done: impl-1954 · 2026-11-18T01:00:57.492Z
  - verified: rev-35 [reviewer] · run rev-35-1954-source-1 · 2026-11-18T01:07:15.935Z · commit 8446a7788f1615d949de0d66240ad08a4f32543a
  - verified: rev-36 [reviewer] · run rev-36-1954-delta-1 · 2026-11-18T02:09:47.065Z · commit f55750d5e6f5fbf405dee9abfcccb043ac3fd23e
  - verified: rev-36 [reviewer] · run rev-36-1954-final-1 · 2026-11-18T02:40:58.924Z · commit f55750d5e6f5fbf405dee9abfcccb043ac3fd23e
- [x] C2. Dropped allowances are shown to fit their budgets in the cited runs, and `npm run test:tiers` plus every durations*.test.ts pass (test).
  - done: impl-1954 · 2026-11-18T01:00:58.917Z
  - verified: rev-36 [reviewer] · run rev-36-1954-final-1 · 2026-11-18T02:40:58.924Z · commit f55750d5e6f5fbf405dee9abfcccb043ac3fd23e

## Comments

### impl-1954 · 2026-11-18T00:30:12.472Z

Data-only duration renewal: 56 expiring entries audited against A-20923 (Linux stage), A-20929 (macOS one-worker stage) and A-20961 (Linux dev); 35 renew, 21 drop. Owners migrate C-216 to open E-880 under D72, approved by Coordinator. No contract shape or policy change. Consumers: shared suite-durations reader/checker and tier lint, suite runner/planner/projections, immutable candidate lint, duration refresh CLI and durations*.test.ts; config-key search captured in evidence. T-1660 entry remains owned by parallel T-1939; C1 scan exception approved by Coordinator. T4 startup-task-pages-soak removal is safe because budget.T4 is null (no duration budget).

### rev-35 · 2026-11-18T01:07:15.935Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1954-source-1
commit: 8446a7788f1615d949de0d66240ad08a4f32543a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20984 full source clearance at Git tree09ae65d914f5076164f13210904a013f7ea4b96f / manifest blob5148092234dce34ea32c1504f93552e5d224b86f against fixed base98c597e0c1efc867c5e6e99ad789f6098223a4c3. Standards0 / Spec0. Only56 allowance keys change:35 renewals,21 removals; all other maps/keys, report mode, baselines and legacy entries unchanged. Independently streamed original A-20923/A-20929/A-20961:166 selected passing timing samples support all worst receipts/rounded1.5x caps;20 removals fit their tier budgets and one T4 has null/no budget. Every tier/budget agrees; two ordinary file-sum floating-point differences do not affect caps. E-880 and C-327 open; approved Nov18-Dec18 dates span30days under D72. C1 verified under Coordinator084e6dec's explicit single T-1660 exclusion, not a literal all-entry scan claim. Local candidate raw checks support53/53 across all four durations*.test.ts, tiers/lint/typecheck exit0 reported; precommit invocation hashes/native signals remain unknown, no new-head configured run. C2 runtime settlement pending configured evidence. A-20981 baseline correction, high-load first helper round, slot retraction/finish permission and existing130 report-only findings remain explicit. Lead may request Coordinator window; if instructed conditional T-1939 dev merge occurs, fresh source review/literal scan before verify. No Reviewer execution/edits, QA none.

Criteria: C1 verified.

### rev-36 · 2026-11-18T02:09:47.065Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1954-delta-1
commit: f55750d5e6f5fbf405dee9abfcccb043ac3fd23e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21028 delta source clearance at Git tree a09c071ac1bf1cbf1fe40ce281231e701998feb1 / manifest blob 31eca278d1307f98455b11b26b9c6464603e50e5, compared with prior clear 8446a7788f1615d949de0d66240ad08a4f32543a/A-20984. Standards 0 / Spec 0. Coordinator-directed dev merge fd2f1d484 resolves durations.json by removing only the T-1660 compiler allowance (0 additions/7 deletions vs prior manifest); all 35 measured renewals, 21 earlier removals and other manifest sections remain unchanged. All 35 reason/cap calculations independently match rounded 1.5x worst samples; E-880 and C-327 remain open. Literal recursive committed-data scan: 170 allowances, 160 dates (35 Dec18, 125 Dec17), zero expiries before Dec8, no exclusion; ten unchanged undated legacy entries remain explicit. C1 verified at the new head. Existing full timing audit A-20984/166 selected samples remains the unchanged source basis, not a new execution. A-21015–A-21017 positively retain all 53 named local passes across four duration test files (23 T3 + 19 T3 + 11 T1), with no skips/cancellations; tiers/full lint/typecheck exit0 in A-21018–A-21020. A-21022 records post-resolution/precommit ordering, command/cwd and unavailable invocation tree/native inventory facts. A-21014 stays discarded pre-resolution history. No after-commit configured verification; C2 final runtime settlement remains pending same-head evidence. Report-only advisories retained, no gate switch or new allowance policy. Pin released; lead may request the Coordinator's mode-free verification window at this exact reviewed head.

Criteria: C1 verified.

### rev-36 · 2026-11-18T02:40:58.924Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1954-final-1
commit: f55750d5e6f5fbf405dee9abfcccb043ac3fd23e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21033 final settlement for same-head configured run b5e00e8e-f429-4fce-bee7-1a4f830a295b / A-21031, prepared verification tree 66179273dc3c94b3a46e6f61c8bb0b87e519cd53, source Git tree a09c071ac1bf1cbf1fe40ce281231e701998feb1. Standards 0 / Spec 0. Hub structured verify passed at reviewed head; log command completions T0/T1/T2/selected T3/Web all exit0. Independently streamed positive receipts and exact expected file sets: 224/224 T1, 430/430 T2, 55/55 Web, two selected T3 files/10 cases; 711 base file envelopes and 6695 base test finishes, all pass, zero unmatched starts/nonpass, including 145 nested and 6550 top-level timing records. Separate 42 site identities each have 5/5 proofs (210 scoped load passes), not added to base totals. C1 retains the literal no-exclusion expiry/source clearance A-21028. C2 combines unchanged historical removal measurements/A-20984, all 53 named post-resolution local duration-tool passes plus tiers exit0 in A-21015–A-21022, and this exact-head configured result. The configured run independently repeats the 11 T1 duration cases with matching timing/file outcomes; durations.test.ts and durations-runner.test.ts are UNEXECUTED here and their 42 T3 passes remain explicitly local Darwin/precommit evidence, never relabelled Linux. The required criterion has no Linux-only constraint. Selected compiler and nine restart cases pass; three removed-history allowances' cases remain below their 10s T3 budget despite generic report-only 5s notices. A-21014 stays discarded pre-resolution history. Remaining 268 T3/17 T4 unexecuted under merge/occasion policy. Linux x64 droplet Node24.21.0/Neovim0.12.5, cached:null; actual browser receipt35784/provenance38351 pins HeadlessShell1248/ChromeTesting156.0.8078.4. Reporter/budget/lint advisories remain report-only; no speedup/full-tier claim. Source clean/unchanged. C1/C2 verified, evidence hold released; ready/merge belongs to hub/lead.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T03:29:44.028Z

Merged 5718742e402c8d519ebfc120f4d13f729f3bec02 onto dev.
