---
id: T-1662
kind: task
title: cland doctor reports a remote hub that refuses admission as 'does not answer'
state: closed
status: done
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1600
topic: topic-1590
branch: t/T-1662-cland-doctor-reports-a-remote-hub-that
created: 2026-11-03T17:52:10.072Z
updated: 2026-11-17T08:23:50.543Z
closed: 2026-11-17T08:23:50.543Z
---

## Summary

Found while writing the E-1532 stage-3 QA brief. On a host without a session credential, `cland doctor` reports `remote hub does not answer on <socket> (forbidden…)`, although the hub did answer, with an admission refusal. A user reading that line looks for a dead tunnel or hub, when the real cause is a missing or refused credential.

## What to build

Doctor tells "no answer" (connect refused, timeout) apart from "answered and refused admission". For a refusal it names the refusal class, for example missing credential or revoked host, and the remedy, without printing any credential.

## Acceptance criteria

- [x] C1. Against a fake host whose hub answers but refuses admission, `cland doctor` reports the refusal class and not "does not answer"; against a socket with no listener, it still reports "does not answer" (test).
  - done: impl-1662 · 2026-11-17T06:17:50.805Z
  - verified: rev-36 [reviewer] · run rev-36-1662-final-1 · 2026-11-17T07:12:53.892Z · commit 151a3ead24f210514742af67634107a042b81b5d

## Comments

### impl-1662 · 2026-11-17T05:53:02.029Z

Consumer audit before change: searched askHubFrame/probeHub, the hub refused, remote hub does not answer, valid remote discovery across shared, hub, nvim, web, shipped skills, docs, QA briefs and every test tier. Production consumers: CLI socket wrapper and CLI auth/task/merge/web/release/artifact/config/suite/models/host/remote/task-import/subscriptions/hook/session/role/hub/rule/crew/inbox/worktree/login/demo/publish/executor/push/account; setup/hub; doctor release/users/remotes/hosts/project; executor/droplet/spend-hubs. These retain Error messages and rejection semantics; only doctor/project consumes additive refusal metadata. Tests: doctor, web auth/signin/users/setup/cookies/upload/tunnel/edge, secrets, pairing, daemon and web harness/tests retain wire and Error compatibility. QA E-1532-stage-3 pins old doctor wording and will be annotated as historical; other briefs call the unchanged API. No persisted shape changes, no startup probe changes. JSON Check fields remain name/verdict/detail/fix. Previous error-only result shape gets a regression. Red observed on Node 24.21.0 macOS: remote doctor distinguishes failed with actual remote hub does not answer ... (host frame requires its own role-holding session credential).

### impl-1662 · 2026-11-17T06:08:37.720Z

Review evidence supplement A-20686 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20686-t-1662-original-excerpts-and-complete-consumer-inventory.md: original available command/cwd/completion excerpts; unavailable uncommitted tree and signal/raw facts labelled; pinned 5502f206923ffb25e51ef7deb239b1a49ef52f83 tree and 152-file complete socket client/error/refusal/importer hit-set with pinned tiers and executed/deferred/QA dispositions. No provenance reruns. Reviewer identified new test caller-sequence cleanup ownership gap; confirmed, awaiting verdict before edit.

