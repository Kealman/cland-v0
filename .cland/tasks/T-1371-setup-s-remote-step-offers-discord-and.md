---
id: T-1371
kind: task
title: Setup's remote step offers Discord and checks the application
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1366
  - T-1367
  - T-1368
  - E-1312
topic: topic-1176
branch: t/T-1371-setup-s-remote-step-offers-discord-and
created: 2026-10-27T05:46:51.472Z
updated: 2026-10-29T11:09:04.242Z
---

## Summary

After Telegram, setup offers Discord. It gives the application guidance and the invite link, reads the token through the hidden question, checks the application's settings and names what to change, enables the remote, and approves the `/cland pair` code on the human's yes. The docs page and the tour stage gain Discord.

## What to build

Spec §3.11, §3.8 (the application) and Q-1293 (setup's checks, the invite with 117824).

The guidance covers creating the application, the Install Link at None, Public Bot off, the Message Content toggle, and the invite link `scope=bot&permissions=117824` built from the application's id. After the token is stored, setup reads the application through E-1312's REST client. It names each setting to change: Public Bot on, the Message Content flag off, or an Interactions Endpoint URL that is set. It enables the remote only after a re-check passes.

Pairing reuses 06's logic: the human runs `/cland pair` in the channel, and setup confirms the code. Decline, `ok` and the commands without a terminal behave as for Telegram, with `cland secret set discord.token` and `cland config set remote.discord.enabled true`. The docs page gains the Discord steps, and the tour stage gains a Discord line.

**External wait and shared files:** E-1312 (the Discord client, its REST application read and the fake gateway) · **Shared files:** hub/src/setup/steps/ (the remote step), .agents/skills/onboarding/TOUR.md, the remote-control docs page

## Acceptance criteria

- [x] C1. With a scripted prompter and the fake Discord, setup offers Discord after Telegram, shows the guidance and an invite link with `permissions=117824` for the fake application's id, reads a made-up token through the hidden question, stores it and enables `remote.discord` (test).
  - done: impl-1371 · 2026-10-29T10:44:28.690Z
  - verified: rev-31 [reviewer] · run rev-20261029-1371-final1 · 2026-10-29T11:09:03.822Z · commit 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
- [x] C2. With Public Bot on, the Message Content flag off, or an Interactions Endpoint URL set on the fake application, setup names each setting to change and does not enable the remote until a re-check passes (test).
  - done: impl-1371 · 2026-10-29T10:44:29.054Z
  - verified: rev-31 [reviewer] · run rev-20261029-1371-final1 · 2026-10-29T11:09:03.822Z · commit 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
- [x] C3. After `/cland pair` on the fake gateway, setup shows "Pair Discord user <id> (<Name>)? code …" and pairs it on yes (test).
  - done: impl-1371 · 2026-10-29T10:44:29.287Z
  - verified: rev-31 [reviewer] · run rev-20261029-1371-final1 · 2026-10-29T11:09:03.822Z · commit 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
- [x] C4. A declined Discord offer prints `skip`, a configured and paired one `ok`, and without a terminal an untouched Discord prints `skip` and a half-configured one `open`, each with the Discord commands (test).
  - done: impl-1371 · 2026-10-29T10:44:29.656Z
  - verified: rev-31 [reviewer] · run rev-20261029-1371-final1 · 2026-10-29T11:09:03.822Z · commit 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
- [x] C5. The docs page's Discord steps and the tour's Discord line pass the docs and onboarding command checks (test).
  - done: impl-1371 · 2026-10-29T10:44:30.571Z
  - verified: rev-31 [reviewer] · run rev-20261029-1371-final1 · 2026-10-29T11:09:03.822Z · commit 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd

## Comments

### impl-1371 · 2026-10-29T10:39:03.597Z

Consumer inventory before setup admission/offer change: hub/src/setup/runner.ts, steps/remotes.ts, pairing.ts, cli/setup.ts, cli/usage.ts; setup runner/CLI scripted consumers hub/test/setup-{remotes,remote-component,pairing-component,hub,cli,handover,flow}.test.ts, hub/test/scenarios/setup.test.ts and telegram-marks-setup.test.ts; terminal prompt consumers setup-terminal/prompter; docs hub/README.md, docs/agents/setup.md, site remote-control/web-and-phone pages, site/test/remote-docs.test.ts, hub/test/remote-docs*.test.ts; onboarding TOUR.md and hub/test/skills-onboarding.test.ts. Reuse existing REST application shape, remote.status, inbox.list and pairing.approve without wire changes; retain prior remote.status shape regression. New optional setup-only Discord API injection for fake REST; default uses existing DiscordApi with passed environment. Existing Telegram/speech scripts need the additional default-No Discord offer. No persisted-record/schema/frame changes.

### impl-1371 · 2026-10-29T10:44:28.524Z

Implementation complete. Final consumer migration uses existing DiscordApi directly with passed-env loopback root, not a new setup API injection; no shared wire/schema changes. Scripted setup consumers now include Discord's default-No offer; T3 setup scenario expected rows/prompts updated. Public guide, CLI help, README, secrets/pairing guidance and TOUR updated; SKILL.md frozen with proposal sent to Coordinator. Local macOS source checks: touched setup-remotes, setup-remote-component (native fake REST/ws), setup-flow, setup-hub, setup-cli, setup-handover, scenarios/setup, skills-onboarding, site/remote-docs and transitive hub/remote-docs each passed individually; npm run typecheck passed. These are local targeted checks, no suite receipt yet, no browser used. Native new Discord cases measured 37–179 ms on macOS; Linux duration pending verification. C1/C2/C3 use generated repair=false/true/decline cases, C4 nonterminal matrix + repeated declines + paired rerun, C5 docs vocabulary + tour command checks. Fetched and merged origin/dev before source review (340d6ddaa).

### rev-31 · 2026-10-29T10:48:23.163Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1371-source1
commit: 6c61a72cee76b20084f6267973815dc1d1cd2928
scope: full
findings: [{"severity":"medium","text":"M1: SETUP_USAGE changed but frozen owning row remains Telegram-only; preserve usage/root-help exact guards, migrate only SETUP_USAGE with original red/green receipts.","file":"hub/test/fixtures/cli-usage/commands.json","line":18},{"severity":"medium","text":"M2: native stop closure can observe undefined during projectHub acquisition and does not adopt/stop a late returned hub; setup/REST work ignores exchange abort. Pre-own acquisition/operation cancellation and joined late settlement before root cleanup; add omitted/aborted setup controls. Existing bounds/fallback acknowledged.","file":"hub/test/setup-remote-component.test.ts","line":123},{"severity":"medium","text":"M3: custom login-profile prompter accepts only Telegram decline; new Discord offer throws an assertion caught as a fail step while final assertions ignore it. Explicitly decline Discord, retain login assertions and assert Discord outcome/no unintended failure.","file":"hub/test/setup-flow.test.ts","line":436}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13655 consolidated source1 not clear: Standards3medium/Spec0, M1–M3 only. Application/recheck/invite/token/local-pairing implementation otherwise matches scope; C1–C5 remain runtime-unverified. Source-identified ownership/consumer gaps, no Reviewer test/race execution. Reported local macOS passes and M1 working-tree correction are not successor-head configured evidence. Explicit loopback readback retained; original pre-fix synthetic REST-only incident stays T-1438. Preserve current base and assertions; fresh pushed source review before verification. No full task run/per-item QA requested.

### impl-1371 · 2026-10-29T10:49:00.911Z

Source1 corrections M1–M3: only frozen SETUP_USAGE row migrated, unchanged cli-usage-compatibility and cli-help guards captured red then green (1/1, 5/5). Login-profile custom prompter now explicitly declines Discord; added Discord row assertion first failed 'fail !== skip', then full setup-flow passed 20/20. New shared pacingOwner owns acquisition/late-hub stop and setup observations. Additive embedded SetupOptions.signal is checked between runner steps and passed into Discord REST/readiness waits; no wire shape change or CLI setting. Production consumers remain cli/setup (optional signal omitted) and existing runner/step tests (optional omitted); new cancellation fixture supplies it. Setup component now 7/7 locally, including omitted/aborted serving receipts and held application-read cancellation, with hub.stopped/native gateway-close, zero fake writers/observers and retained-root then removal ENOENT assertions. npm run typecheck passed after production signal changes. Same dev base retained; no verification submitted before replacement source verdict.

### rev-31 · 2026-10-29T10:50:35.563Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1371-source2
commit: 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13657 source2 clear; M1–M3 resolved, Standards0/Spec0. Frozen SETUP_USAGE literal matches source with guard sources unchanged; pre-owned pacingOwner acquisition/late hub stop and setup observations plus internal abort signal/native REST/readiness cancellation; omitted/aborted/held-read controls retain root through native close and joined settlement; custom login/OpenCode handlers explicitly decline Discord, positive row assertion retains login/profile checks. Same base340d6ddaa, no merge; original application/invite/token/pairing/docs assertions preserved. Local reported component7/7, flow20/20/help1+5/typecheck remain macOS only. C1–C5 await runtime evidence. Mode-free verify may proceed at unchanged head; no full task run/per-item QA requested.

### rev-31 · 2026-10-29T11:09:03.822Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1371-final1
commit: 26b6ea07abccb85167d34b3aa7dae3ebbadf2bcd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13661 final evidence clear; C1–C5 verified. Independent original A-13660/18183671 typed audit:4133 ordinary passes+110 separately scoped load passes, no nonpass/duplicates;14new identities each base+5/5 (70task samples), worst0.744884356s. Application repair/decline/native pairing, nonterminal/repeated decline, lifetime cancellation, docs/tour and existing help/login/setup consumers pass. T0/allT1/fallbackallT2/changedT3setup once/Web complete; remainingT3/T4 absent. Existing T3scenario14.450083080s, selected-phase addedwall15.554s excludes machine wait; emitted21.676/E-1313 recommendation is not a committed allowance/enforced pass. Linuxc-8nyc1 Node24.21/Nvim0.12.5 pinnedHeadlessShell156/v1248; task2/Web4, reused hosttypecheck, report-onlylint/timing/Web warnings retained. Known earlier local REST incident remains T-1438, not relabelled. Ready may follow conflict check; Coordinator gates/enqueue separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
