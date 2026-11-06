---
id: T-1706
kind: task
title: Hosts join and leave a running hub (prefactor)
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1400
branch: t/T-1706-hosts-join-and-leave-a-running-hub
created: 2026-11-06T10:47:42.499Z
updated: 2026-11-06T11:11:22.705Z
---

## Summary

Today the hub opens its SSH hosts once at start, and the sessions' host map is fixed at construction. This prefactor lets a host registered after start open its carrier, git daemon and Host and join the sessions' map without a restart. Removing a host takes it out through the existing revoke settlement. Behaviour for hosts present at start is unchanged.

Hot files: `hub/src/host/registry.ts`, `hub/src/adapters/sessions.ts` (`#hosts`), `hub/src/hub/daemon.ts`, `hub/test/host-runtime-join.test.ts` (new)

## What to build

An owner API on the project's SSH hosts, `add(record)` and `remove(id)`, used by the daemon and handed to the sessions. A host added while serving runs the same path as one opened at start: carrier start, git daemon, clone on first worktree add. A removed host is quiesced and closed in the same order as at hub stop. Its rows are settled the way `host.revoke` settles them, never left `running`.

Notes: `projectSshHosts` is owned here; the later create-to-ready and destroy tickets call `add` and `remove`.

## Acceptance criteria

- [ ] C1. A fake host registered on a running hub opens its tunnel and takes a `session.launch` with its `host` within the test budget, with no hub restart (test).
  - failed: rev-38 [reviewer] · 2026-11-06T11:08:49.581Z · note Publication/shutdown regressions exercise the race but do not establish join-before-public-settlement; add ordered promise-settlement and cleanup completion receipts.
- [ ] C2. Removing that host stops its carrier and git daemon, and its running session rows settle through the revoke path, never staying `running` (test).
  - failed: rev-38 [reviewer] · 2026-11-06T11:05:25.486Z · note Missing failed runtime-remove cleanup/retry regression; existing startup owner.close retry does not exercise this new path.
- [ ] C3. A host added at runtime is reopened at the next hub start like any registered host (test).
- [ ] C4. The existing host test files (`host-ssh-registry`, `host-relaunch`, `host-survival-native`) pass with no test edited.

## Comments

### impl-1706 · 2026-11-06T10:50:41.391Z

Rule 20 consumer sweep before edits: searched projectSshHosts, settleHostBeforeCut, revokeHost, host.revoke, HostRecords and hosts across hub/src, hub/test (all tiers), nvim, web, docs, qa/briefs and shipped .agents/skills. Production migrations: host/registry.ts owner lifecycle, adapters/sessions.ts dynamic map registration with the existing authority proxy, hub/daemon.ts owner wiring. Dispatcher.revokeHost remains the single settlement/cut entry point. adapters/index.ts exports remain compatible. Host records/store/transport configuration, protocol parser, CLI host, web authority/edge, nvim/web clients have no wire/schema changes and remain unaffected. Existing session-host*, adapter-generation*, worktree-host, name-reservation, lifecycle-serialization, host-reboot*, host-survival*, host-relaunch*, host-revoke*, host-settlement, host-secret-admission, host-attach-routing, host-flush-native, host-clone-integration, territory-task-branch, remote-discovery-host, artifact-host, transport-* and remote-adapter tests exercise unchanged Host/wire shape; preservation files stay unedited. E-1532 stage 2/3/4/6 QA briefs, docs/hub/adapters-and-sessions.md, docs/agents/host-agent.md and implement skill describe unchanged revoke/fence semantics. New API is additive and internal; no Host member, frame, config table or executor key changes. New per-test docs will describe runtime owner use.

### impl-1706 · 2026-11-06T10:57:01.075Z

Rule 20 follow-up: projectHub/harness.ts retains its return fields and adds hostOwner and hostEnvironment. All existing projectHub consumers remain source compatible; runtime-join alone uses these additive fields to enable fake SSH admission after serving, without auto-registering f1 at startup. Global typecheck passes after naming the additive environment field hostEnvironment to avoid existing env spreads. No existing test body has changed. Coordinator approved the 14-file affected batch in topic-1400 (decision 520d1b01): runtime-join, ssh-registry, relaunch, survival-native, revoke-native, relaunch-native, relaunch-retry, reboot-native, adapter-generation, session-host-routing, transport-forwards, transport-ssh, host-supervisor, launch-recovery. Other unchanged T3 importers deferred to full integrated merge batch and stage cover.

