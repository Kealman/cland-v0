---
id: E-415
kind: epic
title: The web workspace and the shell
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-783
branch: null
created: 2026-10-14T15:59:18.516Z
updated: 2026-10-21T18:07:36.316Z
closed: 2026-10-21T18:07:36.316Z
---

## Summary

A `web/` workspace in React 19, Vite and strict TypeScript, styled only through the canvas tokens, builds the web workbench's shell: the rail of seven areas, the top strip, a main area that splits, the drawer, the palette and keys matched by physical code. The suite gains its web phase in headless Chromium, and the human approves this epic's plan by hand because it sets the patterns of the whole web lane.

## Goal

The web lane gets its ground: a workspace that agents write well in, kept on the design's tokens, a shell that feels like the accepted boards, and a test phase that proves pages in a browser without slowing the suite. Today `dev` has no `web/` at all. The Q-405 prototype on `prototype/web-shell` showed the shell against the live hub through a read-only bridge (first paint in 250 ms, a frame to the screen in 2.5 ms), and the Q-402 probe measured the stack: 22 packages, a bundle of about 70 kB gzipped, and a browser test at 2.75 s of wall time, 0.2 s of it the test itself.

## Contents

- **§3.7 The workspace.** React 19 with Vite and TypeScript strict on the hub's own flags; CSS Modules on the canvas tokens as custom properties; no UI library; an `AGENTS.md` rule and a check against hex colours keep agents on the tokens; Golos Text and JetBrains Mono self-hosted; the wire types imported from the leaf module of E-412.
- **§3.7 The web phase of the suite.** Its own machine-locked shard after the hub phase, on `node:test` with `playwright-core` and the headless shell, selected only for `web/**` or protocol changes, with the fixtures from the stack research.
- **§3.2 The shell**, as the accepted boards draw it (P1 to P11):
  - **The rail** of seven areas (Inbox, Items, Sessions, Topics, Events, Artifacts, Accounts) as words, with counts only where something asks for attention; it collapses to a 60 px column of icons with badges, by its button, below 1280 px and while the main area is split.
  - **The top strip:** the project, the release switcher, the palette on ⌘K, the Coordinator's chip, the needs-you pill and the hub's live dot, with `?`; the needs-you count also in the tab title (§3.6).
  - **The main area** splits into two panes on ⌘\; the panes swap and close, the divider drags (2:1 by default), and the drawer stays closed while split.
  - **The drawer** on the right holds the card or a thread, with Split and Close, and stays closed when nothing is selected.
  - **The palette** on ⌘K and Space p, with the prefixes `>` actions, `#` items, `@` sessions, `~` artifacts and `/` topics, each action showing its key; Enter opens, ⌘Enter opens in a pane, Tab changes the kind, Esc closes.
  - **Keys** as in Neovim where they fit, matched by `KeyboardEvent.code` so the Russian layout works; `?` shows the keys of the area.
  - **Focus and hover** (P4): the keyboard cursor is the focus, a 2 px blue ring on the selection background; hover only lightens a row.
  - **Folds:** every group and block folds with a chevron and the keyboard, and its state is remembered per client in the browser's own state.
  - **No explanatory prose:** headers carry a name and a count, rows carry facts, and what a block means lives behind `?`, in tooltips and in the docs.
  - **Type and colour** (P3 and the visual vocabulary): Golos Text for prose, JetBrains Mono for ids, code and data, sentence-case headings, ids that never wrap at the hyphen, the role colours of `hl.lua`, and secondary text at 4.5:1 or better.

Not in this epic: the areas' contents (E-416 to E-418); the phone's layouts (E-419); the hub's edge (E-412), which serves this bundle once it lands.

Choices where the spec is silent:

