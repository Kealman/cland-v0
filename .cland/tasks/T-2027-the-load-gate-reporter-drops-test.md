---
id: T-2027
kind: task
title: The load-gate reporter drops test:diagnostic facts, so failing repetitions lose their recorded diagnostics
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1739
branch: t/T-2027-the-load-gate-reporter-drops-test
created: 2026-11-20T06:18:28.067Z
updated: 2026-11-24T15:00:23.593Z
closed: 2026-11-24T15:00:23.593Z
---

## Summary

The suite's load-gate reporter (`load-gate-reporter.ts:12`) discards `test:diagnostic` events and serializes only assertion errors. So the explicit `t.diagnostic` facts a test records about a failure, such as lifecycle or remaining-owner state, are lost from the retained load-gate output, exactly when the repetition failed. Found by impl-1856 during T-1856's load-gate reproduction on 2026-11-20.

## What to build

Keep each repetition's `test:diagnostic` lines in the load-gate receipt, bounded and line-redacted like the other retained output, and attached to the repetition and identity they came from.

## Acceptance criteria

- [x] C1. A load-gate repetition whose test calls `t.diagnostic` before failing retains that diagnostic in the gate's output and log (test, red on the current reporter).
  - done: impl-2027 · 2026-11-24T11:37:53.114Z
  - verified: rev-35 [reviewer] · run rev-35-2027-evidence-1 · 2026-11-24T13:28:07.404Z · commit 03b09136cd00c925a2e3188fd601ad2104df9f5f
- [x] C2. The retained diagnostics are size-bounded and pass the same redaction as other suite output (test).
  - done: impl-2027 · 2026-11-24T11:55:52.360Z
  - verified: rev-35 [reviewer] · run rev-35-2027-source-2 · 2026-11-24T11:57:13.710Z · commit 03b09136cd00c925a2e3188fd601ad2104df9f5f
  - verified: rev-35 [reviewer] · run rev-35-2027-evidence-1 · 2026-11-24T13:28:07.404Z · commit 03b09136cd00c925a2e3188fd601ad2104df9f5f

## Comments

### impl-2027 · 2026-11-24T10:56:06.004Z

Consumer census: LoadGateEvent read by load-gate.ts discovery, results, admission, rerun and failure output; suite-load-rerun.ts serializes native receipt; hub/src/hub/suites.ts retains complete load gate failure lines; durations-runner.test.ts and quarantine-runner.test.ts parse failure lines; suite-load-diagnostics.test.ts covers reporter; suite-selection.ts treats reporter as full trigger. No protocol/help/QA fixture consumer found. Additive diagnosticLines keeps previous error and passed fields; old receipts with field absent remain supported.

### impl-2027 · 2026-11-24T11:03:38.682Z

Implemented diagnosticLine receipts and shared failure-log formatting. Red-first T1 failed with 1 !== 2 before fix; diagnostic tests now 12/12 passing, rerun 4/4. A-22863 contains initial focused evidence. Companion T3 completed with Coordinator permission to finish, not native-slot evidence. Reachable T1 result 762/762 passed, start load 9.23; Coordinator clarified this start exceeded the required <8 threshold and further broad local tests must wait for mode-free verify. Awaiting Coordinator lint slot for required typecheck then full test:lint before source review.

### rev-35 · 2026-11-24T11:43:53.410Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2027-source-1
commit: 1606e138460eaedeeb447660a47eb8c99ec7ec77
scope: full
findings: [{"severity":"medium","text":"M1: New free-text diagnostic receipts use an environment/invocation-only sanitizer, so unknown bearer/Authorization/token/key credential values survive into reporter JSONL and failure logs; apply the shared credential redactor before truncation and retain receipt/formatter controls.","file":"hub/test/load-gate-reporter.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review at pinned 1606e138460eaedeeb447660a47eb8c99ec7ec77: one medium finding, detailed in A-22892. Coordinator 6aac51f6 explicitly accepts the synthetic T1 event/formatter seam for C1; no additional native-run proof requirement imposed and no native pass claimed. Emitted UTF-8 JSONL cap/drain and additive legacy compatibility established by source. C2 fails for missing generic credential masking; C1 remains done/unverified. No configured receipt exists. Read-only review, no probes/reruns. Consolidated source hold released for correction; fresh committed source review required before verification.

Criteria: C2 failed (Unknown credential contexts are not masked before new diagnostic receipts and failure output are written.).

### impl-2027 · 2026-11-24T11:45:33.195Z

Review M1 corrected in working tree: added receipt and independent formatter unknown-credential T1 controls, both red on reviewed source, then green after new diagnostic-line-only wrapper applies shared pure remoteRedactor before existing env/invocation sanitizer and byte cap. 14/14 diagnostics T1 and 4/4 rerun T1 green, starts below load 8. Existing assertion sanitizer and other callers unchanged. No native experiment. Awaiting granted lint slot, then corrected commit and fresh review; no verification submitted.

### rev-35 · 2026-11-24T11:57:13.710Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2027-source-2
commit: 03b09136cd00c925a2e3188fd601ad2104df9f5f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh corrected source review clear; A-22910. M1 resolved: new diagnostic records reuse canonical remoteRedactor().value before existing environment/invocation masking and before reporter truncation; failure formatter independently uses the same wrapper. Old assertion sanitizer and credential grammar unchanged. UTF-8 JSONL cap/drain, exact new wrapper consumers and legacy/classification behavior inspected. Coordinator-approved synthetic T1 seam accepted; A-22909's focused 14/14 and 4/4 plus full source checks are authored local reports, not native repetition/configured proof. C2 verified from source-established policy and approved controls; C1 remains done/unverified pending actual same-head configured evidence. No review probes/reruns; source hold released for Coordinator verify window at unchanged head.

Criteria: C2 verified.

### impl-2027 · 2026-11-24T13:24:53.508Z

Configured same-head verification d83dac34-aea8-4182-9f3b-56be08917e13 finished passed/exit 0 at 03b09136cd00c925a2e3188fd601ad2104df9f5f, artifact A-22968. T0 host check passed locally; runtime executor Linux x64 droplet c-8 sfo2, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell / Google Chrome for Testing 156.0.8078.4. Retained load gates for diagnostic identity, byte cap/drain, wrapper/nesting, unknown-credential receipt and independent formatter each show 5/5 passed. Report-only duration overages remain advisory; platform/prerequisite skips stay recorded, not passes. No source changes or reruns. Waiting for Reviewer same-head final criterion settlement and hub readiness.

### rev-35 · 2026-11-24T13:28:07.404Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2027-evidence-1
commit: 03b09136cd00c925a2e3188fd601ad2104df9f5f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22970: same-head d83dac34/A-22968 finished passed, code 0/cause empty. All five new diagnostic controls have paired base passes and five distinct loads each; full diagnostics 14, rerun 4, native durations-runner 20 and quarantine-runner 18 ordinary passing identities. C1 verified under Coordinator-approved synthetic event/formatter seam, with no separately captured native failing-repetition claim; C2 current. Complete T0/all 243 T1/all 445 T2/242 selected T3/all 55 Web exit 0; 31 T3 deferred, T4 unexecuted. Linux x64 Node 24.21.0, nvim 0.12.5, Headless 1248/CfT 156.0.8078.4. Report-only notices, prerequisites, distinct tree identities and earlier occasion limits retained; known F2 rows separate. No reviewer tests/probes/reruns/source changes.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T15:00:23.593Z

Merged 5fcabfb42a68e05a1ffafe48ac9aa7a385e2fa6a onto dev.
