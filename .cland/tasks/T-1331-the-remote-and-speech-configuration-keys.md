---
id: T-1331
kind: task
title: The remote and speech configuration keys, rendered by init, added by update and applied by reload
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1328
topic: topic-1083
branch: t/T-1331-the-remote-and-speech-configuration-keys
created: 2026-10-26T07:54:42.573Z
updated: 2026-10-26T12:46:07.331Z
---

## Summary

The `[remote]`, `[remote.telegram]`, `[remote.discord]` and `[speech]` keys exist with their defaults. `cland init` renders them, `cland update` adds them to older projects, and `cland hub reload` applies them, connecting or disconnecting a messenger.

## What to build

Add the keys `[remote] mute_default`, `[remote.telegram] enabled` and `format`, `[remote.discord] enabled`, and `[speech] provider`, `model`, `language`, `max_seconds` and `command` to the rendered configuration (`hub/src/init/config.ts`), to `cland update`'s migration and to `cland config set`. A messenger is active when it is enabled and a token is present. Reload starts or stops that remote in the gateway. Until the real clients exist, a test messenger factory stands in through the existing fake seam. Spec §3.3.

## Acceptance criteria

- [x] C1. `cland init` renders the four sections with their defaults, and `cland update` adds them to a project that lacks them without touching other keys (test).
  - verified: rev-31 [reviewer] · run rev-20261026-1331-final · 2026-10-26T12:24:39.598Z · commit 9918cb61fe32cc2d6e9d8e305a842044ad3ca13f
  - done: impl-1331 · 2026-10-26T12:45:35.348Z
- [x] C2. `cland config set remote.telegram.enabled true` with a token present and `cland hub reload` starts a test messenger, and `false` with a reload stops it (test).
  - verified: rev-31 [reviewer] · run rev-20261026-1331-final · 2026-10-26T12:24:39.598Z · commit 9918cb61fe32cc2d6e9d8e305a842044ad3ca13f
  - done: impl-1331 · 2026-10-26T12:45:36.060Z

## Comments

### impl-1331 · 2026-10-26T11:32:20.294Z

Pre-edit rule 20 consumer inventory: ProjectConfig/defaultConfig/parseConfig/renderConfig/provisionConfig and configKeys/setConfigValue; cli/config.ts and bin help; hub/configuration.ts reload result applied[]; daemon startup/shutdown; Gateway constructor and injected gatewayRemotes; harness.ts ProjectHubOptions. Other typed ProjectConfig readers (adapters, doctor, executor, setup, suite limits/selection, territory-release, tracker migration, demos/dispatch/suites) retain existing fields and are unaffected by additive remote/speech sections. Wire consumers of hub.reload/config.set (CLI, nvim, web, shared protocol/schema) retain unchanged reply shape; applied[] only adds key names. All-tier search includes gateway/state/outbox tests, init/config/reload/setup/executor/queue tests, prepared-project and QA fixture, shipped skills and QA briefs; existing gatewayRemotes stays unconditional for legacy fixtures. New factory seam opts into configured behavior. Existing config-set/frame tests without new keys remain previous-shape compatibility evidence. No admission/credential policy or wire schema change.

### impl-1331 · 2026-10-26T11:39:46.983Z

Implementation/evidence: C1 red first (remote section undefined), green in T1 init-config (15 tests). C2 red first (no constructed messenger), green in T2 config-set: both CLI enable/disable walks with no-token inactivity, exact welcome/status and completed stop receipts, unchanged reload retention; held-start shutdown joins owner; all nine settings reach the factory. npm run typecheck green. cli-imports T3 3/3 green on local macOS (3 modules help/version/no-command, 15 task list, 20 hub status). Full mode-free verification remains pending clear source review; no Web phase or browser required. Rule 16 docs/help/skill updated; role permission unchanged and no clause lines added. Factory is injectable until real clients land; changed settings rebuild configured gateway, pairings/outbox retain hub.db identities.

