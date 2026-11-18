---
id: T-1656
kind: task
title: "cland hub status shows a revoked host as plain 'down': host status rows carry no revoked state"
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
regression_of: T-1595
topic: topic-1614
branch: t/T-1656-cland-hub-status-shows-a-revoked-host-as
created: 2026-11-03T05:54:30.566Z
updated: 2026-11-18T09:15:09.409Z
closed: 2026-11-18T09:15:09.409Z
---

## Summary

Found while writing the E-1532 stage-2 QA brief. `HostRecords.list()` includes revoked hosts (T-1596), but `HostTunnelStatus` (T-1595) has no revoked state. After `cland host revoke <host>`, `cland hub status` and `hub.status` still list that host as `down`, the same as a host whose tunnel merely dropped, so the human can't tell a revoked host from a broken one.

## What to build

Host status rows show a revoked host as revoked, with the revocation time. The reconnect loop never starts for a revoked host. The additive `hosts` field keeps its existing members, and old clients still parse it (rule 20).

## Acceptance criteria

- [x] C1. After `cland host revoke qa1`, `cland hub status` and `hub.status` show qa1 as revoked with its revocation time, and qa2 is unchanged (test).
  - done: impl-1656 · 2026-11-18T06:51:32.133Z
  - verified: rev-36 [reviewer] · run rev-36-1656-final-1 · 2026-11-18T07:49:18.725Z · commit 6e460bc1ded50fd76aedd6a2afdabb05c3e43e4e
- [x] C2. The carrier never starts a master for a revoked host, and a client at the previous `hosts` shape still parses the reply (test).
  - done: impl-1656 · 2026-11-18T06:51:32.425Z
  - verified: rev-36 [reviewer] · run rev-36-1656-final-1 · 2026-11-18T07:49:18.725Z · commit 6e460bc1ded50fd76aedd6a2afdabb05c3e43e4e

## Comments

### impl-1656 · 2026-11-18T06:18:39.778Z

Consumer inventory (rules 20/41), before source changes: searched HostTunnelStatus, tunnelStatuses, HostRecord/HostRecords, hosts field, hub.status, lastProbe/reconnects, revoke, SQL hosts readers across hub/web/nvim/shared/docs/qa/skills and all test tiers. Producer: hub/dispatch.ts -> transport/transport.ts; protocol.ts and shared/wire/index.ts types; CLI cli/hub.ts describe reads fields dynamically. Sessions.#relaunchCause checks durable revoked state before tunnel status (unaffected). Web HostsView/HostsLine/state and connection read host.state / host.status pool snapshots, not hub.status.hosts; Neovim init.lua likewise reads host.state pools; selected-field hub.status readers ignore added metadata. Doctor/hosts.ts reads host.status pools, unaffected. Registry gates registered rows; SSH carrier takes HostRecord. Host record consumers: host/{hosts-state,login-release-policy,login-release,login-add,registry,host-health,attach,pool-runtime,status,login-reconcile,host-restart,provision-host,login-signin,login-release-owner}.ts, adapters/sessions, hub/{worktrees,store,dispatch}; they read named fields or spread records; registered row shape will stay unchanged. Persisted raw SQL readers in host-records.test.ts include a legacy hosts schema migration test; add migration/reopen/time retention coverage there. All tier consumers found: transport-{status,ssh,forwards,kind-types}, host-{records,ssh-registry,ssh-contract,runtime-owner,readiness-owner,secret-admission,revoke-native,settlement,unreachable,clone-integration,provision-gate,provision-recovery,lease}, adapter-generation, codex-host, remote-{cli,discovery-host}, web connection and Neovim shell fixtures. Existing up/down/connecting rows stay unchanged, so existing literal equality facts remain valid. Startup/readiness and frozen protocol fixtures select existing fields, no revoked rows. Frozen CLI commands.json/help usages do not change: existing state/since formatter prints revoked/time without text changes. QA E-1532-stage-2 explicitly expects revoked qa1 as down; migrate that expectation and misleading-probe paragraph. Other QA briefs reference carrier/process tests, not revoked status literals. Docs: ssh-transport.md and hub/README.md need updated state/time contract. Skill flow and role permissions unchanged. Compatibility regression will feed an explicit previous hosts row (without revokedAt) through the real CLI describe client; existing omitted-hosts regression retained. No tier reclassification planned.

