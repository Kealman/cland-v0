---
id: T-488
kind: task
title: "cland hub reload: re-read config.toml and roles.toml without a restart (SIGHUP too)"
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: topic-329
branch: t/T-488-cland-hub-reload-re-read-config-toml-and
created: 2026-10-15T11:30:17.553Z
updated: 2026-10-16T05:30:11.713Z
---

## Problem

`.cland/config.toml` and `.cland/roles.toml` are read only when the hub starts, so every routine change waits for a hub restart. On 2026-10-15 the remote budget (D31) and the spend cap (D33) both waited for a restart, and a restart waits for an empty verify queue and no droplets. `hub/src/cli/hub.ts:238` ignores SIGHUP today. The human decided on hot reload (D34).

## Solution

Add `cland hub reload`, which also runs on SIGHUP. It re-reads `.cland/config.toml` and `.cland/roles.toml`, validates both, and applies them atomically. On a parse or validation error the old config stays in force, and a `config-reload-failed` event with the file and error is journaled. A new config applies only to verifications, leases and launches that start after the reload; running ones keep the config they started with. Reuse the last-good pattern from T-455's RULES.md reload.

## Acceptance criteria

- [x] C1. `cland hub reload` and SIGHUP both re-read config.toml and roles.toml, validate them and apply both atomically, so a changed `remote_budget`, `daily_spend_usd` or role default takes effect without a restart.
  - done: impl-488 · 2026-10-16T02:48:53.488Z
  - verified: rev-31 [reviewer] · run rev-20261016-488-source-3 · 2026-10-16T02:49:54.457Z · commit 37c3f4efa2f781b9a76b848cac9b5e209440f8bf
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-4 · 2026-10-16T03:10:19.209Z · commit 72faa365f61064eec819cf9cea9a48f6f71d6715
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-5 · 2026-10-16T03:51:12.026Z · commit bfc146576230846994be376ebbe073d2188acb92
  - verified: rev-31 [reviewer] · run rev-20261016-488-merge-source · 2026-10-16T04:26:19.977Z · commit 3ba2b30bed4547b6b3f3c4b034aab57a665a2c00
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-6 · 2026-10-16T04:55:51.782Z · commit 364c1c22af0191a69673b22b80d29ac839ef6f9b
- [x] C2. A parse or validation error in either file keeps the whole previous config in force and journals `config-reload-failed` with the file and error; the CLI exits non-zero and prints the error.
  - done: impl-488 · 2026-10-15T23:45:16.991Z
  - verified: rev-31 [reviewer] · run rev-20261016-488-source-2 · 2026-10-16T00:01:17.145Z · commit 7b8c92b36c082509ca88ced2ad5efec47b6bac51
  - verified: rev-31 [reviewer] · run rev-20261016-488-source-3 · 2026-10-16T02:49:54.457Z · commit 37c3f4efa2f781b9a76b848cac9b5e209440f8bf
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-4 · 2026-10-16T03:10:19.209Z · commit 72faa365f61064eec819cf9cea9a48f6f71d6715
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-5 · 2026-10-16T03:51:12.026Z · commit bfc146576230846994be376ebbe073d2188acb92
  - verified: rev-31 [reviewer] · run rev-20261016-488-merge-source · 2026-10-16T04:26:19.977Z · commit 3ba2b30bed4547b6b3f3c4b034aab57a665a2c00
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-6 · 2026-10-16T04:55:51.782Z · commit 364c1c22af0191a69673b22b80d29ac839ef6f9b
- [x] C3. Verifications, leases and launches already running keep the config they started with; only those started after the reload use the new one, and a test proves both sides.
  - done: impl-488 · 2026-10-15T23:45:40.291Z
  - verified: rev-31 [reviewer] · run rev-20261016-488-final · 2026-10-16T04:18:09.949Z · commit bfc146576230846994be376ebbe073d2188acb92
  - verified: rev-31 [reviewer] · run rev-20261016-488-merge-final · 2026-10-16T05:30:11.244Z · commit 364c1c22af0191a69673b22b80d29ac839ef6f9b
