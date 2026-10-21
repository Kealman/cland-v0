---
id: E-415
kind: epic
title: The web workspace and the shell
state: open
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
updated: 2026-10-21T12:56:03.534Z
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
- [ ] C2. The root `AGENTS.md` carries the rule for `web/`, and the typecheck fails on a colour value outside `web/src/tokens.css`.
- [ ] C3. The rail lists the seven areas and collapses to icons by its button, below 1280 px and while split, remembering the choice; the top strip shows the release switcher, the palette, the Coordinator, the needs-you pill and the hub's dot, and the tab title carries the needs-you count.
- [ ] C4. ⌘\ splits the main area into two panes that swap and close; the drawer has Split and Close and stays closed when nothing is selected and while split.
- [ ] C5. The palette opens on ⌘K and Space p with the five prefixes and each action's key, `?` lists the keys, every key matches by `KeyboardEvent.code` and works in the Russian layout, and Esc never answers anything.
- [ ] C6. Every group and block folds with a chevron and the keyboard and is remembered per client, and the interface carries no explanatory prose.
- [ ] C7. The web phase runs as its own machine-locked shard after the hub phase on `node:test` with `playwright-core` and the headless shell, selected for `web/**` and protocol changes, locally and on droplets.
- [ ] C8. `web/README.md` describes the workspace, the build, the tests, the token rule and the shell's keys.

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