### rev-35 · 2026-11-18T06:41:53.230Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1656-source-1
commit: a6479ea31421533a80ca5e9506c7be63244fc87f
scope: full
findings: [{"severity":"medium","text":"Standards/rules9/12/42: three new callbacks lack pre-acquisition normal/signal whole-case ownership. Status initial Store/setup and raw t body can outlive teardown; new registry DB/owner close registers only after projectSshHosts returns (host-ssh-registry:20,34–53). Adopt late roots/resources inside producers, fence separately bounded setup/body steps and join originals before resource/root/mock disposal; keep assertions. Author confirms6c684da7.","file":"hub/test/transport-status.test.ts","line":15},{"severity":"medium","text":"Standards/rules12/38/43: prototype-only launch guard misses synchronous child APIs, starts after acquisition, and its final zero-call assertion at56 precedes registry/host/Git teardown. No full-lifetime owner establishes otherwise. Reuse counted positive shared fakeNativeGuard through joined acquisition/body/resource/root cleanup, verify attempts after teardown, then restore. Correct guide's 'every child-process API' claim.","file":"hub/test/host-ssh-registry.test.ts","line":39},{"severity":"low","text":"Standards/rules16/20/41: stage3 still lists only up|connecting|down and stage4:946 describes the previous hosts columns. Add current T-1656 revoked/revokedAt/revoked_at shape/disposition guidance while preserving the pinned historical source provenance; author confirms missed active guidance79ca11a1. No QA execution needed.","file":"qa/briefs/E-1532-stage-3.md","line":657}]
finding_counts: {"high":0,"medium":2,"low":1}

A-21080 full source review at Git tree8a622c8dadd1998d14d62e5d5f3fec23ddaac061, fixed base303b482b82f898df49c31449b70417880005152f: Standards2medium+1low; Spec0 independent findings. Production additive time/legacy null/first revoke/stale-state override and both production Clock callers appear correct; registered shape and unchanged CLI reader remain compatible. Original test suffixes byte-identical. A-21078 independently hashed e4a18461..., current targeted2+9 and prior registry4 positive, root typecheck/lint reportedexit0/zero refusals; docs overlapped lint.49/77 selectedT1files have548retained positive names/aggregate, remaining28unexecuted; no configured/native/browser/cloud proof. Failed import/admission/layout rounds distinct from actual down/null behavioralred, raw/native/source-epoch limits retained. Consolidated fixes then fresh source review before verify; no dev merge or experiment requested. Reviewer reads only; hold released by verdict.

Criteria: C1 failed (New status and legacy metadata tests lack whole-callback acquisition/cancellation ownership before fixture disposal.), C2 failed (Registry criterion test registers cleanup after acquisition and checks a partial native launch guard before teardown.).

### rev-36 · 2026-11-18T07:04:15.852Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1656-source-2
commit: 6e460bc1ded50fd76aedd6a2afdabb05c3e43e4e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21094 corrected full source clearance at Git tree 1b367b216202744842c1ec9131168a7813eb0138 against fixed base 303b482b82f898df49c31449b70417880005152f, with prior findings A-21080/a6479ea31 rechecked. Standards 0 / Spec 0. All five production/wire blobs are unchanged from the prior review; additive revoked time/legacy null/first-time preservation, both production clocks, durable-state override, unchanged CLI formatter and previous-row compatibility remain correct. Three new callbacks now enroll shared normal/signal case ownership before acquisition, bound named setup, adopt roots/capture resources inside producers and join work before fixture/root disposal. Registry uses shared positively controlled callback/custom/sync/prototype native guard through resource/root closure, with final attempt verification then restoration. On unconfirmed closure the guarded root/DB/patches intentionally remain retained and cleanup fails; inspected fixture-work.ts precedent/rule12 supports that conservative policy, not unconditional restoration or a runtime failure-path proof. Stage3/4 additive current-shape notes preserve historical provenance and resolve L1; guide corrected. A-21091 preserves final-source lint/typecheck: zero refusals/130 report-only findings63files; lint began precommit after final edits, continued through commit with no source edits, typecheck ran at committed head; raw invocation-tree/native/timing gaps explicit. Corrected T1/T2 runtime tests and configured verification UNEXECUTED; prior A-21078/A-21080 targeted and 49/77T1/548-positive receipts remain old epochs, remaining28 unexecuted. Neither C1 nor C2 is runtime-verified by this source pass. Source/experiment hold released; follow Coordinator scheduling for pending targeted/T1 checks, then request exact-head mode-free verification. No new stress/native experiment or full suite requested.

