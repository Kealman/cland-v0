---
id: T-1868
kind: task
title: QA drivers for the host and user DoD journeys (live workbenches, hosts-view logins, scripted setup, combined doctor)
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1671
branch: t/T-1868-qa-drivers-for-the-host-and-user-dod
created: 2026-11-15T10:48:29.034Z
updated: 2026-11-20T03:05:21.520Z
closed: 2026-11-20T03:05:21.520Z
---

## Summary

E-1537's Definition-of-Done demo (2026-11-15) couldn't show four criteria literally on one live scratch hub, because no driver for that journey ships. The Coordinator accepted substitute evidence for each, named in the demo verdict (decisions on qa/briefs/E-1537.md Q-1 to Q-4). The four journeys were:
- both workbenches showing the Hosts row and host-named session rows against a CLI-started hub with sessions on two fake hosts;
- adding and removing a login from the web hosts view, read back with `cland login list` and seen in the Neovim inbox;
- one scripted-terminal `cland setup` run through both the agent-hosts and sign-in steps, choosing users;
- doctor on one scratch hub combining a stale image, a signed-out login and no token.

Future host and user epics, and the v0.4 release run, would be better verified with these as runnable QA cases.

## What to build

Add QA drivers, as qa/cases or scratch helpers in the qa skill kit, for the four journeys above, on fakes only: the fake host provider, the fake DigitalOcean API and an isolated Headless Shell. Invite links are treated as credentials (stage 5's `inv.mjs` approach).

## Acceptance criteria

- [x] C1. Each of the four journeys runs as a committed QA case or kit helper against a scratch hub on fakes and records its evidence through `qa-record.sh` (test).
  - done: impl-1868 · 2026-11-20T01:34:26.800Z
  - verified: rev-39 [reviewer] · run rev-20261120-1868-final-3 · 2026-11-20T02:01:28.799Z · commit 02720b07ac47940c7c391939f911312d92e1ffd4
- [x] C2. The invite-link journey proves, with a planted positive control, that no link appears in any capture (test).
  - done: impl-1868 · 2026-11-20T00:46:59.565Z
  - verified: rev-39 [reviewer] · run rev-20261120-1868-final-3 · 2026-11-20T02:01:28.799Z · commit 02720b07ac47940c7c391939f911312d92e1ffd4

## Comments

### impl-1868 · 2026-11-20T00:36:52.839Z

Four native QA case entry points and a scanned qa-record wrapper drafted. Local working-tree receipts: HOSTS-001 passed native-20261120-5; HOSTS-003 passed native-20261120-17 (prepared fake pool; new-pool transport T-2019 per Coordinator); HOSTS-004 initial direct native run passed, recorder rerun pending. HOSTS-002 native-20261120-18 reached running session/rendered Neovim host, then failed stopped-session login release wait; driver now stops the host before web removal. Earlier failed attempts retained. C1/C2 not marked done; full lint/typecheck, final four recorder runs, evidence publication, merge origin/dev, source review and verification remain pending. No checks during Coordinator quiet window.

### impl-1868 · 2026-11-20T00:50:09.199Z

C1/C2 done at 92aa487e4b4767925cfaf0cac37dded6e12d6589. Four serial local macOS arm64 native cases passed and recorded via qa-record.sh (committed-20261120-1 HOSTS-002, -2 HOSTS-001, -3 HOSTS-003, -4 HOSTS-004). Evidence A-21992, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21992-t-1868-four-committed-native-qa-journey-receipts. Positive invite control passed; export passed both policies after local user-path prefix redaction to a SHA-256 label. Prepared-pool limitation accepted by Coordinator, T-2019 follow-up. npm run test:lint and npm run typecheck both exit 0 at this head; 20 targeted pure tests and separate strict QA-driver compilation pass. No full verification yet. origin/dev fetched/merged (already up to date), branch committed and pushed; requesting source review.

### rev-35 · 2026-11-20T00:57:44.931Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1868-source-1
commit: 92aa487e4b4767925cfaf0cac37dded6e12d6589
scope: full
findings: [{"severity":"medium","text":"M1: All four new native QA journey callbacks lack an encompassing pre-acquisition setup/body owner and positive resource-close fence; narrower fixture/process hooks do not join late acquisitions through cancellation or rejected cleanup.","file":"qa/cases/HOSTS-001.test.ts","line":5},{"severity":"medium","text":"M2: A rejected relay tick makes beforeStop throw at await pending before sockets are destroyed and servers closed, leaving relay writers unresolved.","file":"qa/support/live-host-journeys.ts","line":124}]
finding_counts: {"high":0,"medium":2,"low":0}

Full exact-head Standards/Spec source review: not clear; A-21998 records both medium findings and the source/evidence boundaries. M1 affects all four native journey callbacks; M2 is live-host-journeys.ts:124. Lead confirms both with no omitted control or exception. Functional journey mapping and the Coordinator-approved HOSTS-003 prepared-pool/T-2019 limitation are retained. C1 failed, no criteria newly verified; C2 source inspected without a further finding but remains unverified. Four A-21992 ordinary local native case passes do not prove cancellation/rejected-close ownership or configured-suite completion. Correct both together and request fresh committed-head source review before verify. Hold may release for that correction.

Criteria: C1 failed (M1: full native journey acquisition/setup/body ownership is missing; M2: rejected relay work skips socket/server closure.).

### impl-1868 · 2026-11-20T01:31:46.918Z

Review fixes M1/M2 at 02720b07ac47940c7c391939f911312d92e1ffd4: complete original callback owner pre-enrolled for all four journeys, fenced setup/body/teardown, positive daemon stopped receipt, independent relay close attempts and preserved producer/secondary outcomes. HOSTS-005 passed three native controls; all four real journeys reran and passed serially at this clean committed head, recorded as ownership-20261120-1 through -5. Evidence A-22018: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22018-t-1868-ownership-fixes-and-five-native-case-receipts. 24 targeted T1 passes, separate strict QA-case compilation, full npm run typecheck and full npm run test:lint pass (0 refusals, baseline report-only findings). Source review A-21998 and earlier receipts retained as historical. Requesting fresh review before any verify.

### rev-39 · 2026-11-20T01:34:04.053Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261120-1868-source-2
commit: 02720b07ac47940c7c391939f911312d92e1ffd4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE clearance. Standards: A-21998 M1/M2 resolved by pre-acquisition whole original callback ownership, fenced fixture/root cleanup and independent relay resource closes after the final producer settles; exact producer cause and secondary cleanup failures retained. HOSTS-005 covers late abort acquisition, actual guarded root/seam retention and repair, and rejected tick after real byte forwarding with native client/server close receipts. Spec: all four journeys and recorder wrapper present; approved prepared-pool/T-2019 limitation explicit; invite positive control and actual-value absence assertions retained. Full source/evidence boundaries A-22020 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22020-t-1868-source-clear-at-02720b07a.md). A-22018 has five local macOS arm64 Node24.21 native outer code0/signal null captures, seven generated passes/no failures/skips/cancels; Headless Shell1248 paths and Nvim0.12.5, exact Chrome version unknown. Reported T1/static checks are partial evidence, no configured result or other tier/platform/load claim. No Reviewer runtime launched. C1/C2 unverified pending same-head configured evidence settlement; prior C1 source defects resolved, done flag still unchecked in task readback.

