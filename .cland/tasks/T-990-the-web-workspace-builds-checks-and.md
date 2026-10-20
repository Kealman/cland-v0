---
id: T-990
kind: task
title: The web workspace builds, checks and holds the tokens
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: topic-752
branch: t/T-990-the-web-workspace-builds-checks-and
created: 2026-10-20T16:51:40.352Z
updated: 2026-10-20T16:55:07.292Z
---

## Summary

A `web/` workspace in React 19, Vite and TypeScript strict on the hub's flags builds into `web/dist` on `npm install` and in the verification pre-step. The canvas tokens are the only colour values, enforced by the typecheck, and the root `AGENTS.md` carries the rule for agents. The frame of the shell renders from static markup.

## What to build

- **The workspace.** The root `package.json` gets `"workspaces": ["hub", "web"]`. `web/package.json` (`@cland/web`, private) has `typecheck` and `build`. `web/tsconfig.json` takes the hub's strict flags plus `jsx: react-jsx`, the DOM libraries, `moduleResolution: bundler` and `types: ["vite/client"]`.
- **The checks.** The root `typecheck` runs the web's typecheck, with one hoisted TypeScript. The web's typecheck script also runs the colour check (a hex, `rgb()` or `hsl()` colour anywhere under `web/src` except `tokens.css` fails) and oxlint with the React hooks rules.
- **Styling.** CSS Modules on the tokens as custom properties, with the role colours of `nvim/lua/cland/hl.lua` and secondary text at 4.5:1 or better.
- **Fonts.** Golos Text and JetBrains Mono as woff2 subsets with Latin and Cyrillic under `web/public/fonts/`, with their OFL files.
- **The build.** The root `prepare` script builds `web/dist`, and so does the verification pre-step after the typecheck. `web/dist` is never committed.
- **The doctor.** A `cland doctor` row compares the bundle's build stamp with the sources.
- **Docs.** A `web/` section in the root `AGENTS.md` names one reference component to copy, and `web/README.md` covers the workspace, the build and the token rule.
- **The page.** The frame of the shell: the top strip, a rail of the seven area names, the main area, and the drawer closed.

## Acceptance criteria

- [ ] C1. `npm install` at the root builds `web/dist`, and `git status` shows `web/dist` ignored (local evidence from a clean worktree).
- [ ] C2. `npm run typecheck` runs the web's typecheck on the hub's strict flags plus the DOM libraries, and fails on a fixture with a hex, `rgb()` or `hsl()` colour under `web/src` outside `tokens.css` (lint test with fixtures).
- [ ] C3. oxlint with the React hooks rules runs in the web's typecheck script and fails on a fixture that breaks a hooks rule.
- [ ] C4. The verification pre-step builds `web/dist` after the typecheck (test of the prepare plan, or a local `cland verify` log).
- [ ] C5. The two fonts are served from `web/public/fonts/` as woff2 with Latin and Cyrillic and their OFL files, and a test finds no absolute external URL in the built `web/dist`.
- [ ] C6. `tokens.css` carries the canvas tokens with the role colours of `hl.lua`, and a unit test reads every text token at 4.5:1 or better on the ground and on the selection background.
- [ ] C7. The root `AGENTS.md` has a `web/` section: CSS Modules and `var(--token)` only, no UI library, no new dependency without the human, no explanatory prose, keys only through the one key map, and the reference component to copy.
- [ ] C8. `cland doctor` shows a row comparing the bundle's build stamp with the web sources, which reads stale when a source is newer (doctor test).
- [ ] C9. The added dependencies are exactly those the approved plan lists, with no UI library and no Tailwind (diff of `package.json`).
- [ ] C10. `web/README.md` describes the workspace, the build and the token rule.
