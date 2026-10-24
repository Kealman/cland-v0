---
title: Introduction
description: cland runs one coding crew across every AI plan you pay for, with a strong model leading, cheaper models doing the legwork and you making the decisions.
sidebar:
  order: 1
---

**One coding crew across every AI plan you pay for.**

cland runs Claude Code, Codex and OpenCode sessions as one team on your project. A strong model leads. Cheaper and open models do the legwork. You make the decisions.

It is a local tool for one person, with a separate hub and crew per project. It runs on macOS and Linux, is licensed Apache-2.0 and sends no telemetry.

## The problem

You already pay for more than one AI coding plan. Each comes with its own CLI agent, and each agent works alone:

- One agent in one terminal does one thing at a time. Running five means five terminals, and you become the message bus between them.
- Nobody tracks what each agent is doing, which branch it is on or whether its work was reviewed.
- Your expensive model spends its limits on work a cheaper model could do, while the cheaper plan sits idle.
- When an agent needs a decision, it waits in a terminal you are not looking at.

## The crew

cland gives every agent session a **role** and puts them on one **crew**:

| Role | What it does |
| --- | --- |
| **Coordinator** | Leads the project. Plans, launches sessions, merges, releases. The only role that asks you questions. |
| **Implementer** | Takes one task, works on its own branch, hands it over for review. |
| **Reviewer** | Reads the change and returns a verdict: clear or not clear. |
| **QA** | Runs the product and returns a verdict. |
| **Lead** | Optional. Leads one epic or release when the project grows past one Coordinator. |
| **Aide** | Works for you alone. Speaks for you, and runs the onboarding. |

A role does not depend on the harness or the model. Put the Coordinator on Claude Code with `opus`, Implementers on Codex, the Reviewer on another harness than the Implementer, and a bulk of small tasks on an open model through OpenCode. Change any of it in one file. See [Crew configuration](/docs/crew/).

Every session runs under one of your own logins, through the official CLI. cland never reads your tokens to call a model provider directly and never switches accounts on its own. See [Accounts and limits](/docs/accounts/).

## How it fits together

```mermaid
flowchart TB
  %% How cland fits together: you use the workbench, the workbench talks to the hub, the hub connects the sessions, and the sessions work in your repository's tracker and local Git territory.
  you(["You"])
  wb["Workbench<br/>Neovim · browser · phone"]
  hub["Hub<br/>one per project, on your machine"]
  subgraph crew ["Sessions, each on your own account"]
    coord["Coordinator<br/>Claude Code"]
    impl["Implementer<br/>Codex"]
    rev["Reviewer<br/>Claude Code"]
    qa["QA<br/>Codex"]
  end
  subgraph repo ["Your repository"]
    tracker["Tracker<br/>one file per item"]
    git["Git territory<br/>a branch per task"]
  end
  you --> wb --> hub
  hub --> coord & impl & rev & qa
  crew --> repo
  classDef human stroke:var(--cland-diagram-accent)
  class you human
```

- **The hub** is a small local service, one per project. Sessions talk to each other and to you through it. It holds the shared state, enforces what each role may do, and knows each session's real state (busy, idle, waiting for you) from the harness itself, never from what the model says.
- **The tracker** lives in your repository: one Markdown file per item under `.cland/tasks/`. Releases contain epics, epics contain tasks, and categories hold loose work. It is the crew's only source of work. See [Items and the tracker](/docs/items/).
- **The territory** is a local bare Git repository that becomes `origin`. Agents branch, push and merge there. Your GitHub remote is renamed `github`, with publication through `cland release` or approved marketing-only `cland publish`.
- **The workbench** is where you watch and steer: a terminal UI in Neovim, and the same picture in the browser and on your phone. You talk to the Coordinator in [topics](/docs/topics/), answer its questions in the inbox and read every verdict. Any session's own harness is one key away: [attach to it](/docs/sessions/) and type.

## What a day looks like

1. You tell the Coordinator what to build, or accept the plan the Aide drafted with you.
2. The Coordinator files tasks, plans the epic and launches Implementers, each in its own worktree.
3. Each Implementer requests review. The Reviewer reads the change and posts a verdict on the item.
4. When the verdicts the plan requires are clear and every acceptance criterion is done and verified, the hub marks the task `ready`. The Coordinator merges it onto `dev`.
5. When a decision is yours, it reaches your inbox as an ask with numbered options. You answer with one key, from the terminal or your phone.
6. When the release is done, you approve the version and notes, and `cland release` publishes it.

You never type a command the crew could run for you. You are asked for decisions, not keystrokes.

## Where to go next

- [Quickstart](/docs/quickstart/): from an empty folder to a running crew.
- [Features](/docs/features/): everything cland does, one line each.
- [Install](/docs/install/): the three install methods and what cland needs.
- [Concepts](/docs/concepts/): the words cland uses and where its state lives.
- [The workbench](/docs/workbench/): the panels and the keys.
- [Crew configuration](/docs/crew/): example crews for different plans.
- [FAQ](/docs/faq/): subscription terms, cost, privacy.
