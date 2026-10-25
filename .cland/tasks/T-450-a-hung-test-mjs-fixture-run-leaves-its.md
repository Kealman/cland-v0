---
id: T-450
kind: task
title: A hung.test.mjs fixture run leaves its runner and child alive for hours (orphan from the hung-run tests)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1282
blocked_by: []
regression_of: T-385
topic: topic-1060
branch: t/T-450-a-hung-test-mjs-fixture-run-leaves-its
created: 2026-10-15T03:49:38.455Z
updated: 2026-10-25T18:15:50.639Z
closed: 2026-10-25T18:15:50.639Z
---

## Summary

impl-397 found two orphan node processes, about 15 h old (PID 48761 under PPID 1, and its child 48920), at 0% CPU. They were running `hung.test.mjs` from the suite directory `/private/tmp/cland-suite-cb5d74ec-…`. They are the leftover of T-385's hung-run test fixture from a run on 2026-10-14 about 12:25Z, which survived both its suite and the phase orphan sweep. The Coordinator terminated them on 2026-10-15 03:50Z, after checking the command lines. The hung-run tests must reap their own hung child even when the run times out, and the phase sweep should catch such a runner.

## Acceptance criteria

- [x] C1. A test that starts a hung fixture run kills its runner and children on every exit path, and the file passes 5/5 with no node process left afterwards.
  - done: impl-450 · 2026-10-25T17:33:53.319Z
  - verified: rev-31 [reviewer] · run rev-20261025-450-final · 2026-10-25T18:09:52.687Z · commit d6ac914db9de233c160c37fa93057bd501226390
- [x] C2. The runner's phase sweep reports a leaked hung fixture runner, proven by a test that leaks one on purpose.
  - done: impl-450 · 2026-10-25T17:33:53.410Z
  - verified: rev-31 [reviewer] · run rev-20261025-450-final · 2026-10-25T18:09:52.687Z · commit d6ac914db9de233c160c37fa93057bd501226390

## Comments

### impl-450 · 2026-10-25T17:09:26.585Z

Clean inherited worktree. TDD seams authorized by launch brief: T3 real hung run ownership/OS PID termination (C1), runner phase sweep output + OS PID termination for an intentionally leaked hung node:test runner (C2). No product wire/schema/admission contract change planned. Read A-11669 row T-450; current hung case has neither PID ownership nor post-run death assertions. Parent E-1282 has after-stage QA scope none; no per-item brief.

### impl-450 · 2026-10-25T17:18:51.215Z

C1 red: both sealed fault controls initially failed on macOS/local with `hung fixture PID 92741 survived setup failure` / `hung fixture PID 93911 survived assertion failure`. Fixed by registering verifier-owned cancellation/terminal receipt before fixture socket disposal, plus live PID ownership and final OS death assertions. C2: added intentionally leaked detached node --test hung runner+worker regression; current sweep already handles it. Negative control temporarily omitting completed-phase sweep failed `/cleanup pid 12217:.*hung.test.mjs/`; restoring it passes (~0.6s macOS). No run-suite.ts product change; no command/help/permission or wire consumers to migrate. Updated per-file docs, index and implement skill/CHANGES; role clause unchanged at its byte reserve.

