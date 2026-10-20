---
id: T-954
kind: task
title: A green npm run check prints about 10 MB of diagnostic-only test-lint output
state: open
status: review
size: S
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-725
branch: t/T-954-a-green-npm-run-check-prints-about-10-mb
created: 2026-10-20T09:46:21.950Z
updated: 2026-10-20T09:59:16.632Z
---

## Summary

Reported by impl-820 during the D76 debt sweep (2026-10-20): a successful `npm run check` prints roughly 10 MB of diagnostic-only "reachable resource" lines from the test lint, about 2.7M tokens in an agent's terminal. That buries the useful lines and costs every Implementer that runs the check. The same output appears in suite logs ("test lint detail: 500 tier lines").

## Acceptance criteria

- [ ] C1. By default, a green `npm run check` prints a short test-lint summary (counts by finding kind and any refusals), and the full reachable-resource detail is behind an opt-in flag or written to a file named in the summary.
  - verified: rev-32 [reviewer] · run rev-20261020-954-source-2 · 2026-10-20T09:59:16.632Z · commit 0f7fa96e50c0f00c254fe689b1ea64030ad133cb
- [ ] C2. A refusal still prints its own detail in full.
  - verified: rev-32 [reviewer] · run rev-20261020-954-source-2 · 2026-10-20T09:59:16.632Z · commit 0f7fa96e50c0f00c254fe689b1ea64030ad133cb
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.

## Comments

### impl-954 · 2026-10-20T09:46:56.855Z

Implementation started. Inspecting lint-tests CLI versus hub suite reporting so default check output can shrink without losing refusal detail or suite-log evidence.

### impl-954 · 2026-10-20T09:49:12.620Z

Implemented and pushed d77eac27. CLI default is a five-line report with counts and --details hint; all refusals stay uncapped. Documented compact check sections in suite logs; hub dry-run unchanged. Typecheck, lint unit file (34/34, 1.144s), suite-check file (3/3, 2.922s), repository test:lint and diff whitespace checks pass. Repository's 38,690 diagnostic resource paths now print as a single count line. Requesting source review before mode-free verify.

### rev-32 · 2026-10-20T09:57:26.260Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-954-source
commit: d77eac276c88cca088b92a9a5a40ac4cd806e7cb
scope: full
findings: [{"severity":"medium","text":"The expanded CLI regression inherits the parent environment through ownedCheck, as does its fixture Git helper (line 144): no scratch HOME/Git config or final withoutExecutorCredentials filter. Seal these fixture launches under rule 15; Coordinator confirmed this belongs in T-954, not deferred T-961 work.","file":"hub/test/suite-check.test.ts","line":168}]
finding_counts: {"high":0,"medium":1,"low":0}

## Standards

Medium — hub/test/suite-check.test.ts:168: The added refusal command and changed --details command use ownedCheck (line 26), which passes no env. The fixture Git helper at line 144 also inherits the parent. The disposable cwd does not isolate HOME, Git configuration or credentials. Provide scratch HOME/XDG/Git configuration and apply withoutExecutorCredentials after all overlays to the npm/shell and Git launches. Coordinator disposition ef555354 confirms a local T-954 fix is required under rule 15.

## Spec

No functional findings. At d77eac276c88cca088b92a9a5a40ac4cd806e7cb the CLI opts into summaryOnly by default, prints finding/resource kind counts and a --details hint; --details retains the former full resource paths; refusal formatting remains uncapped and sets exit 1. Generic report callers and hub dry-run defaults remain unchanged. Docs describe the suite-check output change. C1 and C2 are source-established; C3 awaits same-head mode-free verification after a clear source verdict.

Read-only source review; no reviewer tests or suite executed. Implementer reports targeted Darwin arm64/local T1 34/34 and T3 3/3 plus T0, with diagnostic census report-only and refusal policy enforced; these are supplemental claims, not a mode-free suite receipt.

Totals: Standards 1 medium; Spec 0.

### impl-954 · 2026-10-20T09:58:48.215Z

Pushed review fix 0f7fa96e. ownedCheck npm/shell and fixture Git calls now use an allowlisted environment (only PATH inherited), scratch HOME/XDG/TMPDIR/Git/npm configs, with withoutExecutorCredentials applied last. Darwin arm64/local targeted suite-check.test.ts T3 3/3 pass in 4.776s; typecheck passed after env change; diff --check pass. No suite/repetition loop run. Requesting fresh source review before exact-head mode-free verification.

### rev-32 · 2026-10-20T09:59:16.632Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-954-source-2
commit: 0f7fa96e50c0f00c254fe689b1ea64030ad133cb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No remaining findings at 0f7fa96e50c0f00c254fe689b1ea64030ad133cb. Rechecked the original change and fixture correction: ownedCheck and fixture Git now receive an allowlisted environment with only PATH inherited, scratch HOME/XDG/TMPDIR, isolated Git/npm config files, and withoutExecutorCredentials applied after the overlays. Nested writer processes inherit this sealed environment. Existing ownership cleanup still stops writers before removal. The previous medium rule-15 finding is resolved.

## Spec

No findings. Compact default report, finding/resource counts, --details/--shrink forwarding, uncapped full refusal lines and nonzero refusal exit remain intact; generic report callers and hub dry-run retain their defaults. Matching agent documentation describes the changed suite check logs. C1 and C2 verified by source; C3 awaits a mode-free same-head verification result after this verdict.

No Reviewer tests or suite run. Supplemental implementation evidence: Darwin arm64/local targeted suite-check.test.ts T3 3/3 in 4.776s; typecheck passed before a final string-only config path adjustment; diagnostic census report-only, refusal policy enforced. This is targeted evidence, not a suite receipt.

Totals: Standards 0; Spec 0.

Criteria: C1 verified, C2 verified.
