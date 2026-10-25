---
id: Q-1290
kind: question
title: "Prior art: agent-to-messenger bridges and their failures"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1286
blocked_by: []
topic: null
branch: null
created: 2026-10-25T10:24:45.385Z
updated: 2026-10-25T10:27:23.486Z
---

## Question

What do existing bridges between coding agents (or long-running assistants) and messengers teach a cland remote (map M-1286)? Sources: primary code and docs where available.

Cover: (1) BCAS's dropped Discord bot, cland's predecessor: the research/bcas-hub branch of this repo, docs/hub-extraction.md, closed items Q-2, Q-7, E-19 and T-21 in .cland/tasks, and /Users/evgeniyivanov/Projects/BratvaInc/bcas (read-only; never print a token): what it did, how it paired humans, how it handled asks, why it was dropped. (2) OpenRig's Slack gateway: the marketing session's write-up at /Users/evgeniyivanov/Projects/cland/marketing/research/openrig/features.md (sections 2 and 5, read-only) and OpenRig's own repository if public: what broke and why. (3) Other bridges: Telegram and Discord front-ends for Claude Code, Codex or OpenCode (search GitHub for recent projects), Home Assistant's Telegram bot, matterbridge, Zulip and Matrix bridges, OpenAI's or Anthropic's own messenger surfaces if any: pairing and allow-lists, catch-up after downtime, command sets, rate limiting, message splitting, buttons for questions, media and voice handling, how they avoid echo loops and duplicate deliveries, how they store tokens. Conclude with the failure classes to design against and the patterns worth copying, each with its source.
