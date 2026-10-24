---
id: T-783
kind: task
title: "Docs pass: check the site against the shipped behaviour"
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by:
  - T-779
  - T-780
  - T-781
  - Q-782
  - E-611
  - E-612
  - E-613
  - E-614
  - E-615
  - E-616
  - E-415
  - E-418
  - E-419
topic: topic-953
branch: t/T-783-docs-pass-check-the-site-against-the
created: 2026-10-18T06:04:23.644Z
updated: 2026-10-24T10:01:02.822Z
---

## Summary

The eleven docs pages under `site/src/content/docs/docs/` were written before the features they describe shipped, partly from specs and partly by inference. Each page needs a pass against the shipped behaviour before promotion starts.

## What to check

Every command, flag, key and default the pages name. These were guessed and need checking first:

- `[web]` keys `bind` and `url`, and `cland web --qr`.
- The `[verification]` keys `prepare`, `check` and `test`, and the order `cland verify` runs them in; `cland verify --report general`.
- Codex `model = ""`, the effort values, and the Codex sandbox defaults: the docs follow the v0.1.4 spec (Implementer `workspace-write`), the code defaults to `danger-full-access`.
- The product default numbers in the docs (`daily_spend_usd = 5`, `remote_budget = 4`, …).
- `permissions = "auto"` for Claude Code roles, and `cland role launch`.
- The XL size refusal and `cland task import-github` defaulting to `origin`.
- The install and uninstall paths, the user state directories and the Neovim cache location.

## Acceptance criteria

- [x] C1. Every docs page is read against the shipped release and every wrong statement is corrected
  - done: impl-783 · 2026-10-24T10:00:17.216Z
- [x] C2. Each command shown in a code block runs as shown on a fresh project
  - done: impl-783 · 2026-10-24T10:00:17.716Z
- [x] C3. The landing's claims (crew section, features, FAQ) are checked the same way
  - done: impl-783 · 2026-10-24T10:00:18.481Z

## Comments

### impl-783 · 2026-10-24T10:00:41.927Z

Documentation audit committed/pushed at d843b1d869d192b7a5db74b5d4464877c463c705 (branch t/T-783-docs-pass-check-the-site-against-the), dev baseline 86449530. All 15 pages + README + landing read; 171 claim rows and 60 syntax-checked shell blocks. A-10709 contains the table, actual isolated CLI receipts, and final root/site build logs. macOS arm64 local npm run check passes (test lint report-only: 133 existing findings/60 files, zero refusals); Astro builds 23 pages with existing i18n/404 warnings. C2 external execution exceptions explicitly accepted by Coordinator decision ae3f5d65 in topic-953 and listed in the table. QA scope none. No suite receipt claimed: verify submission paused for Coordinator hub restart.
