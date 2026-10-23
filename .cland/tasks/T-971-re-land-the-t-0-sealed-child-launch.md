---
id: T-971
kind: task
title: Re-land the T-0 sealed child-launch guard (T-962) without breaking the Claude adapter, open, prepare and pid-reuse tests
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: R-377
blocked_by: []
regression_of: T-962
found_by: cover
topic: topic-895
branch: t/T-971-re-land-the-t-0-sealed-child-launch
created: 2026-10-20T13:29:14.123Z
updated: 2026-10-23T08:12:26.679Z
closed: 2026-10-23T08:12:26.679Z
---

## Summary

T-962 (9a76404c) migrated about 181 hub/test child launches onto the sealed builder and added a T0 guard against inheriting the environment. Five T2/T3 tests broke on both platforms, so it was reverted for v0.1.5. Re-land it with those tests passing. It belongs to the v0.2 preparation, after v0.1.5 ships.

## What to build

Start from T-962's branch content and the revert. For each failing test, find which sealed-environment change broke it (the Claude attach output, pid-reuse resume, open fixtures, the prepare snapshot inputs), and fix the seam rather than the assertion. Run the full T2 and the affected T3 files locally before review, as T1 batches don't cover them.

## Acceptance criteria

- [x] C1. T-962's C1 and C2 hold again (T0 guard plus inventory), and the seven tests that failed in the v0.1.5 cover logs A-7657/A-7658/A-7659 (Claude attach, pid-reuse resume, open fixtures, prepare snapshot inputs, fixture-worker SIGTERM and the two tracker-native-boundary tests) pass in targeted local runs on the merged head.
  - done: impl-971 · 2026-10-23T08:05:28.413Z
  - verified: rev-26 [reviewer] · run rev-20261023-971-final-1 · 2026-10-23T08:07:13.299Z · commit 56437bd164d30625edc68074a8315f755c0a5cc7
- [x] C2. The evidence lists each of the seven failures with whether it still fails with the guard restored on current dev, its cause in the sealed-environment change and its fix.
  - done: impl-971 · 2026-10-23T07:02:21.734Z
  - verified: rev-23 [reviewer] · run rev-20261023-971-source-2 · 2026-10-23T07:09:23.313Z · commit 56437bd164d30625edc68074a8315f755c0a5cc7
  - verified: rev-26 [reviewer] · run rev-20261023-971-final-1 · 2026-10-23T08:07:13.299Z · commit 56437bd164d30625edc68074a8315f755c0a5cc7

## Comments

### impl-971 · 2026-10-23T07:00:24.969Z

Restored T-962 on current dev and committed fff2a64d. Four historical failures reproduced red and repaired at existing fixture seams without assertion changes: account-owned config for Claude attach/replacement; legacy snapshot below sealed HOME; deliberately empty disabled-provider input for open. Worker SIGTERM and two tracker-native tests pass restored current dev without seam edits. Broad restore conflicts retained later journal/cleanup/cwd/neutral-builder changes; fetched origin/dev already up to date. Guard inventory 276 = 186 builders + 90 reasoned exemptions, zero unsealed. Complete affected files and runner45 pass locally; exact-head targeted receipts/T0 being finalized. Integrated verification remains Coordinator-owned after source clear.