- [x] C4. `cland hub status` shows the loaded config's time and the source commit of config.toml.
  - done: impl-488 · 2026-10-15T23:46:10.917Z
  - verified: rev-31 [reviewer] · run rev-20261016-488-source-2 · 2026-10-16T00:01:17.145Z · commit 7b8c92b36c082509ca88ced2ad5efec47b6bac51
  - verified: rev-31 [reviewer] · run rev-20261016-488-source-3 · 2026-10-16T02:49:54.457Z · commit 37c3f4efa2f781b9a76b848cac9b5e209440f8bf
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-4 · 2026-10-16T03:10:19.209Z · commit 72faa365f61064eec819cf9cea9a48f6f71d6715
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-5 · 2026-10-16T03:51:12.026Z · commit bfc146576230846994be376ebbe073d2188acb92
  - verified: rev-31 [reviewer] · run rev-20261016-488-merge-source · 2026-10-16T04:26:19.977Z · commit 3ba2b30bed4547b6b3f3c4b034aab57a665a2c00
  - verified: rev-31 [reviewer] · run rev-20261016-488-delta-6 · 2026-10-16T04:55:51.782Z · commit 364c1c22af0191a69673b22b80d29ac839ef6f9b

## Comments

### impl-488 · 2026-10-15T22:37:51.531Z

Implemented staged config/roles publication, CLI+SIGHUP reload, rollback journaling and status provenance. Added per-verification configuration and runner-limit snapshots, loaded-policy droplet admission/status, and startup-field refusals documented in hub/README.md. Full typecheck green. Initial CLI rollback/provenance test green; expanded CLI/signal/launch and fake-provider lifecycle tests await the required free Mac window (local suite impl-493 currently active).

### impl-488 · 2026-10-15T22:46:20.248Z

Coordinator clarified C3: capture and persist configuration at actual scheduler admission, not submission. Implemented that boundary, including reloaded default executor for queued requests; active runs/leases retain their persisted snapshot. New remote test queues a job before reload, then asserts that it uses the new cap. Expanded tests remain unrun because the Mac is busy and the Coordinator has now reserved the next slot for T-544.

### impl-488 · 2026-10-15T23:41:09.974Z

Source review requested from Reviewer at pushed head 7caccc103e9cf53da9b2d341a79da0a57d21089c after a clean origin/dev merge. Quiet Mac targeted files passed serially: config-reload 3/3, config-reload-remote 1/1, existing roles 8/8. Full typecheck and shard lint passed. Evidence artifact A-3462. Review clear must precede exact-head verification; no suite submitted yet.

### rev-31 · 2026-10-15T23:42:49.955Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261015-488-source-1
commit: 7caccc103e9cf53da9b2d341a79da0a57d21089c
scope: full

Source review not clear at 7caccc103e9cf53da9b2d341a79da0a57d21089c, run rev-20261015-488-source-1, scope full. Fixed point c30b2666 (the merged origin/dev parent); 24 changed files. No edits or tests performed by Reviewer.

## Standards
No additional actionable smell or documented-standard findings. The implementation uses staged pair publication, async file/provenance reads, immutable job configuration references and serial reload work. Targeted source-review artifact A-3462 reports both new files 4/4, existing roles 8/8, typecheck and shard lint green; reviewed diff check passes. Both review axes were performed in this session because the role disables delegation.

## Spec
Medium — hub/src/hub/configuration.ts:89: unconditional readFile(config.toml) breaks the existing missing-config/defaults mode for role refresh. serveProject/readProjectConfig accept an absent config, ProjectConfiguration's constructor uses defaultConfig and start() also tolerates absence, and ensureSkeleton never creates config.toml. A project started in that supported state can load roles initially, but every subsequent roles.toml edit reaches fresh() → reload() and throws ENOENT here before reading/publishing roles. The edit is remembered in attemptStamp, so it cannot take effect until the user creates a config file or restarts. This violates C1's changed-role-default behavior and the explicit requirement to retain roles auto-refresh.

Preserve the absent-config/default interpretation when preparing the pair (or otherwise maintain the supported startup mode), and cover a project with no config file whose roles are edited after startup. Explicitly invalid existing files must continue to reject the whole pair, rather than being treated as defaults. No production verification should run before a corrected-head source review.

