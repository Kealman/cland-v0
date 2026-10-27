---
id: T-1365
kind: task
title: Setup's remote step stores the Telegram token through a hidden prompt and enables the remote
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: null
branch: null
created: 2026-10-27T05:46:50.331Z
updated: 2026-10-27T05:47:00.098Z
---

## Summary

`cland setup` gains an optional remote step after the hub and before the Aide. It offers Telegram, shows how to create the bot with BotFather, reads the token through a hidden prompt as `cland secret set` reads it, stores it, enables the remote and reloads the hub.

## What to build

Spec §3.11 (setup) and §3.3; v0.1.4 §3.3 (check first, ask only about what is missing, one line `ok`, `done`, `skip`, `open` or `fail`, one readline interface per question, no prompt without a terminal).

The prompter seam gains a fourth question: a hidden secret question. It reuses `cland secret`'s raw, no-echo reader and is closed before anything else reads the terminal. The scripted test prompter gains a matching step kind.

A new remote step runs in the runner between the hub and the Aide. For Telegram it detects whether the token is present, whether the remote is enabled and whether it is paired. When something is missing it offers Telegram (default No). On yes it prints the BotFather guidance in a few lines, then asks for the token. A token that fails the Telegram format check is refused at the prompt and asked for again. The token is stored with the secrets module, `remote.telegram.enabled` is set through the config-set path, and the hub is reloaded so the gateway starts the remote.

- A decline prints `skip`. A fully configured, paired remote prints `ok` and asks nothing.
- Without a terminal the step prints `open` with the exact commands: `cland secret set telegram.token`, `cland config set remote.telegram.enabled true`, `cland hub reload`.
- Pairing inside setup comes in 06. Until then an enabled, unpaired remote ends `open` with the approve command.
- With `--no-aide`, where no hub runs, the step stores and enables, and leaves the reload and the pairing `open`.

The step is written so that Discord (11) and the speech key (09) can join it as further offers.

**External wait and shared files:** E-1309 (the parts it drives, the Bot API client and fake, T-1340 to T-1342, are on dev) · **Shared files:** hub/src/setup/runner.ts, hub/src/setup/prompter.ts, hub/src/setup/types.ts, hub/src/cli/setup.ts, hub/test/setup-prompter.ts

## Acceptance criteria

- [ ] C1. With a scripted prompter, a terminal run shows the remote step after the hub and before the Aide, gives the BotFather guidance, reads a made-up token through the hidden question, stores it, enables `remote.telegram` and reloads the hub, ending in `done` (test).
- [ ] C2. A declined Telegram offer prints `skip` and writes nothing, and a run against a token-present, enabled, paired project asks nothing about Telegram and prints `ok` (test).
- [ ] C3. Without a terminal the step asks nothing: an untouched Telegram remote prints `skip` with `cland secret set telegram.token`, `cland config set remote.telegram.enabled true` and `cland hub reload`, and a half-configured one (a token without enabling, or enabled without a token) prints `open` with the missing commands (test).
- [ ] C4. The hidden question echoes nothing, and the token appears in no setup line, narration, `--json` report or hub log (test).
- [ ] C5. A malformed token is refused at the prompt with the expected format named, and the next well-formed one is stored (test).