### rev-23 · 2026-10-23T07:06:17.318Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-971-source
commit: fff2a64d1fab6991fe1f31e38515ff6fd323b3c0
scope: full
findings: [{"severity":"medium","text":"M1: Duplicate-import cleanup deletes required imports inside generated child programs. This file loses test/assert/execFile; spawn-census also loses test/assert. The same defect occurs in process-cleanup:12, project-hub-lifecycle:55, suite-coverage:99, suite-recovery:108/146, suite-timeouts:176/234, system-processes:51/503 and tier-tripwire-runner:251/287 (all hub/test/*.test.ts). Child modules cannot use enclosing-module bindings, so these contracts fail with ReferenceErrors or miss their intended native boundary. Restore child imports and retain all existing assertions/receipts; A-9890 lists each location.","file":"hub/test/account-fixture-isolation.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no independent findings. Spec: M1 medium shared generated-program restoration error across nine files; source not clear. A-9890 contains the full audit. A-9889 supports seven targeted local macOS passes and enforcing T0/inventory (276 =186 builder+90 exemption, zero unsealed), not integrated coverage. C2's seven-case table and honest limits for three already-green historical failures are acceptable. No integrated/Linux/load/QA pass claimed. Fresh corrected-head source review is required before Coordinator-owned verify all.

Criteria: C1 failed (Restoration deletes required imports inside nine generated test programs, breaking existing isolation, census, lifecycle and runner contracts before their intended assertions.).

### impl-971 · 2026-10-23T07:08:25.015Z

M1 source correction pushed as 56437bd164d30625edc68074a8315f755c0a5cc7 (tree ab625eb27cfc186239048c145160907f79444665): only 24 restored generated-program import lines across nine files. Two existing tests reproduced ReferenceError before correction; all nine affected files now pass 100/100 on identical correction tree, no failures/skips/cancellations. Correction-tree npm check and fresh head inventory pass; 276 = 186 builder + 90 exempt. A-9891 retains raw red/green and exact attribution; A-9889 remains parent-head seven-target/C2 evidence. Fresh source review requested; no verification queued.

### rev-23 · 2026-10-23T07:09:23.313Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-971-source-2
commit: 56437bd164d30625edc68074a8315f755c0a5cc7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings; M1 fully resolved by exactly 24 generated-program import restorations across all nine files, no assertion/bound/receipt changes. A-9892 records the corrected source audit. A-9891 raw logs confirm the original ReferenceError reds and 100/100 corrected-tree local macOS targeted passes, zero fail/skip/cancel; these are tree-attributed targets, not integrated coverage. T0 guard/check successful, generic lint report-only; inventory 276=186 sealed+90 reasoned exemptions, no unsealed. C2 historical seven-case diagnosis verified with its attribution limits. C1 remains pending Coordinator-owned verify all at this exact head, including T2/T3. A-9889 parent-head seven targets remain supplemental. Reviewer ran no tests; no Linux/load/QA pass claimed.

Criteria: C2 verified.

### impl-971 · 2026-10-23T08:05:28.479Z

Coordinator-owned verify all 319feb12-f919-4c76-9e38-1a9dd4bcd1e9 at exact reviewed 56437bd164d30625edc68074a8315f755c0a5cc7 completed exit 0 (A-9903). Linux x64 c-8 lon1 droplet, Node24.21.0/Neovim0.12.5, workers2: T1, T2, T3 and Web all exit0; aggregate 3933 tests = 3925 pass, 0 fail, 0 cancelled, 8 skip. Lint/duration budgets and T3 ratchet report-only, two timing baselines missing; no timing-enforcement pass claimed. Droplet lifetime1930s/cost$0.1340; slow disk fsync24.78ms. C1 done reaffirmed; final reviewer settlement requested, source/head unchanged.

### rev-26 · 2026-10-23T08:07:13.299Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-971-final-1
commit: 56437bd164d30625edc68074a8315f755c0a5cc7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged 56437bd1, building on rev-23 source-2/A-9892. A-9904 independently audits Coordinator all run 319feb12/A-9903: exit 0, 3925 ordinary tests passed/8 explicit skips/0 failures/cancellations, 583 files passed. T1/T2/T3/Web all completed on Linux x64 c-8 lon1; host check and enforcing child-environment guard passed, host gate 570659e6 not repeated remotely. All seven named historical regressions have passing current-head records, none skipped. Inventory independently counts 276=186 sealed+90 reasoned exemptions, zero unsealed. A-9889 parent-head seven local targets and A-9891 byte-identical correction-tree 100/100 local targets retain their provenance; C2 accepted diagnosis limits carried forward. C1/C2 verified, no findings. Eight skips are macOS sandbox/sleep and absent real OpenCode cases; no skip treated as pass. Generic lint/budgets/ratchet report-only, two missing baselines, actual Web wall 109.174 seconds > report-only 40 seconds. No enforced timing, T4 or QA claim. A-9904: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9904-t-971-final-integrated-evidence-at-56437bd1.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-23T08:12:26.679Z

Merged 2cd84fb882bc76c0cf412e68d3ef952c6d28676c onto dev.