Other source paths reviewed: Coordinator 2d89ee81-9031-495b-9639-c60a0c002e9f approves retaining role refresh and refusing documented startup-only fields. CLI and SIGHUP share reload, failed parsing/validation precedes publication, failure events carry file/error, and status includes loadedAt/last config-file commit. Coordinator 6a91fc6b-ed49-465b-a6eb-bb10bddc88d4's actual-admission rule is reflected in persisted job snapshots; queued defaults follow updated policy while run/lease deadlines and harness launch parameters retain old settings. New tests exercise the core rollback/provenance, signal, launches and active/queued remote cases, but every reload fixture creates config.toml before exercising refresh, leaving the missing-file regression uncovered.

C1 failed for the supported no-config role-update path. C2–C4 remain unverified; their reviewed source/targeted evidence does not waive the blocking finding or replace the final exact-head gate.
Standards: 0 findings. Spec: 1 medium finding.
Review artifact A-3466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3466-t-488-source-not-clear-missing-config-prevents-role-refresh.md

Criteria: C1 failed (An absent config.toml is supported at startup, but configuration.ts:89 makes every later roles refresh fail ENOENT before applying edited role defaults.).

### rev-31 · 2026-10-16T00:01:17.145Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-source-2
commit: 7b8c92b36c082509ca88ced2ad5efec47b6bac51
scope: full

Corrective source review clear at 7b8c92b36c082509ca88ced2ad5efec47b6bac51, run rev-20261016-488-source-2, scope full. Rechecked the single correction from 7caccc10 with the original full review; no dev merge or unrelated picks. Prior medium finding A-3466 resolved. No high, medium or low findings remain.

## Standards
No additional documented-standard or smell-baseline findings. Missing-file handling catches only ENOENT, preserving parse/permission/I/O errors for rollback; it does not write either input file. Result types and journal event registration cover warnings. Diff check passes. Both axes reviewed within this session under the no-delegation role.

## Spec
C1 verified: configuration.ts:90-93 now retains the loaded immutable config when the file is absent; initial startup's loaded config is the built-in defaults. Valid role edits still reach staged publication. C2 verified: an existing invalid config or roles file still fails before either publication; earlier atomically validated snapshot stays in effect, CLI returns error and journals file/error. C4 verified: retained config preserves loadedAt/sourceCommit; successful new-config loads report their time and last config-file Git commit.

Coordinator policy 2eeff3e2-19e8-4f25-8687-98b54cf9d859 explicitly requires this distinction. Missing-file CLI results and auto-refresh journal config-reload-warning contain the exact warning; README documents initial absence, deletion and invalid-file behavior. Stamps still reject inputs that change during reload.

The added real frame/CLI regression removes a loaded config, edits roles, observes automatic publication, checks retained budget and provenance/time, checks explicit reload/journal warning, then recreates an invalid file and verifies both prior role and config survive. A-3482 checked: config-reload whole file 4/4, typecheck/shard lint green reported; labelled loaded Mac alongside local T-517 verify, admission load 11.04 and no other targeted process. A-3462 unchanged remote admission/lease and roles lifecycle receipts stand.

C3's source snapshot paths remain reviewed: actual scheduler admission captures/persists policy, queued work uses new policy, active jobs/leases and launched harnesses retain old settings, per Coordinator 6a91fc6b. C3 remains unverified until exact-head verification confirms the runtime tests. Source clear does not lift the Coordinator's current verification hold; submit only after its release. No Reviewer edits/tests; no per-item QA criteria.
Standards: 0 findings. Spec: 0 findings.
Review artifact A-3488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3488-t-488-corrected-source-clear-at-7b8c92b3.md

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T01:49:39.894Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-488-evidence-1
commit: 7b8c92b36c082509ca88ced2ad5efec47b6bac51
scope: evidence

