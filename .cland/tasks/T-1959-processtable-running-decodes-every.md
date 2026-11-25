---
id: T-1959
kind: task
title: ProcessTable.running() decodes every retained and archived row before filtering; move its callers onto the indexed runningRows() query
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1765
branch: t/T-1959-processtable-running-decodes-every
created: 2026-11-18T06:44:23.194Z
updated: 2026-11-25T04:58:10.439Z
closed: 2026-11-25T04:58:10.439Z
---

## Summary

Found by the T-1679 reviewer (2026-11-18), pre-existing and non-blocking for T-1679. `ProcessTable.running()` in hub/src/adapters/processes.ts calls `all()`, which decodes every retained and archived process row, and only then filters for running ones; session recovery (`#resumeHost`) and other callers consume it. T-1752 already added `ProcessTable.runningRows()`, an indexed streaming query over unarchived running rows, but left `all()`/`running()` unchanged, so recovery work still grows with retained history (rule 23).

## What to build

Move every caller of `running()` onto `runningRows()` (or make `running()` delegate to it), keeping the returned shape and order its callers rely on. Add a work-count regression over a large retained and archived history.

## Acceptance criteria

- [x] C1. With 10,000 archived or exited rows and a handful running, `running()` and session recovery decode only the running rows (test counts decoded rows).
  - done: impl-1959 · 2026-11-25T02:23:03.509Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1959-final · 2026-11-25T03:27:17.984Z · commit 37831fd2746f331b6ee84ce403d4fa3ac53d1398
- [x] C2. Every caller of `running()` and `all()` in the recovery and status paths is listed with its disposition (rule 20 and rule 41), and their results are unchanged (test).
  - done: impl-1959 · 2026-11-25T02:23:03.719Z
  - verified: rev-40 [reviewer] · run rev-40-20261125-1959-final · 2026-11-25T03:27:17.984Z · commit 37831fd2746f331b6ee84ce403d4fa3ac53d1398

## Comments

### impl-1959 · 2026-11-25T02:01:38.809Z

Consumer inventory (searched ProcessTable, runningRows, .running(), .all(), harness_processes across hub/src, hub/test all tiers, nvim, web, docs, .agents including frozen JSON fixtures): production running() consumers are Sessions.#checkCrew, #reuseCandidate, stopAfterMerge, retiringHostGenerations, constructor deaf restoration and remembered projections, readAccountLimits, #resumeHost. All retain the array API and started_at/name order through delegation. Existing runningRows consumers resumeAll's revoked/deleted-host and missing-registration passes retain their generator shape; now deterministic order. all() consumers in Sessions remain unchanged: #knownLaunchIds needs every retained identity for collision protection; list needs both archive views; #sweepArchive needs terminal rows; pruneArchive needs archived terminal rows; releaseInterruptedLaunches needs durable terminal statuses. No wire/schema/help change; old clients receive unchanged process view shapes. Direct existing test consumers: host-survival.test.ts and name-reservation.test.ts (T2), plus new session-host.test.ts (T2). Other ProcessTable importers retain APIs and queries unchanged; no direct runningRows callers found in skills, QA briefs, startup probes or frozen fixtures. The all() positive control and full-row comparison preserve the previous supported running-result shape/order; valid archive lifecycle never archives running rows.

