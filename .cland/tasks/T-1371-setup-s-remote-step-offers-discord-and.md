---
id: T-1371
kind: task
title: Setup's remote step offers Discord and checks the application
state: open
status: in progress
size: M
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
updated: 2026-10-29T10:39:03.597Z
---

## Summary

After Telegram, setup offers Discord. It gives the application guidance and the invite link, reads the token through the hidden question, checks the application's settings and names what to change, enables the remote, and approves the `/cland pair` code on the human's yes. The docs page and the tour stage gain Discord.

## What to build

Spec §3.11, §3.8 (the application) and Q-1293 (setup's checks, the invite with 117824).

The guidance covers creating the application, the Install Link at None, Public Bot off, the Message Content toggle, and the invite link `scope=bot&permissions=117824` built from the application's id. After the token is stored, setup reads the application through E-1312's REST client. It names each setting to change: Public Bot on, the Message Content flag off, or an Interactions Endpoint URL that is set. It enables the remote only after a re-check passes.

Pairing reuses 06's logic: the human runs `/cland pair` in the channel, and setup confirms the code. Decline, `ok` and the commands without a terminal behave as for Telegram, with `cland secret set discord.token` and `cland config set remote.discord.enabled true`. The docs page gains the Discord steps, and the tour stage gains a Discord line.

**External wait and shared files:** E-1312 (the Discord client, its REST application read and the fake gateway) · **Shared files:** hub/src/setup/steps/ (the remote step), .agents/skills/onboarding/TOUR.md, the remote-control docs page

## Acceptance criteria

- [ ] C1. With a scripted prompter and the fake Discord, setup offers Discord after Telegram, shows the guidance and an invite link with `permissions=117824` for the fake application's id, reads a made-up token through the hidden question, stores it and enables `remote.discord` (test).
- [ ] C2. With Public Bot on, the Message Content flag off, or an Interactions Endpoint URL set on the fake application, setup names each setting to change and does not enable the remote until a re-check passes (test).
- [ ] C3. After `/cland pair` on the fake gateway, setup shows "Pair Discord user <id> (<Name>)? code …" and pairs it on yes (test).
- [ ] C4. A declined Discord offer prints `skip`, a configured and paired one `ok`, and without a terminal an untouched Discord prints `skip` and a half-configured one `open`, each with the Discord commands (test).
- [ ] C5. The docs page's Discord steps and the tour's Discord line pass the docs and onboarding command checks (test).

## Comments

### impl-1371 · 2026-10-29T10:39:03.597Z

Consumer inventory before setup admission/offer change: hub/src/setup/runner.ts, steps/remotes.ts, pairing.ts, cli/setup.ts, cli/usage.ts; setup runner/CLI scripted consumers hub/test/setup-{remotes,remote-component,pairing-component,hub,cli,handover,flow}.test.ts, hub/test/scenarios/setup.test.ts and telegram-marks-setup.test.ts; terminal prompt consumers setup-terminal/prompter; docs hub/README.md, docs/agents/setup.md, site remote-control/web-and-phone pages, site/test/remote-docs.test.ts, hub/test/remote-docs*.test.ts; onboarding TOUR.md and hub/test/skills-onboarding.test.ts. Reuse existing REST application shape, remote.status, inbox.list and pairing.approve without wire changes; retain prior remote.status shape regression. New optional setup-only Discord API injection for fake REST; default uses existing DiscordApi with passed environment. Existing Telegram/speech scripts need the additional default-No Discord offer. No persisted-record/schema/frame changes.