Medium — hub/test/suite-timeouts.test.ts:68,83,128,165: these write test_timeout/stall_timeout after suite-fixture.ts:17 starts the hub, then launch without reload. T-488's loaded policy retains defaults/previous values, so the four shortened-deadline assertions fail at:73,:98,:141,:179. Medium — hub/test/executor-prepare.test.ts:232: writes prepare_size=big after fixture starts the hub and calls prepare without reload; c-8 remains loaded, so oversized refusal at:234 never arrives. Update the real fixtures to set policy before startup or explicitly reload/acknowledge after changes, including later restoration; retain assertions/bounds and audit other post-start config writes. These are task integration failures, not external merely because test files are unchanged.

A-3576 same-head local Darwin2e535b8e exit1:1852pass/5fail. Own config-reload cases all5 pass ordinarily and each5/5 load repetitions. No active/new snapshot defect established, but C3 final gate remains unverified; C1 failed integration. Neovim not reached. Other gate blockers: knownT-556 dynamic-title0/5, demo watchdog4/5 and hook-bridge-doctor duration6.653>5s. Full details/categorized asides A-3579: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3579-t-488-evidence-not-clear-fixtures-omit-config-reload.md. Corrected-head source review required before another verify; no Reviewer edits/tests.

Criteria: C1 failed (Existing timeout and prepare fixtures edit config after hub startup without applying reload; loaded-config semantics leave old policy active and five mandatory cases fail.).

### rev-31 · 2026-10-16T02:49:54.457Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-source-3
commit: 37c3f4efa2f781b9a76b848cac9b5e209440f8bf
scope: delta

Corrective delta source clear. A-3579/C1 fixture integration resolved. Standards: no findings. suite-fixture initial verification policy is written before serve while preserving old config-string callers,budget/cache/lock. All five timeout-setting cases use initial policy; no assertions/deadlines changed. executor-prepare preserves existing config/lock and acknowledges hub.reload after both big/c-8 runtime edits. Parsed manifest differs from Coordinator2149fe33 only by unchanged original9.72s reasoned remote-reload allowance; other textual churn is JSON Unicode escaping/order. Diff check passes.

Spec: no findings. Runtime assertions now observe loaded intended policy; production reload/snapshots/rollback/missing-file/provenance source unchanged from A-3488. A-3619 source audit and quiet serial supporting7/7suite-timeouts +17/17executor-prepare inspected,37.01/60.13s,localnone/guardclear/load3.91/4.32; typecheck/shards green reported. T-555 original pre-snapshot failure is not claimed fixed. C1 restored, C2/C4 reverified unchanged; C3 remains pending final exact-head gate. Source clear does not override Coordinator verification scheduling. No Reviewer edits/tests or per-item QA criteria.
Artifact A-3621: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3621-t-488-corrective-fixture-delta-source-clear-at-37c3f4ef.md.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T03:09:19.294Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-488-evidence-2
commit: 37c3f4efa2f781b9a76b848cac9b5e209440f8bf
scope: evidence

Evidence not clear yet: localDarwinA-3629/e24b58d5 exit1. All1857 ordinary hubtests and allfive config-reload5/5 repetitions pass; earlier fixture integration red is resolved. Sole red suite-runner.test.ts:343 timestamp0/5 is knownT-556. No new task source defect or criterion failure inferred; sourceC1/C2/C4 remain current. C3 stays unverified pending explicit Coordinator accepted-gate/platform disposition and missing Neovim phase evidence. This fullmode hub-only completion is neither Linux nor full hub+Neovim evidence. Known duration notices are not new budget failures. Do not run/pick again without current Coordinator scheduling; changedhead needs source review.
ArtifactA-3630: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3630-t-488-corrected-gate-pending-known-t-556-disposition-and-neovim.md. No Reviewer edits/tests.

### rev-31 · 2026-10-16T03:10:19.209Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-delta-4
commit: 72faa365f61064eec819cf9cea9a48f6f71d6715
scope: delta

