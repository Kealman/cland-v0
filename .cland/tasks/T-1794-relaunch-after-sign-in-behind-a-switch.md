---
id: T-1794
kind: task
title: Relaunch after sign-in, behind a switch
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1790
topic: topic-1481
branch: t/T-1794-relaunch-after-sign-in-behind-a-switch
created: 2026-11-09T12:44:12.839Z
updated: 2026-11-11T19:34:23.703Z
closed: 2026-11-11T19:34:23.703Z
---

## Summary

If a live harness does not pick up re-signed tokens, `cland login signin` must relaunch that host's sessions of the harness in their worktrees. This ships behind `[hosts] relaunch_after_signin`, which defaults to false and which the live run of E-1539 sets. With the switch on, a sign-in in place or from a card ends with those sessions relaunched, their conversations resumed.

## What to build

The config key, parsed with the other `[hosts]` keys and hot-reloaded, and a success hook on the sign-in runner. When the switch is on, the hook relaunches each session of the harness on that host through the existing relaunch path, resuming its conversation, and leaves sessions of other harnesses alone. `cland init` does not write the key; its default is false.

## Acceptance criteria

- [x] C1. `[hosts] relaunch_after_signin` parses as a boolean defaulting to false, is refused otherwise naming the key, and applies on hot reload (test).
  - done: impl-1794 · 2026-11-11T18:25:31.170Z
  - verified: rev-36 [reviewer] · run rev-36-1794-final-1 · 2026-11-11T18:55:06.914Z · commit dd4650fa7ebe7590f46c758582734ce5ab26d3d9
- [x] C2. With it false, a sign-in in place relaunches nothing (test).
  - done: impl-1794 · 2026-11-11T18:25:31.614Z
  - verified: rev-36 [reviewer] · run rev-36-1794-final-1 · 2026-11-11T18:55:06.914Z · commit dd4650fa7ebe7590f46c758582734ce5ab26d3d9
- [x] C3. With it true, each session of that harness on the host is relaunched in its worktree with its conversation resumed, and sessions of other harnesses are untouched (test).
  - done: impl-1794 · 2026-11-11T18:25:32.326Z
  - verified: rev-36 [reviewer] · run rev-36-1794-final-1 · 2026-11-11T18:55:06.914Z · commit dd4650fa7ebe7590f46c758582734ce5ab26d3d9

## Blocked by

- T-1790

## Notes

- Hot files: `hub/src/host/pools.ts` (the key), `hub/src/host/login-signin.ts` (the success hook), `hub/src/adapters/sessions.ts` (the relaunch call).
- Tests: `hub/test/host-pools-config.test.ts` (T1, new cases); new `hub/test/login-relaunch.test.ts` (T2).
- Serves the open point of the Contents bullet "Reconciliation and the open point". Key name and default: question 15.

## Comments

### impl-1794 · 2026-11-11T18:08:49.828Z

Rule-20 sweep: shared suite-import-graph importingTests over all 951 manifest tests for pools.ts/login-signin.ts/login-add.ts/sessions.ts reaches 729 tests + 14 unknowns (all counted reached); complete inventory being published as artifact. Explicit fields/function/frames sweep covers production config init/render/config-set/project reload, transport-config re-export, executor pool reader, pool-runtime/status/provisioners, adapter Sessions; login-add, dispatcher login.signin/login.signed-in and CLI; docs/skills/QA and T1–T4 consumers. Wire LoginSignIn and terminal reply stay unchanged; afterSignIn is optional internal callback, old callers unaffected. Parsed HostPools adds relaunchAfterSignIn; exact record literals must migrate. Native host-relaunch, host-restart, login-resignin-native are reached and require native slot before review. Only one additive registration in dispatch.ts (approved coord ccef91b5); no other lane logic edits.

### rev-35 · 2026-11-11T18:21:36.477Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1794-source-1
commit: 225aa5bdf85e34dd0cca68ddaa55f29514de726a
scope: full
findings: [{"severity":"medium","text":"Standards rules9/26 and SpecC3: running eligibility is checked before resume waits for its lifecycle slot/statDirectory. The later authorize checks session/conversation/host/harness but not captured native generation, live status or archive eligibility. A queued explicit stop/archive or competing resume can therefore be superseded and a stopped/newer generation relaunched. Leadc5a7901d confirms no earlier fence. Admit the captured live/unarchived host generation under the existing resume lifecycle owner after slot readiness and before directory/native effects, retain authority through the operation, and add held-stop/archive/competing-resume controls with durable rows and exact call counts.","file":"hub/src/adapters/sessions.ts","line":2134},{"severity":"medium","text":"Standards rule12: tempProject registers root cleanup before this later raw t.after; HubCore/ProcessTable/Sessions are allocated without immediate owners, and the callback fails fast if snapshots.close or sessions.close rejects, skipping subsequent storage closes. Lead3c062136 confirms no earlier attempt-all owner. Register resources when acquired, join snapshots/Sessions before stores and root disposal through shared cleanup phases, attempt all safe closes and retain root on incomplete writer drainage; include adverse setup/cleanup-order controls.","file":"hub/test/login-relaunch.test.ts","line":28},{"severity":"medium","text":"Standards rules16/20: CONFIG_USAGE changed to advertise hosts.relaunch_after_signin but the frozen command usage fixture is unchanged. cli-usage-compatibility.test.ts deep-compares every usage export, so the required existing consumer is unmigrated. Leadc5a7901d confirms missed refresh/no disposition. Refresh through its existing procedure and retain frozen/rendered-help compatibility controls.","file":"hub/test/fixtures/cli-usage/commands.json"},{"severity":"medium","text":"Standards rule17: expanded/renamed config-set hot-apply case inherits the old identity's0.329747 baseline without a sample binding or approved migration. Leadc5a7901d confirms mechanical transfer; a separate165.265ms candidate is not that historical sample. Remove the transplanted measurement/new identity baseline or preserve the original case separately; a fresh baseline must come from the normal measured producer.","file":"hub/test/durations.json","line":4364},{"severity":"low","text":"Standards rule16: the guide now lists both relaunch=false and=true but says the process keeps its original native identity for both. The enabled test intentionally asserts a new PID. Lead3c062136 confirms stale wording. Distinguish unchanged native PID for false from renewed PID with preserved cland session/conversation/cwd/binding for true.","file":"docs/agents/tests/hub-test-login-resignin-native.test.ts.md","line":15}]
finding_counts: {"high":0,"medium":4,"low":1}

