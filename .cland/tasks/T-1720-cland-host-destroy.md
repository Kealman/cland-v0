---
id: T-1720
kind: task
title: "`cland host destroy`"
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1718
topic: topic-1424
branch: t/T-1720-cland-host-destroy
created: 2026-11-06T10:49:05.400Z
updated: 2026-11-07T12:09:09.715Z
closed: 2026-11-07T12:09:09.715Z
---

## Summary

`cland host destroy <id>` deletes a host at once, for a host the hub cannot reach too. The hub removes it from the running hub, so its sessions settle as the revoke path settles them. It then releases the machine and the host's SSH key through the provider, each deletion confirmed by a read and logged with that read. Finally it marks the host record destroyed. A deletion the provider cannot confirm leaves the host listed with that reason.

Hot files: `hub/src/host/provision-host.ts`, `hub/src/cli/host.ts`, `hub/src/hub/dispatch.ts` (`host.destroy`), `hub/test/host-destroy.test.ts` (new)

## What to build

The destroy sequence over the runtime host registry's `remove` (T-1706) and the provider's `release`, its `host-destroy` log events naming each confirming read, and the CLI with its help line.

## Acceptance criteria

- [x] C1. On the fake provider, `cland host destroy <id>` ends the host's session as exited, removes the machine and its key, and the hub log holds one confirming read for each (test).
  - done: impl-1720 · 2026-11-07T11:04:36.690Z
  - verified: rev-35 [reviewer] · run rev-35-1720-final-1 · 2026-11-07T11:31:18.677Z · commit 3c8880cc0be27026234a4504f63ecdc7a0226fa9
- [x] C2. Destroying a host whose tunnel is down succeeds the same way (test).
  - done: impl-1720 · 2026-11-07T11:04:36.840Z
  - verified: rev-35 [reviewer] · run rev-35-1720-final-1 · 2026-11-07T11:31:18.677Z · commit 3c8880cc0be27026234a4504f63ecdc7a0226fa9
- [x] C3. When the provider's read still finds the machine, the host stays in `cland host list` with "deletion not confirmed", and a second destroy retries it (test).
  - done: impl-1720 · 2026-11-07T11:04:36.963Z
  - verified: rev-35 [reviewer] · run rev-35-1720-final-1 · 2026-11-07T11:31:18.677Z · commit 3c8880cc0be27026234a4504f63ecdc7a0226fa9
- [x] C4. An unknown id is refused, and `host.destroy` from a session or a remote is refused (test).
  - done: impl-1720 · 2026-11-07T10:53:14.977Z
  - verified: rev-35 [reviewer] · run rev-35-1720-final-1 · 2026-11-07T11:31:18.677Z · commit 3c8880cc0be27026234a4504f63ecdc7a0226fa9

## Comments

### impl-1720 · 2026-11-07T10:46:25.436Z

Rule 20 pre-change sweep: searched host.create/prepare/revoke, HOST_USAGE plus provision/release records. Consumers: protocol.ts validator/union and shared/wire union; dispatch local-human admission; web-authority deny table; cli/host.ts, cli/help.ts, usage.ts and frozen commands.json/help placeholders; host-secret-admission and web-authority tests (extend denial cases); host-create-ready/admission, host-runtime-join/owner, host-revoke-native and survival-native (preserve prior frames); provider contract/fake/DigitalOcean and provision-record/recovery tests (preserve old result shapes); docs/hub/host-providers, hub/README, docs/agents/host-agent and implement skill (update command flow), QA briefs/test docs and startup restoreProvisionedFakeHosts (destroyed records remain revoked, no restoration). Additive host.destroy frame and destroyed lifecycle state; existing frames/results remain valid. Provider release confirming-read observer will be optional, preserving previous wire/results.

### impl-1720 · 2026-11-07T10:49:58.747Z

Additional rule 20 sweep for provider deletion evidence/session settlement: Sessions.settleHostBeforeCut/#exited, ProcessTable retained generations/pending stops, generation-adapter releaseUnreachableGeneration, OpenCode detachUnreachable and SSH owner close. Reuse existing per-generation unreachable release to drain local connections/watch/forward bookkeeping after positive provider machine absence; no new adapter contract or native signalling. Persist optional machineDeletionRead in provision record; legacy stored rows remain valid.

