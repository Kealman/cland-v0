---
id: T-46
kind: task
title: "OpenCode: a deprecated default free model fails every turn, and the failure is silent"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T19:09:47.340Z
updated: 2026-10-08T19:14:43.628Z
---

## Parent

Part of T-19. Found in the T-42 dogfooding run on 2026-10-08: the Implementer `impl-43` was launched for T-43 with no model, and the OpenCode adapter picked `opencode/exo-free`, the first free OpenCode Zen model `GET /api/model` listed (`status: active`). Every turn failed upstream (`Upstream request failed: Endpoint is unavailable`; `opencode run -m opencode/exo-free` says `Model exo-free has been deprecated`). The session went `idle` after the failed turn, and nothing told the Coordinator or the human: the Coordinator waited for a report that never came.

Workaround in this repo: `.cland/roles.toml` pins the Implementer to `opencode/big-pickle`.

## What to build

- **A failed turn is not silent.** When OpenCode reports `session.execution.failed` (or a turn ends with an error), the hub records an Agents notice and an inbox notification naming the session and the error's first line (`impl-43 [Implementer]: its turn failed: Upstream request failed: Endpoint is unavailable`), and the session that sent the turn's message (the Coordinator here) gets a hub note. Same shape for Codex (`turn/completed` with an error) and Claude Code (`StopFailure`) where the adapter sees it.
- **The default free model is one that answers.** `pickFreeModel` (`hub/src/adapters/opencode/client.ts`) prefers a known-good list (`opencode/big-pickle` first) before the first listed one, or the launch probes the picked model with one cheap request and falls back to the next on failure. Pick one; say which in `hub/README.md`.

## Acceptance criteria

- [ ] A fake OpenCode whose turn fails produces the Agents notice, the inbox notification and the hub note to the sender (test in `hub/test/opencode-adapter.test.ts`)
- [ ] A launch without a model does not pick a model the server lists but that fails (test against the fake server)
- [ ] `hub/README.md` documents both
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.628Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/45 (filed during the T-42 run; the numbers differ, the item is the source of truth).
