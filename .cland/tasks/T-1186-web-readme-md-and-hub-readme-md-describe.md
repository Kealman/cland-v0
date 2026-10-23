---
id: T-1186
kind: task
title: web/README.md and hub/README.md describe the web workbench as built, from a fresh clone to a signed-in browser
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-420
blocked_by: []
topic: topic-920
branch: t/T-1186-web-readme-md-and-hub-readme-md-describe
created: 2026-10-23T21:24:13.481Z
updated: 2026-10-23T21:29:06.598Z
---

## Summary

E-420's C3 needs `web/README.md`, with its tunnel guide, and `hub/README.md` to describe the web workbench as built. A fresh clone must reach a signed-in browser by following them. Four epics changed these files in parallel, so read both end to end against the code at dev and fix what is stale, contradictory or missing.

## What to build

- **The read.** Read `web/README.md` and `hub/README.md`'s web edge sections against dev: the areas, keys, phone frame, notifications, install, tunnel guide, `cland web` options and `[web]` config.
- **The fixes.** Fix every statement the code contradicts. Remove "not yet" and "later ticket" sentences for work that has landed. Make sure the getting-started path, from a fresh clone through `npm install`, `npm run build`, `cland hub start` and `cland web`, is written once and in order.
- **The record.** List each change in the commit message.

## Acceptance criteria

- [ ] C1. A sealed test follows the getting-started commands in `web/README.md` in a scratch clone, without starting a real browser, up to a minted `cland web --no-open` link that signs a Headless Shell context in (Web test).
- [ ] C2. `web/README.md` and `hub/README.md` contain no "not yet", "later ticket", "stand-in" or "pending" sentence about a landed feature, as a grep in the test asserts (test).
- [ ] C3. Every `cland web` option and `[web]` key the code accepts is described in `hub/README.md`, and every one described is accepted (test).

## Comments

### impl-1186 · 2026-10-23T21:29:06.598Z

Read C1–C3 and E-420 C3; test seams are supplied in the assignment. Root install linked. Source audit and first T1 parser/config guards prepared before README edits. Local tests wait for the stage cover/QA reservation to end; no passing or red-run claim yet. Audit artifact posted in the item topic.
