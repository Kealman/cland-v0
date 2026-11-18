---
id: T-1736
kind: task
title: Discord native history setup test waits for native acquisition with a fixed 2000 ms bound
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1881
blocked_by:
  - T-1889
topic: topic-1606
branch: t/T-1736-discord-native-history-setup-test-waits
created: 2026-11-07T13:26:06.144Z
updated: 2026-11-18T01:58:19.439Z
closed: 2026-11-18T01:58:19.439Z
---

## Summary

`hub/test/telegram-polling-restart.test.ts` "Discord native history setup omitted drains its Store writers and observations" waits for the owned native acquisition with a fixed 2000 ms real-time bound (line 331, `until(() => !!owner.native(), { … timeoutMs: 2000 })`). That is a setup wait, so it must use `testWaitMs()`. Under load it fails before the behaviour under test starts.

## Evidence

- E-1533 stage-3 macOS cover b6058278 (A-17464) at dev 093f851b, local darwin arm64, workers 2, peak 1-minute load 14.21: `Error: owned native acquisition before losing setup receipt: not within 2000 ms`. It was the only failure (6918 pass), and the stage did not touch the file (last change T-1615).
- Run alone at the same tree with `CLAND_*` stripped: 5/5 green on both expansions (omitted, aborted).

## Acceptance criteria

- [x] C1. The native acquisition wait in both expansions uses the shared load-scaled setup budget (`testWaitMs()`), and the behaviour bounds (the 1000 ms FakeClock receipt deadline) stay exact and named.
  - done: impl-1736 · 2026-11-17T23:24:31.998Z
  - verified: rev-36 [reviewer] · run rev-36-1736-final-1 · 2026-11-18T00:42:08.380Z · commit 34944d56f5955bd81bdd3cd50b51340c7fa11c41
- [x] C2. A sweep of `hub/test/telegram-polling-restart.test.ts` and its Discord/Telegram siblings replaces every other fixed real-time setup wait with `testWaitMs()`, listed in an item comment.
  - done: impl-1736 · 2026-11-17T23:46:48.329Z
  - verified: rev-36 [reviewer] · run rev-36-1736-source-3 · 2026-11-17T23:48:50.236Z · commit 34944d56f5955bd81bdd3cd50b51340c7fa11c41
  - verified: rev-36 [reviewer] · run rev-36-1736-final-1 · 2026-11-18T00:42:08.380Z · commit 34944d56f5955bd81bdd3cd50b51340c7fa11c41

## Comments

### coord · 2026-11-17T23:17:35.080Z

New instance, 2026-11-17, from duplicate T-1949: the local macOS stage cover e7494d5d at ca5f70ca4 (A-20922, peak 1-minute load 12.84) failed only telegram-polling-restart "Discord native history setup omitted drains its Store writers and observations", with "owned native acquisition before losing setup receipt: not within 2000 ms" at until.ts:40 via telegram-polling-restart.test.ts:316. Both "Discord native history setup" cases passed 5/5 alone at loads 4.86–5.11. This one fault now costs a full stage cover rerun.

### impl-1736 · 2026-11-17T23:22:21.936Z

Pre-fix red evidence retained from stage e7494d5d at ca5f70ca4 (A-20922), local macOS arm64, peak load 12.84: "owned native acquisition before losing setup receipt: not within 2000 ms". Earlier stage b6058278 at 093f851b had the same literal error. No new runtime seam: existing omitted/aborted native setup cases and their final drainage assertions are the regression seam. Sweep covers hub/test/discord*.ts, telegram*.ts and fake API owners. Setup poll and serving receipts use testSetupWaitMs(), which delegates to load-scaled testWaitMs(); until readiness waits use testWaitMs() directly. Exact injected FakeClock fault deadlines and measured behavior/cleanup/recovery bounds are retained.

### impl-1736 · 2026-11-17T23:22:35.445Z

