---
id: T-1777
kind: task
title: "`cland login add` for disk logins, signed in from the terminal"
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
  - T-1773
  - T-1774
  - T-1776
topic: topic-1460
branch: t/T-1777-cland-login-add-for-disk-logins-signed
created: 2026-11-09T12:44:09.265Z
updated: 2026-11-10T07:39:42.263Z
closed: 2026-11-10T07:39:42.263Z
---

## Summary

`cland login add <harness> [--name <n>] [--pool <pool>] [--account <a>]` reuses a ready host of the pool or boots one. It creates an empty 1 GiB volume in the pool's region, attaches it and mounts it at `/cland/auth/<harness>-<login>`, then opens the harness's own sign-in over `ssh -t` in the human's terminal, with the disk as the harness home. On success the hub unmounts the disk, snapshots it, detaches it and marks the login `ready` with its last sign-in. On failure the login is `signed-out`, with its empty volume detached and kept.

## What to build

Two frames around a terminal step:
- **`login.add`.** The hub writes the row as `creating`, picks or creates the host, creates, attaches and mounts the volume, and answers with the host and a sign-in plan. The plan holds no credential.
- **The terminal step.** The CLI runs `ssh -t`, built the way `terminalAttachCommand` builds its command, with the home variable set to the mount:
  - Claude Code: `CLAUDE_CONFIG_DIR=<mount> claude auth login`.
  - Codex: the hub first writes `config.toml` with `cli_auth_credentials_store = "file"` into the empty `CODEX_HOME=<mount>`, then the CLI runs `codex login --device-auth`.
  - OpenCode: `OPENCODE_DB=<mount>/opencode.db opencode auth login`.
- **`login.signed-in`.** The CLI reports the sign-in's exit status. On exit 0, the hub unmounts, takes one snapshot, detaches and marks the login `ready`. Retention and the rate limit belong to T-1781.

Defaults and limits:
- `--pool` defaults to `agents`, or to the only pool.
- `--name` defaults to `<harness>-<n>`, with the lowest free n.
- The volume name is derived from the project tag and the login name, within the helper's pattern.
- **The host.** Any ready host of the pool is used, even a full one. Without one, the hub creates a host through the same path as `cland host create`, counted toward `max_hosts`; at `max_hosts` with no host ready or booting, the add is refused naming `max_hosts`.

cland never reads the disk. Success is the sign-in's own exit status, and no step runs a logout.

## Acceptance criteria

- [x] C1. With a ready fake host in `agents`, `cland login add codex` creates an empty 1 GiB fake volume in the pool's region, mounts it at `/cland/auth/codex-<name>`, and runs the fake `codex login --device-auth` over `ssh -t` with `CODEX_HOME` at the mount and a `config.toml` there holding `cli_auth_credentials_store = "file"` (test).
  - done: impl-1777 · 2026-11-10T05:39:00.842Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C2. `cland login add claude-code` runs the fake `claude auth login` with `CLAUDE_CONFIG_DIR` at its mount, and the login then reads `ready`, detached, with one snapshot id and its last sign-in (test).
  - done: impl-1777 · 2026-11-10T05:39:01.066Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C3. With no host in the pool, `cland login add` creates one and signs in on it once it is ready (test).
  - done: impl-1777 · 2026-11-10T05:39:01.437Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C4. A sign-in that exits nonzero, or a CLI that disconnects before reporting, leaves the login `signed-out` with its volume unmounted, detached and kept (test).
  - done: impl-1777 · 2026-11-10T06:14:13.853Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C5. While the sign-in runs, the login reads `creating` and is neither free nor bound (test).
  - done: impl-1777 · 2026-11-10T05:39:02.024Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C6. The fake login file's token appears in no argv, frame, log line or journal record of the flow, and the fake's calls file records no logout (test).
  - done: impl-1777 · 2026-11-10T06:27:28.070Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.052Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362
- [x] C7. A source check finds no logout command (`codex logout`, `claude auth logout`, `/logout`) in any command cland builds for a harness (test).
  - done: impl-1777 · 2026-11-10T05:39:02.595Z
  - verified: rev-35 [reviewer] · run rev-35-1777-final-1 · 2026-11-10T06:54:22.053Z · commit 00f767bc96c8ca76e27115b2e9c2d438e60c5362

## Blocked by

- T-1772
- T-1773
- T-1774
- T-1776

## Notes

