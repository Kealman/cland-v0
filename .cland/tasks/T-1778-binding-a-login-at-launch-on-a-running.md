---
id: T-1778
kind: task
title: Binding a login at launch on a running host
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
  - T-1773
  - T-1776
topic: topic-1461
branch: t/T-1778-binding-a-login-at-launch-on-a-running
created: 2026-11-09T12:44:09.501Z
updated: 2026-11-10T09:00:02.254Z
---

## Summary

A launch placed on a pool host binds a login of its harness when the host holds none. The hub picks a `ready` login of the pool's region, narrowed to the role's `account` when it has one, attaches and mounts its volume, and starts the session with the harness home at the mount. The login reads `in-use <host>`, later sessions of that harness on the host reuse the binding, and the session row records the login and its account.

## What to build

A login binding step inside the launch placement, after the host is reserved and before the spawn. A bind attaches and then mounts through `loginDisk`, and the binding is recorded in `login_bindings`. The spawn environment carries `CLAUDE_CONFIG_DIR`, `CODEX_HOME` or `OPENCODE_DB` at the mount, in place of any local account path. Account limits (spec v0.1.2 §3.13) keep applying by the login's account name.

Harness spawns on hosts carry none of the stray variables:
- `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`;
- `OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN`.

With no ready login, until T-1784 the launch is refused with "no login <harness> in pool <pool>". A failed bind detaches what it attached and returns the login to `ready`. Local launches are unchanged.

## Acceptance criteria

- [x] C1. A launch on a ready fake host with no binding attaches and mounts a ready login of its harness, starts the session with the harness home variable at the mount, and the login reads `in-use <host>` (test).
  - done: impl-1778 · 2026-11-10T08:58:45.388Z
- [x] C2. A second session of the same harness on that host reuses the binding with no attach (test).
  - done: impl-1778 · 2026-11-10T08:10:18.079Z
- [x] C3. A role with `account = "work"` binds only a login of account `work`, and the session row records the login name and the account (test).
  - done: impl-1778 · 2026-11-10T08:33:00.952Z
- [x] C4. The process row's account environment holds the mount path only, and the spawned environment holds none of the five stray auth variables (test).
  - done: impl-1778 · 2026-11-10T08:10:18.922Z
- [x] C5. A mount failure detaches the volume, leaves the login `ready`, and fails the launch naming the login (test).
  - done: impl-1778 · 2026-11-10T08:10:19.187Z
- [x] C6. A local launch reads no login and starts as before (test).
  - done: impl-1778 · 2026-11-10T08:10:19.580Z

## Blocked by

- T-1772
- T-1773
- T-1776

## Notes

- Hot files: `hub/src/host/login-binding.ts` (new), `hub/src/adapters/sessions.ts` (`withLaunchPlacement`), `hub/src/host/agent/command-environment.ts` (the stray variables), `hub/src/adapters/processes.ts` (the login on the row).
- Tests: new `hub/test/login-binding.test.ts` (T2, provided fake Hosts with a recording `loginDisk` and fake provider volumes); one case on the host-create fixture (T3).
- Serves epic C2.

## Comments

### impl-1778 · 2026-11-10T05:10:06.536Z

Rule 20 pre-change sweep: suite shared transitive importer graph over Sessions, HarnessProcess, ProcessTable and remoteCommandEnvironment reached 694 tests, plus 15 unknowns conservatively reached (full list in consumer artifact). Explicit consumers: adapters/index, session launch/resume/reuse/relaunch, accounts/registry, process persistence/pending-stop JSON, protocol HarnessProcessView and Sessions.view, CLI session lines, web/Neovim/session.list and startup discovery; shipped skills and QA docs use existing launch frames unchanged. Planned optional process login metadata is additive; older rows/replies remain accepted. Account registry lookup remains local only for pool binding. Existing provided-fixture pool tests without login disks need explicit fixture migration or a documented non-pool exemption; testing by changed paths alone is insufficient.

### impl-1778 · 2026-11-10T05:19:10.512Z

