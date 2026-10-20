---
id: T-962
kind: task
title: A T0 guard refuses raw child launches in hub/test that inherit the environment without the sealed builder
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - tech-debt
assignee: null
parent: E-952
blocked_by:
  - T-961
topic: topic-735
branch: t/T-962-a-t0-guard-refuses-raw-child-launches-in
created: 2026-10-20T10:10:19.498Z
updated: 2026-10-20T12:49:26.434Z
closed: 2026-10-20T12:49:26.434Z
---

## Summary

T-961 seals the shared fixture builders, but nothing stops a test from calling `spawn`, `execFile` or `fork` with an inherited environment. rev-32 found this in T-954's suite-check.test.ts. Add a T0 static guard so rule 15 holds for new tests mechanically.

## What to build

A T0 check over hub/test refuses a child-process launch whose environment is inherited or built from `process.env` without the sealed builder from T-961. Exemptions:

- typed fake-provider and native-credential seams;
- lifecycle and setup helpers that are sealed by construction;
- anything else carrying an inline exemption with a reason.

Each finding is reported with file and line. Found by impl-961 and recorded as a gap outside T-961's C2.

## Acceptance criteria

- [x] C1. A scratch test that spawns with `env: process.env`, or with no env, fails the T0 check, naming the file and line.
  - verified: rev-23 [reviewer] · run rev-20261020-962-source-corrected · 2026-10-20T11:38:36.157Z · commit 981943358ae1dd6e746084e14029f3a7334716b3
  - verified: rev-23 [reviewer] · run rev-20261020-962-source-integration-corrected · 2026-10-20T11:46:43.168Z · commit 80c8f983142ebbaf3843406589ae8ae9ee918dec
  - verified: rev-23 [reviewer] · run rev-20261020-962-final · 2026-10-20T11:54:27.397Z · commit 80c8f983142ebbaf3843406589ae8ae9ee918dec
  - verified: rev-23 [reviewer] · run rev-20261020-962-merge-source · 2026-10-20T12:31:50.867Z · commit 6b0e990c11f213ffdff498c1616aeb914fb71153
  - done: impl-962 · 2026-10-20T12:35:55.660Z
  - verified: rev-23 [reviewer] · run rev-20261020-962-reserve-source · 2026-10-20T12:36:26.204Z · commit 483851f4269c182b2d71109a9b9dd58da658672a
  - verified: rev-23 [reviewer] · run rev-20261020-962-merge-final · 2026-10-20T12:44:25.651Z · commit 483851f4269c182b2d71109a9b9dd58da658672a
- [x] C2. Every existing launch either uses the sealed builder or carries a listed exemption with a reason, and the evidence lists them.
  - done: impl-962 · 2026-10-20T12:35:56.461Z
  - verified: rev-23 [reviewer] · run rev-20261020-962-merge-final · 2026-10-20T12:44:25.651Z · commit 483851f4269c182b2d71109a9b9dd58da658672a

## Comments

### impl-962 · 2026-10-20T11:13:24.804Z

Implemented T0 compiler guard over hub/test native launches (including helpers/fakes/JS, aliases, promisify and dynamic imports), sealed straightforward callers and annotated each intentional seam. Guard has in-memory positive/negative cases and a file/line inventory. Fixed aside in scope per Coordinator: fake-machine transport log now records sorted environment variable names, with a T1 durable-file credential-sentinel regression. Docs/help/implement skill provenance and role clause updated. Candidate 5f58f9d1 after pre-review origin/dev merge and push. Final same-head T0 checks pending before review.