- Hot files: `hub/src/host/login-signin.ts` (new: the sign-in runner T-1790 and T-1791 reuse), `hub/src/host/logins.ts` (transitions), `hub/src/cli/login.ts` (`add`), `hub/src/cli/usage/login.ts`. Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`. No `pool-runtime.ts` edit: the host is created through the `cland host create` path.
- Tests: new `hub/test/login-add.test.ts` (T3: CLI-started hub, fake provider, fake transport with `fake-ssh`, the fake binaries of T-1774); T2 cases for the failure paths with an injected sign-in runner.
- Serves epic C1 and C7.

## Comments

### impl-1777 · 2026-11-10T05:12:00.663Z

Rule-20 sweep: shared suite graph reached 678 tests and 16 unknowns (all counted reached), captured in topic artifact. Explicit consumers: cli/login.ts, protocol.ts, shared/wire/index.ts, hub/dispatch.ts, hub/web-authority.ts, host/logins.ts, login-list.test.ts (previous reply shape regression), login-records.test.ts, host-contract*.ts, host-attach*.test.ts, web-authority*.test.ts, cli usage commands.json, QA E-1535-stage-1, implement skill and session-permissions docs. Additive frames only; existing list/store records remain byte-shape compatible. New metadata mutation methods update creating rows only. No existing wire frame changes; catalog fixtures unaffected. CLI and permission docs receive additive add guidance.

### impl-1777 · 2026-11-10T05:15:54.771Z

Additional rule-20 sweep for approved fake-ssh seam: shared transitive graph captured in topic artifact (all unknowns counted reached). Explicit dynamic consumers include fake-ssh.test.ts and its per-file doc, host-create-fixture.ts, host-create-ready.test.ts, host-attach tests, host-login-disk tests, ssh transport tests and QA stage fixtures. Existing raw commands unchanged; only exact sign-in forms map under authenticated machine; other /cland/auth commands refuse. Native consumer checks will run in preservation slot.

### impl-1777 · 2026-11-10T05:17:05.280Z

Incident: red test used raw fake-ssh commands CLAUDE_CONFIG_DIR=/cland/auth/claude-code-work claude auth login; CODEX_HOME=/cland/auth/codex-work codex login --device-auth; OPENCODE_DB=/cland/auth/opencode-work/opencode.db opencode auth login. Only synthetic stdin was supplied. HOME was fixtureEnvironment(root) -> host.directory/home in disposable fs-* root/short ct-* alias; PATH was inherited safe base PATH, with installed harness locations (mistake). Native Claude output said Opening browser to sign in; actual open invocation is unknown, Coordinator observed no newly started browser. Fixture teardown removed scratch roots and joined children; no scratch credential is retained. Inspecting /cland paths for outside-root writes; output containing link was not exported. Post-fix routing already ran once before decision arrived (Claude/Codex green, OpenCode path failed); further runs stopped until incident and guard requirements complete.

### impl-1777 · 2026-11-10T05:17:33.488Z

Incident follow-up: read-only inspection found no /cland directory or files, hence no observed writes there. Cannot prove every possible outside-root write by installed binary; browser/open invocation remains unknown. No native output exported. All fake-ssh.test environments now prepend a scratch bin containing only fake harness wrappers and Node, with PATH limited to that bin:/usr/bin:/bin; installed harness locations removed. Exact sign-in dispatch uses absolute committed fake binaries; unknown /cland/auth forms refuse. Added planted PATH harness trap regression before rerunning.

### impl-1777 · 2026-11-10T05:21:40.133Z

Authorized prefactor: pure move of inline fake-login-disk validation into agent/fake-login-mount.ts; shared/fake-layout.ts adds only lexical join primitive, via exact agent owner. No tests edited in this commit. Follow-on feature reuses helper at publish/append/write boundaries. Rule-20 sweep extension: agent operations.ts, prepared.ts, files.ts, ssh-host.ts, local.ts, attach/launch-files callers, runtime delivery and host clone writers, host-contract tests, T-1776 host-login-disk/cland-auth tests, T-1778 login-binding loginDisk use, docs/hub/logins.md and QA stage briefs. Existing ordinary paths unchanged; generated closure updated.

### impl-1777 · 2026-11-10T05:28:01.895Z

Authorized rule-20 extension for busyHost pin seam: PoolIdleLifecycle/startPoolScaling callers in dispatcher, Sessions, PoolRuntime, createHost inUse/lease renewal, pool-idle-stop.test.ts, pool-scale.test.ts, host-spend/host-watchdog/host-stop fixtures, waiting-launch tests and docs/hub/logins.md. Shared transitive graph A-18252 reaches production integration tests and treats unknowns reached. Optional callback defaults absent; existing session behavior retained.

### impl-1777 · 2026-11-10T05:29:06.778Z

Fresh native slot inventory: prior own failure roots /private/tmp/hc-nLILcm and /private/tmp/hc-UtZXLr had no lsof users; shared ownDirectory disposal removed them after the earlier tests native close. These were retained by incomplete setup/teardown. Fresh hc-* baseline is zero before final slot. No glob/computed shell removal used.

### impl-1777 · 2026-11-10T05:35:23.491Z

Local native slot: cland-auth 10/10 and host-login-disk 13/13 green, fake-ssh 14/14 green. Full npm run test:nvim-fixtures passed every discovered catalog consumer (6057 frames) and live attach baseline, zero failure/cancellation/skip in the completed command. Snapshot diff inspected separately. Platform macOS arm64 Node24.21.0, local executor, no browser. Fresh final login-add rerun includes argv/log/journal/DB secret scan positive control; still in progress.

### impl-1777 · 2026-11-10T05:41:07.445Z

Coordinator-authorized scope addition after first review request: map validated fake login paths in stat/statDirectory/realpath/fileType/readFile/listFolder/makeDirectory/removePath alongside existing write/publish/append. Keep realpath replies logical; exported loginFilePath is the future host-execution environment seam for T-1778. Consumers extend existing rule-20 sweep A-18252: agent operations and prepared files, Host/sshHost file methods, LaunchFiles recursive directory setup, OpenCode account directory setup, fake-login-disk and new all-filesystem regression. Red observed: ENOENT mkdir /cland/auth/codex-work/nested in the new test before mapping.

### impl-1777 · 2026-11-10T06:02:58.924Z

Corrective source pass against A-18279: reserve/validate the creating row before host effects, release pins by this admitted attempt, revalidate captured host/registration/machine across native boundaries, own and join terminal SSH on cancellation/socket loss, attempt-all Dispatcher.close and early fixture/DB cleanup. Corrective tests are green locally: login-host-pin 12, component 5, signin 5; native terminal 2, fake-ssh 16, integrated login-add 1, unchanged host-create-ready 12. Original full Neovim catalog evidence was recording mode, not separate ordinary replay. Original native stdout with auth link remains unexported; labelled tool excerpts and per-path dispositions follow.

### rev-35 · 2026-11-10T06:11:39.313Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1777-source-1
commit: 7b08bb63d8f350e483bd0e6998d4147a3c206352
scope: full
findings: [{"severity":"medium","text":"Outer timeout:testWaitMs() defaults15s, but setup until alone has15s×loadFactor (2onLinux droplet), with further separately bounded native join/exit/cleanup. The outer watchdog can undercut authorized setup. No shared phase envelope exists (lead3d1dd010 confirms). Derive a named setup/behaviour/native-exit/cleanup envelope using the shared scaling policy without relaxing native receipt assertions; obtain minimal shared-helper scope authorization if needed.","file":"hub/test/login-terminal.test.ts","line":17}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18285: all7A-18279 source observations corrected; one remaining Standards medium test-envelope finding, Spec0additional.43generated closure hashes match. A-18283 candidate/excerpt limits retained; recording-mode49catalog maintenance accepted explicitly by Coordinator4ead38e5, ordinary Linux coverage pending; full graph normalization published for later receipt reconciliation. C1-C7runtime unverified. Correct budget at new committed head; fresh source review before verify, no reviewer/native/provenance reruns.

Criteria: C4 failed (Required terminal disconnect/cancellation test outer watchdog can expire before its load-scaled setup allocation; complete native-outcome coverage needs a coherent phase envelope.).

### impl-1777 · 2026-11-10T06:14:13.181Z

Coordinator c5dc7488 approved behaviour-preserving waitTimeoutMs extraction in until.ts. Shared transitive graph: 684 reached test importers plus14 unknowns conservatively reached (698 total), across all tiers. Existing until consumers are unaffected because default/explicit factor arithmetic, >=1 clamp and finite-positive refusal remain identical. Pure unit red was missing export, then green local default1/droplet2/explicit3/invalid clamp/nonpositive checks; existing clock tests15/15 green. Terminal outer envelope now sums shared scaled setup+join+cleanup and exact named2s native-exit assertion. No all-importer or native rerun required by Coordinator; full graph retained in topic artifact.

### rev-35 · 2026-11-10T06:16:12.982Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1777-source-2
commit: 8e3b246ee7169d6d22952733adf677a501840594
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18287: shared waitTimeoutMs preserves prior until policy; named outer setup/join/cleanup envelope contains scaled waits, exact2s native assertion retained withfactor1. C4source finding repaired; all7A-18279 fixes retained; Standards0/Spec0. Coordinatorc5dc7488 authorizes minimal extraction/no native-all-importer rerun. A-18284 alloriginalgraphpaths/tier flattening checked; final receipts must add newuntil.test.ts and A-18286union, reconcile actualcase+file finishes. A-18283 candidate/recording limits and Coordinator4ead38e5 catalog split retained. RuntimeC1-C7unverified pending exact-head mode-free verify; fullT3/T4/after-stageQA separate. No reviewer tests/native work.

### rev-35 · 2026-11-10T06:24:28.099Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1777-evidence-1
commit: 8e3b246ee7169d6d22952733adf677a501840594
scope: evidence
findings: [{"severity":"medium","text":"Missed enforced policy consumer: the new credential-free login-signin.ts OpenCode path contains opencode.db, but exhaustive accounts-policy source scanning has no authorized exact metadata target for it. Runf6cd427e/A-18288 fails this exact assertion; lead confirms task-local omission/no prior approval. Migrate through the approved canonical pure path owner and exact target, preserving exhaustive/wrong-file/duplicate/read-side-effect guards; no obfuscation or broad exclusion.","file":"hub/test/accounts-policy.test.ts","line":8}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18289 audits failedf6cd427e/A-18288 atsource-clear8e3b246ee. T0pass,T1fail; base1617/1616pass1fail, separatecompleted-beforeinterruption1772/1771pass1fail (not summed). T2/changedT3/Web unexecuted,browsernull. Linuxx64 Node24.21droplet,no cache,lifetime248s/cost$0.0172. Standards1medium/Spec0additional; allruntimecriteriaunverified. New authorized canonical-helper correction requires fresh committed source review before verify; no shared-defect or unchanged-head retry claim.

Criteria: C6 failed (Credential-boundary validation fails the enforced accounts-policy source scan for the new OpenCode path; this is not a claim of a credential leak, and runtime coverage remains incomplete.).

### impl-1777 · 2026-11-10T06:26:42.242Z

Rule20 correction: accounts-policy.test.ts was a missed textual credential-store-name consumer. Coordinator d2261095 directs canonical mountedOpenCodeDatabase helper in accounts/registry.ts with one exact owner/literal exception; login-signin imports it, T-1778 reuses it after merge. Exhaustive scan retained; planted wrong-file, duplicate occurrence and readFile variant refuse. Local accounts-policy4/4 + signin5/5 green after red missing-export/existing source-guard failures. No native/full-suite retry before fresh source review. Failed-run exact generated case/file finishes are being reconciled from A-18288; T2/Web/changedT3 remain unexecuted.

### rev-35 · 2026-11-10T06:29:14.853Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1777-source-3
commit: 00f767bc96c8ca76e27115b2e9c2d438e60c5362
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18291: Coordinator d2261095 canonical registry mountedOpenCodeDatabase implemented as pure join; login-signin imports it, no literal obfuscation/read. Exact file/line target only, exhaustive scan and wrong-file/duplicate/read variant guards retained. All prior source fixes unchanged, Standards0/Spec0. A-18290 correctly retains old failed8e3b246ee receipt and unexecutedT2/Web/changedT3, not corrected-head proof. Local4policy+5plan candidate claims remain qualified. RuntimeC1-C7unverified pending fresh exact-head mode-free verify and complete actual case/file reconciliation. No reviewer tests/native work; fullT3/T4/after-stageQA separate.

### rev-35 · 2026-11-10T06:54:22.053Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1777-final-1
commit: 00f767bc96c8ca76e27115b2e9c2d438e60c5362
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18296 independently audits same-head b94b0d41/A-18295:5826base passes,zero fail/cancel/skip; T0/T1/allT2/4changedT3/Web exit0,no cache. Fulltree4336da40025a283e34448d8b87395d04df67dfb9/exportb2c8bfd7dc1ce81ce533f330dd9d09223da0c2f0 match Git reconstruction. All658manifest lower/Web paths have passing base case+file finishes;49load identities5/5each;32native leaf timings/4files pass incl integrated10.250s<declared16s, actual terminal native-close cases. Policy/phase/all7original fixes retained; C1-C7verified,Standards0/Spec0. Linuxx64 Node24.21,Nvim0.12.5,HeadlessShell1248 Chrome156.0.8078.4. A-18292 prior-failure facts and A-18283 candidate/recording limits retained;250otherT3/17T4,fullT3batch and after-stageQA separate. Report budgets/ratchet advisory; lifetime/cost unavailable in inspected log. No reviewer/native/API runs.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-10T07:39:42.263Z

Merged e6fbbd906059c0e68fd3387f72f39a73ce149955 onto dev.
