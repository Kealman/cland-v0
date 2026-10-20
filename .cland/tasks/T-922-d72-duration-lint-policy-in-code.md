---
id: T-922
kind: task
title: D72 duration-lint policy in code (legacyOwner, 31-day legacy-owner allowances), landed before T-915's manifest
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-673
branch: t/T-922-d72-duration-lint-policy-in-code
created: 2026-10-19T23:49:43.254Z
updated: 2026-10-20T00:03:52.466Z
closed: 2026-10-20T00:03:52.466Z
---

## Summary

D72's duration-lint policy (the legacy owner read from `budget.legacyOwner`, defaulting to E-677, and up to 31-day dated allowances for the legacy owner) has to be live in the hosting hub before T-915's manifest can pass admission. The hub refuses `cland verify` and merge admission with the old lint ("duration allowance needs valid dates at most seven days apart"). This ticket lands the lint code alone, with the current manifest unchanged, so it is admissible under the old lint. Then a hub restart puts it live and T-915 can land the data.

## What to build

Take the D72 lint, test and doc changes from T-915's branch (`origin/t/T-915-switch-duration-budgets-from-report-to`, impl-915 names the commits), without any `hub/test/durations.json` change. Defaults keep today's behaviour exactly: no `legacyOwner` means E-677, and other owners keep 7 days.

## Acceptance criteria

- [x] C1. With the current dev manifest, lint and budget results are identical before and after (replay of A-6792, A-6795 and A-6796 shows the same lines).
  - done: impl-922 · 2026-10-19T23:51:12.262Z
  - verified: rev-31 [reviewer] · run rev-20261019-922-source · 2026-10-19T23:52:11.558Z · commit 7539a67dda0b89efca8aef680467e2fce1cad302
  - verified: rev-31 [reviewer] · run rev-20261019-922-final · 2026-10-19T23:59:11.849Z · commit 7539a67dda0b89efca8aef680467e2fce1cad302
- [x] C2. Lint tests prove that `legacyOwner: "E-880"` accepts E-880 legacy entries and E-880 dated allowances up to 31 days, refuses 32 days, and refuses 8 days for any other owner.
  - done: impl-922 · 2026-10-19T23:51:12.847Z
  - verified: rev-31 [reviewer] · run rev-20261019-922-source · 2026-10-19T23:52:11.558Z · commit 7539a67dda0b89efca8aef680467e2fce1cad302
  - verified: rev-31 [reviewer] · run rev-20261019-922-final · 2026-10-19T23:59:11.849Z · commit 7539a67dda0b89efca8aef680467e2fce1cad302
- [x] C3. docs/agents/tests.md describes D72, and a mode-free verify at the reviewed head is green.
  - done: impl-922 · 2026-10-19T23:58:44.774Z
  - verified: rev-31 [reviewer] · run rev-20261019-922-final · 2026-10-19T23:59:11.849Z · commit 7539a67dda0b89efca8aef680467e2fce1cad302

## Comments

### impl-922 · 2026-10-19T23:51:12.152Z

Policy-only extraction from aebfa979 committed/pushed at 7539a67dda0b89efca8aef680467e2fce1cad302. Four changed files; hub/test/durations.json identical to origin/dev (SHA256 4d24ca00cdff14ca441648bd6876aa96212019f223a97d4d80734f4349babbda). C1 receipt A-6837 and script A-6838 prove identical lint/checker/regression/report/merge-budget results on all three original logs. Focused suite-duration-budget 9/9 (~0.194s total), durations 17/17 (~2.296s total); npm run check and npm run test:tiers pass. D72 tests fail on prior code and pass with the extracted policy. Docs keep current report mode. QA policy none; source review before mode-free verify.

### rev-31 · 2026-10-19T23:52:11.558Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-922-source
commit: 7539a67dda0b89efca8aef680467e2fce1cad302
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6839: Standards and Spec clear, no findings. Four policy/test/doc files only; duration manifest byte-identical to pinned base e80e101e (SHA256 4d24ca00cdff14ca441648bd6876aa96212019f223a97d4d80734f4349babbda). All current legacy owners/default report remain E-677 and current dated spans are seven days; unchanged checker functions and deeply equal A-6837 complete replay results establish C1. Independently matched raw unique timing counts 2932/2920/2481 for A-6792/A-6795/A-6796. C2 source controls prove E-880 legacy ownership and provenance/owner refusals, 31-day acceptance/32-day refusal, other-owner 8-day refusal/7-day acceptance; existing reason/date restrictions retained. Docs accurately describe D72 and leave report mode pending T-915. C3's documentation portion checked, but same-head configured mode-free green remains pending. Implementer may verify this exact unchanged head; audit the two new T1 identities' actual 5/5 receipts and full raw resource/duration diagnostics afterward. No full task-head run requested.

Criteria: C1 verified, C2 verified.

### impl-922 · 2026-10-19T23:58:49.377Z

C3 implementation complete: same reviewed head 7539a67dda0b89efca8aef680467e2fce1cad302 passed mode-free run 654e18f4-240b-422a-8dbc-1ad5a0173fb2, A-6848. 1915 tests passed, zero failures/cancelled/skipped/TODO. Both new D72 tests have explicit 5/5 load receipts at log lines 42316 and 42322. Linux x64 droplet c-8 lon1, lifetime 349 s, cost $0.0243. Awaiting Reviewer evidence verdict; head unchanged.

### rev-31 · 2026-10-19T23:59:11.849Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-922-final
commit: 7539a67dda0b89efca8aef680467e2fce1cad302
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6850 independently audits complete A-6848 at unchanged source-clear 7539a67d. Mode-free run 654e18f4 exits 0: 1915 ordinary passes, 10 repetition passes, zero nonpasses. Both new D72 controls have five distinct passing repetitions and explicit 5/5 at lines 42316/42322; maximum bodies .004419912/.004186580 s, whole-file max .501449241 s within T1 file budget. Host check/typecheck/lint passes; no resource mismatches, hard duration failures, overruns or regression records. One unrelated report-only missing file baseline remains visible. C1/C2 unchanged-manifest replay and policy source conclusions remain current from A-6839; C3 docs plus fresh same-head gate established. All claimant done marks confirmed. C1–C3 verified; Standards/Spec no findings. T3 remains periodic/integrated, not task-run evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T00:03:52.466Z

Merged bb745f124fb984f3ec5dc97c6a641bfee1e4131d onto dev.
