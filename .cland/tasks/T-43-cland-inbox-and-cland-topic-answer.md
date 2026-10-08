---
id: T-43
kind: task
title: "cland inbox and cland topic answer: answer an ask from the CLI"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T18:56:39.124Z
updated: 2026-10-08T18:56:39.124Z
---

## Parent

Part of T-19. The open point of T-33 (#33): "no `cland topic answer` CLI". Found while preparing T-42 (dogfooding): the human can answer an ask only from the Neovim inbox; a terminal without the workbench, a script or an agent acting for the human cannot.

## What to build

Two CLI commands in `hub/src/cli/` over the hub's existing UI frames (`inbox.list`, `topic.answer`, see `hub/README.md`, "Asks and the inbox"), wired into `hub/bin/cland.ts` and its usage text like `cland role` (`hub/src/cli/role.ts` is the pattern: `readDiscovery`, `askHubFrame`, `--json`):

- `cland inbox [--json]`: prints the open asks, one block each: the ask id, the topic title (and its bound item when there is one), the asker's label, then the question and the numbered options (`1. …`); then one line per approval, waiting topic and notification; last, `needs you: <n>`. `--json` prints the `Inbox` value as the hub returns it.
- `cland topic answer <ask id> <option number>` or `cland topic answer <ask id> --text "<free answer>"`: sends `topic.answer` and prints `answered <ask id> in <topic title>: <the answer text>`. The hub's refusals (an ask that is not open, an option out of range, a free answer to an options-only ask) are printed as `cland: <error>` with exit code 1.

No hub change: both frames exist.

## Acceptance criteria

- [ ] `cland inbox` lists an open ask with its id, topic, asker, question and numbered options, and `needs you`; `--json` prints the hub's `Inbox`
- [ ] `cland topic answer <ask> 2` answers with option 2; the Coordinator's spoke receives the answer with `answer_to`, and the ask leaves `cland inbox`
- [ ] `cland topic answer <ask> --text "…"` sends a free answer; refusals from the hub exit 1 with the hub's message
- [ ] A test in `hub/test/` starts a real hub (`cland hub start` in a temporary project, as `daemon.test.ts` does), has a Coordinator spoke ask, and runs both commands as child processes
- [ ] `hub/README.md` documents both commands (the CLI table of "Asks and the inbox"), and its "Not here yet" line about `cland topic answer` is removed
- [ ] `npm run typecheck && npm test` pass
