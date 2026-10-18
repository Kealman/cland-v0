---
title: FAQ
description: Subscription terms, supported plans, privacy, cost, Neovim, how cland differs from agents in tmux, GitHub issues and platform support.
sidebar:
  order: 11
---

## Does running my subscriptions through cland break their terms?

cland is built to stay inside them:

- Every session is the provider's own CLI (`claude`, `codex` or `opencode`), signed in with that CLI's own login and running on your machine, exactly as if you had started it in a terminal.
- cland never reads your tokens or credential files and never calls a provider's API with them. Usage limits are read from the running harness or by asking the harness itself.
- cland never rotates accounts, never fails over to another account and never moves a session between accounts. Providers forbid rotating accounts or using several accounts to get past limits. When an account hits its limit, new launches on it stop and the Coordinator asks you what to do.

You remain responsible for using each plan as its provider allows. Read [Accounts and limits](/docs/accounts/) for the details.

## Which plans work?

Any plan that runs one of the three harnesses:

| Harness | Plans |
| --- | --- |
| Claude Code | A Claude subscription, or whatever Claude Code itself accepts. |
| Codex | A ChatGPT plan, or whatever Codex itself accepts. |
| OpenCode | Any provider OpenCode supports, including OpenRouter, or its free models with no login. |

cland does not care which plan is behind a login: it runs the CLI, and the CLI talks to its provider.

## Do I need all three harnesses?

No. cland needs at least one. A crew on Claude Code alone, with `opus` leading and `sonnet` working, is a complete crew. Mixing harnesses lets you spread work across the plans you pay for, and lets a Reviewer on one harness check an Implementer on another. See [Crew configuration](/docs/crew/#example-crews).

## Does my code leave my machine?

Only the way it already does:

- **The harnesses** send code to their providers as part of their normal work, exactly as when you use them directly.
- **The hub, the tracker and the territory** are local. The territory is a Git repository inside `.cland/`, and only `cland release` pushes to GitHub.
- **The web workbench** is served by the hub on your machine, reachable on your network only when you allow it, and from elsewhere only through your own tunnel or VPN. There is no cland cloud.
- **Cloud verification** is off by default. When you turn it on, your committed tree goes to a machine in your own DigitalOcean account and the machine is destroyed after the run.
- **No telemetry.** cland reports nothing to anyone. (This website counts visits with GoatCounter, without cookies or personal data; that is the website, not the tool.)

:::caution
OpenCode's free models may train on the code they see. `cland doctor` warns for every role configured on OpenCode. Use a paid provider for code you cannot share.
:::

## Do I need to know Neovim?

No. The workbench runs in Neovim, but cland ships its own pinned Neovim with a clean configuration and its own keys. Space opens everything (`␣n` the inbox, `␣s` the sessions, `␣p` the palette), `␣?` lists every key, and the palette shows the key of every action. You type messages in a composer like any chat box.

If you would rather not use a terminal UI at all, use the [web workbench](/docs/web-and-phone/) in a browser. Neovim users get a few extras: [attaching to a harness's terminal](/docs/sessions/#attach-to-a-session), and answering Claude Code's in-TUI approvals.

## What does it cost?

cland itself is free and open source under Apache-2.0. You pay for:

- **Your AI plans**, as you do today. cland uses their limits; it does not add a fee.
- **Cloud verification**, only if you turn it on: DigitalOcean bills your account per second for each machine. The hub enforces a daily spend cap you set, shared by all your projects. Local verification costs nothing.

The crew spends your limits faster than one agent in one terminal, because several sessions work at once. Size the crew to your plans: the Accounts meters show each 5-hour and weekly window as it fills.

## How is this different from running agents in tmux?

tmux gives you several terminals. cland gives you a team:

- **Roles with enforced permissions.** A Reviewer cannot edit, an Implementer cannot merge, only the Coordinator asks you. The hub checks every call.
- **Real state.** cland knows whether each session is busy, idle or waiting for you from the harness itself, not from what the model says.
- **The harness is still there.** Every session is the real CLI in its own interface. [Attach to it](/docs/sessions/) and type, whenever you want.
- **Messages without you in the middle.** Sessions talk through the hub, in [topics](/docs/topics/) you can read. You are not the copy-paste bus.
- **A tracker and a merge gate.** Every task has a branch, a worktree, acceptance criteria and verdicts. Nothing reaches `dev` without a clear review and verified criteria.
- **One inbox.** Every decision waiting on you, from every session, in one list, answerable with one key from the terminal or your phone.
- **Limits and accounts in view.** Each session's account and each account's windows on one screen.

## Can I bring my own tracker?

cland's [tracker](/docs/items/) is the crew's only source of work: one Markdown file per item, committed with your code. You can import your GitHub issues into it:

```sh
cland task import-github
```

It reads open issues through `gh` with your own login (`--all` adds closed ones), maps labels, parents and blocking relations, and keeps comments. Pull requests stay on GitHub. Re-running it updates the imported items in place. During onboarding the Aide offers the import on an existing project.

There is no two-way sync with GitHub or other trackers.

## Does it work on Windows?

No. cland supports macOS and Linux.

## Can several people use one project?

cland is a single-user tool: one person drives one crew per project. Collaborators work through Git as usual, and `cland sync` brings their changes from GitHub into your `dev`.

## Where do I report a problem?

Run `cland doctor` first: most setup problems show up there with their fix. Include its output, plain text, in your report.