### rev-39 · 2026-11-20T02:01:28.799Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261120-1868-final-3
commit: 02720b07ac47940c7c391939f911312d92e1ffd4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

FINAL same-head clear. Source A-22020 remains unchanged; branch readback02720b07a and task.view exact configured55eca583 passed. A-22038 structured unique7065ordinary passes,0fail/cancel/skip/todo; separate30load passes. Six new invite/relay controls each ordinary+5/5load. T0/allT1/fallbackallT2/Web complete; T3 merge-batch deferred, T4 unexecuted. Uncached Linuxx64 6.8.0-149 c-8ams3 Node24.21/Nvim0.12.5; actual isolated HeadlessShell1248/CfT156.0.8078.4; advisories report-only. Runtime snapshot67a4949... distinct source Git tree0a2fefe.... C1 also uses A-22018's five same-head ordinary local macOSarm64 native QA recorder captures (four journeys+three HOSTS-005 controls,7passes, five outer code0/signalnull); these were not rerun in the configured Linux suite. C2 actual invite withholding/absence plus positiveControl=true/linksWithheld=1 and pure regressions checked. Approved T-2019 prepared-pool boundary retained; intentional inner setup code1 remains separate from passing outer case. Details A-22039 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22039-t-1868-final-same-head-evidence-clear.md). C1,C2 verified; findings[]. Reviewer executed no tests/probes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T03:05:21.520Z

Merged 5307ed43c664df534e546ebc64215807d1c162b7 onto dev.
