---
id: T-1817
kind: task
title: login-metadata-owners test helper closes the borrowed Store even when hub.stop rejected
state: open
status: ready
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1598
branch: t/T-1817-login-metadata-owners-test-helper-closes
created: 2026-11-11T19:29:02.179Z
updated: 2026-11-17T08:50:36.037Z
---

## Summary

impl-1791 found in source (topic-1480, 2026-11-11 19:28Z; not a reproduced failure) that the shared test helper `hub/test/login-metadata-owners.ts` calls the borrowed `Store.close` even when `hub.stop` rejected. Its directory guard keeps the fixture root, but the storage the failed hub join still owns is closed underneath it, so a fault test can lose the evidence it means to keep or race a still-running owner. T-1791's new fixture uses phased Gateway → hub → Store ownership instead and leaves this helper unchanged.

## What to build

Make the helper's teardown phased: when `hub.stop` rejects, keep the Store open and owned (retaining root and storage together), report the failed join, and close the Store only after a positive hub stop.

## Acceptance criteria

- [x] C1. A fixture whose hub stop rejects leaves its Store open and its root retained, and reports the rejection (test).
  - done: impl-1817 · 2026-11-17T08:22:15.856Z
  - verified: rev-35 [reviewer] · run rev-35-1817-final-1 · 2026-11-17T08:50:35.822Z · commit 62a454de152517ade91626fcb6c4b389597a5dc3
- [x] C2. A normal stop still closes the Store after the hub and removes the root (test).
  - done: impl-1817 · 2026-11-17T08:22:17.481Z
  - verified: rev-35 [reviewer] · run rev-35-1817-final-1 · 2026-11-17T08:50:35.822Z · commit 62a454de152517ade91626fcb6c4b389597a5dc3
- [x] C3. Every existing consumer of the helper passes unchanged (test).
  - done: impl-1817 · 2026-11-17T08:22:18.186Z
  - verified: rev-35 [reviewer] · run rev-35-1817-final-1 · 2026-11-17T08:50:35.822Z · commit 62a454de152517ade91626fcb6c4b389597a5dc3

## Comments

### impl-1817 · 2026-11-17T07:54:52.200Z

Consumer audit: loginMetadataOwners is imported only by hub/test/login-list.test.ts, hub/test/login-signin-recovery.test.ts and hub/test/login-add-component.test.ts. Repository-wide name/path searches found no production, skill, QA, startup or persisted-reader consumer. Only login-list fault assertions migrate: before-hub expects no Store close, hub-drain expects no Store close until retry positively joins. Coordinator confirmed these bug-pinning assertions are in scope; other caller assertions unchanged. Red on Node 24.21.0 macOS local: targeted login fixture tests, 2 failed with unexpected store closed, 1 normal-stop passed. Fix gates Store close on hubClosed.

### rev-35 · 2026-11-17T08:13:23.062Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1817-source-1
commit: ceda09be878484f391b083c2b26581a8a9f4f6cd
scope: full
findings: [{"severity":"medium","text":"Changed fault callbacks and new held-stop case(:46) lack a whole-sequence owner before tempProject/acquisition. Resource-phase close does not fence/join surrounding start/body continuations; held gate release is registered only after stopping await. Enroll shared lifetime ownership/adopt root before acquisition and join before teardown. Lead confirms no owner/disposition (rule12).","file":"hub/test/login-list.test.ts","line":29},{"severity":"medium","text":"C1 root existence checks occur before directory cleanup, then recovery succeeds before teardown. They cannot detect a disconnected removal guard. Exercise actual guarded cleanup while stop remains rejected, observe retained root/open Store/original failure, then recover and dispose. Lead confirms no existing coverage/disposition (rule9/C1).","file":"hub/test/login-list.test.ts","line":34},{"severity":"low","text":"Guide still says fault cases retain root while attempting Store disposal, contradicting the new hubClosed gate. Replace superseded wording and document corrected ownership/controls; record doc/QA census dispositions (rule16).","file":"docs/agents/tests/hub-test-login-list.test.ts.md","line":5}]
finding_counts: {"high":0,"medium":2,"low":1}

