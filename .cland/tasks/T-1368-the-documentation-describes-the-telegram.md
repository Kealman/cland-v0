---
id: T-1368
kind: task
title: The documentation describes the Telegram remote, `cland remote` and `cland secret`
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1362
  - T-1363
  - T-1364
  - T-1366
  - T-1348
topic: null
branch: null
created: 2026-10-27T05:46:50.947Z
updated: 2026-10-27T05:46:50.947Z
---

## Summary

The web-and-phone page gains a section on remotes. A new page covers `cland remote` and `cland secret`, from creating the Telegram bot to a paired remote, with doctor's causes and the Remotes row. Both describe only what is built.

## What to build

Spec §4 (the documentation pages) and §3.2, §3.3, §3.9 to §3.11. The new page "Remote control" goes under Features in the sidebar and is linked from the features overview. It covers:
- BotFather;
- `cland setup`'s remote step, or by hand `cland secret set telegram.token`, `cland config set remote.telegram.enabled true` and `cland hub reload`;
- Start and the approval from Neovim's card or `cland remote approve`;
- what the chat does (the commands, mute, catch-up, the gap line);
- token rotation;
- doctor's stopped causes with their fixes;
- `cland remote status`, `unpair` and `test`, and `cland secret list` and `unset`.

The web-and-phone section covers the Remotes row and the pairing row that points to the terminal or Neovim. The CLI reference lists the `remote` and `secret` subcommands. Discord and speech are not described until 09 and 11 add them.

A site test checks the pages' commands, config keys and secret names against the CLI help, the config keys and the secret names. A hub test runs the page's marked Telegram command blocks in order against the fake Bot API with a made-up token, piping the token on stdin, and ends paired.

**External wait and shared files:** E-1309 (the page describes mute, T-1345, and catch-up, T-1348, so both must be on dev) · **Shared files:** site/src/content/docs/docs/web-and-phone.mdx, site/src/content/docs/docs/cli.md, site/astro.config.mjs, site/test/

## Acceptance criteria

- [ ] C1. Every `cland` command, config key and secret name on the remote-control page and in web-and-phone's remotes section exists in the CLI help, the config keys and `cland secret`'s names (test).
- [ ] C2. The page is in the docs sidebar and is linked from the features overview and from web-and-phone's remotes section (test).
- [ ] C3. The page's Telegram command blocks, run in order against the fake Bot API in a scratch project with a made-up token, end in a paired remote (test).
- [ ] C4. The CLI reference lists each `cland remote` and `cland secret` subcommand that their usage text names, and no other (test).
