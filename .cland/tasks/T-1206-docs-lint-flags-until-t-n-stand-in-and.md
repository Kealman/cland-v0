---
id: T-1206
kind: task
title: Docs lint flags 'until T-n', 'stand-in' and 'pending' wording that names a closed item
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-999
branch: t/T-1206-docs-lint-flags-until-t-n-stand-in-and
created: 2026-10-24T06:46:05.445Z
updated: 2026-10-24T20:56:42.502Z
---

## Summary

README sentences claiming landed work was pending or a stand-in recurred as QA findings across v0.2 stages (T-1160, T-1164, T-1180). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. The lint reports each README or docs line that names a closed item with 'until', 'stand-in', 'pending' or 'later ticket' wording, over a fixture tracker (test).
  - done: impl-1206 · 2026-10-24T20:56:36.086Z
- [x] C2. The current READMEs pass, or each finding is fixed in this item (docs).
  - done: impl-1206 · 2026-10-24T20:56:36.186Z

## Comments

### impl-1206 · 2026-10-24T20:51:45.180Z

Implementation seam: T0 in-memory fixture tracker/documents through the lint's diagnostic function, then the same guard against repository Markdown. It catches same-line closed-item references with until/stand-in/pending/later ticket wording; it is a lexical drift warning, not semantic proof about unrelated clauses. Cheapest adequate tier is T0 (no worker, sockets, process or waits). No existing shared protocol/schema/policy contract changes; new lint admission is scoped to npm test:static/check. Consumer audit before wiring: package.json test:static -> test:lint -> check; .cland/config.toml verification.check; hub/test/run-suite.ts checks; hub/README.md verification docs; docs/agents/tests.md; implement skill (no CLI/native/client wire changes).

### impl-1206 · 2026-10-24T20:55:53.716Z

TDD evidence (local macOS arm64, Node v24.21.0; working tree before source review): initial exact-diagnostic fixture failed with actual [] vs five README/docs findings, then passed. Exemption slice failed on two unwanted findings, then passed; inline-exemption scope failed with actual [] vs README.md:2, then passed. Prefix/alias slice failed with actual [] vs E-90004/T-90004 findings, then passed. Current guard scans 224 documents / 1259 candidate tracker items with zero findings after replacing the obsolete main-until-T-59 override and adding specific historical/runtime exemptions. npm run typecheck passed all configured projects plus web source/colour/hooks checks. No runtime tiers or browser phase run locally; source guard only. Consumers: test:static/test:lint/check pick up the new gate by package script; verification.check already invokes check; no protocol/wire/schema/persisted shape migration. Docs/help/implement skill updated; role permissions/clauses unchanged.