Rule-20 completion/update: binding phase consumers are LoginRecords.bindings/bind/transition/unbind/settleBinding, Dispatcher login.list, CLI ListedLogin/login rendering, login-records and login-list fixtures; unchanged legacy bindings omit phase. Session login consumers: ProcessTable row/JSON persistence, Sessions spawn/view/reuse, protocol.ts + shared/wire/index.ts, CLI/web/Neovim readers (optional additive key; old shape retained), fixture catalog/conformance tests. Explicit provider-ready sweep covered all 17 files: host-create-entry (T2, no session launch), host-provision-records (T1, store/runtime only), pool-spend-cap (T2, acquisition only), pool-scale (T2, scale only), host-restart-reconcile (T2, recovery only), login-binding (T2 new), waiting-launch (T2 migrated), host-unreachable (T2 retained process fixtures, no new launch), host-lease (T2, lease only), host-provision-recovery (T2, recovery only), pool-idle-stop (T2, lifecycle only), host-destroy (T2, destruction only), host-status (T2, projection only), pool-failures (T2 migrated), waiting-launch-restart (T2 migrated), host-stop (T2 migrated), session-pool-placement (T2 migrated). Shared helper settled-login-fixture.ts seeds explicit settled metadata; readyLogin seeds real directory-backed provider volumes for host-create-fixture.ts and host-create-ready.test.ts (T3 migrated). Only native file changed is host-create-ready; its fixture roots retain existing cleanup ownership. Pending binding phase is T-1793's reconciliation seam; T-1779 must skip it.

### rev-35 · 2026-11-10T05:29:24.279Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1778-source-1
commit: 84164462cea9026abaa9c8c46bd65c061ec39650
scope: full
findings: [{"severity":"high","text":"Item/pool launch re-enters #accountRequest without disk mode and discards placed resolvedAccount. It can re-read the local registry or lose the mount-only account overlay after a successful bind. Preserve the destination login/account selection across item launch and pool handoff; current no-item tests miss this. Author confirms the gap.","file":"hub/src/adapters/sessions.ts","line":1629},{"severity":"high","text":"Native binding happens before operation(), while TaskWorktrees item/claim eligibility and generic name/Lead checks run later. An invalid or ineligible launch can attach/mount and consume a ready login before refusal. Defer effects to the shared post-admission spawn boundary, preserving refusal precedence and revalidation. Coordinator e2fbabf6 explicitly approves this design.","file":"hub/src/adapters/sessions.ts","line":1593},{"severity":"high","text":"Cross-host/fresh #launchNew callers bypass destination binding, carry old accountEnv and omit login. A destination can spawn without its settled disk or with a stale source path; fresh same-host also loses metadata. Coordinator e2fbabf6 assigns these paths to T-1778: bind/reuse destination at shared spawn, retain normal native-resume binding, and refuse missing destination login.","file":"hub/src/adapters/sessions.ts","line":2107},{"severity":"medium","text":"Existing held selection accepts any same-harness binding, including a valid key login, and does not enforce disk/state/provider/region coherence. It can invent a disk mount overlay without a mounted disk. Restrict settled disk reuse to the destination contract and add negative controls; author confirms no earlier exclusion.","file":"hub/src/host/login-binding.ts","line":30},{"severity":"medium","text":"The optional login field is added to RoleLaunch and its shared/wire copy instead of HarnessProcessView, where Sessions.view actually emits it. Correct both schemas and migrate actual process-view consumers/catalog coverage; no role-default contract change was approved.","file":"hub/src/protocol.ts","line":828},{"severity":"medium","text":"The new T2 projectHub fixture omits both explicit fake process facts required by its brief (options.processes and droplet.processes). No earlier owner injects them; default hub PID probes do not establish the process-free startup spend/lock boundary. Use shared fakeLockProcesses with the fixture clock and retain setup ownership.","file":"hub/test/login-binding.test.ts","line":28},{"severity":"medium","text":"Coordinator 50f0d433 accepts join-only shutdown here but requires held-operation close ordering and pending-after-close controls. The submitted tests exercise pending reuse only while open; neither required shutdown boundary is covered. Add exact held list/attach/loginDisk settlement and retained-pending assertions. Cancellation itself belongs to non-blocking T-1801.","file":"hub/test/login-binding.test.ts","line":91}]
finding_counts: {"high":3,"medium":4,"low":0}