### rev-23 · 2026-10-20T11:20:22.280Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-962-source
commit: 7f23ca2d200d78d3e3d20ea3084b1a6b91488afa
scope: full
findings: [{"severity":"medium","text":"Passing the full inherited env as fixtureEnvironment's final extras restores host XDG/account paths after scratch defaults. env originates in suiteTestEnv(process.env); fixtureEnvironment preserves extras XDG_* and CLAUDE_CONFIG_DIR/CODEX_HOME. A parent with these set therefore reaches the child unchanged while inventory labels the launch sealed. Split trusted runner controls from inherited base and audit equivalent {...process.env} extra migrations; retain only explicit scratch-owned profile paths.","file":"hub/test/run-suite.ts","line":185},{"severity":"medium","text":"Re-sealing machine.env with root=machine.project changes its intentional HOME to machine.project/home and inserts CLAUDE_CONFIG_DIR even after this scenario deletes it to exercise default ~/.claude.json. The scenario later asserts trust in machine.home/.claude.json. Preserve the typed scratch-machine HOME/profile contract (or a reasoned sealed-by-construction seam) rather than rewriting the product inputs.","file":"hub/test/scenarios/setup.test.ts","line":39}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: medium run-suite.ts:185 (also load-gate/manual full-env overlays) passes inherited XDG/account paths back as final builder extras; syntactic sealed inventory is not path ownership proof. Spec: medium scenarios/setup.test.ts:39 changes scratch HOME and reintroduces an intentionally absent CLAUDE_CONFIG_DIR, breaking the original default-home trust assertions. Preserve filtered base versus explicit owned extras and the setup machine product seam. A-7555 contains source trace and validation limits. No independent fake-machine env-name writer finding. C2 failed; C1 runtime verification remains pending corrected source. No Reviewer tests executed.

Criteria: C2 failed (Migrated full inherited extras restore host XDG/account paths, and setup scenario migration rewrites its intentional scratch HOME/unset-profile contract.).

### impl-962 · 2026-10-20T11:32:39.540Z

Source correction af1440a40ed52d321a78db686b2789702a61fcc2 pushed, without post-review dev merge. A-7563 supersedes A-7550 migration claims: runner controls are allowlisted over the filtered base; full inherited extras are refused at T0; setup preserves owned HOME/unset Claude profile; actual poisoned phase/load-gate children and full setup assertions pass. Exact-head npm check and T1 environment 4/4 pass. Awaiting fresh source verdict before any verification.

### rev-23 · 2026-10-20T11:34:13.262Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-962-source-second
commit: af1440a40ed52d321a78db686b2789702a61fcc2
scope: full
findings: [{"severity":"medium","text":"Ambient-extra refusal is applied only to fixtureEnvironment's third argument. The equally trusted accountFixtureEnvironment takes extras as its first argument, so spawn('tool', [], {env: await accountFixtureEnvironment({...process.env})}) is classified sealed even though the captured ambient XDG/Claude/Codex paths overwrite scratch defaults. Apply ambient checking to every builder's actual extras position and add direct/aliased account-builder negative cases.","file":"hub/test/lint-child-environment.ts","line":130}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: previous path ownership and setup findings resolved. Spec: medium lint-child-environment.ts:130 checks ambient extras only for fixtureEnvironment's third argument; accountFixtureEnvironment's first argument remains unchecked. A direct awaited accountFixtureEnvironment({...process.env}) child captures inherited paths before worker initialization and restores them as extras, yet inventory marks it sealed. Apply builder-specific extras checks and direct/aliased negative controls. A-7564 contains source trace and A-7563 validation limits; no Reviewer reproduction claimed. C2 failed; C1 remains unverified. No task gate yet.

Criteria: C2 failed (accountFixtureEnvironment's first-argument full ambient extras bypass the new refusal and can still be classified sealed despite restoring inherited profile paths.).

### rev-23 · 2026-10-20T11:38:36.157Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-source-corrected
commit: 981943358ae1dd6e746084e14029f3a7334716b3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. All prior path/setup/unchecked-account-extras findings resolved. Registry binds trusted declarations to each extras position, including nested ambient analysis. A-7567 exact-head T0/check and scratch file/line refusals plus compiler matrix establish C1. A-7569 records source audit, 260-site inventory (181 builder/79 reasoned exemptions), preserved runtime seams and validation limits. C2 integration remains pending mode-free verify at this head; A-7563 native targets are pre-commit correction-tree supplemental receipts, not this head's task gate/load proof. Existing lint report-only; no item QA. Reviewer ran no tests.

Criteria: C1 verified.

### rev-23 · 2026-10-20T11:42:25.863Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-962-evidence-red
commit: 981943358ae1dd6e746084e14029f3a7334716b3
scope: evidence
findings: [{"severity":"medium","text":"scratchMachine now inherits fixtureEnvironment's CLAND_EXECUTOR_STATE default without removing it. This overrides the deliberately default XDG ledger used by the spend/migration/retirement contracts. A-7573 reports expected home/.local/state/cland/spend.json versus actual executor-state/spend.json and retirement refusing CLAND_EXECUTOR_STATE. Preserve the native fixture's default-ledger contract while sealing inherited input.","file":"hub/test/init-machine.ts","line":23},{"severity":"medium","text":"The runner now publishes a fresh HOME under the phase root without creating it. In-process T1 init/setup calls realpathSync(HOME) and fail before their intended assertions; A-7573 reports ENOENT lstat <phase>/home in init-roots/setup-favourite/setup-handover. Provision the owned environment directories before phase and repetition launch, while keeping pure environment construction pure.","file":"hub/test/run-suite.ts","line":185}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: no independent new finding. Spec: two medium integration failures in A-7573/run f5b077eb. init-machine.ts:23 retains new CLAND_EXECUTOR_STATE, changing default XDG ledger and causing retirement/lock/migration failures; run-suite.ts:185 sets fresh HOME without creating it, causing ENOENT before init/setup assertions. Exact failure quotes and source trace in A-7575. Ordinary count 617 pass/23 fail (640); 650 completed counter includes repetitions. T2/Neovim not executed; T3/T4 deferred. C1 T0 evidence remains current, C2 failed. Fresh corrected-head source review required; this is not an unrelated flake or green gate.

Criteria: C2 failed (Same-head T1 gate fails 23 tests: scratchMachine injects a ledger override into default-ledger contracts and runner HOME is not created before in-process init/setup.).

### rev-23 · 2026-10-20T11:46:43.168Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-source-integration-corrected
commit: 80c8f983142ebbaf3843406589ae8ae9ee918dec
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7575 failures resolved: scratchMachine deletes the unwanted ledger override; pure-builder directories are provisioned before phase and repetition spawn, with post-await cancellation checks. Actual-child tests retain directory/HOME write observations and original skip/repetition contracts. A-7579 records source trace; A-7577 exact-head local T0/runner targets and precommit affected targets remain separate from the pending task gate. C1 guard/T0 proof current; C2 integration pending replacement mode-free verify at this head. Historical f5b077eb/A-7573 red retained. Reviewer ran no tests.

Criteria: C1 verified.

### impl-962 · 2026-10-20T11:53:59.257Z

Replacement mode-free run 40d5b06d-b459-472a-9260-2385902577bf at reviewed head 80c8f983142ebbaf3843406589ae8ae9ee918dec: exit0, A-7585. Host T0/check passed; Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5, T1/T2 exit0, all-T2 fallback, receipt reports2048 passes/0failures including repetition records. T3 deferred and not claimed. Lint/budgets/ratchet report-only. Droplet lifetime376s/cost$0.0261. Failed predecessor f5b077eb/A-7573 retained with repair evidence A-7577 and source-clear A-7579. Awaiting Reviewer's same-head final evidence verdict; tree remains clean.

### rev-23 · 2026-10-20T11:54:27.397Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-final
commit: 80c8f983142ebbaf3843406589ae8ae9ee918dec
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7586 audits replacement A-7585/run 40d5b06d at exact source-cleared head: 2048/2048 ordinary tests; new isolation/writer identities each 5/5 load passes. All predecessor failing ledger/init/setup files now pass. C1 enforcing T0/refusal proof and C2 260-site reviewed inventory plus current T1/all-T2 integration established. Historical red f5b077eb/A-7573 (617 pass/23 fail) and A-7575 task-owned repairs retained; changed-head correction, not flaky retry. Linux T1/all-T2 includes Neovim; native T3/T4 deferred and prior local targets supplemental. Host check844b2a46 not repeated. Lint/budgets/ratchet report-only;11 missing baselines/incomplete timing not passes. No item QA.

Criteria: C1 verified, C2 verified.

### impl-962 · 2026-10-20T12:27:42.689Z

Coordinator-authorized dev merge pushed as 6b0e990c11f213ffdff498c1616aeb914fb71153. All T-964 identity/excludes/restart changes retained with T-962 runner controls; init machine's deliberate absent/configured Git identity contract preserved, red→green. Local targeted fixture5/release22/demo5/droplet4/init-wrapper1 pass; npm check passes (lint report-only131/59,0refusals); updated inventory260=181sealed+79exempt. Both C1/C2 claimant done marked. Fresh delta review requested; historical A-7585 gate is not current-head evidence.

### rev-23 · 2026-10-20T12:31:50.867Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-merge-source
commit: 6b0e990c11f213ffdff498c1616aeb914fb71153
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7637 reviews Coordinator-authorized merge 8463bd99: T-964 identity/typed excludes/provider restart and both fixture groups retained alongside T-962 runner filtering and directory preparation. Init machine clears only worker-default author/committer variables so original absent/configured identity assertions remain meaningful; ledger default repair retained. Guard source unchanged; A-7631 inventory 260 = 181 sealed + 79 exempt. A-7632 same-code local targeted checks and guard/T0 are supplemental; C1 current, C2 integration awaits fresh mode-free exact-head verify. Prior A-7585/A-7586 at 80c8f983 are historical, not coverage of this merge. No QA; Reviewer ran no tests.

Criteria: C1 verified.

### rev-23 · 2026-10-20T12:35:15.932Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-962-merge-evidence-red
commit: 6b0e990c11f213ffdff498c1616aeb914fb71153
scope: evidence
findings: [{"severity":"medium","text":"The merged default Implementer clause exceeds its existing reply reserve: A-7639 reports 7684 bytes against the 7680-byte ceiling (512 bytes below the send cap). The T-962 guard paragraph remains additive to incoming clause changes, so the same-head T1 gate fails deterministically. Shorten the guidance or use a concise docs pointer while retaining the sealing requirement and the existing reserve/assertion; request fresh source review before verification.","file":"hub/src/roles/default-roles.ts","line":159}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: medium default-roles.ts:159, merged Implementer guidance exceeds the existing reply reserve. A-7639 exact assertion: 'clause reply is 7684 bytes; reserve ceiling 7680 bytes'. Shorten guidance/use the docs pointer, retaining sealing semantics and reserve assertion. Spec: C1 guard source proof remains, but C2 integration fails. A-7640 audits c28b8066: 642 pass/1 fail ordinary tests, not the 653 completed counter including repetitions; Linux T1 exit 1, T2/Neovim not run, T3/T4 deferred. Host 712dd83d check not repeated; lint/budgets report-only. New source review required before replacement verify; no unchanged-head retry. Reviewer ran no tests.

Criteria: C2 failed (Merged default Implementer clause is 7684 bytes above the 7680-byte reserve ceiling; exact-head T1 gate fails and T2/Neovim do not execute.).

### rev-23 · 2026-10-20T12:36:26.204Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-reserve-source
commit: 483851f4269c182b2d71109a9b9dd58da658672a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. Sole line default-roles.ts:159 is now the sealed-builder/docs pointer requested by Coordinator d381737c. Full guidance remains documented; reserve/cap/test and guard/runtime code unchanged. A-7644 local roles-clauses 27/27 and guard controls pass, rendered reply 7307 bytes (373-byte headroom). A-7645 source trace; C1 current, C2 awaits replacement exact-head mode-free verify. Retain deterministic red c28b8066/A-7639 and A-7640; prior gates historical. Reviewer ran no tests.

Criteria: C1 verified.

### impl-962 · 2026-10-20T12:44:02.770Z

Current exact-head mode-free run d17566de-5637-4099-b928-43af3b149887 passed at483851f4269c182b2d71109a9b9dd58da658672a: A-7649 exit0, receipt2063passes/0failures. Host T0/check passed; Linux x64 droplet c-8 lon1 Node24.21.0/Neovim0.12.5, T1 and all-T2 fallback completed including Neovim; T3/T4 deferred. Lint/budgets/ratchet report-only,13missing baselines; timing projections are not wall times. Lifetime398s/cost$0.0277. Failed c28b8066/A-7639 retained alongside reserve repair A-7644/sourceclear A-7645. Awaiting same-head final reviewer verdict; both claimant done marks recorded.

### rev-23 · 2026-10-20T12:44:25.651Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-962-merge-final
commit: 483851f4269c182b2d71109a9b9dd58da658672a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7649/run d17566de passes 2063 ordinary tests and 328 files at exact source-clear head, Linux droplet T1/all-T2 including Neovim. Roles-clauses 27/27 now green; runner isolation and names-only writer each 5/5 load passes. C1 enforcing guard/controls and C2 260-site inventory plus replacement integration established. Final audit artifact retains c28b8066/A-7639 reserve red and A-7640, plus earlier ledger/directory history; correction changed the head, not a flaky retry. Host check ca2a6593 not repeated remotely; T3/T4 native coverage deferred, prior local targets supplemental. Lint/budgets/ratchet report-only, 13 missing baselines/incomplete timings not passes. No QA; Reviewer ran no tests.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T12:49:26.434Z

Merged 9a76404c4cf1caceee86317c29cd54d2c344994a onto dev.
