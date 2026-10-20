---
id: T-492
kind: task
title: Executor credential is inherited by launched sessions and test processes, and surfaced in a session's process listing
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
  - security
assignee: null
parent: C-325
blocked_by: []
topic: topic-700
branch: t/T-492-executor-credential-is-inherited-by
created: 2026-10-15T12:07:01.208Z
updated: 2026-10-20T07:16:06.814Z
closed: 2026-10-20T07:16:06.814Z
---

## Summary

The hub's DigitalOcean credential reaches every session the hub launches, and every test process those sessions start, through the inherited environment. At 12:06Z on 2026-10-15 an Implementer's routine `pgrep -fl` admission check printed process lines that contained the credential into its own tool output. That output is model context, so it went to the harness's model provider. No value was written to the tracker, artifacts or the repository. Only the hub's executor needs the credential.

## Acceptance criteria

- [x] C1. Sessions launched by the hub (every harness, every role) start without `DIGITALOCEAN_TOKEN` or any other executor secret in their environment. A test proves it for a launched fake session.
  - verified: rev-31 [reviewer] · run rev-20261020-492-final · 2026-10-20T06:28:00.381Z · commit 5e4697e4479f5d9eac882b380be1e53df758facf
  - done: impl-492 · 2026-10-20T06:28:16.563Z
  - verified: rev-31 [reviewer] · run rev-20261020-492-final-merge · 2026-10-20T07:11:54.888Z · commit a8ec291ad2d28b05f523799858b477829416bd59
- [x] C2. Local verify and test processes started by `cland verify`, `run-suite.ts` and the Neovim harness drop executor secrets from child environments. The executor's own droplet calls keep working with the hub's in-process copy.
  - verified: rev-31 [reviewer] · run rev-20261020-492-final · 2026-10-20T06:28:00.381Z · commit 5e4697e4479f5d9eac882b380be1e53df758facf
  - done: impl-492 · 2026-10-20T06:28:17.316Z
  - verified: rev-31 [reviewer] · run rev-20261020-492-final-merge · 2026-10-20T07:11:54.888Z · commit a8ec291ad2d28b05f523799858b477829416bd59
- [x] C4. Docs (`docs/verification-shards.md` or the executor doc) state that the credential lives only in the hub's environment.
  - verified: rev-31 [reviewer] · run rev-20261020-492-source · 2026-10-20T06:20:24.541Z · commit 5e4697e4479f5d9eac882b380be1e53df758facf
  - verified: rev-31 [reviewer] · run rev-20261020-492-final · 2026-10-20T06:28:00.381Z · commit 5e4697e4479f5d9eac882b380be1e53df758facf
  - done: impl-492 · 2026-10-20T06:28:18.162Z
  - verified: rev-31 [reviewer] · run rev-20261020-492-source-merge · 2026-10-20T07:04:56.802Z · commit a8ec291ad2d28b05f523799858b477829416bd59
  - verified: rev-31 [reviewer] · run rev-20261020-492-final-merge · 2026-10-20T07:11:54.888Z · commit a8ec291ad2d28b05f523799858b477829416bd59

## Comments

### coord · 2026-10-15T12:08:07.203Z

Human decision on 2026-10-15 at 12:07Z (ask aa197b46, answer a7ae0d42): no rotation. T-492 goes through the normal queue. The crew's PID-only process-check rule stays in force until this merges.

### coord · 2026-10-15T12:11:23.782Z

Second exposure, local only, logged for the complete record. The stand-in cland-impl ran a disk check, grep -rlF with the value as an argument. From about 12:09Z to 12:12Z on 2026-10-15 the value was in that grep process's argv, visible to any local process that listed full command lines; the crew's PID-only rule was already in force. Result of the check: no file under .cland or ~/.cland holds the value. From now on checks pass the value by file descriptor, never in argv. The decision stands (D35): no rotation.

### impl-492 · 2026-10-20T06:10:48.305Z

Implemented shared executor credential filter across all three harness launch paths (after account overlays), local suite workers/commands, suite and load-gate runners, SSH/SCP and Neovim test/QA launches. Regression assertions for three launched fake adapters reproduced the leak before the fix and pass after it. Docs now name the local watchdog's necessary credential inheritance and the exporting shell caveat. No configurable executor token variable exists in current config. C3 exact historical argv source remains unidentified by source inspection; per launch brief, leaving C3 open. qaPolicy scope is none.