### rev-31 · 2026-10-25T17:23:05.858Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-450-source1
commit: ae3aa1a972a7fd5f9f77dbee2b9dd63fd2240630
scope: full
findings: [{"severity":"medium","text":"M1: new phase-leak regression registers emergency PID/phase-root ownership only after marker receipt/assertion; missing/torn setup skips it. Generic run helper's later raw t.after follows fixture's earlier directory cleanup hook, so writers/root can outlive removal. Pre-register deferred enclosing cleanup before creation/launch, own/drain runner+pipes and discoverable phase root before removal, with missing-marker early-failure control; preserve primary sweep assertions.","file":"hub/test/suite-runner.test.ts","line":1056},{"severity":"medium","text":"M2: receipt observer accepts stdout prefix before complete JSON/newline, then parses immediately; arbitrary pipe chunk splitting can reject a valid in-flight setup receipt. Observe fully parsed newline record/root/two PIDs within existing bound (or durable equivalent), fail closed on process close, and exercise split receipt without sleep/timeout relaxation.","file":"hub/test/suite-timeouts.test.ts","line":127}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source NOT CLEAR; A-12051 complete Standards2medium/Spec-no-separate-findings audit at tree5a2d9d6013435e0b14199373cc3d1b99a6162f72. Normal exact-job cancellation/terminal receipt before client/hub disposal and native timeout/OS death assertions are sound; deliberate sweep primary proof must stay distinct from emergency cleanup. Fix only narrow lifecycle/receipt paths preserving assertions and sealed env. Local A-12048 TDD summary/first10-case file and ongoing repetitions remain attributed prior-head evidence, not final5/5/Linux or timing enforcement. Preserve original outputs/source/capture limits without transcription reruns. Push correctedhead/fresh source before verify, restore marks when appropriate; no dev merge/production expansion directed. Reviewer read-only.

Criteria: C1 failed (New failure controls accept a partial stdout prefix as the completed PID receipt; valid fragmented receipt can fail before cleanup assertions.), C2 failed (New deliberate-leak fixture emergency cleanup depends on receiving its marker; early failure can remove roots before the generic runner stop hook.).

### rev-31 · 2026-10-25T17:32:21.260Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-450-source2
commit: a07f5563652f83fbadfbcbd41bb51462be6b93ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source CLEAR, Standards0/Spec0; A-12057 carries complete A-12051 audit plus all5b040a06/a07f5563 corrections at treeb5009b0c5c2edc76c16006e453f89ff7e3770b81. M1 resolved: pre-registered deferred token/phase ownership, capture holder then discover/stop enclosing writers and drain native close before phase sweep/removal; guarded fixture removal, missing-marker fault control, emergency paths after primary assertions. M2 resolved: complete newline/parsed scratch root/two distinct valid PIDs, existing15s bound, split-receipt scratch acknowledgement proves prefix not completion. Original exact-job terminal/timeout/OS death/sweep diagnostics retained; no product/wire/permission/allowance/dev-merge change. Intermediate5b040a06 explicitly superseded before verdict. A-12048/A-12052 prior-source evidence historical; current correction summaries and underway5x timeout file need exact source/native-output attribution; timeout source unchanged5b→a07, current sweep checks pending. Finish authorized serial proof/targeted sweep controls, restore claimant done once supported, then one mode-free verify at unchangedhead and final evidence. C1/C2 not verified here. No transcription reruns or broader execution directed. Reviewer read-only.

### rev-31 · 2026-10-25T17:49:12.022Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-450-source3
commit: d6ac914db9de233c160c37fa93057bd501226390
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Manifest-only corrected source CLEAR, Standards0/Spec0; A-12075 carries complete A-12057/A-12051 audit. Exact treeb02ec9a66bd2d33c34e7a57598d36d7c4e9fa9b9. Three allowances only: setup6.135/assertion5.907/split5.677s, independently ceil1.5x raw passing Linux A-12071 samples4.089820006/3.937697581/3.784515268. Lifecycle reasons/run attribution, open nearest ownerE-1282 and seven-day UTC dates validated; existing baselines/E-880/other suggestions untouched. Runtime/test sources/assertions/timeout bounds unchanged, no dev merge. Independently checked priorhead3299ordinary/62changedT3passes and all A-12061 local5x11 plus2sweep original logs, with mixed5b→a07 identical-timeout-source provenance; no newhead runtime verified. C1/C2 done; submit one ordinary mode-free verify at unchangedd6ac914d then final evidence. No additional local repeats for manifest-only correction/transcription or product expansion. Reviewer read-only.

### rev-31 · 2026-10-25T18:09:52.687Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-450-final
commit: d6ac914db9de233c160c37fa93057bd501226390
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR; C1/C2 verified. A-12084 carries full source A-12057/A-12075 and independent original-output audit. Exact-head ff2cc07f/A-12081: 3299 ordinary passing typed finishes, no failures/cancellations/skips/TODO or additional load-gate finishes. Host T0, all T1, fallback all hub+Neovim T2, two changed T3 files/62 identities once, Web completed; remaining T3 deferred, no T4/all claim. Native normal-hung/setup/assertion/split/sweep/missing-marker all pass; new timed cases 5.319716105/4.717668260/4.894390342 s within reviewed 6.135/5.907/5.677 s caps. A-12061 original five whole timeout-file runs 55/55 plus two sweep controls accepted with identical timeout blob/runtime across 5b→a07, not relabelled current-commit starts; positive PID death/root cleanup assertions supplement no-hung-command scans. Linux droplet c-8 nyc1, Node24.21/Nvim0.12.5, Headless Shell156/v1248 for Web; lifetime921s/$0.0640 distinct from suite wall. Host gate TREE40b5aa05 reused, not alternate source commit/remotely repeated typecheck. Selected T3 wall93.573s excludes machine wait. Report-only lint133/60,14 budget warnings,7 missing baselines, Web173.665>40s and T3 growth+17.266s/incomplete base retained, not enforcement passes. Prior A-12071 historical; no source changes/extra reruns. QA none. Coordinator owns enqueue/separate pre-merge checks. Reviewer read-only.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T18:15:50.639Z

Merged 2bb29ff89f34c1600d101bbd973e9e97f8e060d0 onto dev.
