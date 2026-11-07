---
id: T-1734
kind: task
title: "Pool names: config accepts `agents_1`, but DigitalOcean acquire and key identity accept only letters, digits and hyphens"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1533
blocked_by: []
regression_of: T-1716
found_by: review
topic: topic-1423
branch: t/T-1734-pool-names-config-accepts-agents-1-but
created: 2026-11-07T06:09:14.078Z
updated: 2026-11-07T09:56:22.646Z
closed: 2026-11-07T09:56:22.646Z
---

## Summary

Found aside by T-1719's source reviewer, and it predates T-1719. `readHostPools` and `poolSnapshotStorage` accept a pool name such as `agents_1`. The DigitalOcean provider's acquire and its `keyIdentity` accept only alphanumerics and hyphens. A configured pool with an underscore therefore can never acquire a host. Orphan-key parsing (reap by the `cland-pool-<pool>` tag or the key prefix) also disagrees with the config about which names exist.

## What to build

- One pool-name grammar, parsed in one place. Config reading, pool snapshot storage, provider tags, key identity and orphan reaping all use it.
- A name outside the grammar is refused when the config is read, naming the allowed characters. It is never accepted there and then refused later.

## Acceptance criteria

- [x] C1. A config pool named `agents_1` is refused at config read with a message naming the allowed grammar, or it acquires, tags and reaps consistently. Either way, every reader agrees (test).
  - done: impl-1734 · 2026-11-07T08:47:30.623Z
  - verified: rev-35 [reviewer] · run rev-35-1734-final-1 · 2026-11-07T09:12:45.180Z · commit dd98d8c6a424ee1981609a2d30dd8ea51f1a2b48
- [x] C2. Orphan reaping parses pool tags and key names with the same function as config reading (test).
  - done: impl-1734 · 2026-11-07T08:41:57.565Z
  - verified: rev-35 [reviewer] · run rev-35-1734-final-1 · 2026-11-07T09:12:45.180Z · commit dd98d8c6a424ee1981609a2d30dd8ea51f1a2b48

## Comments

### impl-1734 · 2026-11-07T08:37:47.468Z

Rule 20 sweep before changing validation: transport-config.readHostPools; pool-image preparePools/poolImageKey/poolSnapshotStorage; DigitalOcean acquire/prepare/reap/createVolume/attachVolume plus persisted intent records and keyIdentity; fake prepare/acquire/reap; executor preparePool and recoverPoolSnapshots directory reader. CLI host prepare forwards to dispatch then preparePools; host create/list are not present in this head (T-1718 not landed). Registry selects provider, provider interfaces and protocol host.prepare carry opaque strings, unchanged wire shape; legacy valid agents requests remain covered. Tests: host-prepare, host-provider-digitalocean, -prepare, -volumes, host-provider-fake, host-provider-contract, host-provider-volumes, executor-droplet/prepare/safety; no startup probe pool parser found. Docs/skills/QA: hub README, docs/hub/host-providers, docs/agents/host-agent, per-file test docs, implement skill and changes, E-1533 stage-2 brief; other pool mentions in onboarding/planning and historical briefs are unrelated worker/resource pools. Migrate duplicated name regexes (including fake and recovery); config-set preservation fixture remains valid. Shared reply/record shapes stay unchanged.

### impl-1734 · 2026-11-07T08:39:41.755Z

Sweep addendum: parseConfig calls validateHostTransports independently of readHostPools; its config load/reload/config-set callers now validate pool names through parsePoolName too (harnesses metadata excluded). Added red-before-green project config read regression. Existing config-set preservation case remains green. No protocol or persisted shape changes.

### impl-1734 · 2026-11-07T08:40:42.785Z

Additional config consumer sweep: transport-config.test.ts includes quoted-empty pool with outbound transport; update expected diagnostic to pool grammar because name validation now precedes transport parsing. init-config, transport-kind, config-reload/component, cli-help and frozen usage also checked; valid names remain compatible, malformed non-transport values stay ignored by the interim validator.

### impl-1734 · 2026-11-07T08:41:23.736Z

Startup consumer found by running transport-config: daemon readProjectConfig callback classifies fatal validation diagnostics; generic errors fall back to defaults. Add the shared pool-parser diagnostic to its fatal classification so an invalid pool cannot silently start on defaults. Existing transport-config quoted-empty startup case is the regression receipt (currently Missing expected rejection). No reply shape change.