### rev-31 · 2026-10-26T11:49:37.794Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261026-1331-source1
commit: dd341dd96ab2bb107a5be0250841af7c116def43
scope: full
findings: [{"severity":"medium","text":"M1 [Standards]: HUB_USAGE and CONFIG_USAGE changed, but their frozen commands.json rows did not. Independent JSON decoding at dd341dd96 confirms both strings differ. The unchanged CLI compatibility/help consumers therefore disagree with this head. Reproduce through the existing strict guards and migrate only the owning frozen rows, preserving ordering/composition assertions.","file":"hub/src/cli/usage.ts","line":25},{"severity":"medium","text":"M2 [Spec]: prepareApply runs while the failure-attribution variable still names roles.toml. A secret-resolution or gateway-stop failure consequently sets #rolesError and logs roles-unreadable despite valid roles; Sessions.#checkRolesLaunch then refuses all role launches. Attribute remote/secret apply failures separately and retain the last-good roles admission state. Add a valid-roles apply-failure regression with the actual refusal/log and subsequent role-admission receipt.","file":"hub/src/hub/configuration.ts","line":212},{"severity":"medium","text":"M3 [Standards]: The held-start test releases and joins its producer only in a lexical finally. No independent cleanup owner is registered before fixture setup/trigger; eventually is not cancellation-aware, and hub.stop/reload joins are unbounded. Cancellation or a lost setup receipt can leave the shared hub disposer waiting on this held start. Reuse heldRemoteBoundary and registered bounded setup/cleanup ownership, with missing-receipt/cancellation controls; release/drain before hub/store/root disposal and retain final stop assertions.","file":"hub/test/config-set.test.ts","line":50},{"severity":"medium","text":"M4 [Spec]: The last config/roles stamp checks precede the new await prepareApply. A held messenger start allows config.toml or roles.toml to change after those checks; release then publishes the old parsed pair and returns reload success without rechecking. Preserve the existing changed-during-reload refusal at the publication boundary after asynchronous preparation. Add held-preparation controls for both source files, retaining last-good publication assertions.","file":"hub/src/hub/configuration.ts","line":209},{"severity":"low","text":"L1 [Standards]: File-specific guidance for the new init-config T1 cases is placed in config-set's guide. Rule 16 and docs/agents/tests.md require guidance under the test's own path. Put these paragraphs in docs/agents/tests/hub-test-init-config.test.ts.md, index that document, and link it from config-set.","file":"docs/agents/tests/hub-test-config-set.test.ts.md","line":35}]
finding_counts: {"high":0,"medium":4,"low":1}

Full source review not clear; A-12370 contains the fixed base/head/tree, independent Standards and Spec findings, all-consumer/source audit, correction controls and evidence limits. C1 appears implemented but remains runtime-unverified. C2 failed by M1–M4; L1 is the per-file T1 guide placement. No tests/builds/probes/edits or configured run performed by Reviewer. Correct consolidated findings and request fresh source review at a pushed replacement head before verification; no dev merge requested.

Criteria: C2 failed (M1–M4: unmigrated frozen CLI help; remote apply failures poison valid role admission; held-start cleanup lacks registered cancellation ownership; final source-stamp guard precedes async preparation.).

### impl-1331 · 2026-10-26T11:55:47.052Z

Source2 replacement 5790b51bc addresses all A-12370 findings. M1 unchanged compatibility/help guards reproduced red; only HUB_USAGE/CONFIG_USAGE frozen rows migrated and both guards green. M2 frame regression reproduced false roles launch refusal; remote failures now attributed separately; exact secrets refusal, retained loaded provenance, no false roles-unreadable and subsequent fake harness/model launch pass. M3 heldRemoteBoundary pre-registered before root/setup, owns reload/stop and bounded setup; missing-receipt/aborted-setup controls retain final stopped receipts. M4 both held-source-edit regressions red before post-prepare stamp checks, green afterward with retained config/roles. L1 own init-config guide indexed. Local macOS: config-set 19/19, usage compatibility 1/1, cli-help 4/4; typecheck and wording lint green. No dev merge; no configured verification or Linux pass yet.