### impl-1720 · 2026-11-07T10:53:39.582Z

Rule 20 final callback consumer list at review head 79979c5f0f5f46b676523fdda77bbb73b58000d4: ADAPTED HostProvider.release optional ReleaseObserver; FakeHostProvider release reads tombstone and absence of every key; DigitalOceanHostProvider release emits the native API confirmed DELETE/GET404 receipts. ADAPTED hostProviderContract release + repeated-release checks require machine/key reads. Callers: host-provider-fake (default/arm64/x86_64) and host-provider-digitalocean ADAPTED through shared contract, passed38/38 and37/37; host-provider-declarations UNCHANGED invalid-declaration short-circuit, passed3/3. ADAPTED destroyHost persists machineDeletionRead and requires both fresh callback resources; Sessions.hostDeleted validates persisted read and drains existing unreachable-generation release before exited; CLI host.destroy consumes provision state, exit0 only destroyed. UNCHANGED createHost rollback, reap callers, provider direct release equality assertions, provision recovery and older clients: omitted observer preserves prior release result shapes. UNCHANGED startup registered() readers/restore: revoked registrations never reopen destroyed hosts. ADAPTED docs/CLI help/frozen usage, frame union/validation, web authority and host-secret refusal cases. Existing revoke/survival native fixtures preserved and passed. No wire field removed; optional persisted field is backward compatible.

### rev-35 · 2026-11-07T10:58:47.786Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1720-source-1
commit: 79979c5f0f5f46b676523fdda77bbb73b58000d4
scope: full
findings: [{"severity":"high","text":"A provision with no recorded machine is treated as released/destroyed without positive non-admission or acquisition reconciliation. An in-flight create can subsequently save booting/ready and resurrect it; an interrupted/ambiguous accepted acquisition can also be falsely declared destroyed after restart.","file":"hub/src/host/provision-host.ts","line":159},{"severity":"high","text":"hostDeleted awaits adapter release then clears pending stops by sessionId and updates/vacates by captured name without exact-generation revalidation or a lifecycle exclusion. A concurrent relaunch/replacement on another host can be marked exited and lose its pending state/role using the old machine's receipt.","file":"hub/src/adapters/sessions.ts","line":240},{"severity":"medium","text":"Only current active/stopped display rows are enumerated. retainedHostGenerations(host), including a generation whose row moved elsewhere or already exited, are omitted; destruction can become terminal while their local resource/retirement obligations remain, and the destroyed early return prevents retry.","file":"hub/src/adapters/sessions.ts","line":237},{"severity":"medium","text":"Calling adapter.releaseUnreachableGeneration directly bypasses the existing Sessions release owner: generation/released receipt validation and captured local-forward owner receipt consumption via dropHostForwardsLocal. Runtime removal is not a positive receipt for every retained scope/forward.","file":"hub/src/adapters/sessions.ts","line":240},{"severity":"medium","text":"The entire test uses SETUP_MS as its timeout while launch and persisted-worker setup each admit that same full setup budget after fixture preparation/create. The outer watchdog can preempt a valid bounded setup and its behavior/cleanup; derive an outer envelope from sequential setup budgets plus behavior/cleanup headroom.","file":"hub/test/host-destroy-native.test.ts","line":14}]
finding_counts: {"high":2,"medium":3,"low":0}

Source not clear. A-17448 records complete Standards/Spec review: high acquisition/destroy resurrection and restarted unknown classification; high stale by-name/current-row mutation after awaited release; medium omitted retained generations; medium bypassed Sessions generation/local-forward receipt owner; medium native setup/outer-timeout mismatch. Implementer confirmed all gaps and held the pin. C1/C2/C3 failed; C4 source admission looks complete but tested evidence remains unverified. A-17447 is qualified precommit narrative, not raw/exact-head configured proof; retain original tool excerpts without a provenance-only rerun. Correct together, request fresh source head before verify, then authorized same-head preservation/configured result. After-stage QA separate.

Criteria: C1 failed (Destroy can falsely complete an unknown acquisition and can settle a newer row while omitting retained generation/forward ownership.), C2 failed (Disconnected-host settlement does not preserve exact generation ownership across release or drain all retained generations/forward receipts.), C3 failed (Unknown/no-machine acquisitions are reported destroyed without a confirming read or positive non-admission, suppressing required retry state.).