A-18267: complete source1 Standards2medium/Spec5(3high2medium). Confirmed item-account loss, effects before admission, missing resume binding, incoherent held reuse, wrong wire type and T2 process seams; accepted join-only shutdown requires held-close/pending tests. Coordinator50f0d433/T-1801 cancels no work in this lane; e2fbabf6 approves shared post-admission spawn design. A-18266 actual native timeout retained, not classified beyond output; C1/C3/C4failed, others runtimeunverified. Closure42hashes match. Evidence/catalog/native scope limits retained; fresh review before verify, no reviewer experiments.

Criteria: C1 failed (New native created-OpenCode integration cancelled after60000ms; A-18266 file11pass/1cancelled/exit1, no successful C1 completion.), C3 failed (Item/pool launch discards placed project-account resolution and may re-read the local registry.), C4 failed (Item/fresh/cross-host spawn paths can lose destination mount-only overlay/login or reuse old accountEnv.).

### impl-1778 · 2026-11-10T05:36:08.990Z

Source2 rule-20 extension under Coordinator e2fbabf6: native binding now belongs to #spawnLaunch after TaskWorktrees/role/name/cwd admission; withLaunchPlacement reserves only. Caller sweep: Sessions.launch→#launchNew→#spawnLaunch; #restartPool (retained Implementer restart), #freshResume→#launchNew, #relaunchElsewhere→#launchNew and retry intent recovery, regular #resume→adapter.resume (recorded binding preserved), requests.session.launch, restored waits in Dispatcher, TaskWorktrees.launch/#launchIn, startup resumeAll/host restore, process persistence and account-limit overlays. Existing transitive graph already conservatively reaches these; explicit E-1534 consumers: host-relaunch-component (T2), host-relaunch-publication (T2), host-relaunch/native/retry (T3), session-resume-component/session-resume (T2), session-resume-lifecycle (T3), nvim session-resume/catalog consumers. Changed native direct files are now host-create-ready and host-relaunch, with same-head slot rerun required; unedited native/retry files remain in Linux/integrated preservation selection. New no-login cross-host case joins captured owners. No provider/SSH/fake-path seam changes; T-1801 owns abortable operations per accepted scope decision50f0d433.

### impl-1778 · 2026-11-10T05:40:00.651Z

Created-OpenCode native integration BLOCKED on T-1777 shared fake-login mapper (Coordinator decision3f4e4141). Actual surfaced error at source2 candidate: `host <id>: tunnel agent makeDirectory: EROFS: read-only file system, mkdir '/cland'` (3.474s), instead of previous hidden 60s observer timeout. T-1777 extends exported helper to all validated login-path agent file ops including makeDirectory and lands first; then Coordinator will authorize this branch's dev merge under rule11. T-1778 uses that single mapper at fake host execution only, preserving logical paths in rows/docs. Native wrappers closed/slot released; hc0→0. Cross-host native fixture currently gets `host f1 has no room` at first launch, before binding; fixture configuration correction remains local source2 work.

### rev-36 · 2026-11-10T05:45:45.773Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1778-source-2
commit: 77cbca5f1c58c3527500c289dab2e04567750c80
scope: full
findings: [{"severity":"high","text":"Unpinned launch admission checks default:<harness>, then LoginBinder can attach/mount and settle a ready login of already-limited account work before this actual-account check. Refusal leaves that login consumed with no rollback owner. Author confirms no omitted check/exception. Admit selected login.account before effects and revalidate at effect/settlement boundaries; public regression must prove zero effects and ready state for an already-limited selected account.","file":"hub/src/adapters/sessions.ts","line":1783},{"severity":"medium","text":"Join-only close controls hold mount only. Required held listVolumes and attachVolume close-order/settlement/pending controls remain absent; author confirms no other coverage. Extend those producer-stage controls without introducing T-1801 cancellation or raced deadlines.","file":"hub/test/login-binding.test.ts","line":170}]
finding_counts: {"high":1,"medium":1,"low":0}