Full source pass, tree496649e6984640ac40883cfdf4699d5c210ad1bb; A-20770. Standards1M/1L; Spec1M root-retention coverage gap, no separate nominal helper algorithm defect. One-line hubClosed Store gate and original-error/retry behavior check out. Coordinator54e5dfdc authorizes only documented bug-expectation migrations; other caller assertions unchanged. A-20752/A-20757 corrected-id/A-20767 retain red2fail and local31T2passes, final typing/lint0/122report findings59files with precommit/raw/hash/signal/scan-control limits; not configured evidence or adverse cleanup proof. C1/C2 failed; C3 unverified. Lead confirms both medium gaps. Consolidate fixes plus stale guide, fresh pushed-head source review before verify. No Reviewer runtime/probe/edit.

Criteria: C1 failed (Fault callbacks lack encompassing lifetime ownership and do not exercise guarded removal during rejected hub stop.), C2 failed (New positive-stop/root-removal regression lacks whole-callback ownership before setup and held-gate admission.).

### impl-1817 · 2026-11-17T08:16:53.925Z

Review corrections at 62a454de152517ade91626fcb6c4b389597a5dc3: shared fixtureWork enrolls whole callbacks before acquisition; registered recovery/hold releases, adopted outer roots/resources and fenced steps cover cancellation/late setup. Inner ownDirectory disposal now actually refuses while metadata closure is unconfirmed; tests check root and no Store close, recover, then observe disposal. Guide corrected. Expanded exact-name/path audit across repository (rg -l --hidden excluding .git/.cland/node_modules) found only helper, 3 runtime caller files, login-list/signin-recovery guides and 5 QA briefs: E-1535, E-1535-stage-4, E-1537-stage-1/-2/-3. QA references are pinned historical stage scope/debt descriptions, not executable helper callers; kept as historical evidence. login-list guide migrated; signin-recovery guide already dependency ordered; no production/startup/persisted consumer or wire migration. Initial evidence limits remain in A-20767.

### rev-35 · 2026-11-17T08:22:05.872Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1817-source-2
commit: 62a454de152517ade91626fcb6c4b389597a5dc3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source clear, tree523ec74d9a07d07b12f629648923b4ce3c75a14e; A-20777. All2M/1L corrected: existing fixtureWork owns criterion callbacks before acquisition, pre-registered holds/recovery and adopted roots/resources/fenced steps join before outer root disposal. Fault cases now invoke actual inner ownDirectory cleanup while closure remains unconfirmed, observe retained root/open Store/original rejection, then positive recovery and disposal. Normal path retains bounded stopping receipt/order and observes root removed after body joins. Guide/census corrected; historical QA references disposed as documentation. Helper/other two caller files unchanged. A-20774 candidate6/6T2/full typing+lint0/122report findings59files qualified by precommit/no per-run hash/raw/signal limits; earlier3/3+22/22 remain prior-candidate evidence. No findings. C1-C3 unverified pending same-head configured result; no verified marks. task.view still had prior C1/C2 failed implementation marks; lead re-marks done before submit. No Reviewer runtime/probe/edit/new run/merge. Follow Coordinator window.

### rev-35 · 2026-11-17T08:50:35.822Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1817-final-1
commit: 62a454de152517ade91626fcb6c4b389597a5dc3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final clear; A-20792 reconciles A-20791/run7756ead7 with A-20777 source. Both rejected-closure/guarded-removal cases pass ordinarily; normal hub→Store/root disposal passes ordinarily plus5/5load. All3runtime consumers pass31cases (6/3/22), preserving Coordinator-approved bug-pinning migrations and other assertions. T0/T1/allT2/Web exit0;6608 ordinary passes/708files plus215 separate load passes, no fail/cancel/skip. Current clean head; normalized verification tree d92ef16b57f756c6e787360804ac886d8abd6acb, uncached Linuxx64/Node24.21.0, actual HeadlessShell1248/ChromeTesting156.0.8078.4. Exactly0/269T3 and0/17T4 files executed.64existing warning identities unchanged, none own-consumer. Actual T-1935 fixture pair retained separately from terminal exit0/hub passed; no retry. Lint122/59 and budgets/ratchet/skip remain report-only. Source was cleared before rules38–43; prior basis preserved. C1-C3 verified, findings[]. Component filesystem/owner proof is not native hub-stop or RSS/timing evidence. Historical provenance limits retained; no Reviewer runtime/probe/edit/new run/merge.

Criteria: C1 verified, C2 verified, C3 verified.
