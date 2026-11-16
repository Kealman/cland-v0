---
id: T-1705
kind: task
title: Role sessions' login shells inherit DIGITALOCEAN_TOKEN from the human's shell startup file despite the launch credential filter
state: open
status: ready
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
updated: 2026-11-16T16:07:53.739Z
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
  - done: impl-1705 · 2026-11-16T14:40:13.589Z
  - verified: rev-35 [reviewer] · run rev-35-1705-final-1 · 2026-11-16T15:14:05.341Z · commit 67f2473c4e950cb34d8c4572470da856a7d33f79
  - verified: rev-35 [reviewer] · run rev-35-1705-merge-1 · 2026-11-16T16:07:53.462Z · commit af14a01115b3d68ca539eba0f0c701ba37beffcc
- [x] C2. The chosen approach and any setup step for the human are documented (docs).
  - done: impl-1705 · 2026-11-16T14:40:13.736Z
  - verified: rev-35 [reviewer] · run rev-35-1705-final-1 · 2026-11-16T15:14:05.341Z · commit 67f2473c4e950cb34d8c4572470da856a7d33f79
  - verified: rev-35 [reviewer] · run rev-35-1705-merge-1 · 2026-11-16T16:07:53.462Z · commit af14a01115b3d68ca539eba0f0c701ba37beffcc

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
