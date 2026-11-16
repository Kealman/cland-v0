---
id: T-1705
kind: task
title: Role sessions' login shells inherit DIGITALOCEAN_TOKEN from the human's shell startup file despite the launch credential filter
state: open
status: review
size: M
criterion_seq: 2
labels:
  - security
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-651
found_by: qa
topic: topic-1552
branch: t/T-1705-role-sessions-login-shells-inherit
created: 2026-11-06T10:31:30.250Z
updated: 2026-11-16T22:09:50.618Z
---

## Summary

During E-1532 stage 6 QA, qa-678 found the variable name `DIGITALOCEAN_TOKEN` in a QA shell's environment, though the setup check S0 had read 0. The check was names only; no value was printed. qa-678 traced it, names only:
- The Codex session process itself does not have the variable.
- A login-launched child of it does: the harness's default command exec runs a login shell, and the human's `~/.zshrc` (line 48) sets that name.
- A non-login exec does not have it.
So cland's launch credential filter (T-651/T-646, rule 15) covers the session process, but every login shell the harness runs re-adds the provider token from the human's shell startup files. Any role session can read it.

Containment for the QA run: qa-678 scanned 1,236 scratch files (with a positive control and the value fed through stdin) and found zero matches. The row was marked BLOCKED, and the scratch processes are being drained.

## What to build

1. Confirm which harness launches run their tool shells as login shells (Codex, Claude Code, OpenCode), and which startup files they source.
2. Choose and implement a product fix that keeps provider credentials out of role sessions' tool shells. Options:
   - launching tool shells non-login;
   - a scratch `ZDOTDIR` or shell rc for sessions;
   - a documented setup check that warns when the human's shell startup exports a provider credential;
   - the hub reading the token from its own secret store instead of the environment.
   The human must agree to any change to their shell setup.
3. Add a regression test showing that a role session's tool shell has no provider credential names when the launching user's shell startup file exports one (a scratch HOME with a planted rc).

## Acceptance criteria

- [x] C1. The hub reads the provider token from its own secret store with no provider credential in its environment, cland doctor warns, names only, when a planted shell startup file exports a provider credential, and a role session's tool shell started the way the harness starts it has zero provider credential names once no startup file exports one (test, red before the fix).
  - verified: rev-35 [reviewer] · run rev-35-1705-final-1 · 2026-11-16T15:14:05.341Z · commit 67f2473c4e950cb34d8c4572470da856a7d33f79
  - verified: rev-35 [reviewer] · run rev-35-1705-merge-1 · 2026-11-16T16:07:53.462Z · commit af14a01115b3d68ca539eba0f0c701ba37beffcc
  - done: impl-1705 · 2026-11-16T20:48:12.970Z
  - verified: rev-35 [reviewer] · run rev-35-1705-final-2 · 2026-11-16T21:27:32.815Z · commit 41fe64e8a86a5a853e130186e1f337fb7b67ea3c
- [x] C2. The chosen approach and any setup step for the human are documented (docs).
  - verified: rev-35 [reviewer] · run rev-35-1705-final-1 · 2026-11-16T15:14:05.341Z · commit 67f2473c4e950cb34d8c4572470da856a7d33f79
  - verified: rev-35 [reviewer] · run rev-35-1705-merge-1 · 2026-11-16T16:07:53.462Z · commit af14a01115b3d68ca539eba0f0c701ba37beffcc
  - done: impl-1705 · 2026-11-16T20:48:13.090Z
  - verified: rev-35 [reviewer] · run rev-35-1705-final-2 · 2026-11-16T21:27:32.815Z · commit 41fe64e8a86a5a853e130186e1f337fb7b67ea3c

## Comments

### coord · 2026-11-16T07:30:03.291Z

The human decided on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813): fix it on the product side in 0.4.1 (E-1884).
- The hub reads the provider token from its own secret store instead of the environment.
- `cland doctor` warns when a shell startup file exports a provider credential.
- No session changes the human's `~/.zshrc`. The Coordinator asks the human separately to move the export into the hub's launch environment.