### impl-1656 · 2026-11-18T07:45:12.001Z

Configured verification run0848656d-0834-4f5a-9860-7d0dd2fa95c1 passed at reviewed head6e460bc1ded50fd76aedd6a2afdabb05c3e43e4e (A-21128). Mode-free command; shared/wire change selected full fallback all T2, not manually selected all. T0/T1/T2/Web exit0;6704passes,0fail/cancel/skip/todo. Required generated cases independently checked in log: `revoked host status retains its revocation time and leaves the other host unchanged`, `legacy revoked records retain unknown time and override stale live carrier status`, `registry never opens a carrier for a revoked host and still starts its registered peer` each have structured timing outcome pass plus5/5 load-gate receipts. Existing C6 previous-reply-shape case also pass. Linux x64 6.8.0-147-generic, droplet c-8 ams3, Node24.21.0, Neovim0.12.5, Chrome Headless Shell/Chrome for Testing156.0.8078.4(v1248); lifetime1403s, cost$0.0974. Budget/lint diagnostics remain report-only; no timing speedup claim. T3 deferred to merge batch; T4 unexecuted. Current head/worktree unchanged/clean; waiting Reviewer same-head evidence settlement and hub ready event. Inventory follow-through: lower-tier legacy-schema/reopen coverage lives in registry/status T2 files, leaving host-records existing T3 file untouched. Stage3/4 received additive current-shape notes preserving historical source provenance.

### rev-36 · 2026-11-18T07:49:18.725Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1656-final-1
commit: 6e460bc1ded50fd76aedd6a2afdabb05c3e43e4e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear. A-21132 independently streams A-21128 / configured run0848656d-0834-4f5a-9860-7d0dd2fa95c1, owner exit0 and exact reviewed6e460bc1d; runtime normalized tree06f74d3bf837229ca30c994e268137cb8a40a836, cached:null. Six required registry/status controls each have typed base pass+timing; three new regressions each have five distinct passing load frames and exact named5/5proof. Positive complete file envelopes225/225T1,430/430T2,55/55Web;6704basepasses incl145nested,225loadpasses separate; no typed nonpass. T0/T1/T2/Web exit0. Source basis rev-36-1656-source-2/A-21094 clear, unchanged clean Git tree1b367b216202744842c1ec9131168a7813eb0138. C1 socket revoke/status, persisted first time/unchanged peer and CLI formatter; C2 fake-carrier exclusion plus legacy/stale and previous-host-shape controls positively executed. No real SSH/nativeT3/T4 or per-item QA claim; T3 merge/occasion deferral retained. Linuxx64 droplet Node24.21.0/nvim0.12.5; actual HeadlessShell1248/ChromeTesting156.0.8078.4. Lint/budget/ratchet advisories report-only. Prior source epochs/failures and local targeted receipts remain separately scoped. No Reviewer experiments/retry/source changes. Findings0 Standards/0 Spec; verify C1,C2, release evidence hold; ready/landing remains hub/lead-owned.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T09:15:09.409Z

Merged 01287db1c2941beac53df1a5895ad6385330e354 onto dev.