Delta source clear:37c3f4ef..72faa365 changes only suite-runner.test.ts+4/-2, exact posted576404e8. Stable label with timestamp in body retains all assertions/bounds/cleanup. Standards/Spec:no findings. Production reload/fixture/manifest bytes unchanged; A-3621 source-3 remains applicable. C1/C2/C4 reverified; C3 awaits finalgate. Shared T-556 proof A-3593 is under its explicit batch exception, not a green task Linux run; no unchanged test-only retest needed. Diff check clean, no Reviewer edits/tests.
Coordinator453f7fb8 independently confirmed: A-3629 accepted Mac hub-phase evidence only; fullmode shared protocol still requires Neovim. After source clear submit once explicit --executor droplet --fresh; receipt must reach Neovim green. Named hub-phaseT-555/T-565 exceptions only. ArtifactA-3632: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3632-t-488-shared-stable-name-delta-source-clear-at-72faa365.md.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T03:44:03.037Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-488-evidence-3
commit: 72faa365f61064eec819cf9cea9a48f6f71d6715
scope: evidence

Evidence not clear. Medium—hub/test/durations.json:3090 lacks measured allowance for new config-reload.test.ts:75 role-refresh identity,6.631s>5s(A-3651:6013). Add exact reasoned measured allowance or reduce runtime while preserving assertions/bounds. Allfiveowncases pass ordinarily+5/5; no task behavior defect inferred, C3 finalgate stays pending.
Linux59571add/A-3651:1852pass/2fail/3skip,exit1,Neovim not reached. OutsideBugs/S—demo.test.ts:69 start fails demo deadline reached during delivery; not named in prior453f7fb8 exceptions, needs leadclassification. OutsideBugs/S—session-model.test.ts:108 reversed identical childrows is exactknownT-544/postedsort08f09c7c. SourceC1/C2/C4 remain current; no criterion failed by this evidence pass. Any allowance/sharedpick head needs delta before verification; Neovimgreen still required. No Reviewer edits/tests.
A-3654: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3654-t-488-linux-gate-not-clear-own-duration-budget-and-outside-failures.md (role-refresh declaration is line75; artifact approximate line80 should read75).

### rev-31 · 2026-10-16T03:51:12.026Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-delta-5
commit: bfc146576230846994be376ebbe073d2188acb92
scope: delta

Delta source clear.72faa365..bfc14657 only exact shared08f09c7c child-order sort and measured6.631s ownrole-refresh allowance. Sort preserves duplicates/count/identities/models and allfive mappedfields. Allowance matchesA-3651 measurement with specific real-work reason; no runtimebound/assertion change. JSON/diffcheckclear. Standards/Spec:no findings;A-3654 budgetfinding resolved. C1/C2/C4 reverified unchangedsource;C3pending.
A-3661 inspected:branch5x7/7+detacheddev516cac6d5x7/7,70pass/0fail/skip,quietserialguards/load<10,unchanged2500msdeadline. Coordinator d84aa98e independently accepts comparison and directs one freshdroplet afterdelta. RepeatLinuxdemo:69 deadline-during-delivery isT-488's tofix withLinuxprobe. Receipt must reachNeovimgreen; only namedT-555/T-565/T-566/T-567/T-568 exceptions. No Reviewer edits/tests.
ArtifactA-3666: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3666-t-488-allowance-and-child-order-delta-clear-at-bfc14657.md.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T04:18:09.949Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-final
commit: bfc146576230846994be376ebbe073d2188acb92
scope: evidence

Finalclear atunchangedbfc14657. FreshLinux463f653f/A-3691 fullmodeexit0:2250tests/2244pass/0fail/6platformskip. Hubfree38/38,machine1816pass+3skip,fullNeovim390pass+3skip.4workers,Node24.21.0,Neovim0.12.5. No failingloadgate/newhardbudget or knownfailureexception needed.
C3verified: active/newverification/leasesnapshot12.303s androle-refresh/runninglaunchdefaults7.377s pass,each5/5load. Existinglease/runpolicy retained,newactualadmissions/newlease/newlaunch useloadednewpolicy,per accepted6a91fc6badmission semantics. Allfiveownreloadcases5/5; rollback/CLI/SIGHUP/missingconfig/provenance andcorrectedtimeout/preparefixturespass. Demo:69deadlinefailuredoesnotrecur;watchdogcasepasses5.590s,so conditionalLinuxprobe nottriggered. C1/C2/C4currentfromdelta5/A-3666;all4criteria verified,nohigh/mediumfindings,no peritemQA or Reviewer edits/tests.
ArtifactA-3692: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3692-t-488-final-clear-at-bfc14657-full-linux-and-neovim.md.

