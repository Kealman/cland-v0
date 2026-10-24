---
layout: ../layouts/ArticleLayout.astro
title: A software factory with the lights on
metaTitle: Software factory for AI coding agents, with a human in charge · cland
description: What a software factory and a dark factory are, and how cland runs Claude Code, Codex and OpenCode as a software factory where agents build and you still decide.
lead: Agents plan, write, review and test the code. You can opt in to plan approval, answer the questions that need a person and accept the release. That is the factory cland runs, and the one we build cland with.
eyebrow: SOFTWARE FACTORY · AI CODING AGENTS
updated: 2026-10-18
faq:
  - q: Is cland a dark factory?
    a: No. Agents do the production work, but a person can require plan approval, answers the questions that need one and accepts releases. When you are away, your Aide answers for you, and the merge gate still holds.
  - q: Can the crew keep working overnight?
    a: Yes. Your Aide answers the crew's questions on your behalf while you are away. During the v0.1.2 build a stand-in answered 13 questions with a median wait of 1.9 minutes, and the crew never stopped overnight.
  - q: Which coding agents does cland run?
    a: Claude Code, Codex and OpenCode. Each role runs as a real CLI session under your own login, on the model you pick for it.
  - q: Is cland open source?
    a: Yes, under Apache-2.0. The code is on GitHub, and cland is built by a cland crew.
---

## What a software factory is

A software factory is a setup where AI coding agents do the production work. They take specified work, write the code, test it and ship it, many tasks at once, inside machinery that decides when a piece of work is done. The term spread in early 2026.

In January, Dan Shapiro described five levels of AI-assisted programming, from "spicy autocomplete" up to "the dark software factory" ([his post](https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/), [Simon Willison's summary](https://simonwillison.net/2026/Jan/28/the-five-levels/)). At the top level the factory is "a black box that turns specs into software", and it is dark because it is "a place where humans are neither needed nor welcome". In February, StrongDM's AI team described running a factory like that, where no human writes the code and no human reviews it ([a discussion from Stanford CodeX](https://law.stanford.edu/2026/02/08/built-by-agents-tested-by-agents-trusted-by-whom/)).

## Why we keep the lights on

cland is a software factory: agents do the planning, coding, reviewing and testing. The human stays in the building, at the points where a person changes the outcome.

- **The plan.** Before an epic starts, the Coordinator splits it into tasks with stages, parallel lanes and a QA policy. By default it starts and tells you; you can opt in to approve each plan first.
- **The questions.** When the crew needs a decision, the Coordinator brings it to you in a topic bound to the work, and the inbox lists everything waiting on you. When you are away, your Aide answers for you.
- **The merge.** Every ordinary task merge needs a current clear review, QA when the plan requires it, and every criterion done and verified. A changed head needs fresh evidence.
- **The release.** QA demos each epic, and you accept the release. Only then does cland tag it, write the notes and push.

The lights are on in a plainer sense too. Every session is a real Claude Code, Codex or OpenCode session, and you can attach to any of them and type.

## What it looks like in numbers

We build cland with a cland crew and publish the numbers after every release in the [build log](/log/).

- **v0.1.2:** 94 tasks landed in 77 hours across 10 epics, each closed by a clean QA demo. A stand-in answered the crew's 13 questions with a median wait of 1.9 minutes.
- **v0.1.3:** 93 tasks, 2.9 merges an hour, and 78% of tasks through review on the first pass. The maintainer and the stand-in answered 21 questions with a median wait of one minute.

Keeping a person in charge added a median of a minute per question. The test suite set the pace instead: during v0.1.2, tasks spent 6,618 minutes waiting for tests and 3,411 minutes running them ([what we found](/log/why-the-suite-eats-the-crew/)).

## The workers are the plans you already pay for

cland's workers are the coding agents you already use, under your own subscriptions. A strong model leads, and cheaper and open models do the legwork. One Claude plan works. So does Claude plus ChatGPT plus open models through OpenCode. cland runs the official `claude`, `codex` and `opencode` CLIs under your logins, exactly as you would by hand, and never reads your tokens to call a provider's API. [Crew configuration](/docs/crew/) shows the options.

## Who it is for

Developers who already run coding agents and want them to work as a team on a real repository, while keeping a say in what ships. cland runs on macOS and Linux, and its tracker lives in your repository as Markdown files.