### rev-38 · 2026-11-06T11:04:12.628Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1706-source-1
commit: 4f30cb6f96024d400566264be9f66a874c9ff3a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 4f30cb6f96024d400566264be9f66a874c9ff3a0 against base 74117dabb. Standards and Spec: no findings; full review in A-17061 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17061-t-1706-source-review-at-4f30cb6f9.md). Add/startup share the lifecycle owner; runtime publication keeps the existing Sessions authority fence, and removal calls Dispatcher.revokeHost before owner closure/map removal. Checked shutdown serialization, preparation drain, failed cleanup retention, consumers, fixture isolation, test tiers/docs and unchanged C4 files. Criteria marks: none. C1-C3 runtime and C4 preservation remain unverified pending exact-head post-source configured run and required receipts. No Reviewer test/browser execution; A-17057 is initial partial implementer evidence, not final exact-head coverage.

### rev-38 · 2026-11-06T11:05:25.486Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1706-source-2
commit: 4f30cb6f96024d400566264be9f66a874c9ff3a0
scope: full
findings: [{"severity":"medium","text":"Coordinator-required runtime lifecycle regressions are absent: duplicate add preserving the published owner, rollback when onAdd throws, failed remove cleanup retaining ownership for retry, and shutdown racing an add held in carrier.start. Existing startup close retry does not exercise runtime remove retention/map removal.","file":"hub/test/host-runtime-owner.test.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; supersedes rev-38-1706-source-1 following Coordinator direction 5cabaa51. Medium: hub/test/host-runtime-owner.test.ts:11 — new runtime lifecycle branches lack the four required regressions; happy-path add/remove and revoked re-add do not cover them. Full two-axis correction A-17063 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17063-t-1706-source-review-correction-runtime-lifecycle-cases.md). Standards: 1 medium; Spec: no additional implementation defect established. Failed C1/C2 for missing regression coverage; C3/C4 remain unverified. No Reviewer execution and no observed runtime failure asserted.

Criteria: C1 failed (Missing duplicate-add, failed-publication rollback and shutdown/in-flight-add lifecycle regressions required by Coordinator 5cabaa51.), C2 failed (Missing failed runtime-remove cleanup/retry regression; existing startup owner.close retry does not exercise this new path.).

### rev-38 · 2026-11-06T11:08:49.581Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1706-source-3
commit: f4b6c2061178cbe8d6d79c2aff5604a2b890ef22
scope: full
findings: [{"severity":"medium","text":"Publication rollback and shutdown/add tests release their held work before awaiting public completion, without settlement markers in the final ordered trace. Early add rejection or early close resolution with background cleanup can pass; assert the public settlement follows positive carrier/Git cleanup completion, and queue the retry while rollback is held.","file":"hub/test/host-runtime-owner.test.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at f4b6c2061; prior production review retained and delta limited to test+guide. Duplicate-add and failed remove cleanup/retry coverage now resolve those portions of source-2. Remaining medium at host-runtime-owner.test.ts:68 (also :95-98): no ordering receipt connects public rejection/close settlement to completed rollback. Gates are released first, then promises awaited, so early settlement can pass (rules 9/12). A-17066 retains two-axis review and concrete fix. C1 failed for remaining source coverage; C2 retry source gap resolved, execution still pending. No criteria verified; no Reviewer execution.

Criteria: C1 failed (Publication/shutdown regressions exercise the race but do not establish join-before-public-settlement; add ordered promise-settlement and cleanup completion receipts.).

### rev-38 · 2026-11-06T11:11:22.705Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1706-source-4
commit: 4e8aa7793e45c15ac3cbd22252a9b7f228065ef0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 4e8aa7793; supersedes source-2/source-3 findings. Standards and Spec: no findings. All four required lifecycle cases now have assertions; rollback queues retry while held and records Git close before add rejection/new publication; shutdown records Git close/add rejection before public close resolution. A-17069 confirms both early-settlement mutants fail by AssertionError (exit1/cancelled0), focused evidence only. Full review retained from base74117dabb, product unchanged; correction in A-17070 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17070-t-1706-source-clear-at-4e8aa7793.md). C1/C2 source gaps resolved. Criteria marks: none; C1-C4 runtime verification remains pending exact-head native/preservation receipts and post-source configured verification. No Reviewer execution.