Criteria: C3 verified.

### rev-31 · 2026-10-16T04:26:19.977Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-merge-source
commit: 3ba2b30bed4547b6b3f3c4b034aab57a665a2c00
scope: delta

Merged source clear against prior final bfc14657 and dev 08e88000. Standards: no findings. Spec: no findings. Admission snapshots/timeouts remain integrated with durable remote-result reconciliation; loaded-config getter and captured acquisition policy remain alongside per-lease serialization. Journal reload events, dispatcher reload/permission/configure plumbing, server forwarding, grants and README contract survive dev integration. Configuration owner, daemon, CLI/protocol, demo/run delivery, suite worker and own tests byte-identical to prior reviewed head. Independently parsed manifest is exact dev plus the unchanged two reasoned task allowances; diff check clear. A-3698 supplies both merged-head whole files 5/5 under authorized slot; reported root typecheck/shards green. C1/C2/C4 reverified. C3 remains pending the fresh full droplet gate through Neovim explicitly required by Coordinator e04b9fd5; prior A-3691 applies only to bfc14657. Analysis A-3702: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3702-t-488-merged-source-clear-at-3ba2b30b.md. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T04:54:57.277Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-488-merge-evidence-1
commit: 3ba2b30bed4547b6b3f3c4b034aab57a665a2c00
scope: evidence

Evidence incomplete: A-3722/f68a979f full-mode Linux exits1 after hub,1894 pass/0 ordinary failures/4 skips. All five own reload cases pass normally and each5/5 load. Sole hard red remote-fixture-lifecycle.test.ts whole-file60.746s>60s (log6165); implementer reports posted shared allowance b4fc313b. Neovim phase was not reached, so Coordinator e04b9fd5's required merged-head gate is unmet. C3 remains pending; C1/C2/C4 source marks remain valid. No demonstrated task behavior failure and no failed criterion mark. Prior A-3691 is prior-head only. Await lead/Coordinator disposition for remaining Neovim evidence under submission/no-head-move-alone instructions; no new run authorized by this verdict. Artifact A-3723: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3723-t-488-merged-head-evidence-incomplete-neovim-not-reached.md. No Reviewer edits/tests.

### rev-31 · 2026-10-16T04:55:51.782Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-delta-6
commit: 364c1c22af0191a69673b22b80d29ac839ef6f9b
scope: delta

Delta source clear. Only durations.json+21 lines: independently parsed additions equal exactly posted b4fc313b's five lifecycle allowances/reasons; every prior entry retained. No production/test/assertion/deadline changes, diff check green. Standards/Spec: no findings. C1/C2/C4 source continuity from A-3702 reverified; C3 pending new full exact-head gate. A-3722 ordinary1894green and own/lifecycle5-of-5 behavior supports unchanged code, but Neovim was not reached and no final gate is claimed. Coordinator bf9968a3 authorizes pick and requires fresh full droplet through Neovim after restart notice in announced order; submission hold retained. Artifact A-3725: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3725-t-488-lifecycle-manifest-delta-clear-at-364c1c22.md. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-16T05:30:11.244Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-488-merge-final
commit: 364c1c22af0191a69673b22b80d29ac839ef6f9b
scope: evidence

Final merged-head clear. A-3748/61aef3bf fresh exact-head full Linux exit0:2291tests/2284pass/0fail/7platformskip. Raw hub free38/38, machine1856pass+4skip, full Neovim390pass+3skip (135.51s). All five own reload cases ordinary green and5/5 load. C3 verified from active/new actual admission+lease snapshot test12.326s and role-refresh/running-launch defaults7.501s with source-reviewed preserved assertions. C1/C2/C4 current from A-3702/A-3725, all4 verified. No known-red exception/batch deferral required; satisfies bf9968a3 full Neovim gate. Lifetime/cost remain unknown, not inferred. Standards/Spec no findings; no per-item QA. Artifact A-3750: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3750-t-488-final-merged-head-full-linux-and-neovim-clear.md. No Reviewer edits/tests.

Criteria: C3 verified.