### coord · 2026-11-16T13:42:56.707Z

Coordinator, 2026-11-16 13:43Z: C1 rewritten to the human's 07:25Z decision (comment above): secret store plus doctor warning, no change to the human's rc. Mandatory shell isolation (an isolated HOME or rc for sessions) was not part of that decision and changes the human's aliases and tool discovery, so it is out of scope; if wanted later, it is its own item and a human decision.

### impl-1705 · 2026-11-16T13:43:40.903Z

Rule 20 sweep before policy change: searched withoutExecutorCredentials, EXECUTOR_CREDENTIALS, resolveSecrets, providerTokens, DIGITALOCEAN_TOKEN, ZDOTDIR, BASH_ENV across hub/src, shared, test-support, all hub/nvim/web tests, docs and shipped skills. Consumers: all three adapters and local/agent hostCommandEnvironment retain final shared filter; fixtureEnvironment remains sealed; remote secret store/CLI schema + daemon resolver + providerTokens + executor/host provider paths need store resolution; doctor/hosts and setup/hosts need updated guidance. Tests: secrets CLI/resolution/validation, doctor-hosts, setup-hosts/setup-machine/init-machine, host-command-environment, executor-* (T1–T4), fake-machine-calls, scenarios/startup-smoke, host native/SSH/prepare tests. QA briefs/docs mention env-only token and need migration guidance. No wire field removal; previous host.providers shape unchanged. No persisted process ownership/schema change; existing environment fallback remains compatibility pending scope confirmation. Test selection by changed files is not treated as sweep evidence.

### impl-1705 · 2026-11-16T13:56:43.968Z

Development evidence A-20117: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20117-t-1705-red-green-development-evidence-and-policy-consumers.md. Positive-control secret scan passed before publication (0 evidence matches); staged copy removed. Red tests recorded actual failures before store/doctor production changes and before fixture human migration. Candidate merged origin/dev once before first source review; post-merge hub typecheck and whole-source/closed-item lints passed with report-only known findings. Tightened shell fixture rerun waits for authorized slot. QA policy none; no per-item QA brief supplied. Explicit environment override preserved for older launch setups; no wire shape change.

### rev-35 · 2026-11-16T14:08:18.981Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1705-source-1
commit: 1528055abe1f3fe46a5c81163012365ee7469e1e
scope: full
findings: [{"severity":"medium","text":"All three new asynchronous callbacks (shell migration, doctor planted-rc and store/provider metadata) lack an admission fence and whole-continuation join before root disposal. Existing native/hub/directory joins do not own pending FS writes or continuation-launched work; claimant confirmed no earlier owner. Register ownership before acquisition, fence later steps, join complete admitted work, adopt late resources and add an owned held-work failure control.","file":"hub/test/secrets-environment.test.ts","line":25},{"severity":"low","text":"Current public cloud setup still presents token export as the preferred path and misses project-store/human startup-export migration plus hub/session restart. Explicit env override remains valid compatibility; claimant confirmed this live guidance was missed.","file":"site/src/content/docs/docs/verification-and-release.mdx","line":123},{"severity":"medium","text":"Current OpenCode login/explicit-source claim is based on an unpinned stale search excerpt; current linked source delegates to non-login shell/select args. Pin supported version/source or qualify historical/unverified mode and align emulation linkage, retaining no-native-harness limits.","file":"docs/hub/provider-credential-migration.md","line":40}]
finding_counts: {"high":0,"medium":2,"low":1}

Full Standards/Spec pass at fixed 1528055ab complete; not clear. A-20132 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20132-t-1705-full-source-review-at-1528055ab.md records consolidated findings, unchanged production/store/filter/wire assessment, exact frozen-help comparisons and evidence limits. A-20117/A-20119 remain narrative development reports; retained provenance/normalized full consumer supplement requested without reruns. Latest same-head lint report retained separately, not final configured evidence. No Reviewer tests/native work. Hold released for consolidated correction; fresh committed-head source request before configured verification.

