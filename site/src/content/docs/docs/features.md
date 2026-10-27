---
title: Features
description: Everything cland does, one line each, with the page that explains it.
---

Everything cland does, one line each. Each line links to the page that explains it.

## The work

- **[Items and the tracker](/docs/items/).** Releases, categories, epics, specs, tasks, questions and maps are Markdown files in your repository, with a container ladder you configure in `.cland/config.toml`.
- **[Tasks with status, rank, size and criteria](/docs/items/#tasks).** The hub moves a task's status on claims, verdicts and merges; rank sets what is next; acceptance criteria carry done and verified marks.
- **[Categories](/docs/items/#categories).** Bugs, Tech debt, Follow-ups and Ideas collect what the crew finds along the way, until you promote it.
- **[GitHub issue import](/docs/items/#importing-github-issues).** One command brings your open issues into the tracker.
- **[Plans with stages and lanes](/docs/concepts/#plans-and-approval).** Every epic is planned before work starts: ordered stages, parallel lanes and a QA policy per stage, approved by you if you want.

## Talking to the crew

- **[Topics](/docs/topics/#topics).** You talk to the Coordinator in topics bound to units of work, each with a status that says who is waited on.
- **[General and the Agents topic](/docs/topics/#general).** A standing topic for free conversation, and a read-only one that keeps agent-to-agent traffic out of your way.
- **[Asks and the inbox](/docs/topics/#the-inbox).** Questions travel up the chain of leads; only the Coordinator asks you, and the inbox holds only what needs you now.
- **[Layers](/docs/topics/#layers).** Now, watch, background and archive decide what demands your attention and what waits behind a fold.
- **[Artifacts](/docs/concepts/#artifacts).** Reports, diagrams and pages a session shows you, as chips in their topic and rendered in the browser.

## The crew

- **[Sessions and direct harness access](/docs/sessions/).** Every session is a real Claude Code, Codex or OpenCode session; attach to it and type into it at any time.
- **[Roles and crew configuration](/docs/crew/).** Choose the harness, model, effort, account and permissions of every role, and how many sessions of each run.
- **[Accounts and limits](/docs/accounts/).** The usage windows Claude Code and Codex report in one place (OpenCode has no limit data); a limited account stops new launches, and you choose what happens next.
- **[Your Aide and the onboarding](/docs/quickstart/#4-the-onboarding).** Your own session studies the project, proposes the crew and drafts the first plan with you.
- **[The rulebook](/docs/concepts/#rulebook).** The project's own rules for how work is done, delivered into every role's instructions.

## Landing the work

- **[The merge gate](/docs/verification-and-release/#the-merge-gate).** A task lands on `dev` only with current clear verdicts from other sessions and every criterion done and verified.
- **[Verification for any stack](/docs/verification-and-release/#verification-for-any-stack).** Your own check and test commands through one queue, with an idempotent prepare command for cloud images and runs.
- **[Cloud runners](/docs/verification-and-release/#local-and-cloud-runners).** Run verification on fresh DigitalOcean machines in parallel, under a daily spend cap the hub enforces.
- **[Releases from the item](/docs/verification-and-release/#releases).** `cland release` tags the release, writes its notes and pushes to GitHub in one atomic push.

## Where you work

- **[The terminal workbench](/docs/workbench/).** cland's own Neovim, with a palette that shows every action and its key; no Neovim experience needed.
- **[Web and phone](/docs/web-and-phone/).** The same hub in any browser and on your phone, installed as an app, with notifications for what needs you.
- **[Remote control](/docs/remote-control/).** Pair a private Telegram chat to follow General, receive inbox cards and answer away from the workbench.
- **[The CLI](/docs/cli/).** Every command by area; most take `--json` for scripts.
