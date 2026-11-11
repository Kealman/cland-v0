---
id: T-1789
kind: task
title: Dead-login signals mark the login signed out
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1774
  - T-1778
  - T-1784
  - T-1785
topic: topic-1474
branch: t/T-1789-dead-login-signals-mark-the-login-signed
created: 2026-11-09T12:44:11.774Z
updated: 2026-11-11T14:56:22.787Z
closed: 2026-11-11T14:56:22.787Z
---

## Summary

When a harness on a pool host reports a dead login, the hub marks that session's login `signed-out`. The signals are:
- Claude Code: `authentication_failed`, `Login expired`, `OAuth token revoked` or a 401;
- Codex: `refresh_token_reused`, `codexErrorInfo: "unauthorized"` or a 401;
- OpenCode: `provider.auth`.

Placement then skips that host for that harness, the sessions already there keep running, and the human gets one "sign in again" card.

## What to build

The adapters classify these signals and report them through a new optional adapter-host callback, `loginDead`, beside `limitHit`. They report only for sessions on hosts; the local Claude signed-out latch stays as it is for local rows. The hub maps the session to its binding and marks the login signed out; a reader's report marks the login too. The Coordinator gets an Agents line of kind `login-signed-out`. The `login-signin` card is raised through T-1775 once per sign-out, with options "Sign in again" (handled by T-1791) and "Not now", and is withdrawn when the login reads `ready`.

## Acceptance criteria

- [x] C1. Each listed signal from each fake harness on a fake host marks the session's login `signed-out` with its host (test).
  - done: impl-1789 · 2026-11-11T13:16:54.505Z
  - verified: rev-36 [reviewer] · run rev-36-1789-final-1 · 2026-11-11T13:48:12.646Z · commit 1470a7b09c1518781aa566c45d36b4e22c6a7214
- [x] C2. The next launch of that harness in the pool skips that host, and the sessions already on it keep running, with no stop and no exit (test).
  - done: impl-1789 · 2026-11-11T13:16:54.664Z
  - verified: rev-36 [reviewer] · run rev-36-1789-final-1 · 2026-11-11T13:48:12.646Z · commit 1470a7b09c1518781aa566c45d36b4e22c6a7214
- [x] C3. One "sign in again" card is raised per sign-out however many sessions report it, and it folds when the login reads `ready` (test).
  - done: impl-1789 · 2026-11-11T13:16:54.794Z
  - verified: rev-36 [reviewer] · run rev-36-1789-final-1 · 2026-11-11T13:48:12.646Z · commit 1470a7b09c1518781aa566c45d36b4e22c6a7214
- [x] C4. A dead-login signal from a local session changes no login and keeps the local signed-out latch as before (test).
  - done: impl-1789 · 2026-11-11T13:16:55.054Z
  - verified: rev-36 [reviewer] · run rev-36-1789-final-1 · 2026-11-11T13:48:12.646Z · commit 1470a7b09c1518781aa566c45d36b4e22c6a7214
- [x] C5. The Coordinator gets one Agents line naming the login, the host and the signal (test).
  - done: impl-1789 · 2026-11-11T13:16:55.183Z
  - verified: rev-36 [reviewer] · run rev-36-1789-final-1 · 2026-11-11T13:48:12.647Z · commit 1470a7b09c1518781aa566c45d36b4e22c6a7214

## Blocked by

- T-1774
- T-1778
- T-1784
- T-1785

## Notes

- Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/adapters/contract.ts` (`loginDead`), `hub/src/adapters/sessions.ts` (the callback), `hub/src/host/login-signals.ts` (new), `hub/src/host/login-cards.ts`, `hub/src/hub/agents-topic.ts` (the kind).
- Tests: new `hub/test/login-signed-out.test.ts` (T2 with the in-process fakes for classification; T3 cases with the fake binaries on a fake host for C1 and C2).
- Serves epic C8. The signal strings come from the research (Q-1514, Q-1520); the fakes emit them, and real harness output is the live run's.

## Comments

### impl-1789 · 2026-11-11T09:06:45.241Z

Rule 20 sweep before edits: shared suite transitive import graph over all hub/web/nvim test files reaches 703 tests; 15 unknown traversals count as reached. Full lists attached in item-topic artifacts, plus explicit symbol/field consumers across production, skills, docs, QA and every tier. Changes additive: optional AdapterHost.loginDead and Interpretation/Change.loginDead; existing old adapter hosts remain valid. Consumers: Sessions wires callback and interprets hooks; Claude/Codex/OpenCode adapters emit; OpenCode SessionTracker supplies classified change; LoginCards owns sign-in card; Agents lifecycle mapper projects log. Wire shapes unchanged. Store shared operation owned by T-1793 per Coordinator. Existing transition consumers unaffected. Native reach includes host-create-ready, host-destroy-native, host-restart(-reconcile), host-stop, host-unreachable and login-write-back; changed behavior native proofs will use fake harness/host, broader T3 evidence at integrated occasion.

### impl-1789 · 2026-11-11T09:15:16.699Z

WIP committed/pushed at 43e6528f5. Independent targeted component run: 46 passed on local macOS, Node 24.21.0, no browser; public hub callback test remains deliberately red at `records.markSignedOut is not a function`, waiting for T-1793 landing and Coordinator-authorized dev merge. Hub typecheck and closed-item wording lint passed. No full suite, Linux receipt, native-slot proof, review or QA claimed. Detailed outstanding work and evidence in item-topic progress artifact. Keep item in progress/claimed.

### rev-36 · 2026-11-11T09:22:13.232Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1789-source-1
commit: 43e6528f574bbdfa0fd62f3f7a8c14b6c5c65922
scope: full
findings: [{"severity":"high","text":"Signed-out state commits before card/Coordinator publication, with no durable recovery owner; later signals skip signed-out and card startup only sees existing metadata. login-signed-out also lacks JOURNALLED registration. Persist/recover distinct episode publication obligations and positive dedupe receipts across faults/restart without releasing bindings.","file":"hub/src/host/login-signals.ts","line":15},{"severity":"medium","text":"active[name] truthiness reads Object.prototype for valid login name constructor, suppressing its sign-in card. Use own-property/map membership consistently and regress the admitted name.","file":"hub/src/host/login-cards.ts","line":32},{"severity":"medium","text":"Queued ready reconciliation rereads current state while card identity is name-only; ready then new sign-out before the microtask reuses the prior episode/card and never folds it. Preserve durable episode identity/ready boundary; regress rapid cycles without advancing the pinned clock.","file":"hub/src/adapters/sessions.ts","line":827}]
finding_counts: {"high":1,"medium":2,"low":0}

A-18637: authorized early SOURCE pass (Coordinator c0a112c9), Standards0/Spec1high2medium. Implementer confirms all gaps, no omitted recovery/normalization owner. Pin audit complete; repair and fresh committed-head source review. Known markSignedOut missing-method red remains explicit T-1793 dependency under the approved overlap, not final completion; no task-branch merge/cherry-pick authorized. C1/C2/C4 and all runtime proofs remain unverified; local46-case support qualified, no native/Linux pass. Preserve bindings/no-stop/local-latch assertions; update pending docs/consumer migrations before final integration review. T-1791 option1 remains deliberately open. No Reviewer tests/probes run.

Criteria: C3 failed (Card recovery/name membership and rapid sign-out episode identity have confirmed gaps.), C5 failed (Signed-out can persist without recoverable Coordinator publication; new event is not in the domain journal replay input.).

### impl-1789 · 2026-11-11T09:26:20.354Z

Rule 20 extension for signedOut.id: receipt is owned by T-1793; this lane consumes it in LoginCards' episode-aware metadata and Sessions' deterministic existing notice-store key. All card read/replace/withdraw paths use own-property membership. New tests read persisted card payload/metadata, reconstruct owners/reopen SQLite at publication faults, and cover same-clock distinct episodes. Existing generic login.list JSON transports preserve additive fields; no wire type or registration changes. No at fallback (unreleased logins): missing id refuses loudly. signedOutRows read seam/work-budget test will be added only after authorized dev merge; store owner remains T-1793.

### impl-1789 · 2026-11-11T12:31:25.302Z

Authorized dev merge integrated T-1793 markSignedOut/signedOut.id and reconciliation. Extended rule-20 graph A-18685: 698 reached and 15 unknown (count reached). Startup order: Sessions/card owner constructs before LoginReconciliation.start inside restoreSessions; indexed startup sign-out recovery plus change callback covers prior episodes and reconciliation-produced new ones. settledLogin helper now allocates positive provider volumes and callers use its landed fixture semantics; public startup regression uses an OpenCode signed-out key (no key bytes or provider).
Producer sweep A-18684 lists direct/dynamic bare signed-out callers: production login-add and login-signin preparation/complete paths migrated; fixture producers in login-add-component, login-host-pin, login-wait, login-capacity, login-selection, login-reconcile, login-release, login-snapshots, login-records and login-signed-out migrated. QA stage-2 source anchors updated. Failed sign-in tests: login-signin, login-host-pin, login-add-component plus snapshot-failure cases in login-snapshots. Coordinator authorized creating-state markSignedOut, bare transition refusal, and signedOutRows iterator using existing index. No new table/index/trigger. Native signals use existing fake binaries with additive test-only payload selection; defaults unchanged.

### rev-36 · 2026-11-11T12:38:38.781Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1789-source-2
commit: 76e30514f81e2bd50345f02f5c5b68b22a9160a8
scope: full
findings: [{"severity":"medium","text":"The pre-started eventually() observer is only awaited after topic.send succeeds. A thrown/failed send leaves it polling an owned Store during/after closure and eventually rejecting unobserved; no cancellation/join owner exists (Implementer confirmed). Start/await this durable-state poll after the positive send receipt or explicitly own its cancellation and join.","file":"hub/test/login-signed-out-native.test.ts","line":50}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18695 records the completed pinned audit. Standards1medium/Spec0 source findings: all three earlier recovery/name/episode findings are repaired in source, including real T-1793 startup interaction and authorized sign-in producer migration. Only the native observer failure-path ownership fix remains. Fresh committed-head source re-review before native slot/configured verification. No native/Linux pass or C1-C5 verification claimed; no new criterion failure appended for this fixture-only source finding. Earlier failed marks await actual repaired runtime evidence. Consumer graph unions and deferred T3/T4 need final accounting. No Reviewer tests/probes executed; after-stage QA separate.

### rev-36 · 2026-11-11T12:39:54.072Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-1
commit: 0530bd06080485f66541082e9bb884217d5a1b3f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18698; Standards0/Spec0. Full two-file diff closes A-18695's observer ownership finding: durable poll starts only after positive send and is immediately awaited. All episode/binding/placement/no-stop/native-alive assertions retained; no production changes. Prior full source audit remains A-18695. C1-C5 runtime-unverified; native eight-case matrix and exact-head configured Linux receipt unexecuted, no Reviewer probes. Proceed with Coordinator-scheduled native slot at reviewed head, review any required duration delta before verification, then final named-case/consumer-union evidence settlement. Remaining T3/T4/after-stage QA separate.

### rev-36 · 2026-11-11T12:53:24.697Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-2
commit: 77fcbb350806a47a8e64710e3624a203d6121d48
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18706; Standards0/Spec0. Complete six-file fixture-only delta matches Coordinator60d07b85/c7995956/27c516b4: decorate admitted env with scratch fake fields, production filtering final, per-host OpenCode forwarding and physical hc- socket setup. New pure T1 manifest and T2 filesystem-budget controls reviewed; native assertions/ownership unchanged. No Reviewer execution. Initial A-18702 remains 0/8 red; cleanup A-18703 not behavior proof. C1-C5 runtime-unverified. Native retry at reviewed head next; green samples then any allowance-only fresh delta review before configured verify. Final union must include new explicit tests; full T3/T4/QA remain separate.

### rev-36 · 2026-11-11T13:01:16.595Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-3
commit: ec33bbf3b6c5f359e183b77a27f10e170e0e89b4
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18713; Standards0/Spec0. Complete three-file diff: Codex-only physical run layout, host-home cwd, fixed nonsecret OpenCode subscription receipt/wait, owned bounded scanned diagnostics. Independently read Coordinator4c284b0c accepting three native cases with variants in T2 and at most two more slots. All persisted sign-out/binding/alternative-host/no-stop/native-alive assertions retained. No production or allowance changes. Both eight-case runs remain red; cleanup deltas not behavior pass. C1-C5 runtime-unverified, current matrix unexecuted. No Reviewer probes. Follow time-box; no extra slot authorization. Green-sample allowance delta review, exact-head configured verification and final union receipts still pending; full T3/T4/QA separate.

### rev-36 · 2026-11-11T13:06:54.025Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-4
commit: 691f5d2ddcb9402553a0b2cb60c83233b9cbe939
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18716; Standards0/Spec0. Complete three-file fixture/doc delta defines independent login-source role and assigns it to first launch; login-worker stays available for next. Read production #helloRole admission; no product/ownership/assertion/allowance changes. A-18714 remains three red lone cases, A-18715 cleanup only. C1-C5 runtime-unverified; no Reviewer execution. Exactly one native slot remains under Coordinator time-box per request; clearance adds none. Stop/report if final slot not all green. Green timing allowance delta review, exact-head configured receipt and final consumer union remain pending; T3/T4/QA limits unchanged.

### impl-1789 · 2026-11-11T13:11:48.883Z

C1/C2 native coverage scope changed by Coordinator decision31d6dbc2: keep only OpenCode end-to-end native in this item, retain per-harness/every-variant component classification and actual adapter T2 tests. Native Codex and Claude cases move to follow-up T-1813 (Follow-ups). A-18717 retains their final red diagnostics: Codex native hello/role clause succeeded but session.launch reply timed out; Claude native turns ran but dead-login receipt was absent. OpenCode reached sign-out+host, retained binding, next native PID on other host, first PID alive/no-stop, but final stoppedAt expectedundefined vs actualnull made that receipt red. Correcting assertion to persistednull, not treating prior red as pass. Coordinator separately authorizes one OpenCode-only run plus5lone repetitions after fresh source review, then measured allowance-only review/verify.

### rev-36 · 2026-11-11T13:13:18.018Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-5
commit: ad6bfa87bd3ecdc96e40f7acd6ba2d8f8568e70f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18720 (supersedes A-18719 file-count typo); Standards0/Spec0 under independently read Coordinator31d6dbc2. Pinned branch tip from request: ad6bfa87bd3ecdc96e40f7acd6ba2d8f8568e70f. Complete six-file diff removes deferred Claude/Codex native fixture code, retains one OpenCode case and all positive sign-out/binding/placement/alive/no-stop assertions. stoppedAt:null matches production ProcessTable decoder. Task comment/guide explicitly defer Claude/Codex native proof to T-1813; component variants retained. All earlier native reds stay failed. C1-C5 runtime-unverified; no Reviewer execution. Follow Coordinator's one OpenCode run plus five lone repetitions at reviewed head; stop/report if not green. Green-sample allowance-only review, exact-head configured evidence and final consumer-union settlement still pending; T3/T4/QA boundaries unchanged.

### rev-36 · 2026-11-11T13:18:53.911Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-6
commit: d16ff8d2c0816a05f36f7039a0376b1f6dae5ec1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18726; Standards0/Spec0. One semantic allowance addition only; all prior parsed manifest data and report policy unchanged. Six positive named TAP samples A-18721 agree with A-18722; worst6.829408333 x Linux projection1.6 x margin1.5 => ceil17s. Exact identity/ownerC-216/Nov11–Nov18 correct. Linux10.9270533328s is explicitly unexecuted projection. C1-C5 remain unverified at source stage. No Reviewer execution. Proceed with exact-head mode-free verification. Final evidence needs original native argv/cwd/completion linkage (TAP alone lacks it), preserved T-1806 cleanup qualification/origin c539c329, and full consumer-union dispositions; no provenance-only rerun. T-1813 native deferral, earlier reds and T3/T4/QA boundaries remain explicit.

### rev-36 · 2026-11-11T13:20:39.507Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1789-evidence-1
commit: d16ff8d2c0816a05f36f7039a0376b1f6dae5ec1
scope: evidence
findings: [{"severity":"medium","text":"Configured T0 fails because the guide heading is not its exact repository test path. The component guide hub-test-login-signed-out.test.ts.md:1 has the same defect; generator line7-8 requires # <test path>. Correct both headings and regenerate the index before fresh source review/verification.","file":"docs/agents/tests/hub-test-login-signed-out-native.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18728/A-18727: run5efb8133 host check exit1, no droplet created. T1/T2/T3/T4/Web unexecuted; counts unavailable, platform/browser null. C1-C5 remain unverified; no new product behavior criterion failure inferred from T0-only receipt. Invalid guide headings were missed in earlier source review; this evidence verdict corrects it. Fresh committed docs/index delta review then configured retry. Native samples/qualifications and Coordinator limits retained; no extra native run requested. No Reviewer execution.

### rev-36 · 2026-11-11T13:22:27.266Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-delta-source-7
commit: 1470a7b09c1518781aa566c45d36b4e22c6a7214
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18731; Standards0/Spec0. Entire three-file docs-only delta fixes both exact-path headings and sorted generated index entries, addressing observed T0 cause A-18728. No test/runtime/allowance changes. Prior5efb8133 remains T0red/no droplet/later phases unexecuted. C1-C5 remain unverified; submit fresh exact-head configured verification. Independently read Coordinatorc539c329 in topic1425 accepting twelve known T-1806 socket dirs with retained count/no-zero-leak qualification. Native parent evidence and T-1813 deferral remain explicit; final native linkage/case/file/consumer-union reconciliation pending. No Reviewer execution; no extra native run requested.

### rev-36 · 2026-11-11T13:48:12.647Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1789-final-1
commit: 1470a7b09c1518781aa566c45d36b4e22c6a7214
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

FINAL CLEAR, A-18739; Standards0/Spec0, C1-C5 verified under Coordinator31d6dbc2 (native OpenCode here, Claude/Codex native T-1813; all variant/adapter component seams pass). Same-head53625592/A-18736 exit0:6049 base test passes,0fail/cancel/skip,145 separate load passes; T0/allT1/fallbackT2/selected3T3/T4guard base/Web completed. Independent ledgerA-18737:723 required=479 positivefiles(80T1/343T2/52Web/3T3/1T4)+244deferred(231T3/13T4), zero missing lower/Web; original/merged graphs+all15unknowns+explicit tests retained. AuthorA-18738 matches union and584 cited receipt rows checked exactly against raw log, no mismatch. Native OpenCode Linux8.889517445s<17s; six macOS parent-runtime-identical passes linkedA-18721/22/30, argv/cwd/p.wait/outerexit limits explicit, no separate signal tuple inferred. Known12externalT-1806 socketdirs accepted by independently readc539c329/A-18733; no zero-leak claim. Linuxx64 kernel147/Node24.21/Nvim.12.5/CfT156 HeadlessShell1248, exportedtree021663ec5f085576edad3d1f41254d7d0ab1110d, cachednull, c8lon1 lifetime1177s/$0.0817. All earlier native/configured reds remain failed history. Full remainingT3/T4/repetitions and affected after-stageQA separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-11T14:56:22.787Z

Merged f1071098238ed3aa9aa4ff73fe5e3e685a8bdbdf onto dev.