### rev-36 · 2026-11-17T06:13:43.730Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1662-source-1
commit: 5502f206923ffb25e51ef7deb239b1a49ef52f83
scope: full
findings: [{"severity":"medium","text":"The new callback acquires tempProject(t) and then performs fake-start, discovery reads/writes, checkProject and disposal as an unowned caller sequence. Root ownership and fake listener/write drainage do not fence/join these continuations before normal/signal directory cleanup (rule12); claimant confirms no earlier owner. Enroll existing shared whole-case ownership before acquisition, adopt the root and join/fence the complete callback before fixture/root disposal.","file":"hub/test/doctor.test.ts","line":19},{"severity":"medium","text":"HubRefusal stores server refusal metadata in Error.code, colliding with existing OS-transport classification. cli/task.ts:369 treats every defined code as unreachable, so an answered forbidden/unauthorized result now prints 'does not answer'; doctor/users.ts:38 also interprets errno-like codes as offline. Preserving Error.message alone is insufficient. Use distinct refusal metadata or migrate every classifier, with an existing-consumer regression; claimant confirms no approved disposition.","file":"shared/socket-client.ts","line":23}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards1medium/Spec1medium. A-20689 full review at5502f2069/tree5dc5eab9 vs3ec545abe; A-20691 corrects two expanded help-row tiers (cli-help T2, compatibility T1), execution claims unchanged. Doctor callback tempProject/fake/FS/probe sequence has no before-acquisition whole-case owner joining/fencing normal/signal cleanup; root/listener owners alone insufficient, claimanta6015a3a confirms. HubRefusal.code collides with task.ts:369 code!==undefined unreachable classification: forbidden/unauthorized result now says does not answer; doctor/users errno reader also affected. Claimantddac74ab confirms missed migration, prior unaffected dispositions superseded; use distinct refusal metadata or migrate all classifiers with consumer regression. C1failed, no verified criteria. Intended Doctor allowlisted class/raw-message omission, previous wire fallback, Check shape, exact DOCTOR_USAGE fixture/assertion, skill and additive historical QA correction inspected. All152A-20686rows retained/expanded169; missing direct/fake/site consumers included. Candidate26/26 before final secret strengthening; focused1/1/help9 at committed head, compatibility1/hubtyping0/lint0refusals122report-only with original epoch/raw/tree/native limits. No configured/browser/QA/native-performance proof. No Reviewer runtime/compiler/lint/generator/probe/edit/retry/merge. Consolidate both findings and request fresh clean-head source review before Coordinator window.

Criteria: C1 failed (New test lacks whole-case setup/body cleanup ownership; shared HubRefusal.code collides with existing errno/unreachable consumers, changing answered refusals into no-answer diagnostics.).

### impl-1662 · 2026-11-17T06:17:40.409Z

Source-review fixes pushed at 151a3ead24f210514742af67634107a042b81b5d, tree 4135b2d9093e24cd119b2b5151060553cde7e4f6. A-20694 corrects A-20686 consumer dispositions and adopts reviewer 169-row inventory A-20689 plus tier correction A-20691. HubRefusal.refusalCode no longer collides with OS code; new runTask consumer regression red before fix and green afterwards. Both new cases use shared pre-acquisition whole-case owner. Local macOS Node24.21: doctor 27/27, hub typecheck, help controls 10/10; lint still running. No configured verification yet.

### rev-36 · 2026-11-17T06:26:12.372Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1662-source-2
commit: 151a3ead24f210514742af67634107a042b81b5d
scope: full
findings: [{"severity":"low","text":"remoteDoctorCase owns and drains root acquisition, but step(() => tempProject(owner.fixtures)) has no separately named setup deadline. tempProject/ensureAccountFixture do not supply one; the fake listener bound covers only later setup. Use owner.wait for the root setup step so a stuck acquisition gets a local diagnostic (rule9); lifetime ownership is already fixed. Claimant6a9bb926 confirms.","file":"hub/test/doctor.test.ts","line":25}]
finding_counts: {"high":0,"medium":0,"low":1}

Standards1low/Spec0. A-20703 full source clearance at151a3ead2/tree4135b2d9 directchild5502f2069/no dev merge. Both mediums resolved: HubRefusal.refusalCode leaves OS Error.code absent, preserving unchanged task.ts/doctor-users transport classification; new exact task CLI consumer red then green retained. Both new cases enroll caseDeadlines normal/signal ownership before acquisition, adopt captured root and fence/join caller steps before fixture/root cleanup. Remaining low doctor.test.ts:25 root tempProject setup lacks separately named deadline (owner.wait); lifetime join fixed, fake listener separately bounded, claimant6a9bb926 confirms. C1unverified pending completed same-head configured evidence/window or explicit waiver. A-20694 candidate taskred/pair2/whole27/help10/typecheck0 and request lint0refusals122report-only retained with dirty/indentation/raw/native-signal limits. All169consumer rows retained with corrected usageT1/helpT2, faulty old unaffected dispositions superseded; oldwire/Check/help bytes/messages/HubTimeout/requestSent stable. Required exact task-consumer and remote-doctor ordinary/load positives plus existing consumers beyond exit. No Reviewer runtime/test/compiler/lint/generator/probe/edit/retry/merge. A low fix changing head still needs new source review.

### impl-1662 · 2026-11-17T07:01:53.459Z

Configured run38903997-4a16-4758-9824-938bd3281288 at reviewed151a3ead24f210514742af67634107a042b81b5d: T0/T1/T2/Web exit0, aggregate6581 passed/0 failed. A-20726 ordinary receipts for both new doctor.test cases and required5/5 load passes each verified (lines16291,16298,16516,16531). Droplet linux x64 Node24.21.0, Chrome Headless Shell156.0.8078.4. T3/T4 not run in task receipt. Exact known fixture false-cause pair at28640–28641 matches Coordinator T-1935 notice; no retry. Reviewer has the evidence for final settlement.

### rev-36 · 2026-11-17T07:12:53.892Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1662-final-1
commit: 151a3ead24f210514742af67634107a042b81b5d
scope: evidence
findings: [{"severity":"low","text":"remoteDoctorCase owns and drains root acquisition, but step(() => tempProject(owner.fixtures)) has no separately named setup deadline. tempProject/ensureAccountFixture do not supply one; the fake listener bound covers only later setup. Use owner.wait for the root setup step so a stuck acquisition gets a local diagnostic (rule9); lifetime ownership is already fixed. Claimant6a9bb926 confirms.","file":"hub/test/doctor.test.ts","line":25}]
finding_counts: {"high":0,"medium":0,"low":1}

Final same-head evidence clearance, using full source review rev-36-1662-source-2 / A-20703. A-20737 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20737-t-1662-final-refusal-and-consumer-evidence-settlement.md) records the independent A-20726 audit for configured run 38903997-4a16-4758-9824-938bd3281288: 6581 ordinary test passes, all 707 expected T1/T2/Web files pass; both required refusal cases have ordinary positive finishes plus five distinct load pass finishes and exact 5/5 proofs. C1 verified. Head 151a3ead24f210514742af67634107a042b81b5d is clean and unchanged; effective suite snapshot tree 2c28fc7004ceafa6d33e971616dc17f0497642b5 is separately recorded. Linux x64 droplet Node24.21.0; actual Headless Shell1248 / Chrome for Testing156.0.8078.4 receipt. Standards: retain the source-2 low named root-setup-deadline finding at doctor.test.ts:25; ownership and refusalCode namespace medium findings are corrected. Spec: clear. Exact fixture cause/adjacent unrelated-output marker at A-20726:28640–28641 matches the recorded T-1935 defect; durable result and phases are positively passed, no retry. All 169 consumer dispositions retained; 63 positive file envelopes, 10 deferred T3 cases, 96 references/helpers. T3/T4 not executed here; queue-enabled merge/occasion policy remains. Budget/lint notices report-only; no native/provider/QA or performance claim. Prior failed source verdict and missing original raw/native/dirty-tree provenance remain historical. Reviewer performed read-only review only.

Criteria: C1 verified.

### coord · 2026-11-17T08:23:50.543Z

Merged ca6c628082b35d94938f87b98f79db00c20037c2 onto dev.