Consolidated source-only review A-18278 (supersedes reference-only A-18277). Standards0 new findings, Spec2 (high selected-account pre-effect admission, medium missing held provider-stage close controls). Prior static corrections for post-item shared spawn, item account continuity, fresh/cross-host destination binding, held disk coherence, process-view wire type and FakeClock/process facts are present. No runtime criteria verified. Known created-OpenCode mapper-dependent EROFS and cross-host native fixture completion remain pending; A-18275 candidate outputs are explicitly not same-head configured proof. Coordinator accepts join-only native settlement/existing deadlines with cancellation in non-blocking T-1801. Fix both findings; T-1777 landing/authorized merge/mapper integration then need fresh source review and directed native/configured receipts. No full task-head T3 run requested; batch/T4/affected after-stage QA separate.

Criteria: C1 failed (Selected actual account can be refused only after native attach/mount has consumed its ready login; integrated native completion also remains pending.).

### impl-1778 · 2026-11-10T05:47:37.601Z

Source3 pre-change contract sweep for LoginBinder selected-account admission: sole production caller is Sessions.#spawnLaunch; direct test callers are login-binding held-close, held-key and provider/region controls. Rg of LoginBinder/binder.bind plus existing shared transitive graph finds no other caller/skill/QA API example. Add required checkAccount(account) callback using HubCore.checkAccountLimit; invoke for selected/held login before provider work and after each await before effects/settlement. No copied account policy or provider API change. Red public unpinned-limited-account test at base77cbca5f1 observed attachments=1 vs expected0; original source3-red producer log retained. Expanded six held list/attach/mount close controls already pass join-only behavior; native unknown attach/mount remain pending, list-only failure remains ready.

### impl-1778 · 2026-11-10T07:43:33.696Z

Authorized post-T-1777 merge completed as a0a30693a; conflicts resolved by preserving both login-add and binding docs/skills plus all tier entries. Pre-change execution-env sweep: AgentProcesses.spawn (prepared spawn and direct agent spawn), operationHandlers.run (agent file/command handlers), server run-host (Claude lifecycle and generic command owner), PreparedOperations.commit/runCommand (persisted logical plan and receipt owner), local/SSH host environment builders, host-command-environment/host-agent/host-login-disk and harness remote native regressions. All use existing remote credential filter; new loginExecutionEnvironment will call only T-1777's exported loginFilePath for three login env values at execution, never mutate hub/process-row overlays or durable hub requests. Generic directory preparation is already mapped by merged operationHandlers. accounts-policy red retained: login-binding.ts contains forbidden literal; replace with canonical mountedOpenCodeDatabase import.

### rev-35 · 2026-11-10T07:56:39.795Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1778-source-3
commit: 8591fc10680e2aceeac41eae03e428a2a6b2b48f
scope: delta
findings: [{"severity":"medium","text":"withLaunchPlacement unconditionally calls #launchRequestRole before the item operation callback, reintroducing name/Lead validation ahead of TaskWorktrees claim/worktree admission. Merged T-1743/T-1744 intentionally deferred item-name refusal. Binding is now post-admission, so this precedence change is unnecessary and unapproved. Retain item role lookup and defer ordinary name/Lead checks to the established owner; lead dc51ef0d confirms the gap.","file":"hub/src/adapters/sessions.ts","line":1547},{"severity":"medium","text":"Every #bind decodes LoginRecords.list() over all retained logins and queries bindings for each same-harness row before selecting a held/ready candidate. Signed-out/ineligible history widens synchronous spawn work without a bound or derived/indexed owner; serial tail ordering is not bounded selection. Rule23 requires bounded retained-history work. Lead d666cc9b confirms no omitted bound; implement bounded host/harness conflict and ready-selection queries with authorized fake-only work-count controls.","file":"hub/src/host/login-binding.ts","line":28},{"severity":"medium","text":"The seeding Store has only normal-path close after async config/secret setup; rejection can leak it. Separately held list/attach/mount controls register producer release/join after fixture() has registered borrowed Store.close, so shared FIFO resource cleanup can close storage before pending work settles on early failure. Prearm ordered producer drainage and idempotent Store disposal, attempt all joins and retain adverse failure-path controls. Lead220c8e2a confirms both ownership gaps.","file":"hub/test/host-relaunch.test.ts","line":51},{"severity":"medium","text":"SESSION_USAGE adds the ready-project-disk-login/account sentence, but frozen cli-usage/commands.json SESSION_USAGE retains the previous bytes. Independently compared exact strings: mismatch. No migration exception exists (lead5b4b2a26). Refresh through the existing catalog procedure and retain rendered-help/frozen-usage checks.","file":"hub/src/cli/usage/session.ts","line":2}]
finding_counts: {"high":0,"medium":4,"low":0}

