---
id: T-1750
kind: task
title: Boot failures and provider API limits
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
topic: topic-1448
branch: t/T-1750-boot-failures-and-provider-api-limits
created: 2026-11-07T16:01:59.219Z
updated: 2026-11-08T19:57:35.260Z
---

## Summary

Two create-side failures, handled by the scheduler:
- **No machine or SSH within 5 minutes of the create call:** the host is destroyed, its launches keep waiting, and the Coordinator gets one line naming the host.
- **A provider refusal with a retry time** (DigitalOcean's 429 or droplet limit): creation in that pool pauses until the retry time, and the launch keeps waiting, with no cascade.

After a boot failure, the pool backs off before its next create: 1 minute, doubling to 30 minutes, reset by a host reaching `ready` or by a change to that pool's configuration.

## What to build

The failure handling around the create seam, and the backoff. The line to the Coordinator is an Agents notice addressed to `coordinator`, as `account-limited` is, one per failure, never in General. The 5 minutes stay a fixed constant. The test-only knob `CLAND_TEST_HOST_BOOT_MS` shortens the gate the pool runtime passes to the create path. It is honoured only inside the fake-host fence (`CLAND_FAKE_HOST_ROOT` set), like the executor's `CLAND_TEST_DROPLET_*` (`testTiming`).

## Acceptance criteria

- [x] C1. A fake host that never boots is destroyed with a confirmed deletion at 5 minutes of hub-clock time, its launch stays waiting, and the Coordinator gets exactly one Agents line naming the host (test).
  - done: impl-1750 · 2026-11-08T19:55:45.574Z
- [x] C2. A fake machine whose pinned key never answers within the gate is handled the same way (test).
  - done: impl-1750 · 2026-11-08T19:06:26.643Z
- [x] C3. A provider refusal with a retry time makes no further acquire call before that time, keeps the launch waiting, and allows one create after it (test).
  - done: impl-1750 · 2026-11-08T19:07:48.050Z
- [x] C4. After a boot failure the pool's next create waits 1 minute, the wait doubles per consecutive failure up to 30 minutes, and a host reaching `ready` resets it (test).
  - done: impl-1750 · 2026-11-08T19:55:46.895Z
- [x] C5. `CLAND_TEST_HOST_BOOT_MS` shortens the gate inside the fake-host fence and is ignored without `CLAND_FAKE_HOST_ROOT` (test).
  - done: impl-1750 · 2026-11-08T19:07:48.400Z

## Blocked by

- T-1746

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/hub/agents-topic.ts` (Coordinator line kind).
- Tests: new `hub/test/pool-failures.test.ts` (T2, fake clock, fake provider `neverBoot` and `refuseUntil`).
- Serves epic C6. Its plan lane orders it after T-1749, because both edit `pool-runtime.ts`.

## Comments

### impl-1750 · 2026-11-08T18:41:50.630Z

Rule 20 sweep before edits: PoolRuntime callers adapters/sessions.ts and hub/dispatch.ts; createHost callers dispatch.ts, host-create-entry/admission/ready, host-provision-gate/recovery, host-destroy/native, host-restart-reconcile, pool-idle-stop, host-lease tests. ProvisionRecord readers records/provision-records, host-watchdog, host-leases, host-health, scheduler, host-status; optional retryAt preserves existing wire/record shape. Agents lifecycle consumers agents-topic checkpoint/replay tests, journal kind census, inbox/visibility, nvim and web generic notice renderers; account-limited remains unchanged. Provider acquire refusal shape already includes retryAt; fake neverBoot/refuseUntil behaviour unchanged. New boot gate consumes existing provider.status and pinned SSH probe. No removal or change to existing reply fields; old hubs without retryAt remain supported as ordinary failed results.

### rev-35 · 2026-11-08T18:55:15.780Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1750-source-1
commit: 9cb6cbfc365928112e2795933e0b52e7a220fae9
scope: full
findings: [{"severity":"medium","text":"Standards: the new pending-acquire fixture skips lease/store cleanup if joining creating rejects. Prearm an operation owner and attempt every cleanup in order even after producer failure; observe its rejection immediately. No independent earlier owner covers this path.","file":"hub/test/host-provision-gate.test.ts","line":110},{"severity":"low","text":"Standards: repeated start() replaces #unsubscribeReady while retaining the previous provision observer. Dispose/reuse the earlier subscription so close() unregisters every observer owned by this runtime.","file":"hub/src/host/pool-runtime.ts","line":54},{"severity":"high","text":"Spec: the five-minute identified-machine gate does not bound a held probe. hostBootGate awaits provider.status indefinitely; bootTimer only checkpoints/notifies and cannot initiate cleanup. SSH also receives remainingMs captured before status I/O. Own a bounded/cancellable status/probe at the one absolute deadline, recompute remaining time before SSH and join native close. The approved unidentified-acquire exception does not cover this machine-known path.","file":"hub/src/host/boot-gate.ts","line":15},{"severity":"high","text":"Spec: explicit provider retryAt and resettable boot backoff share #retries. A pool config change or ready event deletes the provider not-before fence and can admit another acquire before retryAt. Preserve the provider pause independently of boot streak resets; cover both reset events.","file":"hub/src/host/pool-runtime.ts","line":116},{"severity":"medium","text":"Spec/compatibility: HOST_USAGE gains two lines without migrating the frozen commands.json expected bytes. Existing exact-byte usage/rendered-help consumers remain inconsistent. Migrate the expected fixture through its normal procedure and preserve the complete assertions.","file":"hub/src/cli/usage.ts","line":46},{"severity":"medium","text":"Spec: the fake-only shortening knob accepts values above 300000, so CLAND_TEST_HOST_BOOT_MS=600000 extends the fixed five-minute gate. Enforce the shortening-only maximum and add upper-bound controls.","file":"hub/src/host/boot-gate.ts","line":7}]
finding_counts: {"high":2,"medium":3,"low":1}

NOT CLEAR: Standards 1 medium/1 low; Spec 2 high/2 medium. A-17936 contains all six findings, author confirmations and qualified A-17935 provenance. Correct bounded known-machine probe ownership/fresh remaining time, separate provider pause from boot streak, migrate frozen HOST_USAGE, cap the shortening knob, make native fixture cleanup attempt-all and dispose repeated start observers. C4 remains runtime-unverified; approved pending-acquire uncertainty policy d9c07a76 remains valid. The mistaken observation-count timeout premise was explicitly withdrawn; no timeout finding. Native/T4 and configured verification remain pending fresh source clearance. No reviewer execution; full after-stage QA separate.

Criteria: C1 failed (A held identified-machine status/probe can outlive the five-minute deadline without confirmed cleanup.), C2 failed (Pinned SSH can receive stale remaining time after status I/O; the deadline timer does not own probe interruption/cleanup.), C3 failed (Ready/config reset can delete an explicit provider retryAt not-before fence.), C5 failed (The shortening-only fake knob accepts values above the fixed five-minute gate.).

### impl-1750 · 2026-11-08T18:56:30.253Z

Rule 20 review-fix sweep: additive status read scope (optional signal/deadline) affects HostProvider interface, FakeHostProvider.status, DigitalOceanHostProvider.status, production provision-host caller; old health/restart/watchdog/status/volume callers omit scope and retain behaviour. DigitalOceanApi.droplet adds optional signal, preserving old id/deadline calls; ProviderCall adds optional fifth signal for fake cancellation. Consumers searched by status/MachineStatus/HostProvider/droplet/ProviderCall and import paths across hub/src, hub/test, nvim, web, shared, skills, docs and QA. Provider contract/fake/digitalocean tests and executor API/pacing tests retained; no positional wire frame changes. T-1756 handoff: touched DigitalOceanHostProvider.status only; no acquire/prepare/volume/reap changes. Frozen HOST_USAGE consumers cli-usage-compatibility, cli-help, cli-usage-merge and commands.json require expected-byte migration.

### rev-35 · 2026-11-08T19:05:55.896Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1750-source-2
commit: 2171f87cd38639f936c6d526eb7cc4a208224263
scope: full
findings: [{"severity":"medium","text":"Standards/test validity: the new known-machine setup observer returns false directly, but harness.eventually accepts every value except undefined. It can complete before the provider/SSH probe enters and advance the boot clock during acquisition setup. Return true only after the positive status/marker receipt and undefined otherwise; preserve the absolute-deadline and joined-close assertions.","file":"hub/test/host-provision-gate.test.ts","line":146},{"severity":"medium","text":"Standards/lifecycle: the aborted-GET fixture registers only fake.close before starting a delayed scoped read. If setup/assertion fails before abort.abort, cleanup joins a still-held FakeClock GET until drainage failure. Prearm abort → observed request join → fake.close with attempt-all cleanup before triggering the request.","file":"hub/test/digitalocean-pacing.test.ts","line":223}]
finding_counts: {"high":0,"medium":2,"low":0}

NOT CLEAR: Standards two medium fixture findings; Spec zero new findings. Source-1 production corrections, provider/API scope and compatibility migration are accepted on source inspection. A-17939 details the falsely successful eventually observer and missing prearmed scoped-GET abort/join/close cleanup. Author confirmed both; preserve deadline/native receipt assertions. A-17938 is qualified precommit/candidate evidence, with interrupted attempt/retry limits retained. No reviewer execution; native/T4/configured verification still pending fresh source clearance. C3/C4/C5 runtime-unverified; prior failed marks are not new verification. Full after-stage QA separate.

Criteria: C1 failed (The identified-machine native setup observer can succeed on false before its held probe is admitted.), C2 failed (The pinned-SSH native setup observer can advance the deadline clock before receiving its entry marker.).

### rev-35 · 2026-11-08T19:07:17.663Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1750-source-3
commit: 764cf31f65a972de8b22425c8a03ac2236d0a67b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards 0 / Spec 0. Exact two-file test delta fixes positive probe admission observation and prearmed scoped-GET abort/join/close; production source remains accepted source-2. A-17940 incorporates prior source audits and qualified A-17935/38 evidence. All C1–C5 runtime-unverified pending authorized native/T4 preservation and mode-free same-head verification. Restore remaining C3/C5 old failed marks to implementation-done for corrected code before verify admission. No reviewer execution; full after-stage QA separate.

### rev-35 · 2026-11-08T19:39:16.070Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1750-evidence-1
commit: 764cf31f65a972de8b22425c8a03ac2236d0a67b
scope: evidence
findings: [{"severity":"medium","text":"Evidence/compatibility: configured run bbd12da7 at the exact reviewed head records failure of 'restored wait places once on capacity commit and placed launches never restore', then never obtains file completion after all 11 cases finish (10 pass/1 fail). The run stalls/exits124. Exact buffered assertion and source cause are not established; diagnose the task-head regression and file/process drainage, preserving assertions, before fresh reviewed verification.","file":"hub/test/waiting-launch-restart.test.ts","line":99}]
finding_counts: {"high":0,"medium":1,"low":0}

NOT CLEAR: A-17947/bbd12da7 exits124 after one waiting-launch-restart compatibility failure and missing file completion. All11 cases finished10pass/1fail; exact buffered assertion/source cause unknown, not inferred. Coordinator base control3/3 reported; bounded task-head diagnosis ongoing, no accepted shared-defect exemption. A-17948 preserves distinct receipt censuses and provenance. T0/T1 pass; T2/file drainage incomplete, selectedT3/Web unexecuted. Pool-failures15base+75load and pacing24base/new5load pass. A-17942 native15files/278pass/code0/signalnull and four required gate identities audited, retained as qualified preservation. All criteria finally runtime-unverified; no unsupported criterion-specific cause assigned. Fix needs fresh source review before configured retry; full after-stage QA separate.

### impl-1750 · 2026-11-08T19:42:36.306Z

Rule20 diagnosis fix sweep: optional provision failure.code=cleanup-unavailable retains machine/acquisition/release=incomplete. Consumers provision-records occupied/current inventory, host status/list, restart, watchdog, leases, scheduler and wire readers retain existing fields and treat failed ownership as occupied. No refusal or wire field removed. Production cleanup catches resolution/rejection before clearing retry and fencing pool; shared create callers may return a nonterminal record, which must remain owned and not be destroyed. Existing waiting-launch-restart T2 case is the regression; capacity-commit assertions stay intact.

### rev-35 · 2026-11-08T19:52:29.458Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1750-source-4
commit: 526785854e42fd4bc9993895e7814eebf07576d9
scope: full
findings: [{"severity":"medium","text":"Spec/C4: cleanup-unavailable catch deletes #retries, including its consecutive-failure count, before #retry(name). Repeated retained cleanup failures therefore always wait one minute instead of doubling until ready or pool-config reset. Preserve the streak when replacing its timer and cover consecutive retained failures without reset.","file":"hub/src/host/pool-runtime.ts","line":182},{"severity":"medium","text":"Spec/settlement: retained-failure publication occurs after awaited destroy without a captured-record/terminal revalidation. A concurrent confirmed destroy can publish destroyed/released, then this catch rewrites it failed/incomplete and falsely reoccupies the slot. Preserve newer positive completion and revalidate identity before publishing retained failure; cover held cleanup concurrent with confirmed completion.","file":"hub/src/host/pool-runtime.ts","line":185}]
finding_counts: {"high":0,"medium":2,"low":0}

NOT CLEAR: Standards0/Spec2medium, detailed A-17952. Prior nonterminal-result/drainage correction is accepted, but cleanup catch resets the boot streak and lacks exact-record/terminal fencing before rewriting failed/incomplete; author confirmed both. Preserve backoff count and newer confirmed completion, with held/consecutive-failure controls. A-17950 red5/base5/green5 logs inspected with interrupted-vs-natural-completion limits; assertions retained. Coordinator cec50c89 coverage split acknowledged: Linux fallbackT1/T2/Web/changedT3, fullT3 batch, local15+mac-only5 after fresh clearance. No reviewer execution; runtime remains unverified; full after-stage QA separate.

Criteria: C4 failed (Cleanup-unavailable catch deletes the consecutive failure count, restarting every retry at one minute.), C1 failed (Post-await retained failure publication can overwrite newer destroyed/released confirmation and reoccupy its slot.).

### rev-35 · 2026-11-08T19:57:35.260Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1750-source-5
commit: 6ccf01d82d70c03ef64263ace011ce931c59e3eb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards0/Spec0. A-17957 incorporates prior audits: streak survives cleanup failure; captured identity/state/release fence preserves newer terminal/ready/replacement checkpoints without stale notice/retry. Candidate red4/green32 transcript limits A-17956 retained; all C1–C5 runtime-unverified. Per Coordinator d7a99417, no intermediate native/verify: wait explicit merge-dev after T-1753, then merged-head delta review before20-file local preservation and configured verify. Coverage split cec50c89 and transitive A-17951 remain, full after-stage QA separate. Head clean; no reviewer execution.
