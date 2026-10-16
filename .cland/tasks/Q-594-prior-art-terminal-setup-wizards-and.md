---
id: Q-594
kind: question
title: "Prior art: terminal setup wizards and first-run tours"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-591
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:26:11.335Z
updated: 2026-10-16T12:17:25.582Z
closed: 2026-10-16T12:17:25.582Z
---

## Question

How do good CLIs run a guided first step in the terminal, and what fits `cland setup`? Read `gh auth login`, create-next-app, `rails new`, Claude Code's first run and `/init`, Codex's and OpenCode's first runs, `npx skills`: the step shapes (detect, offer, confirm, wait for an external step and re-check), the prompt libraries that work on Node 24 ESM without a build step (@inquirer/prompts, @clack/prompts, node:readline/promises), how such a wizard stays testable under node:test (injected streams, a fake TTY), and what first-run flows print at the end to hand over to the product. Recommend the step shape and the library for `cland setup`. Deliver `docs/research/setup-prior-art.md` on research/setup-prior-art and the resolution comment here.

## Comments

### human · 2026-10-16T12:17:25.210Z

## Resolution

Document: `docs/research/setup-prior-art.md` on research/setup-prior-art (68dffed3).

Recommendation for `cland setup`:
- Step shape: ordered idempotent steps; each detects, offers, confirms, runs the vendor command as a child with inherited stdio, then detects again; the re-check decides, never the exit code; detection reuses doctor's harness probes.
- Without a terminal: never prompt, wait, install or launch; report each open step with its exact command and exit 1 while any is open; `--yes` covers only harmless questions, an install needs its own flag, `--json` reuses doctor's shape.
- Library: none for 0.1.4; a prompter with confirm, choose and pause over node:readline/promises, one readline interface per question (an interface left open while a child runs steals keystrokes, three of three runs; `rl.question` drops lines and hangs at end of input, the line iterator does not); @clack/prompts (6 packages, 280 KiB) can sit behind the same seam later; @inquirer/prompts is 25 packages, 1.7 MiB; prompts and enquirer are unmaintained.
- Testing: a fake prompter for the flow, fake harnesses on the PATH as the doctor tests have them with login commands added, one stream-level test of the real prompter; a sketch of 58 + 28 lines passes six tests.

Patterns: Codex builds its steps from what is missing; Rails bin/setup is idempotent and ends by exec of the dev server; create-vite offers to start the product in place; wait steps block on or poll the vendor (OpenCode avoids clack's spinner there because it swallows Ctrl+C); skills exits 1 without a terminal; create-next-app prints every default it assumed.

Caveats: Claude Code's first-run screens come from docs and changelog; the real logins were never run as children of a Node parent (the prototype does that first); running codex once leaves its app-server daemon running.