### rev-31 · 2026-10-26T11:57:56.992Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1331-source2
commit: 5790b51bc128a170916ab552529cafa98b172a29
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear; A-12378 resolves M1–M4/L1 and carries the unchanged source1 audit. Only two frozen rows migrated with unchanged assertion sources/order; remote apply attribution retains valid roles admission; post-prepare checks protect both source snapshots; registered heldRemoteBoundary controls own missing/aborted setup and disposal; T1 guide is correctly indexed. A-12375 retains actual local correction red/green outputs/native exits with implementation-tree/provenance limits. No configured/Linux/load evidence yet; C1/C2 runtime verification remains pending. Submit one ordinary mode-free configured verify at this unchanged head and request final evidence review; no dev merge requested.

### impl-1331 · 2026-10-26T12:13:47.017Z

Configured run 8aa40cc7 at source-clear 5790b51bc finished exit0, 3414 ordinary tests all pass, plus 50 passing load-gate samples (10 new identities ×5); T0/T1/T2/Web completed, T3/T4 absent under task selection. Log A-12382. Linux x64 6.8.0-142, droplet c-8 lon1, Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4/v1248 installed; workers2, lifetime745s/cost$0.0517. Duration/lint/ratchet reports are report-only, with over-budget lines retained. Coordinator decision864cd392 authorized one durations-only successor: 9918cb61f adds 4.626s allowance for activation case, E-880, added2026-10-26/expires2026-11-25. Exact samples: Linux ordinary3.035164865s and load worst3.083795257s (A-12382), original local1.012606083s (A-12375); ceil(1.5×worst to ms). No new execution is claimed at9918cb61f; no second mode-free run required by Coordinator unless Reviewer requests. Source review of metadata delta precedes final evidence review.

### rev-31 · 2026-10-26T12:14:32.467Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1331-delta1
commit: 9918cb61fe32cc2d6e9d8e305a842044ad3ca13f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized duration-only source delta clear; A-12385. Exactly one seven-line allowance, 4.626 s from ceil-ms(1.5×actual worst load 3.083795257 s), with original local/Linux receipts and Coordinator 864cd392 attribution, open E-880 and approved UTC dates within its configured legacy-owner span. No executable/test/help/assertion delta or merge. A-12378 full source carries. Prior configured A-12382 remains attributed to 5790b51bc; Coordinator explicitly permits that evidence carry for this transcription-only successor. No additional mode-free run requested. C1/C2 remain pending final evidence settlement.

### rev-31 · 2026-10-26T12:24:39.598Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261026-1331-final
commit: 9918cb61fe32cc2d6e9d8e305a842044ad3ca13f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-12390 contains independent exact-name/type/outcome/load audit and supersedes A-12389's single missing-baseline filename typo. Executed run8aa40cc7/A-12382 is at5790b51bc, explicitly carried to current9918cb61f under Coordinator864cd392 for the one reviewed allowance-only delta; no new-head execution claimed. 3414 ordinary passes +50 additional load passes, ten new identities5/5 each; init15/15, config-set19/19, strict usage1/1, help4/4. HostT0/allT1/fallbackallT2/Web complete, no remoteT3/T4. Linuxc8lon1 Node24.21/Nvim0.12.5 HeadlessShell156/v1248, lifetime745s/$0.0517; host gate TREE reuse separated. Report-only135lint/61files, two missing baselines, nine budget warnings/Webwall/ratchet limits retained. Reviewed4.626s allowance uses actual3.083795257s worst load and retained local sample. No real-platform/phone/speech claim; QA none/after-stage, Coordinator owns separate enqueue/rule6/integration gates.

Criteria: C1 verified, C2 verified.
