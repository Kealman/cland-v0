---
id: T-1365
kind: task
title: Setup's remote step stores the Telegram token through a hidden prompt and enables the remote
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by: []
topic: topic-1104
branch: t/T-1365-setup-s-remote-step-stores-the-telegram
created: 2026-10-27T05:46:50.331Z
updated: 2026-10-27T05:49:18.840Z
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

- [ ] C1. With a scripted prompter, a terminal run shows the remote step after the hub and before the Aide, gives the BotFather guidance, reads a made-up token through the hidden question, stores it, enables `remote.telegram` and reloads the hub, ending in `open` with the pairing step named when nothing is paired and in `done` when an existing pairing is kept (test).
- [ ] C2. A declined Telegram offer prints `skip` and writes nothing, and a run against a token-present, enabled, paired project asks nothing about Telegram and prints `ok` (test).
- [ ] C3. Without a terminal the step asks nothing: an untouched Telegram remote prints `skip` with `cland secret set telegram.token`, `cland config set remote.telegram.enabled true` and `cland hub reload`, and a half-configured one (a token without enabling, or enabled without a token) prints `open` with the missing commands (test).
- [ ] C4. The hidden question echoes nothing, and the token appears in no setup line, narration, `--json` report or hub log (test).
- [ ] C5. A malformed token is refused at the prompt with the expected format named, and the next well-formed one is stored (test).

## Comments

### impl-1365 · 2026-10-27T05:48:44.635Z

Rule 20 consumer inventory before edits: new setup report row (remote telegram) and Prompter.secret affect hub/src/cli/setup.ts, setup/{runner,types,prompter,handover,hub}.ts and setup steps. Production clients consume SetupReport only in cli/setup; wire remote.status/config.set/hub.reload shapes remain unchanged. Test consumers searched across hub/test, web/test, nvim/test, qa and docs: setup-flow.test.ts (ordered rows/counts and scripts), setup-cli.test.ts (JSON count/rows/relative indexing), setup-hub.test.ts (runner scripts and suffix expectations), setup-prompter{,.test}.ts (fourth question), scenarios/setup.test.ts (T3 terminal transcript/order), setup-handover, setup-accounts, setup-favourite, setup-trust and setup-trust-lock (scripted interface; individual steps do not offer remotes), setup-hub-component (frame client), executor-safety-component (typed SetupMachine unaffected). Existing SetupHub mocks remain source-compatible with optional added operations; previous remote.status reply shape is retained and covered via the real frame client. No Web/Neovim consumer, startup probe or persisted-record reader uses setup report rows. Shipped examples: hub/README.md setup and scratch scenario sections, cli/usage.ts, docs/agents/secrets.md, implement skill/CHANGES; onboarding skill only receives unchanged Aide brief and is unaffected. Brand launch audit is historical and unaffected. New tests use the agreed scripted prompter + sealed frame/projectHub + fake messenger seams; hidden input uses existing raw keypress stream seam.