Criteria: C1 failed (New regression callbacks lack failure-path whole-work ownership; OpenCode startup evidence is not revision-established.), C2 failed (Live public setup migration and OpenCode source qualification remain incomplete.).

### impl-1705 · 2026-11-16T14:19:51.860Z

Source verdict1 A-20132/rev-35-1705-source-1 not clear at1528055ab preserved. Original provenance supplement A-20133 corrects immutable-head claims and unpinned OpenCode source; A-20140 derives normalized object-valued tier rows while preserving A-20133. Consolidated correction committed6878513e9: all three new callbacks use shared fixtureWork through secretSequence, capturing late roots/resources and joining whole continuations before removal; deterministic held FS+late resource control owns release/join before admission. Live public cloud/hosts setup migrated; env override remains compatibility. OpenCode explicit-source mode qualified historical/unverified; non-login emulations added. T2/T1 serial correction run63/63 at6878513e9 on local macOS Node24.21.0, no browser. Earlier batch failures retained. Waiting assigned exclusive T3slot after impl-1843; no further dev merge.

### rev-35 · 2026-11-16T14:24:19.951Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-source-2
commit: 6878513e958469976aeb69a8611b4013d2581068
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear A-20162 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20162-t-1705-corrected-full-source-review-at-6878513e9.md. All3 new callbacks reuse fixtureWork through pre-acquisition secretSequence, step fencing, immediate late root/resource capture, full-body/resource settlement guards before disposal. Owned held-write/late-resource control preserves root while pending, captures/closes late owner and fences next step. Both public setup guides migrated; shipped SECRET_USAGE reused by vocabulary guard. OpenCode mode qualified historical/unverified, non-login emulations added, no native harness proof claimed. Production unchanged/no extra dev merge. A-20160 actual available correction output63/63/exit0 retained with native/provenance limits; A-20133 original history and A-20140 derived normalized inventory retained (977 mapped occurrences independently match tiers). Latest typecheck/lint producer reports positive with122 report-only findings. Revised T3 execution pending assigned slot; configured verification unexecuted. C1/C2 done but not verified. Hold released; exact-head mode-free verify after clear in authorized window, no full/all request.

