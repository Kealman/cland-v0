---
id: T-6
kind: task
title: "smoke-test codex:rescue with gpt 6.1 sol and gpt 6 astra"
state: closed
status: done
labels:
  - wayfinder:task
assignee: Kealman
parent: M-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:52:00Z
updated: 2026-10-10T00:58:17.304Z
github:
  repo: Kealman/cland-v0
  number: 6
  url: https://github.com/Kealman/cland-v0/issues/6
---

## Question

Does the review / QA chain work in this environment? Run `/codex:rescue` from a session in this repo with gpt 6.1 sol (review) and gpt 6 astra (QA with computer use), on a trivial task each, and record what works, what fails, exact invocations, versions and error text.

Do not work around failures by doing the review or QA yourself: a failure is the finding. Fix the chain or report it to the human.

The answer records the working invocations and any facts later tickets depend on.

## Comments

### Kealman · 2026-10-07T16:37:33Z

<!-- github-comment: 6042373810 -->

## Resolution

Smoke-tested on 2026-10-07 from this repo through `/codex:rescue` (plugin `openai-codex/codex` 1.0.6, companion runtime in shared-session mode, codex-cli 0.160.0, ChatGPT login). Both halves of the chain work.

**Review with gpt 6.1 sol.** Invocation: `/codex:rescue --wait --fresh --model gpt-6.1-sol <task>`, read-only (no `--write`). Job `task-muyboz33-hkwgwe`, 34 s, completed. The Codex rollout for thread `01a11732-db71-7012-a629-663cd0a0f128` records `model: gpt-6.1-sol`, `reasoning_effort: high` (the effort comes from `~/.codex/config.toml`, which also sets `gpt-6.1-sol` as the default model). The model cannot see its own model id; verify it from the rollout under `~/.codex/sessions/`. The output was a correct review: it flagged the engine choice in the GLOSSARY.md context line as implementation detail (fixed in 7112317; the harness examples in the Harness entry stay, since naming harnesses is domain, not implementation).

**QA with gpt 6 astra (computer use).** Invocation: `/codex:rescue --wait --fresh --model gpt-6-astra <task>`, read-only. Job `task-muybqtag-i5r4t4`, 57 s, completed. Rollout for thread `01a11734-2a9a-7ce2-9725-ba026c72e7fa` records `model: gpt-6-astra`, `reasoning_effort: high`. Facts later tickets depend on:

- astra's computer-use surface is the MCP tool `mcp__cua_repl.js` (a JS REPL with screenshot, mouse, keyboard and open-app actions) plus `js_reset`. Shell access is `exec_command` / `write_stdin`; `apply_patch` and `view_image` exist; a `web__run` tool and a large set of ChatGPT-app tools are also exposed.
- A screenshot succeeded but captured "the browser viewport", uniformly dark: computer use appears to operate on a browser surface, not on the macOS desktop.
- Opening the terminal app was refused: `Computer Use is not allowed to use the app 'com.mitchellh.ghostty' for safety reasons.` (verbatim from the rollout). astra cannot drive a terminal emulator directly, so QA of a terminal IDE needs another surface (a web terminal inside the browser surface, tmux capture through the shell, a headless UI client of the IDE, or similar). This is the central input for the QA research ticket #16.
- Shell commands run fine: `gh version 2.102.0`, `NVIM v0.11.2`.

**Notes.** `node codex-companion.mjs task --help` is not a help flag: it starts a real Codex task with the prompt `--help` (job `task-muybmyfp-ujw02o`). Each run costs ChatGPT Pro quota. The companion's `status --json` does not expose the model; the rollout does.