### rev-40 · 2026-11-25T02:10:18.820Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-1959-source
commit: d5e0b1445fff4148cc43c9634d1f665b2ce4dad7
scope: full
findings: [{"severity":"medium","text":"New decode/recovery cases lack a pre-acquisition complete-case owner and setup/action bounds; late raw t.after cleanup does not establish resource closure before root removal/native and JSON.parse seam restoration.","file":"hub/test/session-host.test.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; M1 medium session-host.test.ts:16 confirmed by implementer484dc0e0. Enroll shared whole-case owner before root/guard acquisition, capture resources before further acquisition, separately bound setup/recovery and retain late-work joins plus native/JSON.parse seams through cleanup. Preserve all historical-decode positive controls, exact order and full-row assertions. Production runningRows delegation/order and consumer dispositions otherwise source-consistent; no production finding. C1 failed, C2 runtime remains pending corrected-head evidence. Corrected SHA used; local selected959T1/108T2/static0 claims are not configured suite proof. No Reviewer runs. A-23154: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23154-t-1959-source-not-clear-at-d5e0b1445.md.

Criteria: C1 failed (New work-count proof lacks complete-case setup/recovery/cleanup ownership and bounds before acquisition (M1).).

### rev-40 · 2026-11-25T02:19:03.801Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-1959-source2
commit: 9397f9e2540fada3b9d4c2570d37235dc9e0e7f8
scope: full
findings: [{"severity":"medium","text":"M1-R: tempProject registers proxy directory drain before the later raw proxy resource-close hook; adoptRoot only joins body, so directories can disappear before Sessions/fake/storage close.","file":"hub/test/session-host.test.ts","line":48}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; M1-R confirmed by implementer51789a83. Named setup/recovery bounds and complete-body admission are repaired, but proxy cleanup drain precedes the later resource-close hook. Fence the proxy and register captured disposer via shared beforeDirectories on that owner before root acquisition; rejected closure must retain roots/seams. Production query/order/census unchanged and source-consistent. Next-clear bar is completion of originalM1: owned/bounded setup/recovery, partial capture, resources positively closed before actual proxy directory removal and seam restoration, all existing positive decode/full-row/order assertions retained. C1 failed; C2 final pending. No Reviewer runs. A-23164: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23164-t-1959-ownership-correction-not-clear-at-9397f9e25.md.

Criteria: C1 failed (M1 cleanup ordering remains incomplete: proxy directories can be removed before resource closure; fence/register same-proxy resource disposer before root acquisition.).

### rev-40 · 2026-11-25T02:24:10.877Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1959-source3
commit: 37831fd2746f331b6ee84ce403d4fa3ac53d1398
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; originalM1/M1-R resolved. Captured disposer is registered before acquisition through beforeDirectories on the same fenced proxy owner; full body/pending work joins before resource drain, resource closure precedes proxy directory removal, rejection retains roots/seams. Named setup/recovery bounds and native/JSON.parse restoration ordering retained. Production indexed delegation/order/census unchanged; all10000-history positive controls, full rows and a,b,z resume assertions preserved. C1/C2 done restored, final verification marks pending configured exact-head named case/consumer receipts. A-23168 supersedes earlier ordering claim; current selected959T1/108T2/static0 remain localMacNode24.21 checks, not configured suite proof. No findings/Reviewer runs. A-23169: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23169-t-1959-corrected-source-clear-at-37831fd27.md.

### impl-1959 · 2026-11-25T03:26:29.632Z

Configured same-head receipt: run d9826630-eb22-4e63-8f70-1cfcb9ed3338, A-23222, finished passed at 37831fd2746f331b6ee84ce403d4fa3ac53d1398 (tree 615fbfa44c9a3f1da40ee0cea96ad74e8a3d4c87). Droplet c-8 fra1, Linux x64 6.8.0-149-generic, Node 24.21.0, Neovim 0.12.5; Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. Recorded T0, T1, selected T2, T3 importers and Web each exited 0. Duration budgets remain report mode; recorded platform/prerequisite skips retained. No T4 execution claim; remaining T3 deferred to merge/integrated occasions per task policy. Exact case receipts: 'running decodes only current running processes with 10000 retained rows' passed 1.964332239s; 'recovery decodes only current running processes with 10000 retained rows' passed 1.741598725s. Both new identities also have load-gate 5/5 passed receipts. Droplet lifetime 3234s, cost $0.2246. No source changes or resubmission after clear source review; final Reviewer criteria/verdict settlement pending.

### rev-40 · 2026-11-25T03:27:17.984Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261125-1959-final
commit: 37831fd2746f331b6ee84ce403d4fa3ac53d1398
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-23225. Exact-head d9826630/A-23222 passed; canonical tree615fbfa4 matches reviewed executable content. C1 two exact10000-row running/recovery structured bases pass1.964332239s/1.741598725s and separate5/5 load receipts; source assertions preserve positive history decode control, zero optimized history decodes, complete rows/order and a,b,z recovery. C2 retained consumer census/dispositions plus11session-host/direct host-survival/name-reservation positive outcomes checked. Actual scope T0,all247T1,function-selected305T2,selected252T3,Web smoke1file exit0; T4unexecuted, nonselected/batch coverage not claimed. Noncached Linuxx64 c8fra1 workers2 Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4.12prerequisite skips retained; advisory budgets report-only. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T04:58:10.439Z

Merged 2da68b2b8971882eea65d874bfd2357695182d99 onto dev.
