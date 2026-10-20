---
id: T-990
kind: task
title: The web workspace builds, checks and holds the tokens
state: open
status: review
size: M
criterion_seq: 10
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: topic-752
branch: t/T-990-the-web-workspace-builds-checks-and
created: 2026-10-20T16:51:40.352Z
updated: 2026-10-20T17:21:29.407Z
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

- [x] C1. `npm install` at the root builds `web/dist`, and `git status` shows `web/dist` ignored (local evidence from a clean worktree).
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.538Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:23.680Z
- [x] C2. `npm run typecheck` runs the web's typecheck on the hub's strict flags plus the DOM libraries, and fails on a fixture with a hex, `rgb()` or `hsl()` colour under `web/src` outside `tokens.css` (lint test with fixtures).
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:24.301Z
- [x] C3. oxlint with the React hooks rules runs in the web's typecheck script and fails on a fixture that breaks a hooks rule.
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:24.819Z
- [x] C4. The verification pre-step builds `web/dist` after the typecheck (test of the prepare plan, or a local `cland verify` log).
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:25.444Z
- [x] C5. The two fonts are served from `web/public/fonts/` as woff2 with Latin and Cyrillic and their OFL files, and a test finds no absolute external URL in the built `web/dist`.
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:25.959Z
- [x] C6. `tokens.css` carries the canvas tokens with the role colours of `hl.lua`, and a unit test reads every text token at 4.5:1 or better on the ground and on the selection background.
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:26.591Z
- [x] C7. The root `AGENTS.md` has a `web/` section: CSS Modules and `var(--token)` only, no UI library, no new dependency without the human, no explanatory prose, keys only through the one key map, and the reference component to copy.
  - verified: rev-23 [reviewer] · run rev-20261020-990-source · 2026-10-20T17:10:25.615Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:27.117Z
- [x] C8. `cland doctor` shows a row comparing the bundle's build stamp with the web sources, which reads stale when a source is newer (doctor test).
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:27.741Z
- [x] C9. The added dependencies are exactly those the approved plan lists, with no UI library and no Tailwind (diff of `package.json`).
  - verified: rev-23 [reviewer] · run rev-20261020-990-source · 2026-10-20T17:10:25.615Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:28.265Z
- [x] C10. `web/README.md` describes the workspace, the build and the token rule.
  - verified: rev-23 [reviewer] · run rev-20261020-990-source · 2026-10-20T17:10:25.615Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - verified: rev-23 [reviewer] · run rev-20261020-990-final · 2026-10-20T17:19:16.539Z · commit b1606b2194b5bd37d90984f1dde92c33c3be4e01
  - done: impl-990 · 2026-10-20T17:21:28.886Z

## Comments

### impl-990 · 2026-10-20T17:00:19.242Z

Colour guard and AGENTS web rule committed first (a56bf505), before any component. Implementing the static prototype frame only; approved E-415 comment removes the development bridge. Root check now plans typecheck → web build → static/test lint, so the required verification build also occurs locally (remote verification.prepare is not run locally). Added a deterministic T1 installed-bundle doctor test and T0 colour/hooks/contrast/build-plan fixtures. Local implementation checks are in progress; no suite receipt claimed.

### rev-23 · 2026-10-20T17:10:25.615Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-990-source
commit: b1606b2194b5bd37d90984f1dde92c33c3be4e01
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Strict web workspace/token/hooks/contrast guards, build order/stamp/doctor and static shell reviewed. C7 agent rule, C9 approved dependencies (no existing lock versions changed), C10 docs established; matching help/implement provenance retained. C5 follows direct Coordinator c4052a45 resource-target interpretation. A-7736 exact-head clean-clone local install/check/doctor/colour failures supplemental. Withdrawn A-7737/A-7738 excluded; replacement Headless Shell A-7741/A-7742 viewed and records five same-origin requests, no queued Web-phase claim. Remaining C1–C6/C8 final settlement awaits mode-free same-head gate with local evidence. QA after-stage; Reviewer ran no tests/browser.

Criteria: C7 verified, C9 verified, C10 verified.

### rev-23 · 2026-10-20T17:19:16.539Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-990-final
commit: b1606b2194b5bd37d90984f1dde92c33c3be4e01
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Exact-head A-7775/run 073a343d audited: Linux droplet 2063 ordinary tests / 328 files all pass; T1 and all-T2 fallback including Neovim, doctor regression actual 5/5 load passes. Log establishes strict web typecheck/colour/hooks/23-token contrast guards, post-typecheck Vite build and T0 plan check; build invokes resource/font validation under Coordinator c4052a45 interpretation. A-7736 supplies exact-head clean-clone install/ignored dist and actual colour negative controls; replacement isolated Headless Shell A-7741/A-7742 remains separate local manual evidence. Withdrawn A-7737/A-7738 excluded. C1–C10 verified with source A-7752; audit A-7776. Host gate 3c0a99ec not repeated remotely; existing lint/budgets report-only; T3/T4/integrated and queued Web phase not claimed. Lifetime 430s, estimated $0.0299. Reviewer ran no tests/browser; after-stage QA unchanged.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified, C10 verified.
