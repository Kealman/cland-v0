---
id: T-2057
kind: task
title: Generated and managed configs write an explicit test_timeout (`cland init`, and any managed config rendering such as `config set`), so projects lose default provenance and T-2046's load scaling
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1751
branch: t/T-2057-cland-init-writes-an-explicit-test
created: 2026-11-21T23:29:11.442Z
updated: 2026-11-24T19:01:12.200Z
closed: 2026-11-24T19:01:12.200Z
---

## Summary

T-2046 scales per-test timeouts with load, but only when `test_timeout` is a default rather than an explicit setting. T-2051 carries that default provenance through fresh admissions. However, the config template that `cland init` renders writes `test_timeout = "120s"` explicitly, at template line 167 (since d86cc5f29, 2026-10-14). So every init-created project counts as explicit and keeps an exact 120,000 ms bound (A-22587). Only a config that omits the line gets the scaled default.

## What to build

Decide the template policy, then apply it:
- Leave `test_timeout` out of, or commented in, the generated config, so new projects get the scaled default.
- Or treat a value equal to the default as a default.

Keep an explicit user value exact. Existing projects are unchanged unless their owner edits the line.

## Acceptance criteria

- [x] C1. A project created by `cland init` gets the scaled default per-test timeout under load, and a project that sets `test_timeout` explicitly keeps it exact (test).
  - done: impl-2057 · 2026-11-24T13:56:18.469Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2057-final · 2026-11-24T15:22:12.381Z · commit 7497df9969864279447afe5d79a134a2d8ca494c
- [x] C2. Rendering a managed config setting (for example `config set` on a verification key) in a project that leaves `test_timeout` unset keeps it unset, or keeps default provenance, so load scaling survives (test).
  - done: impl-2057 · 2026-11-24T13:56:22.477Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-2057-final · 2026-11-24T15:22:12.381Z · commit 7497df9969864279447afe5d79a134a2d8ca494c

## Comments

### coord · 2026-11-22T00:29:34.117Z

Widened (2026-11-22): T-2051's verify 8fce93e4 (A-22602) showed `hub/test/verification-workers.test.ts` failing on `testTimeoutIsDefault` true before versus false after managed config rendering. So managed rendering (for example `config set` on a verification setting) also writes `test_timeout` explicitly. A project that left it unset loses default provenance, and load scaling, as soon as any managed setting is rendered. This item covers both the init template and managed rendering. Rendering should keep an unset `test_timeout` unset, or keep its default provenance.

### impl-2057 · 2026-11-24T13:52:42.504Z

Consumer search: searched renderConfig, test_timeout, testTimeoutIsDefault and configKeys across hub/src, all hub/test tiers (including frozen CLI fixture), nvim/test, web, docs, QA briefs and shipped skills. Production consumers: provisionConfig (init/update), config-set/configKeys, setup harness/account writers, hub/configuration, suite-limits and run-suite. Changed renderer and key vocabulary exemplar; parser/admission/wire shape unchanged. Migrated init-config and verification-workers expectations and executor-safety roundtrip. Other render callers retain explicit values through parser provenance; existing config-reload explicit transition remains valid. suite-remote-budget explicitly marks its synthetic bound exact and is unaffected. No frozen CLI usage bytes or help export changes. Updated running/test docs, hub index and implement skill. Existing until legacy-admission regression retains previous snapshot shape. T1 import-graph search selects 89 reachable files plus 2 unresolved files included conservatively; T2/T3/T4 callers left to reviewed mode-free verify selection.

### rev-40 · 2026-11-24T14:04:51.453Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2057-source
commit: 7497df9969864279447afe5d79a134a2d8ca494c
scope: full
findings: [{"severity":"low","text":"L1: runConfig derives string argv type from rendered default template; commented test_timeout loses its exemplar, enabling TOML decoding of embedded quoted durations instead of literal-string handling. Ordinary120s/17s unaffected. Share explicit vocabulary/type exemplar and add argv coverage; nonblocking XS/Bugs follow-up T-2089 filed by Coordinator.","file":"hub/src/cli/config.ts","line":13}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at7497df996, one low L1 runConfig:13 retained/trackedT-2089; no high/medium. Renderer comments only positive default provenance, explicit/legacy-unknown assignments stay exact; provision/update/managed settings preserve absent source and unknown keys. configKeys retains writabletimeout; parser/runner/admission contracts unchanged. C1/C2 tests exercise emitted absence, factor3runner argument, explicit120/17 and managed settings roundtrip; changed worker/executor assertions/docs/skill provenance match. Authorized sharedT2088 test correction retained. A-23001 records both axes/census/local evidence limits. C1/C2 pending same-head configured named receipts, verification-workersT3 included;91selectedT1/localchecks not full or exact-head configured proof. No reviewer runs/edits.

### rev-40 · 2026-11-24T15:22:12.381Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2057-final
commit: 7497df9969864279447afe5d79a134a2d8ca494c
scope: evidence
findings: [{"severity":"low","text":"L1 retained: commented test_timeout loses runConfig's rendered-default string type exemplar, so embedded TOML-quoted duration argv is decoded rather than literal. Ordinary120s/17s unaffected; XS/Bugs T-2089 tracks shared key/type exemplar and argv regression. Passing suite does not erase this low.","file":"hub/src/cli/config.ts","line":13}]
finding_counts: {"high":0,"medium":0,"low":1}

Final clear atunchanged7497df996, lowL1/T2089 retained; no high/medium. Exact-head9c687737/A-23035 finished/passed, canonicalabacee9b executable match. C1/C2 verified: exact init/default-explicit5997 and managed-absence6002 basepasses withdistinct5/5loads6239/6274;25init/24settings/17until/5verification-workers/1safety-config/7shared-fix basespass; changedT3managed worker50613positive. T0/T1/fallbackT2/253selectedprocessfiles2022positive identities/Webexit0 once/no repetitions;T4unexecuted/prerequisite skips retained. NoncachedLinuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4, budgets advisory and factor3 controlled argv proof not machine latency. A-23036 records both axes/provenance/limits. No reviewer runs/edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T19:01:12.200Z

Merged fb9bcf93b113dcbedb3d9e17e8a09b479de880cc onto dev.
