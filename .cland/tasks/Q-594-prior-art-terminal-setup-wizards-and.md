---
id: Q-594
kind: question
title: "Prior art: terminal setup wizards and first-run tours"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.335Z
updated: 2026-10-16T11:26:12.337Z
---

## Question

How do good CLIs run a guided first step in the terminal, and what fits `cland setup`? Read `gh auth login`, create-next-app, `rails new`, Claude Code's first run and `/init`, Codex's and OpenCode's first runs, `npx skills`: the step shapes (detect, offer, confirm, wait for an external step and re-check), the prompt libraries that work on Node 24 ESM without a build step (@inquirer/prompts, @clack/prompts, node:readline/promises), how such a wizard stays testable under node:test (injected streams, a fake TTY), and what first-run flows print at the end to hand over to the product. Recommend the step shape and the library for `cland setup`. Deliver `docs/research/setup-prior-art.md` on research/setup-prior-art and the resolution comment here.