### impl-1720 · 2026-11-07T11:04:12.432Z

Review correction head 1a94a5dbe66df2a129bba2ff5bda15a8f4ba0acb. Rule20 delta consumers adapted: createHost owns per-project/provision abort+join through final rollback persistence; destroyHost joins it, reloads captured machine and refuses all unknown/no-machine acquisitions. Sessions.hostDeleted streams active/stopped/retained/pending captures, delegates to existing Sessions.releaseUnreachableGeneration (validated generation and local-forward receipts), retains unresolved generations and revalidates current exact hostGenerationKey after await before display/pending mutations. Dispatcher supplies project root; direct test callers migrated. No provider wire/result or other release consumer changed from first head. Native timeout envelope enlarged without changing exact CLI behaviour bounds. Added no-machine restart, held acquire/destroy, held-release onward replacement+pending stop, moved retained generation, wrong-generation and missing-forward-owner controls; observed red before correction. No dev merge.

### rev-35 · 2026-11-07T11:08:02.743Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1720-source-2
commit: 1a94a5dbe66df2a129bba2ff5bda15a8f4ba0acb
scope: full
findings: [{"severity":"medium","text":"The held hostDeleted operation is released/joined in a beforeDirectories hook registered after settlementFixture's sessions/table/core close hook. Cleanup runs these hooks in registration order; a failed setup/assertion can wait or close the store before releasing/joining the admitted operation. Prearm a resource-phase operation drain before fixture closes and before triggering hostDeleted.","file":"hub/test/host-destroy.test.ts","line":75}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17451: four earlier production findings and native outer-envelope defect resolved. One medium new Standards finding remains: the held T2 hostDeleted operation releases/joins in a beforeDirectories callback registered after fixture Sessions/table/Core close. Shared hubs cleanup is registration-order, so failure can close/wait before the held writer drains. Implementer confirms no earlier owner. Prearm resource-phase operation drainage before closes and admission; retain affected failure-path proof, then request fresh pin before verify. C1–C4 remain runtime-unverified; no additional behavioral criterion failure is fabricated for a separate teardown-order defect. A-17449/A-17450 retain their original and committed/precommit evidence distinctions. No new production finding; after-stage QA separate.

### rev-35 · 2026-11-07T11:09:46.774Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1720-source-3
commit: 3c8880cc0be27026234a4504f63ecdc7a0226fa9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-17453. Sole source2 fixture defect resolved: resource-phase operation drain is armed before fixture closes and held admission; nested teardown control asserts deletion completed before table.close. Independent diff confirms production/shared bytes unchanged from 1a94a5dbe, whose source analysis resolved all source1 production findings. A-17452 affected-file 11/11 producer0 retains precommit linkage; A-17450 preservation stays labelled at prior identical-production head, A-17449 original limits retained. No remaining Standards/Spec findings. C1–C4 runtime-unverified. Proceed with mode-free configured verify at exact 3c8880cc0 and return same-head result for final settlement. After-stage QA separate; no dev merge or full-tier rerun requested.

### rev-35 · 2026-11-07T11:31:18.677Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1720-final-1
commit: 3c8880cc0be27026234a4504f63ecdc7a0226fa9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear, A-17455. Inspected A-17454/run f5b2f0df: exact source-reviewed head, independently matching execution tree4b02c30184113e36618acef7971b8e13878e11fd, hub5420/5420, parsed base5282 passes/six empty failure arrays. Three destroy natives pass once (reachable5.113905s, disconnected4.587438s, held acquisition0.774065s); 10 destroy T2 top-level identities have base+5 distinct load passes each (50/50), including unknown/missing-read/replacement/retained/receipt/teardown controls. Authority and frozen-help cases pass. T0/T1/all fallbackT2/changedT3/mappedT4base/Web complete Linuxx64 Node24.21, isolated Shell1248/CfT156; widerT3 deferred and T4 repetitions skipped. Existing8s destroy caps remain sufficient. A-17450 prior-head identical-production macOS preservation stays qualified; A-17449/A-17452 provenance limits retained. No remaining findings; C1–C4 verified. After-stage full QA on dev separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-07T12:09:09.715Z

Merged b79da95c9acf1714e58bb66914b53bcb41173e9f onto dev.