### rev-31 · 2026-10-20T06:20:24.541Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-492-source
commit: 5e4697e4479f5d9eac882b380be1e53df758facf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7143: full revised source review clear. Shared pure helper fixes the earlier Neovim import-boundary defect without changing the guard. Final child environments filter after account overlays; filtering copies the API environment and skips denied values before access. C4 verified from truthful docs including watchdog/exporting-shell exceptions. C1/C2 await exact-head mode-free and native fake-adapter evidence. C3 remains open per launch brief; not verified.

Criteria: C4 verified.

### coord · 2026-10-20T06:21:22.420Z

C3 (find the argv source) split into T-942
T-942 at the v0.1.4 release (D76): T-492 ships the env filter (C1, C2) and the docs (C4); impl-492 could not find the historical argv source at 5e4697e4.

### impl-492 · 2026-10-20T06:27:34.314Z

Mode-free exact-head verification f7f0abfe-56b3-4c70-bb1a-36ca083a827c passed at 5e4697e4479f5d9eac882b380be1e53df758facf: 1927/1927 tests, no failures/cancellations/skips. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet c-8 lon1 lifetime 376s, cost $0.0261. Log A-7154 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7154-suite-f7f0abfe-56b3-4c70-bb1a-36ca083a827c-auto-at-5e4697e.log. Retained targeted native adapter evidence is A-7149/A-7150; task plan covers T0–T2, T3 remains deferred to periodic dev/integrated occasions. Historical argv investigation is T-942. Awaiting reviewer final evidence verdict; no merge requested.

### rev-31 · 2026-10-20T06:28:00.381Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-492-final
commit: 5e4697e4479f5d9eac882b380be1e53df758facf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7156: exact-head A-7154/f7f0abfe audited: 1927 ordinary passes, new credential contract 5/5 distinct repeats, Neovim boundary 7/7, no resource/duration violations. Retained native A-7149 complete 65/65 proves three fake adapter launches/relaunches; A-7150 preserves standalone-exit limitation and import-only source attribution. C1/C2/C4 verified with A-7143. Historical argv investigation is separate T-942 by Coordinator decision; no old C3 mark. Claimant done marks were absent at view; no merge authorization.

Criteria: C1 verified, C2 verified, C4 verified.

### rev-31 · 2026-10-20T07:04:56.802Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-492-source-merge
commit: a8ec291ad2d28b05f523799858b477829416bd59
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7183: authorized merge delta clear. T-830 launcher/appname/state behavior retained; final launchEnv filters after all overlays and is used by both Neovim spawn branches. Existing state test asserts fake-token absence while retaining all state checks. All other original T-492 files unchanged; native/helper blobs independently match prior review. C4 verified; C1/C2 await fresh exact-head mode-free gate. T-942 remains separate.

Criteria: C4 verified.

### impl-492 · 2026-10-20T07:11:34.377Z

Post-conflict exact-head mode-free verification d42644d0-6dff-4eb8-a9d3-a1b31f746d6b passed at a8ec291ad2d28b05f523799858b477829416bd59: 1928/1928 tests, no failures/cancellations/skips. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet c-8 lon1 lifetime 346s, cost $0.0240. Log A-7187 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7187-suite-d42644d0-6dff-4eb8-a9d3-a1b31f746d6b-auto-at-a8ec291.log. Targeted merge-resolution receipts A-7177. Waiting final evidence review; Coordinator will enqueue after ready.

### rev-31 · 2026-10-20T07:11:54.888Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-492-final-merge
commit: a8ec291ad2d28b05f523799858b477829416bd59
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7188: merged-head A-7187/d42644d0 independently audited: 1928 ordinary passes plus credential contract 5/5 distinct repeats; new Neovim token-absence assertion and all four state/client cases pass. Zero resource/duration failures. C1/C2/C4 current at a8ec291a with source A-7183 and unchanged retained native proof A-7149/A-7150; provenance limits preserved, Linux T3 not claimed. Claimant done marks present. T-942 owns historical argv investigation.

Criteria: C1 verified, C2 verified, C4 verified.

### coord · 2026-10-20T07:16:06.814Z

Merged 40992e04428d1d6d62f2c504d7aa65bba8daa911 onto dev.
