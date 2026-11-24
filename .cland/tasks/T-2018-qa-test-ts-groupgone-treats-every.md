---
id: T-2018
kind: task
title: qa.test.ts groupGone treats every process-group probe error as absence; only ESRCH proves the group is gone
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1732
branch: t/T-2018-qa-test-ts-groupgone-treats-every
created: 2026-11-20T00:18:35.899Z
updated: 2026-11-24T12:47:42.992Z
closed: 2026-11-24T12:47:42.992Z
---

## Summary

The `groupGone` helper in `nvim/test/qa.test.ts` treats every exception from `process.kill(-pgid, 0)` as proof that the process group is gone. Only `ESRCH` establishes that. A permission error or another probe failure is an unknown, which should fail the check rather than pass it. This is a static finding from T-1798's source review; none of the retained runs hit such an error.

## What to build

Treat only `ESRCH` as absence. Any other error from the probe fails the assertion with its literal code.

## Acceptance criteria

- [x] C1. A probe that throws a non-ESRCH error makes the no-spinning-Neovim check fail, naming the code, while ESRCH still passes (test).
  - done: impl-2018 · 2026-11-24T10:09:52.171Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2018-final · 2026-11-24T11:06:51.206Z · commit 2f353bde9f7391e71935d014c7bbc5a7deb97e27

## Comments

### impl-2018 · 2026-11-24T10:06:33.017Z

Consumer audit: groupGone has exactly three callers in nvim/test/qa.test.ts (timeout, SIGTERM and sandbox no-spinning checks); all now use processGroupGone via the shared eventually wait. No production or wire contract changed. Fake-probe T1 regression red: Missing expected exception /EPERM/; green: 1/1 on Node 24.21.0 macOS arm64. Native QA scenarios deferred to configured verify.

### rev-40 · 2026-11-24T10:15:44.176Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2018-source
commit: 2f353bde9f7391e71935d014c7bbc5a7deb97e27
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 2f353bde9f7391e71935d014c7bbc5a7deb97e27. Standards: no findings; pure injected T1 classifier regression is registered, shared bounded/load-scaled wait preserves terminal probe errors and all three native callers retain final assertions. Spec: only ESRCH proves group absence; successful probes remain present and EPERM/EIO/unknown errors throw their code with original cause. A-22824 records source review and A-22822 local evidence limitations. C1 remains unverified pending same-head configured test receipt; no configured/native T3 pass claimed. Reviewer ran no tests/probes and made no edits.

### rev-40 · 2026-11-24T11:06:51.206Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2018-final
commit: 2f353bde9f7391e71935d014c7bbc5a7deb97e27
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged2f353bde9; C1 verified. Exact-head2856ebe9/A-22864 finished/passed; canonicalc50e261a matches executable head. Named injected classifier base8609 outcome pass and load gate8968 5/5, plus all3 native groupGone callers timeout40528/SIGTERM40533/live-project cleanup40558 pass. qa.test.ts27pass/3macOS sandbox skips; no sandbox execution claimed on Linux. T0/T1/fallbackT2/selectedT3/Web exit0,8selected processfiles127passing identities once;restT3 batch/T4unexecuted. Aggregate7497pass/4skip/0fail. Noncached Linuxx64c8nyc1/workers2/Node24.21.0/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4; budgets/lint advisory. A-22866 records both axes/receipts/limits; sourceA-22824 retained. No findings or reviewer runs/edits.

Criteria: C1 verified.

### impl-2018 · 2026-11-24T11:06:52.280Z

Configured verify 2856ebe9-c4a9-4094-933e-8fe9c951a74f passed at exact reviewed head 2f353bde9f7391e71935d014c7bbc5a7deb97e27. A-22864: Linux x64 droplet, Node 24.21.0, Neovim 0.12.5; T0, all T1/T2 fallback, eight selected T3 files including nvim/test/qa.test.ts, Web; 7497 passed, 0 failed, 4 skipped. Remaining T3 deferred to merge batch; T4 unexecuted. Budget/lint advisories remain report-only. Awaiting reviewer C1 settlement; source unchanged.

### coord · 2026-11-24T12:47:42.992Z

Merged faff3e3809c5f7ba6bcc0ea3b60c1c7499e0aef9 onto dev.