A-18828 complete pinned source1 NOT CLEAR:4medium/1low. Lead confirms production lifecycle-slot/generation race, fixture attempt-all/root-order gap, frozen CONFIG_USAGE miss, transferred config-set0.329747 baseline and stale native guide identity. Shared default-false parser/init omission/hot settings and durable success hook otherwise source-aligned; ccef91b5 additive dispatcher and f08d3a93 live-only scope confirmed. Hook promise coalesces per admission; existing same-conversation resume reused. A18826 honest captured local logs+native/red excerpts/candidate limits; no final exact-head configured proof. A18827 independently checked744 test paths, all729reached+14unknown+newT2 retained, manifest tiers89T1/349T2/240T3/14T4/52Web; reach not coverage. Native3 directed files supporting only; fullT3/T4/QA split explicit. Crashed fixture root retained without descendant receipt; T1816 repeating-port aside stays separate. No Reviewer tests/native/provider/browser; clean fixed source. Hold released for consolidated fixes and fresh committed source review before verification; no provenance-only reruns.

Criteria: C1 failed (Expanded config-set proof carries an unsupported transplanted timing baseline and CONFIG_USAGE frozen consumer is unmigrated; reviewed-head proof remains pending.), C2 failed (New disabled/enabled fixture has late fail-fast resource teardown after owned root disposal; safe adverse setup/drain ownership is incomplete.), C3 failed (Pre-slot live selection does not fence concurrent stop/archive or newer native generation, so automatic renewal can revive explicitly stopped sessions.).

### impl-1794 · 2026-11-11T18:23:12.650Z

Source1 fixes: resume adds an optional internal admission callback after its lifecycle slot is acquired (old callers/wire unchanged); relaunch pins captured hostGenerationKey/live/unarchived there, preserving stop/archive/new-generation authority. Existing transitive Sessions sweep and explicit session.resume consumers remain reached/unaffected with omitted callback; new held stop/archive/resume T2 cases prove supersession. Frozen CONFIG_USAGE consumer migrated; unsupported expanded config-set baseline removed, preserving normal new-identity load measurement. New T2 root/writer/storage owners prearmed with attempt-all safe drainage, plus adverse setup/cleanup controls.

### rev-36 · 2026-11-11T18:29:09.770Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1794-source-2
commit: dd4650fa7ebe7590f46c758582734ce5ab26d3d9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

SOURCE CLEAR, A-18834; Standards 0 / Spec 0. All five A-18828 findings repaired: captured live/unarchived host generation admitted under existing resume lifecycle slot before directory/native work; immediate attempt-all writer/storage/root owners with adverse controls; frozen CONFIG_USAGE refreshed; unsupported config-set baseline removed; native PID guide corrected. Full feature and six-file repair diff inspected, shared optional resume callback consumers A-18830 reviewed; Coordinator ccef91b5/f08d3a93/85dc4a97 read independently. C1-C3 remain runtime-unverified. A-18831 supporting candidate logs include 9/9 relaunch, 9/9 existing resume and native 4+4+1 named cases/close0; uncommitted-candidate linkage and inventory/retained-crash limits explicit, not exact-head configured proof. No Reviewer execution. Submit exact-head mode-free verify; final actual consumer union/case/file accounting required. Full T3/T4/after-stage QA and T-1816 separate; no provenance rerun or root cleanup requested.

### rev-36 · 2026-11-11T18:55:06.914Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1794-final-1
commit: dd4650fa7ebe7590f46c758582734ce5ab26d3d9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

FINAL CLEAR, A-18851; Standards 0 / Spec 0, C1-C3 verified. Same-head f9326204/A-18847 exit0: 6130 positive base tests, 55 separate load finishes, no fail/cancel/skip; T0/allT1/fallbackT2/changedT3 four renewal cases/mappedT4 base/Web complete. Nine relaunch cases each base+5, parser/config-set hot apply each base+5, compatibility1/1 and existing resume9/9 positive. Native false5.069s retains PID; true6.563s renews PID with stable conversation/cwd/session/binding and renewed turn; held stop/archive/resume controls pass. Independent ledger A-18850 expands744 subset with9 explicit A-18830 paths:753=500 positive files(96T1/350T2/52Web/1T3/1T4)+253 deferred(240T3/13T4), no missing lower/Web. Log footer positively records HeadlessShell1248/CfT156 despite author's absent-browser claim. Exported tree f9b1c4f2bb2cd21de8765672ba64025a90d04f95, Linuxx64 kernel147/Node24.21/Nvim.12.5, cachednull, c8lon1/2workers/lifetime1242s/$0.0863. A-18831 local 4+4+1 candidate/native close0 support and inventory/capture limits explicit; earlier crashed root retained, old reds remain failed, T-1816 separate. No Reviewer execution. Full remainingT3/T4/repetitions/affected after-stageQA and landing unclaimed.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-11T19:34:23.703Z

Merged 6aa8c95df36f133ea36003b5f66c1a863ad24a1b onto dev.
