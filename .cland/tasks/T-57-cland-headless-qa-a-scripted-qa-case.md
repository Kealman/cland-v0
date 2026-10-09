---
id: T-57
kind: task
title: "cland --headless --qa: a scripted QA case drives a headless workbench and exits with its verdict"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-57
parent: T-20
blocked_by: []
topic: topic-14
branch: t/T-57-headless-qa-runner
created: 2026-10-09T08:33:53.699Z
updated: 2026-10-09T08:39:13.201Z
---

## Parent

Part of T-20 (slice 2, ticket 10 of 12). Spec sections 4.10 and 7(c); the qa-astra research. This is the ticket that frees QA from Codex sandbox approvals and from the headless gap found in T-42: it belongs to the first wave.

## What to build

`cland --headless --qa <case.lua> [--out <dir>]` runs one QA case in one Neovim process with no socket. It builds a fixture project in the temp dir from the case's fixture (items, roles, config): a case always runs against a fixture project with its own stdio hub or the stub hub, never the live project (decision D13). It then starts the standalone Neovim under its own app name, `--clean` with cland's init, headless, with a fixed 160×45 grid, pinned `TERM`, `LANG` and `TZ`, no `--listen` and no redraw timers. The hub is its stdio child (`cland hub serve --stdio --no-listen` on the fixture), or the stub hub with the case's scenario for sessions and states. The case runs inside Neovim through a Lua QA API: `keys` (over `nvim_input`), `wait_for(predicate, timeout)` (over `vim.wait`), `screen()` (over `screenstring()`), `state()` (a JSON snapshot of what the client knows: sessions and their states, roles, topics and their statuses, open asks, items), `expect(condition, message)`, and `dump(path)` (the grid as text and the state as JSON, also as `:Cland qa dump <path>` in any run). The run prints one JSON line (case, result PASS, FAIL, INCONCLUSIVE or BLOCKED, duration, build, evidence) and exits 0, 1 or 2. Without `--out`, the evidence is printed inline. Two cases ship, the epic's first scripted QA cases: `qa/cases/SHELL-001.lua` (General shows and a message goes `queued`) and `qa/cases/ITEMS-001.lua` (a fixture item in the items panel and its view).

## Acceptance criteria

- [ ] `cland --headless --qa qa/cases/SHELL-001.lua` exits 0 and prints one JSON line with `"result":"PASS"`; a case whose `expect` fails exits 1, with `"result":"FAIL"`, the expectation's message and a grid dump in `--out`.
- [ ] A `wait_for` timeout ends `INCONCLUSIVE` and a Lua error `BLOCKED`, both exiting 2 with the last screen dumped.
- [ ] Under `sandbox-exec` with the network denied, both cases pass; with file writes also denied outside the temp dir, both pass; a stub-hub case without `--out` passes with every file write denied, as in a read-only rescue run. The test skips with the reason where `sandbox-exec` is missing.
- [ ] `qa.state()` returns the stub scenario's sessions with their states, and the topics, asks and items the screen shows.
- [ ] The run reads no user configuration, never touches the live project's hub or tracker, and leaves no process behind.
- [ ] `npm run typecheck && npm test` pass; `nvim/README.md` documents the QA API and the case file.

## Notes

Test seam: `cland --headless --qa` as a process: exit codes, the JSON lines and the dump files, under `sandbox-exec` profiles (the edges tests are prior art); the stub hub's scenarios. Size L. Implementer: Claude Code, the one with the most context on the harness and the hub (the sandbox criteria need `sandbox-exec`, which does not nest inside a Codex sandbox, and driving Neovim from inside itself needs careful event-loop reasoning). Can start immediately.

## Comments

### coord · 2026-10-09T08:39:13.201Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/52 (a sub-issue of #20; the item is the source of truth).