A-18308: integrated authorized merge+mapper pass complete,Standards3medium/Spec1medium. Confirmed unbounded retained selection, FIFO producer/borrowed-Store and setup-Store ownership gaps, stale frozenSESSION_USAGE, and early item-name refusal regression. Prior selected-account/held-close/static corrections present; mapper canonical/agent-only,43closure hashes match,tier entries from both parents preserved. A-18304 originalred/53guard/123component candidate streams retained; no final native/Linux/cat proof. Join-only50f0d433/T-1801 scope retained. New-head correction/review before directed native slot, catalog and mode-free verify; no reviewer experiments or fullT3/provenance repeats.

Criteria: C1 failed (Binding selection scans all retained login rows and same-harness bindings on each spawn with no enforced work bound; the required launch-binding path needs a bounded selection owner before acceptance.).

### impl-1778 · 2026-11-10T07:59:54.650Z

Pre-change schema/selection consumer sweep (Coordinator6ee8b256/8ac729c4): LoginRecords module adds one selectForLaunch query method, private binding harness column/backfill and login_bindings_launch/login_ready_launch indexes. No new Login/LoginBinding or wire field. Production consumers remain HostRecords construction, Dispatcher login.list, CLI ListedLogin, login-signin's create/update/read/bind paths and snapshot readers; T-1781 snapshot owner uses get/bindings and is unaffected because public shapes stay identical. Persisted readers: Store/HostRecords restart, LoginRecords get/list/free/bindings, ProcessTable account/login metadata, sign-in intent recovery. Tests sweep covers login-records/list/signin/add/component/host-pin/terminal, host-login-disk/agent, login-binding, new login-selection migration/history controls and prior full transitive graph/unknown set. Existing record readers keep stage1 bytes; migration fixture seeds public API rows then downgrades schema only to prove old DB upgrade. Binder switches off list/per-row bindings scans to bounded index selection.

### impl-1778 · 2026-11-10T08:07:19.591Z

Source5 retained-history/migration and setup-owner tests use mandatory shared process-cleanup root/resource ownership. Tier lint identifies that import as T2, so both new files are T2 (lowest admitted tier), though neither launches a child/socket. The first T1 manifest attempt was refused and corrected, without guard changes. Source5 targeted producer passed175 checks + repo typecheck/closed wording before this tier correction; final controls/tier producer is retained separately. No native or configured pass inferred.

### impl-1778 · 2026-11-10T08:07:32.996Z

Correction to preceding source5 count: actual original targeted stdout records170 tests/170 pass, not175. Repo typecheck and closed-wording producers exited0; the tier producer exited1 for the now-corrected T1 imports. Final source5 control stream records36 tests/36 pass and tier lint exit0 with both new files classifiedT2. Counts come from retained producer summaries; neither stream is final reviewed-head native/Linux verification.