- **The monorepo.** The root `package.json` gets `"workspaces": ["hub", "web"]`; `web/package.json` (`@cland/web`, private) has `typecheck` and `build`; the root `typecheck` runs the web's too, with one hoisted TypeScript. `web/tsconfig.json` takes the hub's strict flags plus `jsx: react-jsx`, the DOM libraries, `moduleResolution: bundler` and `types: ["vite/client"]`.
- **The wire types.** Until the leaf module of E-412 lands, the prototype's copy in `web/src/wire.ts` stands in, marked as temporary, and it goes when the module arrives.
- **`web/dist`** is built by the root `prepare` script, so `npm install` produces it, and again in the verification pre-step after the typecheck; it is never committed. A `cland doctor` row compares the bundle's build stamp with the sources.
- **The tokens.** `web/src/tokens.css` is the only file with colour values. The check runs in the web's typecheck script and fails on a hex, `rgb()` or `hsl()` colour in any other file under `web/src`.
- **The rule for agents.** A `web/` section in the root `AGENTS.md`: CSS Modules and `var(--token)` only, no UI library, no new dependency without the human, no explanatory prose, keys only through the one key map, and one reference component to copy.
- **Lint.** oxlint with the React hooks rules (two packages, about 0.2 s) runs in the web's typecheck script; ESLint is not used. The plan names it, so the human's approval decides it.
- **The fonts.** woff2 subsets with Latin and Cyrillic under `web/public/fonts/`, with their OFL licence files; no request leaves the origin.
- **Until the edge.** The prototype's bridge is ported as `web/dev/bridge.ts`, a development stand-in with its read-only allowlist and its tests that opens the hub's Unix socket as the human's client; the web phase's fixtures use it. When the edge of E-412 serves the bundle, the shell and the fixtures move to the edge and the bridge goes: in this epic if E-412 lands first, otherwise as the first slice of E-416.
- **The development loop** is `vite build --watch` and a reload, with no Vite dev server, so the edge's Origin check never needs a second origin.
- **The interface state** (folds, the rail, the split, the release switcher's pick) lives in `localStorage` under one versioned key per area, every read and write guarded, and the page works without it. None of it goes to the hub, and `ui.json` stays Neovim's.
- **The key map.** One table keyed by `KeyboardEvent.code` and modifiers, from which `?` and the palette show the keys. The browser's reserved chords (⌘T, ⌘W, ⌘N, ⌘⇧T) are never bound. Esc closes a sheet, the palette, a field or the drawer and never answers anything.
- **The web phase.** A `Web` shard after the hub phase with resource `machine`, two workers locally and four on a droplet; a `web-only` selection mode for diffs inside `web/**`, which runs the web phase with the hub's and Neovim's smoke files; the protocol and edge files keep forcing `full`; one web smoke file joins the other modes' smoke; a budget of 40 seconds on a full run.
- **The fixtures.** `web/dist` built once per run; a scratch hub per test file through the hub harness; a one-time link minted by a frame; a browser per file and a fresh context per test, closed explicitly; a `Notification` stub through an init script; a trace saved on a failure; short `TMPDIR` paths. The waiting helpers poll through `page.evaluate`, since the strict CSP blocks `waitForFunction`.
- **Droplets.** The prepared executor snapshot carries Chrome Headless Shell and its Linux libraries, keyed by the lock file, so the web phase runs on the remote executors (D28 of v0.1 §4).

## Tracer-bullet order

1. **The workspace and the frame of the shell.** `web/` builds and typechecks on the hub's flags with the tokens, the self-hosted fonts, the `AGENTS.md` rule and the hex check, and the frame of the shell opens through the development bridge. Demo: the typecheck fails on a hex colour added to a component and passes without it, and the shell opens through the bridge's link with no request leaving the origin.
2. **The web phase.** The `Web` shard on `node:test` with `playwright-core` and the headless shell, its fixtures, the `web-only` selection and the droplet image. Demo: `cland verify` on a web-only diff runs the web phase with the hub and Neovim smoke files and reports it as its own shard.
3. **The rail and the top strip.** The seven areas with their counts, the collapse to icons and its memory, the top strip with the release switcher, the Coordinator, the needs-you pill and the tab title, and the areas on keys matched by physical code. Demo: `1` to `7` switch the areas with the Russian layout active, and the collapsed rail survives a reload.
4. **The split and the drawer.** ⌘\ with Swap, Close and the divider; the drawer with Split and Close, closed when nothing is selected and while split. Demo: ⌘\ splits the main area, Swap swaps the panes, and the drawer stays closed until the split closes and a row is selected.
5. **The palette and the keys.** ⌘K and Space p with the five prefixes over the snapshot's objects and the actions with their keys, and `?` listing the area's keys. Demo: ⌘K with `@` lists the sessions, `>` lists the actions with their keys, and Esc closes the palette without acting.
6. **Folds and the move to the edge.** The fold component remembered per client, and the shell served by the edge of E-412 once it is on `dev`. Demo: a folded group stays folded after a reload, and with E-412 on `dev` `cland web` opens the same shell.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and headless Chromium (Chrome Headless Shell through `playwright-core`, keys sent with their physical codes, the screen read from the DOM), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, QA runs `npm install` and reads `web/dist` built, then `npm run typecheck` with a hex colour added to a component and reads the failure. QA opens the shell at 1440x900 through `cland web` when the edge of E-412 is on `dev`, otherwise through the development bridge's link. QA reads the rail's seven areas, switches them on `1` to `7` with the Russian layout active, collapses the rail, reloads and finds it collapsed, and narrows the window below 1280 px to see it collapse by itself. ⌘\ splits the main area, Swap and Close work, and the drawer stays closed while split. ⌘K opens the palette with each of the five prefixes, `?` lists the keys, and Esc closes without acting. A folded group stays folded across a reload. No request leaves the origin, and no element carries a sentence of explanation. `cland verify` on a web-only change runs the web phase as its own shard. On the live tracker, `cland task plan show` on this epic reads approved by the human.

- [ ] C1. The `web/` workspace builds into `web/dist` with React 19, Vite and TypeScript strict on the hub's flags, CSS Modules on the tokens, no UI library and the two fonts self-hosted; `npm install` and the verification pre-step build it.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.253Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C2. The root `AGENTS.md` carries the rule for `web/`, and the typecheck fails on a colour value outside `web/src/tokens.css`.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.253Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C3. The rail lists the seven areas and collapses to icons by its button, below 1280 px and while split, remembering the choice; the top strip shows the release switcher, the palette, the Coordinator, the needs-you pill and the hub's dot, and the tab title carries the needs-you count.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.253Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C4. ⌘\ splits the main area into two panes that swap and close; the drawer has Split and Close and stays closed when nothing is selected and while split.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.254Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C5. The palette opens on ⌘K and Space p with the five prefixes and each action's key, `?` lists the keys, every key matches by `KeyboardEvent.code` and works in the Russian layout, and Esc never answers anything.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.254Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C6. Every group and block folds with a chevron and the keyboard and is remembered per client, and the interface carries no explanatory prose.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.254Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C7. The web phase runs as its own machine-locked shard after the hub phase on `node:test` with `playwright-core` and the headless shell, selected for `web/**` and protocol changes, locally and on droplets.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.254Z · commit 128444a096311143e706fb8d36a19ac9916f492f
- [ ] C8. `web/README.md` describes the workspace, the build, the tests, the token rule and the shell's keys.
  - verified: qa-676 [qa] · run qa-dod-2026-10-21-1 · 2026-10-21T18:07:03.254Z · commit 128444a096311143e706fb8d36a19ac9916f492f

## Dogfooding

The human opens the shell from its first slice beside Neovim, through the bridge and then `cland web`, and reacts to its feel before E-416 builds the areas on it. The plan of this epic waits for the human's approval, as §4 decided, because its choices (the workspace, the token rule, the lint, the key map, the test phase) set the patterns for every later web epic.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Plan approval.** `[plan] approval` stays `none` project-wide. The Coordinator writes this epic's plan with the `plan-epic` skill, asks the human to approve it in the plan view, and launches nothing under this epic until `cland task plan show` reads it approved by the human.
- **Precedence.** The spec's words; then the prototype's behaviour (`web/PROTOTYPE.md` and `web/src/` on `prototype/web-shell`: the shell, the keys, the palette, its choices marked `// choice:`), ported slice by slice and never merged; then the boards, for visual intent.
- **Prior art.** No browser-reserved chords, no letter keys bound to characters, no Esc as a decision key, no irreversible layout switch, and no state of the web's own beyond its interface (`docs/research/web-prior-art.md` §7.1).
- **Risks.** Both vendors steer their models to Tailwind and shadcn/ui, so the rule and the check matter from the first commit. Focus handling in the palette and the split panes is where hand-written components fail, so keyboard paths get browser tests. Whether a Codex Implementer's sandbox can launch Chromium is untested; if it cannot, its web tests run through `cland verify` only. The fixtures must close their browsers, which lead their own process groups.
- **Size.** About six sessions on the v0 scale.
- **Order.** First in the web lane, with no blocker; E-416 waits for it.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.2, §3.6 (the tab title), §3.7 and §4; `docs/spec/v0.1.md` §3.11 (the palette) and §3.12 (keys and layouts).
- Map M-399 and the tickets this epic absorbs: Q-401 (keys and the palette in prior art), Q-402 (the stack and the seams), Q-404 (the shell's boards), Q-405 (the prototype).
- Research: `research/web-stack` (`docs/research/web-stack.md` §1 and §3, the probe in `docs/research/web-stack/probe/`); `research/web-prior-art` (`docs/research/web-prior-art.md` §6 and §7.1).
- Prototype: `prototype/web-shell` (`web/PROTOTYPE.md`; `web/proto/bridge.ts`; `web/src/App.tsx`, `Palette.tsx`, `KeysHelp.tsx`, `keys.ts`, `ui.ts`, `tokens.css`, `Shell.module.css`).
- Mockups: `docs/design/web/README.md` and `Main.dc.html` (P1 to P9), `Thread.dc.html` (P10, P11); `screens/v02-main.png`; the canvas https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6 (version 9).
- GLOSSARY: Web workbench, Rail, Drawer, Palette.

## Plan

```yaml
stages:
  - name: the ground
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-990
        - T-1025
        - T-991
  - name: the connection, the rail and the droplets
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-992
        - T-994
      - - T-993
      - - T-1011
  - name: split, palette and folds
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-995
        - T-996
        - T-997
```

## Comments

### coord · 2026-10-20T16:54:38.328Z

Plan approved by the human, 2026-10-20 16:54Z (ask 310190bf option 1, typed by the human in cland-impl's terminal; decision page A-7719). (a) The plan as set: no development bridge, the shell uses E-412's edge from the start. Approved dependencies: react 19, react-dom, vite, @vitejs/plugin-react, @types/react, @types/react-dom, oxlint, playwright-core with the Chrome Headless Shell it downloads (tests only), Golos Text and JetBrains Mono woff2 vendored with OFL, E-412's QR encoder vendored with MIT. No UI library, no Tailwind. (b) Browser-test tier: a separate Web phase outside T0-T3, selected when a diff touches web/** or the protocol and edge files; it runs in that task's own cland verify (so browser criteria are checkable before enqueue), not in T1 merge batches, and always in periodic dev T3, stage, release and integrated runs; budget 4 s a test, 40 s for the phase.

### coord · 2026-10-20T17:06:48.136Z

Crew browser rule (Coordinator, 2026-10-20 17:06Z, after impl-990's run raised a macOS 'Keychain Not Found' modal on the human's desktop, A-7738): Implementers and Reviewers never launch the human's real Chrome, Safari or default profile. Browser checks use Chrome Headless Shell or Chrome for Testing headless, with its own --user-data-dir under the worktree or a scratch temp dir, killed at the end. No GUI process starts from a crew session unless a brief explicitly foresees it. Only QA (T-1011) touches the real browser, through computer use, with the human's normal environment and a dedicated cland profile, and it never resets or changes keychain, profile or system settings.

### qa-676 · 2026-10-21T09:33:06.714Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-1
commit: 479178b25c78ccbb54f908ef7cc7c05c18426cd0
stage: the ground
stage_hash: 0035804adb5fce026489e5f185f5db05705be8099e0e60bf6778e78067b5454f
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Surface | Result | Evidence/observation |
| --- | --- | --- | --- |
| S0 | local macOS CLI | PASS | Clean detached HEAD and dev 479178b25c78ccbb54f908ef7cc7c05c18426cd0; all three item merges present; scratch HOME/XDG/Git, filtered credentials, system TMPDIR. |
| M1 | CLI | PASS | npm install exit 0; prepare built index.html/build-stamp.json; dist ignored; tree clean. |
| M2 | CLI | PASS | Control exit 0; CSS and TSX plants each exit 1 at exact line; plants removed. |
| M3 | CLI | PASS | Hooks control exit 0; conditional-hook plant rejected with rules-of-hooks; removed. |
| M4 | Headless Shell via node:test | PASS | 4/4 including subtests, zero skips; external browser census 0→0; fixture group 80461 after 0; scratch hub stopped. |
| M5 | CLI tests | PASS | Web-only selection and hub-plus-Neovim smoke tests: 1/1 each, zero skips. |
| M6 | CLI tests | PASS | Web planner file 8/8, zero skips; enforced 4-second Web budget contract tested. |
| M7 | CLI tests | PASS | Missing-browser unavailable receipt contract 1/1, zero skips. |
| M8 | CLI | PASS | Workspace/tier lint exit 0; bundle doctor 1/1; both documentation headings present. |
| M9 | CLI | PASS | Root typecheck exit 0, no warnings/errors. |

Findings: no product failures. Low brief observation, M4: smoke.test.ts verifies the planted trace ZIP and then removes it explicitly, so the trace does not remain in test-results after the passing test. M4.txt retains the trace diagnostic and passing ZIP/context assertions. This satisfies failure-capture behavior; no missing product evidence.

Run qa-2026-10-21-1, stage “the ground”. Actual local macOS arm64, Node v24.21.0; Chrome Headless Shell 156.0.8078.4 (Playwright revision 1248), disposable profile. 16 targeted test executions passed, zero skips. No full suite submitted by QA. Requested covers: Linux 6773233c/A-8207 and macOS baaf13ec/A-8211; task.view confirms complete cover tree d026d0a84f0b25de15257e303002111bc247cbf1. Stage covers and their duration reports are outside this brief.

npm install recovered from two download-host DNS errors using its normal fallback and exited 0. No credential or GUI access. All command captures retained. Final HEAD/dev unchanged and tree clean; own process scan zero, scratch and detached worktree removed. No epic criterion marks.

Durable artifact A-8217: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8217-e-415-ground-stage-10-checks-pass-at-479178b2/report.md

### qa-676 · 2026-10-21T12:56:03.534Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-2
commit: cb231eeb0824d105824263535c5ee476fe5fc3f5
stage: the connection, the rail and the droplets
stage_hash: 0b6c3251be9c659a95df63d69b41d96f8cb43c6c464339b4f2cad35da576d8b8
findings: [{"severity":"low","text":"M10 storage grep expectation omitted T-989's sessionStorage reload guard in connection.ts:47–48. Approved scope is shell preference storage in interface-state.ts; all relevant guard/preference tests pass.","file":"qa/briefs/E-415-stage-2.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Check | Result | Command / observation |
| --- | --- | --- |
| S0 | PASS | Clean detached cb231eeb; all four merges present; isolated scratch HOME/XDG/Git with shared credential filter and system TMPDIR; expected files present. |
| M1 | PASS | Exact-source build exit0, stamp af90afe7, index/JS/CSS present and worktree clean. |
| M2 | PASS | Single-use link matches; auth302 HttpOnly SameSiteStrict Path/ MaxAge cookie, no Secure; jar1; reuse401; hub on loopback. |
| M3 | PASS | Served entry equals built entry; index/JS200 strict CSP, no unsafe tokens; immutable JS; anonymous bundle200; WS no cookie401, cookie101 (curl timeout28 expected). |
| M4 | PASS | Secret positive control1; all11 bundle files200; auth unknown401 and absentJS404; secret grep no matches exit1 across served resources/auth/headers/cookiejar. |
| M5 | PASS | Before stop101, stopped000, restarted49939 equals kept49939, persisted cookie WS101; curl timeout28 expected. |
| M6 | PASS | No local wire.ts/import; connection uses shared/wire; entry/cookie/backoff docs and targeted command match. |
| M7 | PASS | Connection file4/4 pass incl sign-in/secret confinement/reconnect, stale reload guard, protocol refusal; isolated Headless Shell census0->0. |
| M8 | PASS | Shell file7/7 pass incl all six rail/top-strip/navigation/storage/focus subtests; Headless Shell census0->0. |
| M9 | PASS | Smoke file4/4 pass incl CSP, origin confinement and intentional failure trace test; browser census0->0; worktree clean. |
| M10 | PASS | Keymap1/1 pass; listeners only keyboard.ts, codes only keymap.ts; preferences only interface-state.ts; T-989 sessionStorage reload guard accepted per d6d1d7bb (low brief correction). |
| M11 | PASS | CSS rail60px below1280 and collapsed; README keymap/storage/commands and tests.md match; tier classifications Web/Web/T1. |
| M12 | PASS | Prepare-key5/5 pass; provision shell syntax0;21 Headless Shell libraries precede useradd. Static/unit evidence only, no provider or apt actions. |
| M13 | PASS | Web worker planner1/1 pass (two local/four remote); prepare/restart/receipt docs match. |
| M14 | PASS | Scratch recorder accepts real-browser, writes one row with screenshot path; unknown surface exit64 writes none; targeted recorder test1/1 pass. Fixture png is synthetic; actual GUI case separately recorded. |
| M15 | PASS | Good surface lint0; unknown surface1 at line3; actual brief lint0; qa-lint-cli2/2 pass. |
| M16 | PASS | QA skill/templates describe dedicated-profile computer use, scoped page/prompts, screenshots/tab cleanup; lint docs/usage and authorized HTTP amendment present. Live unauthenticated page is request-specific; no live sign-in link minted. |
| M17 | PASS | Full typecheck/colour/contrast/hooks/oxlint exit0,0 warnings/errors. |
| WEB-REAL-001 | PASS | Computer use Chrome native cland QA profile: opened owned tab1158676367 at http://127.0.0.1:56935/; exact af90afe7 source stamps equal, HTTP200; screenshot shows cland/Workbench/Offline and seven named rail areas; no page interaction, no live authentication; closed only owned tab, original1158676307 remains. |

Low finding (brief only): M10, qa/briefs/E-415-stage-2.md, storage grep expectation predates T-989. Actual grep includes connection.ts:47–48 sessionStorage cland-reload-build as well as interface-state.ts's versioned preference localStorage. The former is the deliberate one-reload guard, not shell preference storage. Coordinator decision d6d1d7bb approves judging T-994 C6 against preference storage only. The guard and storage-denial tests pass; no product defect found.

Stage: the connection, the rail and the droplets. Run qa-2026-10-21-2, full tested SHA cb231eeb0824d105824263535c5ee476fe5fc3f5. All19 scoped checks PASS: S0, M1–M17 and WEB-REAL-001. No epic criterion marks.

Fresh local macOS arm64 execution, Node v24.21.0. Automated targeted tests: M7 connection4/4, M8 shell7/7, M9 smoke4/4, M10 keymap1/1, M12 prepare-key5/5, M13 worker planner1/1, M14 recorder1/1, M15 lint2/2; total25, zero failures/cancellations/skips/todo. Headless Shell revision1248 ran in isolated fixture profiles; browser process census was0 before/after each file and final scan0. Other fixture checks used disposable HOME/XDG/Git and shared credential filtering, system TMPDIR retained. Coordinator decision9cc8f008 clarifies cover-quiet means this Mac; local queue was empty before each serial file while the remote cover ran elsewhere. No full suite, droplet, provider, apt or prepare operation was run by QA. T-993 live droplet evidence belongs to the Coordinator and is outside this brief; budget lines are report-only/out of scope.

Actual real-browser case: CUA Chrome extension browser1, native window/profile button cland QA, normal browser environment. Opened one owned tab1158676367 at http://127.0.0.1:56935/, no page clicks/typing/keys. Live root and tested-worktree source stamps both af90afe76ff70b9c0607d8218af6f70ed89d3ca995bc282d2992f0884a9c9cb4; unauthenticated entry HTTP200. Screenshot shows the tested shell: cland, Workbench, Offline, seven named rail areas and top-strip controls. Offline is expected without a cookie; this case does not claim authenticated live connection. No live sign-in link or cookie session was created. Captured before/page/after PNGs, then closed only owned tab; original New Tab1158676307 remains. Before/after PNG bytes identical. No settings, keychain, permissions or profiles changed; no dialog/refusal occurred. M14's synthetic scratch recorder row is unit evidence only, distinct from this actual computer-use run.

All merges present: T-992158e188a, T-994e70309cd, T-993b65fb11b, T-1011102d592d. Final worktree clean and HEAD/dev unchanged at cb231eeb. Scratch hub stopped, own scratch/worktree process scan empty, scratch root and detached worktree removed. Final secret scan found0 matches; scratch auth bearer values redacted from published captures. The intentional failing-case trace test passed; its trace was verified/deleted by the harness, not retained as a real product failure.

Coordinator cover metadata initially reported missing Linux after hub restart#37 (T-1049). Coordinator has replacement117ca925 at this same SHA; closure/cover handling remains the Coordinator's. This verdict reports scoped execution and does not replace or assert a new full-suite receipt.

Durable evidence A-8388: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8388-e-415-stage-2-19-checks-pass-real-chrome-shell-at-cb231eeb/report.md

### qa-676 · 2026-10-21T17:30:16.431Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s3-2026-10-21-1
commit: dbb1604fd8ab9f21a4f1a5858117d99e9e4932ac
stage: split, palette and folds
stage_hash: 794487fe5e0cd3a19ce5727d0d930d4d2968bea5aa58b4dfe76228e066e821ac
findings: [{"severity":"low","text":"WEB-REAL-005 brief correction: fresh client writes default cland.ui.shell.v1. Coordinator decision 5a3d761e permits self-written defaults; captured value has no fold and inbox value is null. Original empty-key expectation and corrected evidence retained; isolation passes.","file":"qa/briefs/E-415-stage-3.md"},{"severity":"low","text":"WEB-DOCS-001: palette.test.ts has no dedicated paragraph in tests.md, though README documents its command. Brief explicitly treats this as non-blocking. Reported as Follow-ups / XS.","file":"docs/agents/tests.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface | Result | Observation and evidence |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | Clean requested HEAD and dev; all three items merged and closed; isolated fixture environment. [S0.txt](S0.txt), [S0-setup.txt](S0-setup.txt) |
| WEB-REAL-001 | real-browser | PASS | Real Chrome showed the matching anonymous shell, seven areas and Offline state; owned tab closed. [WEB-REAL-001.png](WEB-REAL-001.png), [WEB-REAL-001-before.png](WEB-REAL-001-before.png) |
| WEB-REAL-002 | real-browser | PASS | Both palette shortcuts, blue filtered action, Enter, Tab and safe Escape worked. [WEB-REAL-002-filter.png](WEB-REAL-002-filter.png), [WEB-REAL-002-open.png](WEB-REAL-002-open.png) |
| WEB-REAL-003 | real-browser | PASS | Physical help shortcut and Help button showed all 14 keys; both dismissal paths worked. [WEB-REAL-003.png](WEB-REAL-003.png), [WEB-REAL-003-closed.png](WEB-REAL-003-closed.png) |
| WEB-REAL-004 | real-browser | PASS | Visible 2:1 split, Topics navigation, Swap, divider drag and Close worked; no drawer. [WEB-REAL-004-closed.png](WEB-REAL-004-closed.png), [WEB-REAL-004-swap.png](WEB-REAL-004-swap.png) |
| WEB-REAL-005 | real-browser | PASS | Fold persisted; fresh client inherited no fold. PASS under the documented expectation correction. [WEB-REAL-005-reload.png](WEB-REAL-005-reload.png), [WEB-REAL-005-explicit-reload.png](WEB-REAL-005-explicit-reload.png) |
| WEB-REAL-006 | real-browser | PASS | Visible-text transcript and second-client prose/origin checks passed. [WEB-REAL-observations.txt](WEB-REAL-observations.txt), [WEB-REAL-006-text.txt](WEB-REAL-006-text.txt) |
| S2-M1 | hub-api | PASS | Build passed; index, JS and CSS emitted; clean tree and matching live source stamp. [S2-M1.txt](S2-M1.txt) |
| WEB-SPLIT-001 | hub-api | PASS | Shell tests 9/9; default 2:1 split, drag, Swap and Close passed. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| WEB-SPLIT-002 | hub-api | PASS | Rail collapses to 60 px while split and restores its previous choice. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| WEB-DRAWER-001 | hub-api | PASS | Selection, dismissal, reload, area changes and split drawer states passed. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| WEB-DRAWER-002 | hub-api | PASS | Physical Command-Enter opens the other pane; Swap and Close retain selection. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| WEB-DRAWER-003 | hub-api | PASS | Escape closes the drawer with no outgoing hub frame. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| WEB-PALETTE-001 | hub-api | PASS | Palette tests 8/8; both modal openers, input focus and safe Escape passed. [WEB-PALETTE-001.raw.txt](WEB-PALETTE-001.raw.txt) |
| WEB-PALETTE-002 | hub-api | PASS | Five prefix groups, ordering, action keys and Unicode blue matches passed. [WEB-PALETTE-001.raw.txt](WEB-PALETTE-001.raw.txt) |
| WEB-PALETTE-003 | hub-api | PASS | Enter, Command-Enter, kind cycling, footer keys and empty searches passed. [WEB-PALETTE-001.raw.txt](WEB-PALETTE-001.raw.txt) |
| WEB-KEYS-001 | hub-api | PASS | Physical/Cyrillic keys and Space focus checks passed; keymap test 1/1. [WEB-PALETTE-001.raw.txt](WEB-PALETTE-001.raw.txt), [WEB-KEYS-001.raw.txt](WEB-KEYS-001.raw.txt) |
| WEB-KEYS-002 | hub-api | PASS | Three README sections, nine key rows and both fold keys match behavior. [WEB-KEYS-002.raw.txt](WEB-KEYS-002.raw.txt) |
| WEB-FOLDS-001 | hub-api | PASS | Fold tests 6/6; persistence, shared pane state, defaults and denied storage passed. [WEB-FOLDS-001.raw.txt](WEB-FOLDS-001.raw.txt) |
| WEB-FOLDS-002 | hub-api | PASS | No outgoing fold frames; hub/shared source search returned no fold-state key. [WEB-FOLDS-001.raw.txt](WEB-FOLDS-001.raw.txt), [WEB-FOLDS-002.raw.txt](WEB-FOLDS-002.raw.txt) |
| WEB-PROSE-001 | hub-api | PASS | Positive and negative prose fixtures passed; detector source inspected. [WEB-FOLDS-001.raw.txt](WEB-FOLDS-001.raw.txt), [WEB-PROSE-001.raw.txt](WEB-PROSE-001.raw.txt) |
| WEB-FOLDS-003 | hub-api | PASS | Documented reference Shell imports Fold and renders it twice. [WEB-FOLDS-003.raw.txt](WEB-FOLDS-003.raw.txt) |
| S2-M10 | hub-api | PASS | One key listener/table; preference storage and deliberate reload guard only. [S2-M10.raw.txt](S2-M10.raw.txt) |
| WEB-DOCS-001 | hub-api | PASS | Web tier entries, README commands, fold paragraph and tier lint passed; low palette-doc observation. [WEB-DOCS-001.raw.txt](WEB-DOCS-001.raw.txt) |
| S1-M2 | hub-api | PASS | Colour guard passed, rejected both planted files at line 1, and cleanup restored the tree. [S1-M2.raw.txt](S1-M2.raw.txt) |
| S1-M3 | hub-api | PASS | Conditional hook plant was rejected; initial guard and clean-tree checks passed. [S1-M3.raw.txt](S1-M3.raw.txt) |
| S1-M5 | hub-api | PASS | Both targeted selection tests passed, one test each. [S1-M5.raw.txt](S1-M5.raw.txt) |
| S1-M6 | hub-api | PASS | Web phase planner passed 8/8 tests. [S1-M6.raw.txt](S1-M6.raw.txt) |
| S1-M7 | hub-api | PASS | Missing-browser reporting fixture passed 1/1; the actual host ran Web tests. [S1-M7.raw.txt](S1-M7.raw.txt) |
| S1-M8 | hub-api | PASS | Workspace/tier lints, bundle doctor test and documentation headings passed. [S1-M8.raw.txt](S1-M8.raw.txt), [cleanup.txt](cleanup.txt) |
| S2-M2 | hub-api | PASS | One-time sign-in 302; correct cookie flags; replay 401. [S2-M2.raw.txt](S2-M2.raw.txt) |
| S2-M3 | hub-api | PASS | Matching served bundle, strict CSP, unauthenticated WS 401 and authenticated WS 101. [S2-M3.raw.txt](S2-M3.raw.txt) |
| S2-M4 | hub-api | PASS | Positive control 1; all 11 bundle files 200; probes 401/404; zero secret matches. [S2-M4.raw.txt](S2-M4.raw.txt) |
| S2-M5 | hub-api | PASS | WS 101 before stop, 000 stopped, 101 after restart on the same port; no timeout. [S2-M5.raw.txt](S2-M5.raw.txt) |
| S2-M6 | hub-api | PASS | Shared wire import and connection documentation match the tested behavior. [S2-M6.raw.txt](S2-M6.raw.txt) |
| S2-M7 | hub-api | PASS | Connection tests passed 4/4, including reconnect and the reload guard. [S2-M7.raw.txt](S2-M7.raw.txt) |
| S2-M8 | hub-api | PASS | All six prior-stage shell regression subtests passed in the fresh shell run. [WEB-SPLIT-001.raw.txt](WEB-SPLIT-001.raw.txt) |
| S2-M9 | hub-api | PASS | Smoke tests passed 4/4; CSP, origin isolation and trace cleanup passed. [S2-M9.raw.txt](S2-M9.raw.txt) |
| S2-M11 | hub-api | PASS | Rail CSS, README keys/state documentation and tier classifications passed. [S2-M11.raw.txt](S2-M11.raw.txt) |
| S2-M12 | hub-api | PASS | Prepare-key tests passed 5/5; provision script syntax/order passed. Static/unit evidence only. [S2-M12.raw.txt](S2-M12.raw.txt) |
| S2-M13 | hub-api | PASS | Worker-count test passed 1/1; two local/four remote workers and docs confirmed. [S2-M13.raw.txt](S2-M13.raw.txt) |
| S2-M14 | hub-api | PASS | Scratch recorder accepted the valid surface, rejected the invalid surface without append; test passed 1/1. [S2-M14.raw.txt](S2-M14.raw.txt) |
| S2-M15 | hub-api | PASS | Good/bad fixtures behaved as expected; both briefs linted; CLI tests passed 2/2. [S2-M15.raw.txt](S2-M15.raw.txt) |
| S2-M16 | hub-api | PASS | QA skill, templates, lint, usage and scoped browser grant documentation confirmed. [S2-M16.raw.txt](S2-M16.raw.txt) |
| S2-M17 | hub-api | PASS | All workspace typechecks, colour/contrast guards and hooks checks passed. [S2-M17.raw.txt](S2-M17.raw.txt) |
| COVER-001 | hub-api | PASS | Both same-head receipts are green; final plan confirms both covers complete. See COVER-001-final-plan.txt. [COVER-001-plan.txt](COVER-001-plan.txt), [A-8570-summary.txt](A-8570-summary.txt) |

## Findings, ranked by severity

High: none. Medium: none.

- Low — WEB-REAL-005, brief expectation correction. Original fresh second-client output was `fold-inbox-expanded true`, `storage-keys ["cland.ui.shell.v1"]`, rather than the brief's empty-key list. Coordinator decision `5a3d761e-47ab-4733-9edf-357085465bad` permits client-written defaults and requires no inherited key/value. The supplementary fresh context returned `inbox-value null` and shell value `{"collapsed":false,"area":"Inbox","release":"","detail":false,"secondaryDetail":false,"ratio":0.6666666666666666}`. It contains no fold entry; the real Chrome client was still folded. Both outputs retained. The correct expectation is no key or value inherited from the first client. Product behavior passes.
- Low — WEB-DOCS-001, documentation observation, Follow-ups / XS. The README documents the palette targeted command, but `rg web/test/palette.test.ts docs/agents/tests.md` has no paragraph. The brief explicitly makes this non-blocking; no criterion requires that paragraph. Reported to Coordinator for filing.

## Build and execution

E-415 stage **split, palette and folds**, full/after-stage; run **qa-s3-2026-10-21-1**. Tested commit **dbb1604fd8ab9f21a4f1a5858117d99e9e4932ac**, verification tree **15400ec57d0bfbbb09eccf792c492bda4039cbfc**. Stage items T-995/T-996/T-997 are closed and landed via 0080a0c7/b4264fdd/c9063d06. Brief committed at fb9adfe3. No product or brief edits. T-1065/T-1066 fixes were present at the requested build.

Fresh local macOS arm64, Node v24.21.0. 53 targeted passing test records, zero failures/skips/cancellations/todos; this includes 31 Web records (five parent tests plus 26 subtests), the keymap test and 21 other test records. Some planner checks are deliberately repeated by the prescribed brief. Single files ran serially, with local queue-none receipts before each test case. No QA full suite or performance benchmark. Test durations are raw observations only.

Detached worktree and scratch root paths are in paths.json. Fixture commands used their own HOME/XDG/Git configuration and the brief's credential/provider filter; PATH/SHELL/TERM and macOS system TMPDIR were preserved. Shared dependencies were linked without npm install. Existing repository fixtures apply their fixture environment to child launches. The second anonymous Headless Shell client alone used a scratch TMPDIR/profile, as granted. Its two executions each closed fully. All five Web test files report browser group after 0 and external census 0 → 0.

Real browser: computer use, real Chrome existing **cland QA** profile, anonymous allowed origin only. Newly created tab 1158676369 was explicitly closed; original New Tab left intact. No sign-in, live cookie/session, settings, profile, keychain or layout change. Restored one pane, Inbox unfolded, expanded rail. Screenshot/AX captures and action notes retained. The literal key API spelling `super+\` was used after the tool rejected `super+backslash` as an unknown key; this was an input spelling error, not a product or permission failure. Explicit browser reload additionally confirms both chevron and keyboard folds. A supplementary owned tab 1158676371 was restored and closed after the chevron reload capture; see WEB-REAL-observations.txt.

Live and detached stamp sources both **1003d2d554c2cca66bcb7dd1bf85ef410a8d7eed3a428e495d0589542bcd71f1**, live HTTP 200, so the GUI observations judge this stage's shell. Real-browser screenshots show no selected objects because the client is anonymous; drawer-open and palette object behavior was established against signed-in scratch hubs by the passing Headless Shell tests.

## Same-head stage covers, cited rather than rerun

The Coordinator owns both stage runs. Both executed check/T1/T2/T3/T4/Web at the tested SHA. T4 base files ran; T4 load repetitions were skipped. Linux has 8 platform skips; macOS has 0. Lint, test budgets and T3 ratchet were **report-only**, not enforced performance passes. Both logs name missing duration baselines; projections are not measured walls.

| Receipt | Executor/platform | Actual result and Web phase | Wall/lifetime/cost |
| --- | --- | --- | --- |
| A-8570  / 5551daab-2343-45ff-9dd6-1003514d7839 | Droplet, Linux x64 6.8.0-142-generic, Node 24.21.0, Neovim 0.12.5 | exit 0; summed runner summaries: 3611 tests / 3603 pass / 8 skipped / 0 fail; Web: 5 files / 31 records pass, four workers, phase wall 9.95 s | Overall admission through collection 1044.93 s; total $0.1361 |
| A-8571  / shard 1 | cland-v0-c1268906, c-8 lon1 | exit 0, including executed Web | Admission through remote finish 1020.59 s; collection 24.02 s; lifetime 1009 s; $0.0701 |
| A-8572  / shard 2 | cland-v0-ca8994c0, c-8 lon1 | exit 0; no Web files assigned here | Admission through remote finish 961.59 s; collection 38.14 s; lifetime 951 s; $0.0660 |
| A-8574  / 97d513e8-1686-4737-90b4-c654c1173c57 | Local macOS arm64 27.0.0, Node 24.21.0, Neovim 0.12.5 | exit 0; summed runner summaries: 3611 / 3611 pass / 0 skipped / 0 fail; Web: 5 files / 31 records pass,two workers,phase wall 5.99 s | Queued 16:53:30.934Z,result finished 17:13:13.092Z: elapsed 1182.158 s, including reported queue 0.20 s; derived admission-to-result 1181.958 s. Local cost N/A |

Linux artifact paths and all shard summaries are in cover-artifacts.json and A-8570/1/2-summary.txt; macOS A-8574-summary.txt. Original full logs remain the authoritative durable artifacts. Aggregate counts above sum logged runner summaries (including parent/subtests and any repeated records), rather than equating tier top-level counts with total test records. The Web aggregate tier count is 5 top-level tests; its actual runner includes 31 records. QA incurred no additional droplet cost.

Restored Linux admission was pending after restart #39 although the receipt was green. Coordinator message a0834cd6 explains the Freshness rescan (T-1049 correctness/T-1050 speed). Initial and final plan states are retained. The final plan read at 17:29Z reports stage cover complete (Linux droplet, macOS) at the same tree; admission is resolved.

## Cleanup and record

Scratch hub 10388 stopped and restarted as 25670 on the same edge port 52862; final stop confirmed, zero scratch process matches and zero Chrome Headless Shell processes. No T-1060 timeout. Scratch root removed by literal non-force rm -r. HEAD/dev unchanged and worktree clean after checks. Bearer scratch link/header files are retained privately in source evidence and excluded from the published folder; no cookie/secret values are published.

All 46 scoped cases are PASS and recorded at the full tested build. Verdict: clear. COVER-001 now counts both green covers. Stage QA has **no epic criterion marks**. Case mapping covers T-995 C1–C5, T-996 C1–C5, T-997 C1–C4 and the specified stage 1/2 regression criteria; item QA marks are not added by this stage verdict.

Rule proposal sent to Coordinator: second-client isolation checks should assert absence of inherited state, allowing defaults written by the fresh client itself. Preserve original output and any authorized corrected expectation separately from product failures.

Final build recheck: HEAD and dev remained dbb1604fd8ab9f21a4f1a5858117d99e9e4932ac; clean detached worktree. The historical pending artifact is A-8579; this final evidence supersedes its pending status without removing the history.

Durable evidence A-8583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8583-e-415-stage-3-at-dbb1604f-all-46-checks-pass-real-chrome-and-both-covers/report.md

### hub · 2026-10-21T17:45:52.276Z

demo 8ab4f4ba-0f82-450f-8170-9db2222bdd2c created: droplet cland-v0-8ab4f4ba, commit 128444a096311143e706fb8d36a19ac9916f492f, deadline 2026-10-21T18:59:38.623Z.

### hub · 2026-10-21T17:49:39.890Z

demo 8ab4f4ba-0f82-450f-8170-9db2222bdd2c destroyed: lifetime 286474 ms; cost $0.0199.

### qa-676 · 2026-10-21T18:07:03.254Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-21-1
commit: 128444a096311143e706fb8d36a19ac9916f492f
findings: [{"severity":"low","text":"E415-DOD-19: prescribed static read still says 'the shell-key slice adds it' although the physical-code map exists and passed. Follow-ups/XS; Coordinator confirmed filed.","file":"AGENTS.md","line":19},{"severity":"low","text":"E415-DOD-18: prescribed README read still says 'Until T-993 supplies Linux libraries' after T-993 closed and fresh Linux Web receipts passed. Required C8 documentation is present. Follow-ups/XS; Coordinator confirmed filed.","file":"web/README.md","line":256}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface / actual execution | Result | Evidence |
| --- | --- | --- | --- |
| G0 | local macOS / records | PASS | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/G0.txt) |
| G1 | local macOS / records | PASS | [G1-plan.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/G1-plan.txt) |
| G2 | local macOS / records | PASS | [G1-epic.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/G1-epic.txt) |
| S0 | local macOS / records | PASS | [S0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/S0.txt) |
| D0 | Linux droplet | PASS | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/D0-start.json) |
| D1 | Linux droplet | PASS | [D1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/D1.txt) |
| E415-DOD-01 | Linux droplet | PASS | [E415-DOD-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-01.txt) |
| E415-DOD-02 | Linux droplet | PASS | [E415-DOD-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-02.txt) |
| E415-DOD-03 | Linux droplet | PASS | [E415-DOD-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-03.txt) |
| E415-DOD-04 | Linux droplet | PASS | [E415-DOD-04a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-04a.log), [E415-DOD-04b.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-04b.log) |
| E415-DOD-05 | Linux droplet | PASS | [E415-DOD-05.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-05.log) |
| E415-DOD-06 | Linux droplet | PASS | [E415-DOD-06a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-06a.log), [E415-DOD-06b.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-06b.log) |
| E415-DOD-07 | Linux droplet | PASS | [E415-DOD-07.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-07.log) |
| E415-DOD-08 | Linux droplet | PASS | [E415-DOD-08a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-08a.log), [E415-DOD-08b.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-08b.log) |
| S2-M1 | local macOS / records | PASS | [S2-M1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/S2-M1.txt) |
| D15 | local macOS / records | PASS | [D15-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/D15-stop.json), [D15-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/D15-after.json) |
| E415-WALK | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt), [E415-WALK-command.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK-command.txt) |
| E415-DOD-09 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt) |
| E415-DOD-10 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt) |
| E415-DOD-11 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt) |
| E415-DOD-12 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt) |
| E415-DOD-13 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt) |
| E415-DOD-14 | local macOS / records | PASS | [E415-WALK.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-WALK.txt), [WEB-REAL-005-second.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-second.txt), [E415-DOD-14-grep.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-14-grep.txt) |
| E415-DOD-15 | local macOS / records | PASS | [E415-DOD-15-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-15-corrected.txt), [E415-DOD-15.raw.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-15.raw.txt), [probe-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/probe-correction.txt) |
| E415-DOD-18 | local macOS / records | PASS | [E415-DOD-18-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-18-corrected.txt), [E415-DOD-18.raw.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-18.raw.txt), [probe-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/probe-correction.txt) |
| E415-DOD-19 | local macOS / records | PASS | [E415-DOD-19-corrected.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-19-corrected.txt), [E415-DOD-19.raw.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-19.raw.txt), [probe-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/probe-correction.txt) |
| E415-DOD-20 | local macOS / records | PASS | [E415-DOD-20.raw.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-20.raw.txt) |
| WEB-REAL-001 | real Chrome / macOS | PASS | [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png), [WEB-REAL-001-before.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-before.png), [WEB-REAL-001-index.html](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-index.html), [WEB-REAL-001-stamps.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-stamps.txt), [WEB-REAL-001.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001.ax.txt), [WEB-REAL-001.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001.png), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png) |
| WEB-REAL-002 | real Chrome / macOS | PASS | [WEB-REAL-002-esc.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-esc.ax.txt), [WEB-REAL-002-esc.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-esc.png), [WEB-REAL-002-filter.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-filter.ax.txt), [WEB-REAL-002-filter.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-filter.png), [WEB-REAL-002-open.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-open.ax.txt), [WEB-REAL-002-open.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-open.png), [WEB-REAL-002-run.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-run.ax.txt), [WEB-REAL-002-run.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-run.png), [WEB-REAL-002-tab.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-tab.png), [WEB-REAL-002-tab1.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-tab1.ax.txt), [WEB-REAL-002-tab2.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-002-tab2.ax.txt), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png), [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png) |
| WEB-REAL-003 | real Chrome / macOS | PASS | [WEB-REAL-003-button.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-003-button.ax.txt), [WEB-REAL-003-closed.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-003-closed.ax.txt), [WEB-REAL-003-closed.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-003-closed.png), [WEB-REAL-003.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-003.ax.txt), [WEB-REAL-003.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-003.png), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png), [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png) |
| WEB-REAL-004 | real Chrome / macOS | PASS | [WEB-REAL-004-closed.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-closed.ax.txt), [WEB-REAL-004-closed.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-closed.png), [WEB-REAL-004-drag.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-drag.ax.txt), [WEB-REAL-004-drag.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-drag.png), [WEB-REAL-004-split.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-split.ax.txt), [WEB-REAL-004-split.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-split.png), [WEB-REAL-004-swap.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-swap.ax.txt), [WEB-REAL-004-swap.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-004-swap.png), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png), [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png) |
| WEB-REAL-005 | real Chrome / macOS | PASS | [WEB-REAL-005-folded.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-folded.ax.txt), [WEB-REAL-005-folded.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-folded.png), [WEB-REAL-005-keyreload-key.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-keyreload-key.ax.txt), [WEB-REAL-005-keyreload.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-keyreload.ax.txt), [WEB-REAL-005-keyreload.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-keyreload.png), [WEB-REAL-005-left.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-left.ax.txt), [WEB-REAL-005-left.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-left.png), [WEB-REAL-005-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-queue.json), [WEB-REAL-005-reload-key.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-reload-key.ax.txt), [WEB-REAL-005-reload.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-reload.ax.txt), [WEB-REAL-005-reload.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-reload.png), [WEB-REAL-005-right.ax.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-right.ax.txt), [WEB-REAL-005-right.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-right.png), [WEB-REAL-005-second.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-005-second.txt), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png), [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png) |
| WEB-REAL-006 | real Chrome / macOS | PASS | [WEB-REAL-006-text.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-006-text.txt), [WEB-REAL-observations.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-observations.txt), [computer-use-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/computer-use-notes.txt), [WEB-REAL-restored.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-restored.png), [WEB-REAL-001-after.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/WEB-REAL-001-after.png) |
| E415-DOD-16 | Linux droplet receipt read locally | PASS | [E415-DOD-16-suite.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-16-suite.log), [E415-DOD-16-lines.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-16-lines.txt), [E415-DOD-16-dry.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-16-dry.txt) |
| E415-DOD-17 | local macOS / records | PASS | [E415-DOD-17-suite.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-17-suite.log), [E415-DOD-17-lines.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-17-lines.txt), [E415-DOD-17-cleanup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/E415-DOD-17-cleanup.txt) |
| D14 | local macOS / records | PASS | [D14-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/D14-status.json), [final-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/final-build.txt) |
| E415-DOD-21 | Linux droplet receipt read locally | PASS | [A-8594-suite-51af7345-d155-4c16-a148-c81da2036991-all-at-128444a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/A-8594-suite-51af7345-d155-4c16-a148-c81da2036991-all-at-128444a.log), [A-8595-suite-51af7345-d155-4c16-a148-c81da2036991-shard-1-at-128444a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/A-8595-suite-51af7345-d155-4c16-a148-c81da2036991-shard-1-at-128444a.log), [A-8596-suite-51af7345-d155-4c16-a148-c81da2036991-shard-2-at-128444a.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/A-8596-suite-51af7345-d155-4c16-a148-c81da2036991-shard-2-at-128444a.log) |

Clear: all 37 scoped cases passed. Run `qa-dod-2026-10-21-1`; tested commit `128444a096311143e706fb8d36a19ac9916f492f` (S). Final demo freshness is `current: true`. This is the epic DoD verdict, with C1–C8 verified; no stage marks.

Low findings (no high or medium findings):

- **E415-DOD-19, AGENTS.md:19.** The prescribed static `grep`/`sed` read (full command in E415-DOD-19-corrected.sh) still shows “the shell-key slice adds it” although the shared physical-code map exists and passed. Follow-ups/XS, reported and confirmed filed by the Coordinator.
- **E415-DOD-18, web/README.md:256.** The prescribed README `grep`/`sed` read (E415-DOD-18-corrected.sh) shows “Until T-993 supplies Linux libraries” after T-993 closed and Linux Web tests passed. Follow-ups/XS, reported and confirmed filed. The required workspace/build/test/token/key documentation is present. Existing tests.md palette wording is tracked separately as T-1070.

Criteria and observations:

- C1: workspace/build/dependency/font checks, clean rebuild after deleting web/dist with both npm install and the verification pre-step, Web smoke, no shared fold state, and real-browser prose/network checks.
- C2: root web rule present; planted hex and rgb values rejected at Fold.tsx:57 and Shell.module.css:70; restored tree passes and is clean.
- C3: seven rail areas, release/palette/Coordinator/needs-you/connection strip and title; collapse at 1280 threshold, manual persistence and split; scratch walkthrough and real Chrome.
- C4: split 2:1, swap, drag, close, drawer selection/Split/Close; no drawer without selection or during split.
- C5: five palette groups, action keys, physical-code Russian-layout input, 14 help keys, Escape with no answer frames; source inventory confirms central handling.
- C6: chevron and keyboard folds persist across actual reload; independent second client starts unfolded with no inherited inbox value; shared hub grep has no fold-state key; prose/off-origin audits pass.
- C7: planner/selection tests plus actual web-only remote and local runs; separate machine phase after hub. Full epic Web phase receipt at S.
- C8: README required sections and key table match the implementation, with the low stale prerequisite sentence above.

The exact criterion-to-case mapping is in criterion-map.json. G0/G1/G2 confirm clean named build, all ten children and all three stages closed, and QA hold. DOD-20 separately confirms the human's option-1 approval through ask 310190bf-d703-4973-9805-62c254ee4228, item comment, journal and A-7719; plan approval=none does not replace that evidence.

Execution and accounting:

| Receipt | Actual run / platform | Outcome and scope | Duration / lifetime / cost |
| --- | --- | --- | --- |
| Demo lease 8ab4f4ba-0f82-450f-8170-9db2222bdd2c | S; Linux x64, Node 24.21.0, machine cland-v0-8ab4f4ba | 136/136 targeted test records, no skips/failures; build and lint plants restored | Released lifetime 286474 ms; $0.019894027777777778; deadline 18:59:38.623Z |
| Mac scratch walkthrough | S; Darwin arm64; headless browser against scratch hub | 5/5, no skips/failures; browser census 0→0 | Local cost not applicable; timing not used as a performance verdict |
| A-8592 / 13fe65fe-d6ed-4afd-acd6-9de52e913965 | Throwaway 0391978983d36abaf8fe9df8ec8669fdddea3e99 (one CSS comment atop S); Linux x64 droplet cland-v0-404a9e1b, c-8 lon1 | Web-only 49/49: T3 smoke 18 records, Web 31 records/5 files; T1/T2 commands had no tests. Web machine phase workers 4 after hub | Web phase wall 10.168 s; provider lifetime 130 s / $0.0090 (rounded); derived admission→report 176.979 s, including collection/publication |
| A-8593 / 33c8ef39-8009-4c29-aa67-06839effbe0c | Same throwaway head; local Darwin arm64; Node 24.21.0, Nvim 0.12.5 | Web-only 49/49, same smoke/Web scope; Web workers 2 after hub, local typecheck executed | Web phase wall 5.681 s; queue wait 2.43 s; derived admission→report 43.178 s; local cost not applicable |
| A-8594 / 51af7345-d155-4c16-a148-c81da2036991 | S; integrated dev, epic occasion, Linux x64 6.8.0-142-generic, Node 24.21.0, Nvim 0.12.5, 2 droplets | Full exit 0: 3615 tests, 3607 pass, 8 skipped, 0 fail/cancel/todo; T1–T3, T4 base, Web | Overall wall admission→collection **1133.63 s**, total provider cost **$0.1421** |
| A-8595 / epic shard-1 | cland-v0-d276436a, c-8 lon1; hub workers 2, Web workers 4 | Assigned hub/Neovim and Web; Web machine phase after hub, 9.48 s | Admission→remote finish 959.85 s; collection 18.96 s; provider lifetime 946 s / $0.0657 |
| A-8596 / epic shard-2 | cland-v0-411dd755, c-8 lon1; hub workers 2 | Assigned hub tests; no Web assignment | Admission→remote finish 1104.85 s; collection 28.52 s; provider lifetime 1100 s / $0.0764 |

The suite logs are retained separately, including merged and both shard logs. Total reported remote spend for this QA pass is approximately **$0.170994** (demo + web-only droplet + epic); component receipts are rounded where noted. The epic's 1133.63 s is measured overall wall; projected tier walls are not measurements and are not substituted for it. Different components overlapped, so their durations are not summed into a fabricated end-to-end wall.

Epic tiers: T1 121 files/706 tests, T2 230/1552, T3 179/1201, T4 10/48, Web 5/5 top-level tests (nested records are included in the suite total). T4 repetitions were skipped by the load gate; ten files ran in the base phase only. Eight suite tests were skipped. Lint (132 findings/59 files), budgets and T3 ratchet are **report-only**; budget warnings and one missing duration baseline remain in A-8594. This verdict does not assert a performance-budget pass, an enforced lint pass, or a completed T4 soak. Remote web-only typecheck used the host gate at tree 1057026598e8d9957b4c1ced5bee7a6a32535416 and was not repeated on the droplet.

Real-browser evidence:

Six WEB-REAL cases used computer use in the existing dedicated cland QA Chrome profile against the authorized anonymous live edge. Live and detached bundle source stamps matched `1003d2d554c2cca66bcb7dd1bf85ef410a8d7eed3a428e495d0589542bcd71f1`; screenshots therefore judge the tested shell. The anonymous view was Offline; authenticated behavior is established by scratch tests, not inferred from the screenshot. No live auth link or cookie was minted. Screenshots and accessibility captures cover split/swap/divider drag, palette/filter/action, keyboard help, folds and reload. A separate isolated client showed inbox expanded, storage inbox value null, no explanatory prose or off-origin request. The owned tab was closed; original New Tab retained; shell restored to one-pane Inbox, unfolded, word rail.

Probe corrections (separate from product findings):

DOD-15/-18/-19 initially mis-extracted prose into the wrapper, producing a `<worktree>git/grep/sed: No such file or directory` error. Original `.raw.txt` captures remain labelled **probe error (wrapper)**. Coordinator decision 2e9739c4-43ea-452a-8464-94073d9546b3 authorized explicit scratch-environment sourcing and corrected static reads under the same run; all passed. The original errors are not product failures. The CUA alias `shift+slash` returned `Unknown key` before dispatch; the documented literal `shift+/` succeeded. Explicit Tab.reload calls establish fresh-page fold persistence after the keyboard reload chord.

Cleanup and isolation:

Fixture commands used disposable roots, HOME/XDG/Git configuration and filtered credentials, retaining normal PATH/SHELL/TERM and system TMPDIR. Browser checks used the role's explicit normal-profile exception. Demo released; scratch hub/browser processes are gone; scratch root removed; throwaway worktree/branch removed; origin QA refs zero. Dev remained S at final build capture. The detached QA source worktree is removed after publishing the verdict. No implementation or brief was edited.

A-8591 is the earlier partial evidence bundle; this report supersedes its pending receipt status without altering that history. All 37 original recorder rows, commands, corrected and original probe outputs, screenshots and logs are included here.

Durable final artifact: A-8600, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8600-e-415-epic-dod-at-128444a0-37-pass-c1-c8-green-epic-and-both-web-only-platforms/report.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
