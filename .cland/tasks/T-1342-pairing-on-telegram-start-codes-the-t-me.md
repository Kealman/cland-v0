---
id: T-1342
kind: task
title: "Pairing on Telegram: start, codes, the t.me link and a blocked bot"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1094
branch: t/T-1342-pairing-on-telegram-start-codes-the-t-me
created: 2026-10-26T19:09:06.499Z
updated: 2026-10-26T23:18:51.065Z
---

## Summary

Pairing on Telegram: `/start` in an unpaired chat gives the code, the sender's id and the approve command; `/start` in the paired chat names the project; and `cland remote status` prints the bot's `t.me/<bot>` link. A blocked bot stops sending and reports it.

## What to build

Wire T-1332's codes and limits and T-1333's approval to the Telegram client. Detect a block from the membership update and a 403, stop sending, and report it in General and `cland remote status`. Spec §3.2.

## Acceptance criteria

- [ ] C1. On the fake, a stranger's `/start` gets a code with their id and the approve command and at most two replies, `cland remote approve telegram <code>` pairs the human, and `/start` in the paired chat names the project (test).
- [ ] C2. After the fake reports the bot blocked, through a membership update and then a 403, the remote stops sending and reports it, and `cland remote status` shows the `t.me/<bot>` link (test).

## Comments

### impl-1342 · 2026-10-26T23:18:51.065Z

Read E-1309/spec §§3.2, 3.4, 3.7, 3.9, 3.10, 3.12/§4 and GLOSSARY. Pre-agreed TDD seams: production projectHub frame/CLI plus loopback fake Bot API. Consumer inventory (rule 20, before policy change): TelegramRemote start/run/test/status/pairingReplaced and production messengerFactory/daemon, Telegram polling first-match handlers and stored pairing/update/dedupe readers; Gateway disable/status/test and ConfiguredGateway; remote.status dispatcher/CLI and doctor/native workbench status consumers; pairing callback/PairingCodes/approval frames; test fakes/messenger, telegram-polling-fixture, telegram-polling and restart T3, telegram-messenger, telegram-api, remote-cli (legacy shape), gateway/state/secrets/config-set, pairing-codes/approval/service, project-hub-lifecycle/cli-imports, all-tier search incl QA E-1308 and shipped implement skill. No wire/schema fields removed or added. Existing explicit handlers retain priority and all legacy signatures remain valid. Changes: attach native private /start after injected handlers, paired membership failure via existing disable path, retain botLink/traffic on disabled native remotes, sanitized General notice helper coordinated with T-1349. Other consumers retain existing contracts; T2 previous-hub remote-cli coverage retained. New telegram-pairing.test.ts covers C1/C2 through native factory, CLI approval/status, durable next-poll offsets and native close receipts.