C2 changed setup wait inventory (each source occurrence; repeated lines belong to separate test cases):
hub/test/discord-api.test.ts: await within(hello, testSetupWaitMs()); await held;
hub/test/discord-cards-fixture.ts: await until(async () => (await exchange.fake.control('state')).gateway.identifies === 1, { what: 'Discord READY', timeoutMs: testWaitMs() });
hub/test/discord-cards-fixture.ts: await until(() => remote.status!().connected, { what: 'READY plus native heartbeat ACK', timeoutMs: testWaitMs() });
hub/test/discord-cards-fixture.ts: await until(() => f.state.get('discord.lastMessageId') === seed.id, { what: 'TEXT cursor committed', timeoutMs: testWaitMs() });
hub/test/discord-cards-fixture.ts: await until(() => f.state.outbox().some(j => j.source === `discord.reaction:${ids.channel}:${seed.id}:👌` && j.state === 'sent'), { what: 'seed feedback settled', timeoutMs: testWaitMs() });
hub/test/discord-cards.test.ts: await until(f.script!.ready, { what: 'scripted native approval subscription', timeoutMs: testWaitMs() });
hub/test/discord-cards.test.ts: await until(f.script!.ready, { what: 'scripted native approval subscription', timeoutMs: testWaitMs() });
hub/test/discord-commands.test.ts: await until(async () => (await exchange.fake.control('state')).gateway.identifies === 1, { what: 'Discord READY', timeoutMs: testWaitMs() });
hub/test/discord-commands.test.ts: await until(() => remote.status!().connected, { what: 'READY plus native heartbeat ACK', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: const first = await start(); await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-inbound-media.test.ts: const acquired = within(startup.serving, testSetupWaitMs()); void acquired.catch(() => {});
hub/test/discord-messages.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: testWaitMs(), what: 'Discord READY' });
hub/test/discord-messages.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: testWaitMs(), what: 'READY' });
hub/test/discord-messages.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: testWaitMs(), what: 'READY' });
hub/test/discord-messages.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: testWaitMs(), what: 'READY' });
hub/test/discord-messages.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { timeoutMs: testWaitMs(), what: 'READY' });
hub/test/discord-messages.test.ts: const factsReceipt = within(ready.promise, testSetupWaitMs());
hub/test/discord-messages.test.ts: const acquired = await within(facts.owner.serving, testSetupWaitMs());
hub/test/discord-messenger.test.ts: const setupReceipt = within(acquired.promise, waitTimeoutMs(testWaitMs(20_000)));
hub/test/discord-pairing.test.ts: await until(async () => (await fake.control('state')).commandWrites === 1, { timeoutMs: testWaitMs(), what: 'global command write' });
hub/test/discord-pairing.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-pairing.test.ts: await until(async () => (await fake.control('state')).gateway.identifies === 1, { what: 'READY', timeoutMs: testWaitMs() });
hub/test/discord-render.test.ts: await within(acquired.promise, testSetupWaitMs());
hub/test/telegram-approvals.test.ts: await until(script.ready, { timeoutMs: testWaitMs(), what: 'native subscription ready before raising approval' });
hub/test/telegram-approvals.test.ts: const hub = await within(f.owner.serving, testSetupWaitMs());
hub/test/telegram-approvals.test.ts: await within(f.polled, testSetupWaitMs());
hub/test/telegram-approvals.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-approvals.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-approvals.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-approvals.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await within(initial, testSetupWaitMs());
hub/test/telegram-cards.test.ts: const active = await driveTelegram(f.clock, f.state, within(polling, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(polling, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(polled, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(polling, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: assert.equal((await driveTelegram(f.clock, f.state, within(polled, testSetupWaitMs()))).params.offset, input.update_id + 1, 'input was already confirmed, not replayed');
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-cards.test.ts: await driveTelegram(f.clock, f.state, within(initial, testSetupWaitMs()));
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-catchup.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-commands.test.ts: const poll = await within(polling, testSetupWaitMs());
hub/test/telegram-commands.test.ts: await within(polling, testSetupWaitMs());
hub/test/telegram-commands.test.ts: await within(polling, testSetupWaitMs());
hub/test/telegram-commands.test.ts: let poll = await drive(within(polling, testSetupWaitMs()));
hub/test/telegram-commands.test.ts: await drive(within(polling, testSetupWaitMs()));
hub/test/telegram-commands.test.ts: await drive(within(polling, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: await drive(within(initialPoll, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: await drive(within(initial, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: await drive(within(initial, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: await drive(within(initial, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-inbound.test.ts: const poll = await drive(within(polled, testSetupWaitMs()));
hub/test/telegram-liveness.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-liveness.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-liveness.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-liveness.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-liveness.test.ts: const poll = await within(initial, testSetupWaitMs());
hub/test/telegram-marks-setup.test.ts: const hub = await within(f.owner.serving, testSetupWaitMs());
hub/test/telegram-marks-setup.test.ts: await within(poll, testSetupWaitMs());
hub/test/telegram-marks-setup.test.ts: await within(entered.promise, testSetupWaitMs());
hub/test/telegram-messenger.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-mute.test.ts: await within(initial, testSetupWaitMs());
hub/test/telegram-mute.test.ts: const lateHub = await within(f.owner.serving, testSetupWaitMs());
hub/test/telegram-notices.test.ts: await within(polling, testSetupWaitMs());
hub/test/telegram-pacing.test.ts: hub = await within(owner.serving, testSetupWaitMs());
hub/test/telegram-pacing.test.ts: const request = await within(entered, testSetupWaitMs());
hub/test/telegram-pacing.test.ts: const lateHub = await within(owner.serving, testSetupWaitMs());
hub/test/telegram-pairing.test.ts: let poll = await within(initial, testSetupWaitMs());
hub/test/telegram-pairing.test.ts: await within(initial, testSetupWaitMs());
hub/test/telegram-pairing.test.ts: let poll = await within(initial, testSetupWaitMs());
hub/test/telegram-polling-restart.test.ts: assert.equal((await within(initialPoll, testSetupWaitMs())).params.offset, undefined);
hub/test/telegram-polling-restart.test.ts: const held = await within(interrupted, testSetupWaitMs());
hub/test/telegram-polling-restart.test.ts: const poll = await within(polled, testSetupWaitMs());
hub/test/telegram-polling-restart.test.ts: const hub = await within(owner.serving, testSetupWaitMs());
hub/test/telegram-polling-restart.test.ts: const receipt = await within(held, testSetupWaitMs());
hub/test/telegram-polling-restart.test.ts: await until(async () => (await owner.fake.control('state')).gateway.identifies === 1, { what: 'initial native READY', timeoutMs: testWaitMs() });
hub/test/telegram-polling-restart.test.ts: await until(() => !!owner.native(), { what: 'owned native acquisition before losing setup receipt', timeoutMs: testWaitMs() });
hub/test/telegram-polling.test.ts: const receipt = await within(polled, testSetupWaitMs());
hub/test/telegram-polling.test.ts: const receipt = await within(polled, testSetupWaitMs());
hub/test/telegram-polling.test.ts: const receipt = await within(polled, testSetupWaitMs());
hub/test/telegram-polling.test.ts: const receipt = await within(polled, testSetupWaitMs());
hub/test/telegram-users.test.ts: await within(initial, testSetupWaitMs());

### impl-1736 · 2026-11-17T23:24:05.895Z

C2 clarification: restored active-input confirmation waits in telegram-inbound (after eyes feedback and the already-running routing loop); these are behavior, not startup. telegram-approvals now waits for the setup subscription before arming its exact 1000 ms approval observer, still before raising approval. Startup inventory additionally includes telegram-marks-setup initial poll and held acquisition; telegram-pacing held getMe; discord-api initial gateway hello. Discord cold acquisition retains its 20000 ms fallback via waitTimeoutMs(testWaitMs(20000)). No production or wire contract changed.

### rev-35 · 2026-11-17T23:30:50.550Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1736-source-1
commit: 5b29f1194722b95bef35c2ca022fe1fdd50edef0
scope: full
findings: [{"severity":"medium","text":"C2 misses four cursor-seed setup waits: discord-inbound-media:221 and discord-cards:1005 keep 2000 ms; discord-users:97/:150 keep 1500 ms. They establish history/recovery preconditions, like the converted shared history seed, with no approved behavior-bound exception (author confirms 4a350c97). Use the shared setup budget and update the inventory, also listing the changed startNative default receipt wait.","file":"hub/test/discord-inbound-media.test.ts","line":221}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20948 full source review at tree 0ef528bfb2971c5141648b7894411f1db8235540, fixed base 98c597e0c1efc867c5e6e99ad789f6098223a4c3. Standards zero findings; Spec one medium. C1 source is correct: native acquisition uses testWaitMs; named1000 ms FakeClock fault deadline remains exact through helper explicit override; subscription setup precedes approval observer, which precedes trigger. Inspected all24 files/100 added budget lines, remaining sibling/fake-owner waits, and unchanged behavior/cleanup boundaries. No production/wire/tier change or new native launch. A-20938/A-20943 retain historical failed stage error, precommit local macOS Node24.21 T3 two named expansions2/2, T1 until7/7, selected T2 four files54/54, typecheck exit0. Lint exit0/0refusals/130 report-only findings overlapped final edits, so not exact final-source proof. Invocation-tree/raw hashes/native child signals/original scan controls unknown. Whole-case durations are not acquisition timing; failed stages remain failed history. No configured run, full tiers/Web/browser/stress proof. C2 failed; C1 not failed, pending final same-head evidence. Consolidate four omissions and inventory, then fresh source request; no dev merge or Reviewer runtime/probe/edit.

Criteria: C2 failed (Four fixed cursor-seed setup waits remain outside the shared setup budget and the changed-wait inventory is incomplete.).

### impl-1736 · 2026-11-17T23:31:18.014Z

Review M1 consolidated: converted four additional cursor-seed setup waits to testWaitMs(): discord-inbound-media.test.ts 'seed cursor' (previous 2000); discord-cards.test.ts 'stored cursor' (previous 2000); discord-users.test.ts 'durable cursor seed' and 'durable channel cursor seed' (previous 1500 each). All occur before history/recovery faults. Inventory supplement: telegram-polling-restart.test.ts discordHistoryCrashOwner.startNative native receipt default changed from setup.timeoutMs ?? 10000 to testSetupWaitMs(setup.clock, setup.timeoutMs); explicit FakeClock 1000 ms bound remains exact. No source or experiment changes were made during the review hold. No dev merge after first review.

### rev-36 · 2026-11-17T23:42:06.260Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1736-source-2
commit: 759b313133a236a101d532cc932c5c58f076f435
scope: full
findings: [{"severity":"medium","text":"C2 still omits five fixed1500 setup preconditions: discord-messages:603 connection before input, :442 native Reply target mirror and :444 its durable map before reply dispatch; discord-users:154 initial cards before recovery faults and :244 initial copies before inbox/first-winner actions. Author confirms all five/no exemption in 949d4163. Convert to the shared setup budget, preserve predicates/later behavior assertions and list each in the item inventory.","file":"hub/test/discord-messages.test.ts","line":603}]
finding_counts: {"high":0,"medium":1,"low":0}

A-20952 full Standards+Spec review at tree62423d2407c3a5551995b82089655c53192888a0, fixed baseline98c597e0c1efc867c5e6e99ad789f6098223a4c3. Standards zero findings; Spec one medium C2 omission. All25 changed files/104 budget lines and 191 consumer/reference dispositions recorded. The earlier four cursor-seed finding is fixed and startNative default is now inventoried. C1 source has no finding: real acquisition uses shared budget, injected FakeClock deadline stays named/exact1000, approval observer order and final drainage assertions retained. C1 pending same-head configured named receipts, not failed. A-20950 reports stable candidate-tree root lint/typecheck exit0 (130report-only advisories/0refusals) plus seven selected T2 cases; earlier T1/T2/T3 working-tree evidence remains a separate epoch. No configured run, whole tiers, Linux/browser/cloud/stress or current-head T3 proof. Historical failed stages remain failed; raw/native/epoch unknowns labelled. No Reviewer execution or source edits. Hold released for consolidated five-site fix/inventory and fresh source review before verify; no dev merge or stress run requested.

Criteria: C2 failed (Five confirmed fixed real-time setup preconditions remain outside the shared setup budget and inventory.).

### impl-1736 · 2026-11-17T23:42:36.127Z

Second consolidated C2 correction, all five occurrence sites from rev-36-1736-source-2: discord-messages.test.ts native mirror of Reply target (1500 -> testWaitMs), durable target map (1500 -> testWaitMs), Discord connection setup before source input (1500 -> testWaitMs; four origin/destination expansions); discord-users.test.ts both initial cards durable before recovery (1500 -> testWaitMs; history/gap/card expansions), initial durable copies before inbox/first-winner actions (1500 -> testWaitMs). Predicates, observers and all later behavior bounds retained. No dev merge or stress run. Prior cursor-seed/startNative inventory remains current.

### rev-36 · 2026-11-17T23:48:50.236Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1736-source-3
commit: 34944d56f5955bd81bdd3cd50b51340c7fa11c41
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20955 consolidated full source review: Standards clear / Spec clear, no findings. Exact tree39a38808e6f3e9e15c8e34ad4ad641374f7aa159; fixed baseline98c597e0c1efc867c5e6e99ad789f6098223a4c3. Direct parent759b3131, no dev merge. Byte comparison confirms only the five specified setup1500->testWaitMs substitutions across messages/users relative to the prior reviewed parent; every predicate, action, observer, assertion and later behavior bound retained. Updated item inventory covers all five. C2 verified from source, using full A-20952 assessment/191-path census plus complete correction comparison. C1 source correct but remains pending current-head configured named omitted/aborted native history setup receipts; exact1000 FakeClock constant and final drainage assertions intact. A-20953 reports stable-tree root lint/typecheck exit0 (130report-only findings/0refusals), nine selected T2 cases0fail/cancel/skip, local Darwinarm64 Node24.21; selected cases are not whole files/tiers. Prior source epochs/local native checks and failed historical covers remain separately labelled; no current configured/nativeT3/Linux/Web proof or missing raw/native receipt invented. No Reviewer execution/edits, QA none. Hold released; lead may request Coordinator window for configured verification at this unchanged head.

Criteria: C2 verified.

### rev-36 · 2026-11-18T00:42:08.381Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1736-final-1
commit: 34944d56f5955bd81bdd3cd50b51340c7fa11c41
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence settlement A-20976: Standards clear / Spec clear, no findings. Current source clearance rev-36-1736-source-3/A-20955 unchanged/clean; Git tree39a38808e6f3e9e15c8e34ad4ad641374f7aa159. Hub run68a14f02-6df8-44d5-9c9c-e2976bb7cc23/A-20973 finished passed, uncached verificationtree2ca4e0946108b87242d2c7e2c452e36a2169c4fe. Independently decoded exact omitted native setup finish/timing35730/31 pass1.533470796s and aborted35735/36 pass1.559672916s; changed T3 file9/9 once, positive file envelope35746, no repetitions. All23 changed T2 files also positive. T0/T1/T2/changedT3/Web commands end0;711 base file envelopes and6695 base test finishes all pass, no fail/cancel/skip;145nested included. Separate42site load identities each5 positive scoped finishes +5/5proof, not native repetitions. Provenance38339 Linuxx64 droplet Node24.21.0/nvim0.12.5,cached:null; browser35780 HeadlessShell1248/Google Chrome for Testing156.0.8078.4.268remainingT3/17T4unexecuted. Ticket-loss strings are text, not owner outcomes; hub passed/decoded outcomes independently establish result.130lint/advisory budgets remain report-only. Whole-case durations not acquisition timing/speedup; no new macOS native cover/provider/QA claim. C1 now verified with C2 source verification carried forward; all criteria satisfied. Earlier failed covers remain failed history; Reviewer did no runtime execution or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T01:58:19.439Z

Merged 692960bf115ba82d31bd5f3bbaf7d0c93bd4120e onto dev.
