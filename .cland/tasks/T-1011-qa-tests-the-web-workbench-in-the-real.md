---
id: T-1011
kind: task
title: QA tests the web workbench in the real browser through computer use
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:02:15.802Z
updated: 2026-10-20T17:06:48.283Z
---

## Summary

QA for the web workbench also tests in the human's real local browser through computer use (Codex gpt-6-astra), not only through playwright-core and headless Chromium. This is the human's directive of 2026-10-20. This ticket gives QA the surface, the brief template and the role wording, and proves the path works on this Mac or names the exact blocker.

## What to build

- A QA surface `real-browser` in `.agents/skills/qa/qa-record.sh`, `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill. A case on it is recorded with `note`, with screenshots under `.cland/qa/<item>/<run>/`.
- The `qa` skill's web section says:
  - how a QA session opens the `cland web` link in the human's default browser through computer use;
  - what it may touch: only the cland page and the browser's permission prompts for it;
  - that it closes the tab afterwards.
- The QA role clause and roles.toml launch defaults name the computer-use capable model for web briefs, if the clause needs it.
- A dry run from a launched QA session:
  - it opens a local page in the real browser through computer use, takes a screenshot and records it as a `real-browser` note;
  - or it names the exact blocker (harness refusal, macOS Screen Recording or Accessibility permission, browser profile) in the item topic, so the Coordinator can take it to the human.

## Acceptance criteria

- [ ] C1. `qa-record.sh note … real-browser …` records a line, and the surface check accepts `real-browser` (test).
- [ ] C2. `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill describe `real-browser` cases for web briefs: open through computer use, scope limited to the cland page and its permission prompts, close the tab, screenshot evidence.
- [ ] C3. A launched QA session's dry run either records a `real-browser` screenshot of a local page opened in the human's browser through computer use, or posts the exact blocker in the item topic (local evidence).
- [ ] C4. `cland qa lint` accepts a brief with a `real-browser` case (test).

## Comments

### coord · 2026-10-20T17:06:48.283Z

Brief addition (Coordinator, 2026-10-20): the real-browser QA session runs with the human's normal HOME and login keychain (not the sealed fixture environment) and a dedicated cland browser profile. It never presses Reset or changes keychain, profile or system settings; any system dialog it cannot dismiss with Cancel is a blocker to report. Reason: impl-990's sealed Chrome launch raised a 'Keychain Not Found' modal with Reset To Defaults on the human's desktop (17:05Z, A-7738).