### rev-35 · 2026-11-10T08:15:02.502Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1778-source-4
commit: 4fdf45ab7809d61f4f6f404ec70081056387a46a
scope: full
findings: [{"severity":"medium","text":"Disk #accountRequest retains explicit account:'', while local resolution and the old binder treat a falsy account as unpinned. New indexed selectForLaunch distinguishes '' from null and looks for an exact empty account, so a launch can refuse despite a ready eligible login. Lead18eea582 confirms no approved policy change. Normalize empty string to null at account resolution and add a public compatibility control, preserving bounded selection.","file":"hub/src/adapters/sessions.ts","line":1532}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18315: all4A-18308 findings corrected; Standards0additional/Spec1medium empty-account regression confirmed. Two approved indexes/private transactional harness migration, bounded decode/query/EXPLAIN controls and10kpositivecontrol inspected; ownership/bodyfailure/setup-store/help/precedence corrected.43closurehashes match,frozenSESSION_USAGEequal. A-18311 original red/intermediate/tierfail and50/170/36candidategreens remain qualified. Fresh source after small account normalization before native/catalog/verify; join-only/T-1801 and no-live-data scope retained. No reviewer tests/native work.

Criteria: C1 failed (Explicit-empty-account pool launch can fail to select an otherwise eligible ready login because the new index path changed existing unpinned semantics.).

### rev-35 · 2026-11-10T08:18:12.074Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1778-source-5
commit: 2bcda8354b675ed60de36fb0e5eea1faf3710984
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18320: explicit empty disk account now normalizes to null before indexed selection, matching local/prior unpinned semantics and overriding role default. Public selection+reuse regression verifies work account/login,one mount/two spawns/logical overlays. All prior indexed migration/work-budget, precedence, help, ownership, mapper and account/close fixes retained; Standards0/Spec0. A-18319 original1red/40candidategreen+static exits remain qualified,not native/Linux proof. Proceed directed same-head native2files,catalog and mode-free verify; runtimeC1-C6unverified. Preserve recording/replay/consumercase+file accounting;27sallowance stillprojection,fullT3/T4/after-stageQA separate. No reviewer tests/native work.

### rev-35 · 2026-11-10T08:32:21.665Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1778-evidence-1
commit: 2bcda8354b675ed60de36fb0e5eea1faf3710984
scope: evidence
findings: [{"severity":"medium","text":"Enforced T0 dictionary-membership lint rejects newly added 'resolvedAccount' in request. Own-property membership is intended; inherited membership has no approval (lead23bf4407 confirms). Use Object.hasOwn while preserving resolved account continuity; no prototype exemption or unchanged-head suite retry.","file":"hub/src/adapters/sessions.ts","line":1621}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18329 audits failedbb95ff4d/A-18326. LocalT0typecheck/build complete,static lint stops13.884s;no droplet,platform/browsernull,testcounts unavailable,T1/T2/changedT3/T4/Webunexecuted. Standards1medium/Spec0additional;runtimeC1-C6unverified. Prior-head targeted native/catalog receipts A-18328 remain separately qualified,not configured proof. Fresh committed source review before resubmission; no reviewer experiments or unchanged-head retry.

Criteria: C3 failed (Account-continuity validation fails the enforced own-property membership guard before configured test phases; no runtime criterion proof from this run.).

### impl-1778 · 2026-11-10T08:32:46.551Z

T0 correction committed/pushed 66801dbe87988b761ce25a354da0705d10a5ee02: replace new resolvedAccount dictionary membership with Object.hasOwn. No wire/fixture change. Exact original enforced red is A-18326/A-18329; complete local npm run -s test:lint green (producer close0/null) retained A-18330; standalone dictionary lint also green. Coordinator ad010c5a directs delta review, native host-create-ready/host-relaunch at new reviewed head, retained490 catalog receipt A-18328 at2bcda8354 because no wire/fixture delta, then mode-free verify. All C1–C6 implementation-done marks remain; runtime verification awaits same-head run.

### rev-35 · 2026-11-10T08:33:49.745Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1778-source-6
commit: 66801dbe87988b761ce25a354da0705d10a5ee02
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18331: one-line Object.hasOwn correction preserves own resolved-account continuity; no prototype exception,Standards0/Spec0. A-18330 complete test:lint nativeclose0/signalnull,zero refusals with122report-only findings; candidate static only. Coordinatorad010c5a independently authorizes retained catalog490/490 atprior2bcda8354/A-18328 due no wire/fixture changes; requires nativehost-create-ready/host-relaunch atnewhead before mode-free verify. Prior source fixes unchanged; runtimeC1-C6unverified. OldfailedT0 and prior native/cat/source limits retained,fullT3/T4/QA separate. No reviewer runs.

### impl-1778 · 2026-11-10T08:54:52.985Z

Rule-20 corrected pre-retry sweep (A-18340): prior dispositions for host-status and pool-scale were wrong: they launch provided/pool-host sessions, so both now seed matching settled Codex bindings through the shared settledLogin helper before ready publication; assertions and bounds unchanged. Swept every tier manifest path for host/hosts/pool/placement/CLAND_TEST_HOSTS/testHost plus session.launch/.launch/.spawn callers; unioned all explicit pool/provided setup matches and shared transitive importers/unknowns of host-create-fixture, host-admission-fixture, digitalocean-pool-fixture and config-preservation. This supplements the735-path contract graph;186 conservative candidates including16 unknowns are listed with tiers and reasons in A-18340. All98 T2 candidates are being run locally, serially with per-file cover-quiet admission, sealed scratch environments and load<20. T3/native and Web/T4 remain separately dispositioned; graph reach is not coverage. Corrected targeted T2 list:
hub/test/account-coalescing.test.ts
hub/test/adapter-generation.test.ts
hub/test/artifact-host.test.ts
hub/test/claude-code-environment.test.ts
hub/test/claude-code-host.test.ts
hub/test/claude-code-remote-files.test.ts
hub/test/claude-code-schedule.test.ts
hub/test/claude-code-sessions.test.ts
hub/test/cli-session-credential.test.ts
hub/test/codex-delivery.test.ts
hub/test/codex-host.test.ts
hub/test/codex-remote-cleanup.test.ts
hub/test/codex-remote.test.ts
hub/test/codex-sandbox-host.test.ts
hub/test/config-reload-component.test.ts
hub/test/config-set.test.ts
hub/test/connection-snapshot.test.ts
hub/test/crew-launch.test.ts
hub/test/discord-cards.test.ts
hub/test/discord-users.test.ts
hub/test/executor-safety-component.test.ts
hub/test/fake-harness.test.ts
hub/test/host-attach-routing.test.ts
hub/test/host-create-admission.test.ts
hub/test/host-create-entry.test.ts
hub/test/host-destroy.test.ts
hub/test/host-launch-layout.test.ts
hub/test/host-lease.test.ts
hub/test/host-prepare.test.ts
hub/test/host-provider-digitalocean-prepare.test.ts
hub/test/host-provider-digitalocean-volumes.test.ts
hub/test/host-provider-digitalocean.test.ts
hub/test/host-provider-fake.test.ts
hub/test/host-provider-volumes.test.ts
hub/test/host-provision-recovery.test.ts
hub/test/host-readiness-owner.test.ts
hub/test/host-reboot.test.ts
hub/test/host-records.test.ts
hub/test/host-registry.test.ts
hub/test/host-relaunch-component.test.ts
hub/test/host-relaunch-publication.test.ts
hub/test/host-restart-reconcile.test.ts
hub/test/host-revoke.test.ts
hub/test/host-runtime-owner.test.ts
hub/test/host-secret-admission.test.ts
hub/test/host-status.test.ts
hub/test/host-stop.test.ts
hub/test/host-survival.test.ts
hub/test/host-unreachable.test.ts
hub/test/host-watchdog-loop.test.ts
hub/test/human-hold.test.ts
hub/test/inject-stalled.test.ts
hub/test/launch-admission.test.ts
hub/test/lead-permissions-component.test.ts
hub/test/login-add-component.test.ts
hub/test/login-binding.test.ts
hub/test/login-host-pin.test.ts
hub/test/login-list.test.ts
hub/test/mod-bridge.test.ts
hub/test/name-reservation.test.ts
hub/test/nvim-sessions-rules.test.ts
hub/test/opencode-host.test.ts
hub/test/opencode-launch-policy.test.ts
hub/test/opencode-remote-cleanup.test.ts
hub/test/plan-approval.test.ts
hub/test/pool-failures.test.ts
hub/test/pool-idle-stop.test.ts
hub/test/pool-scale.test.ts
hub/test/pool-spend-cap.test.ts
hub/test/project-hub.test.ts
hub/test/remote-scripted.test.ts
hub/test/roles-component.test.ts
hub/test/roles-snapshot.test.ts
hub/test/session-archive.test.ts
hub/test/session-async-processes.test.ts
hub/test/session-credential-io.test.ts
hub/test/session-host-placement.test.ts
hub/test/session-host-routing.test.ts
hub/test/session-host.test.ts
hub/test/session-pool-placement.test.ts
hub/test/session-resume-component.test.ts
hub/test/spoke-lazy-tools.test.ts
hub/test/sqlite-contention.test.ts
hub/test/suite-accounting.test.ts
hub/test/suite-close-component.test.ts
hub/test/suite-queue-policy.test.ts
hub/test/task-worktrees.test.ts
hub/test/telegram-approvals.test.ts
hub/test/telegram-users.test.ts
hub/test/tracker-ready.test.ts
hub/test/transport-config.test.ts
hub/test/transport-status.test.ts
hub/test/verifier-routing.test.ts
hub/test/visibility-component.test.ts
hub/test/waiting-launch-restart.test.ts
hub/test/waiting-launch.test.ts
hub/test/web-authority.test.ts
nvim/test/plan-component.test.ts

### rev-35 · 2026-11-10T08:55:33.801Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1778-evidence-2
commit: 66801dbe87988b761ce25a354da0705d10a5ee02
scope: evidence
findings: [{"severity":"medium","text":"Missed pool/provided-host launch fixture migrations in host-status and pool-scale: ready Hosts have no settled disk login. A-18337 directly reports no login codex in pool agents; five placement observations time out and another launch assertion fails. Prior acquisition/projection-only consumer disposition is invalid. Preserve assertions/bounds, migrate shared fixture setup, re-sweep all pool-host launch consumers, and establish targeted positive receipts before fresh source review.","file":"hub/test/host-status.test.ts","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18341 contains exact assertion/source evidence and limits. Configured6231cf33: T0/T1 exit0, T2 exit1,5138 base tests/5131pass/7fail; T3/T4/Web unexecuted. Same-head local native15 in A-18332 and authorized prior-head recording catalog490 in A-18328 remain separately qualified. No new C2–C6 verification, no shared-defect acceptance, no test or native review runs. Replacement committed delta requires source review before retry; Coordinator a686d981 directs complete pool/provided-host launch sweep and all affected local T2 receipts. Hold released by verdict.

Criteria: C1 failed (Configured pool-host launch consumer validation fails: seven T2 failures in A-18337; missing settled-login fixture migration remains unresolved at this pin.).

### impl-1778 · 2026-11-10T08:58:45.525Z

Committed/pushed8bf33b2af2661f123dfa581dcfe5ffaac0794f1c. Only4-file delta: settledLogin import/call before ready publication in host-status and pool-scale, plus their per-test docs (13 additions; assertions/bounds unchanged). Corrected complete explicit sweep A-18340; original redA-18337; local candidate A-18342 records ALL98T2files green,1417/1417actualTAPpasses,0fail/cancel/skip/todo, all producerclose0/null and complete npm run -s test:lint close0/null. macOSarm64Node24.21.0,local,sealed scratch,serial cover-quiet admission/load<20,no browser. Coordinator79910c8c permits carried native12+3 at66801dbe8(A-18332) and recording-mode catalog490 at2bcda8354(A-18328), since no production/wire/catalog/native/importer change. Delta scope held exactly. Final configured verification/consumer reconciliation still required; T3merge batch,T4stage/epic,after-stageQAseparate.

### rev-35 · 2026-11-10T09:00:02.254Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1778-source-7
commit: 8bf33b2af2661f123dfa581dcfe5ffaac0794f1c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18343: complete four-file fixture/docs delta,Standards0/Spec0. Shared settledLogin seeds match provider/region before ready; all assertions/bounds unchanged,no production/wire/native/importer/catalog delta. A-18342 candidate.patch equals committed diff; all98 T2 sweep paths match receipts,1417/1417 positive actual TAP summaries,all producerclose0/null,0fail/cancel/skip/todo. Seven old failures now positive local candidates; lint0/null,zero refusals/122report-only findings. Coordinator79910c8c explicitly authorizes carry native15/A-18332 at66801dbe8 and recording catalog490/A-18328 at2bcda8354; prior limits retained. New configured run/final C1–C6 and actual consumer reconciliation pending; A-18337 failed run remains failed. No reviewer runs. Hold released by verdict.