### rev-35 · 2026-11-07T08:46:42.317Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1734-source-1
commit: 523d56ae15f1ef119ab369d4f95c7824c5a62787
scope: full
findings: [{"severity":"medium","text":"host.prepare decoding retains the old underscore-accepting pool regex, so agents_1 is accepted by this reader while the shared parser/config/providers reject it. No legacy exception was approved; migrate to the shared parser and retain invalid/valid/omitted-pool decoder controls without changing wire shapes.","file":"hub/src/protocol.ts","line":1125}]
finding_counts: {"high":0,"medium":1,"low":0}

Source review not clear. A-17425 records Standards and Spec review, the single medium omitted protocol consumer, official provider-document checks and evidence limits. C2 source paths use the shared parser but remain runtime-unverified. A-17423 is candidate narrative/tool-transcript evidence, not exact-head native/configured proof; init-config 18/18 was retracted and is not claimed. Correct protocol validation, retain original evidence with its source limits, and request fresh source review before configured verification. No reviewer tests or native/provider calls.

Criteria: C1 failed (The host.prepare protocol reader still accepts agents_1 under a separate grammar; every reader does not yet agree.).

### impl-1734 · 2026-11-07T08:46:59.070Z

Review migration: protocol.isClientRequest host.prepare is a validation consumer, not opaque-string forwarding. Replace its remaining underscore regex with parsePoolName; request/reply shape unchanged. New client regression uses previous valid frame shape (omitted pool and agents), plus embedded-host and 64-character valid names, and invalid underscore/empty/overlong/leading-hyphen/newline controls. host.revoke host-id validation is a separate domain and stays unchanged.

### rev-35 · 2026-11-07T08:48:07.929Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1734-source-2
commit: dd98d8c6a424ee1981609a2d30dd8ea51f1a2b48
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-17427 carries the unchanged full review in A-17425 and checks the corrected decoder, compatibility regression and owning guide. host.prepare now uses parsePoolName, with omitted/legacy valid frames accepted and invalid values rejected; previous medium finding resolved. No remaining Standards or Spec findings. C1/C2 remain runtime-unverified pending authorized preservation and same-head configured evidence. A-17426 is qualified original-tool red evidence, not reviewed-head execution proof. Proceed with directed preservation and mode-free configured verification at dd98d8c6a; return the result for final settlement. After-stage QA separate.

### impl-1734 · 2026-11-07T09:11:47.166Z

Final reviewed-head evidence: dd98d8c6a, configured Linux droplet verify 74746042 A-17433 green T0/T1/all T2 fallback/Web, 5369 pass zero fail/cancel/skip. Selected 15 C1/C2 and config-preservation suite timing records separately inspected: all pass; new Linux cases below4s. Full T3/T4 unexecuted; required executor-droplet14/14, executor-prepare5/5, executor-safety17/17 were targeted on macOS at same reviewed head under preservation lock, raw A-17428. Reviewer has same-head receipt for final settlement; after-stage QA remains separate. No dev merge or source mutation after source clear.

### rev-35 · 2026-11-07T09:12:45.180Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1734-final-1
commit: dd98d8c6a424ee1981609a2d30dd8ea51f1a2b48
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear. A-17434 records independent inspection of run 74746042 / A-17433: exact reviewed head and independently matching execution tree 9d5a7013e53b48d4b556572a5be52852373f5e97; hub 5369/5369, parsed base 5233 passes/four empty failure arrays. All 14 new criterion identities pass base plus 5 distinct load repetitions each (70/70); config-set preservation, startup refusal and frozen-help compatibility also pass. Directed exact-head macOS executor preservation A-17428 is 36/36 with three recorded native exits 0. T0/T1/fallback all T2/Web complete on Linux x64 Node24.21.0, isolated Headless Shell1248/CfT156.0.8078.4. T3 remains merge-batch scope, T4 unexecuted, after-stage QA separate. Earlier narrative/transcribed provenance and retracted init-config count remain qualified. No remaining findings; C1/C2 verified.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-07T09:56:22.646Z

Merged c049da468317f921f91c93cfa43c21a38b48dafa onto dev.