### rev-35 · 2026-11-16T14:36:27.146Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1705-evidence-1
commit: 6878513e958469976aeb69a8611b4013d2581068
scope: evidence
findings: [{"severity":"medium","text":"New approved startup-file reader was omitted from exact HOME/state-path inventory. Configured A-20169 actual findings env.HOME at lines11/13/14 fail the T1 inventory guard. Coordinator ea7ac412 authorizes narrow exact-expression/immediate-context registration with names-only/read-only reason, no whole-file or broader HOME bypass; preserve guard/negative controls and request fresh delta review.","file":"hub/src/doctor/shell-credentials.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20170 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20170-t-1705-failed-evidence-and-missing-home-inventory-entry.md completes failed-evidence pass. Exact same head/tree/platform checked;1715ordinary test passes/1fail,221file passes/1fail,separate210load passes/files. T0green,T1red;T2/T3/Web unexecuted/browsernull. Local revisedT3 and correction63/63 stay separately qualified. C1failed,C2done/unverified. Earlier source clearance missed inventory consumer; prior ownership/docs repairs remain accepted. Hold released for Coordinator-approved narrow inventory correction, fresh delta source review and new mode-free verify at new exact head; no unchanged-head retry.

Criteria: C1 failed (Configured T1 state-path inventory fails on three new doctor HOME reads; T2/T3/Web did not execute.).

### rev-35 · 2026-11-16T14:41:22.653Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-source-3
commit: 67f2473c4e950cb34d8c4572470da856a7d33f79
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow Coordinator-approved inventory delta clear A-20172 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20172-t-1705-narrow-inventory-delta-clear-at-67f2473c4.md. Five files read; single captured HOME lookup registered only at exact file/expression/immediate-context with read-only/names-only/no-write reason. Named-file scan behavior unchanged. T1 regression retains other expression/context/file rejection and existing planted/whole-source guards. Docs/index scoped. A-20171 red/20-of-20 development receipts preserve precommit/native unknowns; A-20169 remains failed history. Latest b1b35f2e reconciles previously pending committed-head test:lint exit0,0refusals/122 report-only, guide-index/wording0 findings; typecheck producer exit0. Prior full source repairs A-20162 retained. C1/C2 done/unverified until new exact-head configured evidence. Hold released; mode-free verify in authorized window at67f2473c4, no broad/full/all request or extra dev merge.

### rev-35 · 2026-11-16T15:14:05.341Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-final-1
commit: 67f2473c4e950cb34d8c4572470da856a7d33f79
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear A-20208 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20208-t-1705-final-exact-head-evidence-verdict-with-shell-qualification.md with A-20204 detailed named receipts/1097-path conservative ledger. A-20198 exact-head6422ordinary passes/705files,0fail/cancel,4zsh prerequisite skips; separate230load passes/files. Required store/doctor/held-work/exact HOME controls ordinary+5; formerly failed inventory full file pass. AllT1/T2/Web and changedT3 file pass;267T3/17T4deferred. Four Linux zsh modes are explicitly unexecuted, not passes. Separate clean6878513e9 macOS A-20164 4/4/no skips covers six emulated modes; shell/fixture/environment/work/cleanup blobs independently identical through sole five-file doctor/inventory delta, permitting narrowly qualified platform coverage carry with original raw/native/hash limits, no native harness proof. C1/C2verified under documented human-only migration/no-isolation scope; actual human rc migration not claimed. Exact provenance/browser checked; advisory budgets not enforced passes; failed A-20169 and prior capture/consumer limits retained. Hold released; Coordinator owns enqueue/landing. No Reviewer runtime.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-16T16:07:53.462Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-merge-1
commit: af14a01115b3d68ca539eba0f0c701ba37beffcc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-delta clear A-20234. Whole-tree parent comparison has no unexpected non-overlap paths; all33 task paths outside five shared files are unchanged. Reviewed shared skill/index/README/help fixture and combined running.md hunk: secret-store/migration guidance retained with exact regional422 fallback; obsolete blanket create-retry denial removed. Task production/tests unchanged; daemon credential and inherited droplet boundary inspected. Coordinator9ce8d8fe/7525817f explicitly waives new verify for docs-only resolution after three checks; A-20233 records merged-head root typecheck/test:lint/separate wording exit0, report-only findings and tool-return provenance limits retained. C1/C2 reverified under that waiver with A-20208/A-20204 prior evidence qualifications, not a new merged-head runtime pass. Four Linuxzsh skips and separate limited MacA-20164 remain distinct, no native harness/human migration claim; old redA-20169 retained. Hold released; Coordinator owns enqueue/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T16:10:54.194Z

Enqueued at af14a0111 under the rule 6 docs-only waiver. The full mode-free verify passed at 67f2473c4. af14a0111 merges dev b57847bca, and the only manual resolution is in `docs/hub/running.md`. Evidence at the merged head:
- `npm run typecheck` exit 0 (impl-1705);
- searches of hub/test and nvim/test for every changed phrase; the only match is `hub/test/executor-admission.test.ts`, which pins the fake provider's message, not the doc;
- that file run on af14a0111 merged with dev 9859c068b (c99b51aad): 9/9 pass, exit 0;
- `npm run test:lint` 0 refusals;
- closed-item wording lint: 793 documents, 0 findings.
No new verify; the merge-queue batch adds T1+T3 on the integrated tree.

### hub · 2026-11-16T20:35:53.660Z

Merge-delta assessment (report-only)
{"reviewed":"af14a01115b3d68ca539eba0f0c701ba37beffcc","head":"a648fa5d991fd586c9fea0dcbe24d8ab593bf268","dev":"020aef2e09bb5c5d929c1ffdc99ef4c9a2207715","mergeBase":"b57847bca2c2ebd9beb8e62651bd49faa9e8d97e","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1705-provider-credentials.md",".agents/skills/implement/SKILL.md","docs/agents/secrets.md","docs/agents/tests/hub-test-doctor-hosts.test.ts.md","docs/agents/tests/hub-test-secrets-environment.test.ts.md","docs/agents/tests/hub-test-secrets.test.ts.md","docs/agents/tests/hub-test-state-paths-lint.test.ts.md","docs/agents/tests/index.md","docs/hub/cland-doctor.md","docs/hub/cland-setup.md","docs/hub/host-providers.md","docs/hub/project-secrets.md","docs/hub/provider-credential-migration.md","docs/hub/running.md","hub/README.md","hub/src/cli/doctor.ts","hub/src/cli/usage/doctor.ts","hub/src/cli/usage/secret.ts","hub/src/cli/usage/setup.ts","hub/src/doctor/hosts.ts","hub/src/doctor/shell-credentials.ts","hub/src/host/provider-tokens.ts","hub/src/hub/daemon.ts","hub/src/remote/secrets.ts","hub/src/setup/steps/hosts.ts","hub/test/doctor-hosts.test.ts","hub/test/durations.json","hub/test/fixtures/cli-usage/commands.json","hub/test/secrets-environment.test.ts","hub/test/secrets-fixture.ts","hub/test/secrets-resolution.test.ts","hub/test/secrets.test.ts","hub/test/setup-hosts.test.ts","hub/test/state-paths-inventory.ts","hub/test/state-paths-lint.test.ts","site/src/content/docs/docs/hosts.md","site/src/content/docs/docs/verification-and-release.mdx","site/test/hosts-docs.test.ts"],"devPaths":[".agents/skills/implement/CHANGES/T-1867-mdx-wording.md",".agents/skills/implement/SKILL.md",".agents/skills/qa/CHANGES/T-1861-guide-references.md",".agents/skills/qa/SKILL.md",".agents/skills/qa/qa-demo-policy.ts",".cland/tasks/E-1883-merge-queue-verification-delivery-and.md",".cland/tasks/E-1885-sessions-the-hub-and-recovery-0-4-1.md",".cland/tasks/T-1637-a-request-frame-that-fails-validation-is.md",".cland/tasks/T-1640-hub-lock-readers-test-ts-calls.md",".cland/tasks/T-1665-the-publication-scanner-flags-test.md",".cland/tasks/T-1705-role-sessions-login-shells-inherit.md",".cland/tasks/T-1725-the-duration-manifest-check-reports.md",".cland/tasks/T-1764-one-pending-sub-agent-permission-prompt.md",".cland/tasks/T-1768-projecthub-t2-fixtures-reach-native.md",".cland/tasks/T-1812-a-spoke-that-starts-while-the-hub-is.md",".cland/tasks/T-1816-startserver-s-port-retry-spins-without.md",".cland/tasks/T-1841-heartbeat-digest-test-ts-hung-632-s-with.md",".cland/tasks/T-1843-a-finished-suite-with-no-lease-stays-in.md",".cland/tasks/T-1861-qa-lint-reads-a-per-test-docs-path-test.md",".cland/tasks/T-1867-closed-item-wording-lint-skips-mdx-site.md",".cland/tasks/T-1904-hub-status-component-test-ts-fails-4-8.md",".cland/tasks/T-1907-cland-verify-times-out-at-15-s.md",".cland/tasks/T-1915-t2-files-whose-native-cli-reads-the-hub.md",".cland/tasks/T-1916-a-remote-run-still-marked-running-whose.md",".cland/tasks/T-1917-hub-lock-readers-test-ts-still-reports.md",".cland/tasks/T-1918-suite-admission-responsive-test-ts.md",".cland/tasks/T-1919-each-injection-completion-rebuilds-every.md",".cland/tasks/T-1920-the-publication-scanner-s-header-context.md",".cland/tasks/T-1921-a-transient-git-failure-in-the-landing.md",".cland/tasks/T-1922-when-pgrep-fails-while-exiting-0-macos.md",".cland/tasks/T-204-incident-log-lost-suite-runs-and-stalled.md","docs/agents/qa-brief-lint.md","docs/agents/qa-demo-recording.md","docs/agents/tests.md","docs/agents/tests/hub-test-duration-duplicates.test.ts.md","docs/agents/tests/hub-test-opencode-host.test.ts.md","docs/agents/tests/hub-test-qa-demo-policy.test.ts.md","docs/agents/tests/hub-test-qa-lint-build.test.ts.md","docs/agents/tests/hub-test-qa-lint.test.ts.md","docs/agents/tests/hub-test-remote-docs.test.ts.md","docs/agents/tests/hub-test-suite-duration-budget.test.ts.md","docs/agents/tests/hub-test-suite-duration-context.test.ts.md","docs/agents/tests/index.md","docs/hub/adapters-and-sessions.md","docs/hub/running.md","hub/README.md","hub/src/adapters/opencode/server.ts","hub/src/cli/qa-lint.ts","hub/src/cli/usage/qa-lint.ts","hub/src/qa-lint-references.ts","hub/src/suite-duration-context.ts","hub/src/suite-durations.ts","hub/src/suite-shards.ts","hub/src/tracker/tracker.ts","hub/test/duration-duplicates.test.ts","hub/test/fixtures/cli-usage/commands.json","hub/test/lint-closed-item-wording.ts","hub/test/lint-tests.ts","hub/test/opencode-host.test.ts","hub/test/qa-demo-policy.test.ts","hub/test/qa-lint-build.test.ts","hub/test/qa-lint.test.ts","hub/test/suite-duration-budget.test.ts","hub/test/suite-duration-context.test.ts","hub/test/tiers.json","site/src/content/docs/docs/items.mdx"],"overlap":[".agents/skills/implement/SKILL.md","docs/agents/tests/index.md","docs/hub/running.md","hub/README.md","hub/test/fixtures/cli-usage/commands.json"],"dependency":{"status":"unknown","reason":"import graph incomplete or budget exceeded"},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1705 · 2026-11-16T20:39:43.409Z

Post-bisect diagnosis at authorized current-dev merge a648fa5d9: minimal native C1/C2 ready/reopen case reproduced original assertion (startup restores durable machine address; actual undefined/expected true), exit1. Root cause candidate confirmed by source: serveProject now clones the supplied env for private provider resolution; projectHub still returns its old supplied env as hostEnvironment. Startup restores fake membership on private runtime env; test sees stale caller env. Runtime join tests write membership into stale caller env while registry/carrier reads private env. Missed T3 consumers: host-create-ready.test.ts (reopen, direct create/settlement/held readiness), host-runtime-join.test.ts (dynamic admission/reopen). Related shared helper consumers and createHostRegistry injection owners being inventoried before correcting helper view. No credential value read; no real provider/network.

### impl-1705 · 2026-11-16T20:44:28.791Z

Rule20 correction: the missed contract was object identity/live runtime updates, not only credential names or reply fields. serveProject legitimately owns a private env copy; projectHub.hostEnvironment must expose that actual host-registry env, not the original launch input. Existing createHostRegistry seam now captures the authoritative env while honoring injected factories; no Daemon/wire API addition or production credential-isolation reversal. Direct consumer sweep (normalized tiers): T3 host-create-ready, host-runtime-join, fixture-socket-lifecycle, host-destroy-native; T2 secrets, host-create-admission, doctor-hosts, session-pool-placement, web-hosts-authority, host-stop, host-status; Web hosts-view, hosts. All migrate via shared projectHub helper view; custom factory observer remains honored. Two failing T3 files now unchanged12/12+5/5 at919b5b234; other2 T3 and Web runtime not locally rerun, deferred to configured/batch selection. Historical QA E-1537-stage-1 uses this fixture and remains pinned, not rewritten. Before this correction the broad conservative transitive ledger did not establish migration of these mutable-identity consumers.

### rev-35 · 2026-11-16T20:51:45.649Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-source-4
commit: 41fe64e8a86a5a853e130186e1f337fb7b67ea3c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-bisect complete5-file correction/context clear A-20384. Existing registry factory seam captures authoritative private runtime env, preserves custom factory/default function/return semantics and exposes it via hostEnvironment; production credential copy/filtering not reverted, no Daemon/wire additions. Expanded existing owned secretSequence case checks both live mutation directions/custom factory and retains provider-store assertions; three guides explain identity boundary. Coordinator239d1f98 merge/fix authorization checked; no runtimefix waiver. A-20383 retains exactred at mergeda648, unchanged native12/12+5/5 at919, doc-only paragraph delta to41fe and7T2files68/68 at41fe. FourT3/sevenT2/twoWeb+QA/production inventory corrects earlier missed mutable-identity semantics;2otherT3/Web unexecuted/deferred. Native/tool-return/raw/hash/signal/source-linkage limits and prior batch/bisect/oldgreen history retained; current request completes root static checks exit0/report-only122/0refusals. C1/C2done/unverified pending new exacthead configured result, human migration waits landing. Hold released; new mode-free verify only in newly authorized Coordinator window, then evidence settlement. No Reviewer runtime.

### rev-35 · 2026-11-16T21:27:32.815Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1705-final-2
commit: 41fe64e8a86a5a853e130186e1f337fb7b67ea3c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-bisect final evidence clear A-20392 with A-20391 current named receipts/1103-path conservative ledger. Exact reviewed41fe64e8a remains clean; configured d2d251c4/A-20385 same-head green:6592ordinary passes/715files,0fail/cancel,4explicit /bin/zsh prerequisite skips; separate230load passes/files. Required store+both live-env mutation directions, names-only doctor, held-work and narrow HOME inventory cases ordinary+5positive. All224T1/428fallbackT2/55Web and8selectedT3files102passing identities complete;261T3/17T4unexecuted. All7 direct T2 and2Web consumers positive. Formerly failing host-create-ready12/12/runtime-join5/5 remain separate nativeMac919 receipts with doc-only finaldelta; no Linux receipt inferred. OlderMac six shell-mode emulations stay historical at687 with unchanged commands/helper/filter/work and newer inherited cleanup explicitly qualified;4Linuxzsh skips are not passes, no installed native-harness/human migration claim. Exact provenance/actualbrowser checked; budgets/lint/ratchet/skipchecks report mode retained. Prior batch red, bisect, failed inventory and original raw/hash/signal/search limits preserved. C1/C2verified under approved human-only migration/no-mandatory-isolation scope. Hold released; Coordinator owns enqueue/landing and deferred human credential migration. No Reviewer runtime.

Criteria: C1 verified, C2 verified.

### impl-1705 · 2026-11-16T22:09:50.531Z

Authorized post-batch merge6579171d9 (parents41fe64e8a+0e093db62), sole conflict harness.ts resolved with final normalized option/identity/process defaults + dispose API + live runtimeEnvironment capture. Root typecheck, whole-source test:lint, separate wording all exit0; report-only122/0refusals,804docs0wording. Targeted localMacNode24.21T2:98pass/12files; unchanged incoming hub-priority1fail, Coordinator independently confirmed dev regressionT-1923 and directed no T-1705 fix. A-20397 captures available output, counts, limits; typecheck load correction supplement preserves distinction. Native slot and configured verify remain pending restart/window; no merged-head full runtime pass claimed. Clean/pushed. C1/C2done remain; prior verified marks stale atnewhead. Requesting merge-delta source review.
