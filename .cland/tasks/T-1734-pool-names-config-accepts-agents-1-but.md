---
id: T-1734
kind: task
title: "Pool names: config accepts `agents_1`, but DigitalOcean acquire and key identity accept only letters, digits and hyphens"
state: open
status: in progress
size: S
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
updated: 2026-11-07T08:37:47.468Z
---

## Summary

Found aside by T-1719's source reviewer, and it predates T-1719. `readHostPools` and `poolSnapshotStorage` accept a pool name such as `agents_1`. The DigitalOcean provider's acquire and its `keyIdentity` accept only alphanumerics and hyphens. A configured pool with an underscore therefore can never acquire a host. Orphan-key parsing (reap by the `cland-pool-<pool>` tag or the key prefix) also disagrees with the config about which names exist.

## What to build

- One pool-name grammar, parsed in one place. Config reading, pool snapshot storage, provider tags, key identity and orphan reaping all use it.
- A name outside the grammar is refused when the config is read, naming the allowed characters. It is never accepted there and then refused later.

## Acceptance criteria

- [ ] C1. A config pool named `agents_1` is refused at config read with a message naming the allowed grammar, or it acquires, tags and reaps consistently. Either way, every reader agrees (test).
- [ ] C2. Orphan reaping parses pool tags and key names with the same function as config reading (test).

## Comments

### impl-1734 · 2026-11-07T08:37:47.468Z

Rule 20 sweep before changing validation: transport-config.readHostPools; pool-image preparePools/poolImageKey/poolSnapshotStorage; DigitalOcean acquire/prepare/reap/createVolume/attachVolume plus persisted intent records and keyIdentity; fake prepare/acquire/reap; executor preparePool and recoverPoolSnapshots directory reader. CLI host prepare forwards to dispatch then preparePools; host create/list are not present in this head (T-1718 not landed). Registry selects provider, provider interfaces and protocol host.prepare carry opaque strings, unchanged wire shape; legacy valid agents requests remain covered. Tests: host-prepare, host-provider-digitalocean, -prepare, -volumes, host-provider-fake, host-provider-contract, host-provider-volumes, executor-droplet/prepare/safety; no startup probe pool parser found. Docs/skills/QA: hub README, docs/hub/host-providers, docs/agents/host-agent, per-file test docs, implement skill and changes, E-1533 stage-2 brief; other pool mentions in onboarding/planning and historical briefs are unrelated worker/resource pools. Migrate duplicated name regexes (including fake and recovery); config-set preservation fixture remains valid. Shared reply/record shapes stay unchanged.
