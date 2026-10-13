---
id: T-21
kind: task
title: Repository skeleton and the BCAS hub core extracted
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: E-19
blocked_by: []
topic: null
branch: null
created: 2026-10-08T11:53:09Z
updated: 2026-10-10T00:58:17.316Z
github:
  repo: Kealman/cland-v0
  number: 21
  url: https://github.com/Kealman/cland-v0/issues/21
---

## Parent

Part of #19 (Epic: cland v0 slice 1, the daily driver). Spec: `docs/spec/v0.md` sections 4.2 and 6; ADR 0003; research `docs/research/bcas-hub.md` on branch `research/bcas-hub`.

## What to build

The repository takes the layout decided in the spec (`hub/` for the TypeScript hub, adapters and the `cland` CLI; `nvim/` for the Lua UI and the standalone build; `skills/`; `docs/`), and `hub/` receives the reusable core of the BCAS driver hub, stripped of everything BCAS-specific: the per-session MCP spoke with its WebSocket hub-client (reconnect, same-session takeover, exit on stdin close), the versioned hello / welcome / result / deliver protocol, the SQLite store with additive migrations and per-addressee store-and-forward, hygiene (size cap, rate limit, loop breaker), the address grammar, the JSON-lines log, and the test harness that drives a real spoke over MCP and a real hub over WebSocket. Discord, the evidence CLI, boards, slots, the SRE flow, the committed secret and the prose protocol documents are not carried over. A `cland` CLI entry point exists and prints its version. This is the prefactoring step: it makes every later ticket a small change.

## Acceptance criteria

- [ ] `hub/` builds with Node 24 and TypeScript by type stripping (no build step) and its test suite passes, driving a real spoke and a real hub as BCAS did
- [ ] No reference to Discord, evidence, boards, slots, SRE or BCAS owner names remains in `hub/`
- [ ] `cland --version` prints a version from the repo root
- [ ] `docs/` gains a short `hub/README.md` or equivalent note describing the extracted modules and what was dropped, with a pointer to the BCAS research
- [ ] Nothing in the repo contains machine paths or secrets

## Comments

### Kealman · 2026-10-08T12:28:26Z

<!-- github-comment: 6059861679 -->

Done on main in commits 073af01..11ab311 (hub/ skeleton, extracted spoke, protocol, store, hygiene, harness; cland --version; docs/hub-extraction.md). Codex review (gpt-6.1-sol) found 2 P1 / 4 P2 (name reuse of offline sessions, delivered-before-accepted, stale-socket dispatch after takeover, hygiene keyed by mutable name, history filter after limit, no request deadline); fixes land in a follow-up commit series before #23.
