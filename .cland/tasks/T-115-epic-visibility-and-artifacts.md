---
id: T-115
kind: epic
title: "Epic: Visibility and artifacts"
state: open
criterion_seq: 9
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-110
  - T-109
topic: topic-136
branch: null
created: 2026-10-09T21:51:34.527Z
updated: 2026-10-11T15:15:57.536Z
---

## Goal

Every surface of the workbench shows what needs the human now and what is worth watching, folds agent bookkeeping and keeps the old out of sight, and the human pins or mutes topics, sessions and artifacts. The human keeps their own artifacts, files or folders such as a prompt drafted over days, in an Artifacts browser where they never expire, while agents' reports follow their topics unless kept. Today the inbox and the panels show everything at once, and an artifact is a single file swept away with its topic.

## Contents

- **§3.5 Visibility levels, the rest**: the four layers on the inbox, the sessions, the items and the artifacts by the default placement table, with messages older than 7 days in archive; now and watch shown everywhere, background folded behind a count and archive reached only by an action; pins and mutes on topics, sessions and artifacts kept in `.cland/ui.json`; a `[visibility]` table for project overrides; and one classifier for every surface, the thread, the top bar and the palette included.
- **§3.6 Artifacts as a workspace**: an artifact is a file or a folder with an entry file; the human's and Aides' artifacts never expire, while agents' follow their topic unless `kept`; `artifact.keep`, `artifact.move`, `artifact.archive` and the `cland artifact` CLI; an "Artifacts" browser in the centre with the sections mine, this topic, kept, by role and archived, and its keys; and editing in place, where saving the buffer is the artifact.

Not in this epic: the thread's folds of agent runs and the top bar's now count, which "Threads that read" built and this epic's classifier takes over.

Choice where the spec is silent: the `[visibility]` table is keyed by surface and kind, each value a layer, mirroring the cells of the default placement table.

## Tracer-bullet order

1. **One classifier.** A module that places messages, inbox events, sessions, items and artifacts in a layer by the default table, overridable by `[visibility]`; the thread, the top bar and the palette move onto it. Demo: a project's `[visibility]` raises long idles to now, and the top bar counts them.
2. **Layers on the inbox and the sessions.** The inbox shows now and watch, with background only in the Agents log; "more (N)" folds and unfold keys; archive reached only by an action. Demo: a clear verdict sits under watch, and a session's bookkeeping never reaches the inbox.
3. **Layers on items, messages and artifacts; pins and mutes.** The items panel's filters as layers; messages older than 7 days archived; artifact lists by layer; pin and mute on topics, sessions and artifacts, kept in `ui.json`. Demo: the human mutes a noisy topic and pins a Reviewer, and both survive a restart.
4. **Folder artifacts and their lifetime.** `artifact.create` with a folder and an entry file; its files listed on request; the human's and Aides' artifacts exempt from the sweep; `kept`; `artifact.keep`, `artifact.move` and `artifact.archive`; agents refused on the human's artifacts. Demo: an agent's report without `kept` is swept after the retention period, and the human's folder is not.
5. **The artifact CLI.** `cland artifact new | open | keep | move | archive | promote`, including promoting a folder into the repository. Demo: the human creates a folder artifact from the shell and promotes it into `docs/`.
6. **The Artifacts browser.** The centre view with its sections and keys, editing in place, attaching to the composer with `s`. Demo: the human creates a folder "v0.2 notes" in the browser, adds two files, and attaches it to a message with `s`.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo: the human accepts only the release (T-117), decision D16.

The human starts the day. The inbox shows an ask and a not-clear verdict on top, the clear verdicts under watch, and no agent bookkeeping; the sessions panel folds the stopped sessions; the items panel shows the release's work with backlog and done folded. They mute a noisy item topic and pin a Reviewer. In the Artifacts browser they create a folder "v0.2 notes", add files over two days and attach it to a message with `s`. An agent's report artifact disappears after the retention period unless it was kept; the human's folder never does.

- [ ] C1. One classifier places every message, inbox event, session, item and artifact by the default table and `[visibility]`.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:34.780Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C2. Each surface shows now and watch, folds background behind a count, and reaches archive only on an action; the inbox never shows background.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:34.944Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C3. Pins and mutes on topics, sessions and artifacts persist in `.cland/ui.json`.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.099Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C4. Messages older than 7 days leave the thread until the human asks for them.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.253Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C5. A folder artifact has one id and an entry file, and its files are listed on request.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.427Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C6. The human's and Aides' artifacts are never archived or deleted automatically; `kept` exempts an agent's artifact from the sweep and raises it to watch.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.603Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C7. `artifact.keep`, `artifact.move`, `artifact.archive` and the `cland artifact` commands work; agents cannot change the human's or an Aide's artifacts.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.769Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C8. The Artifacts browser has the sections and keys of §3.6, and saving a buffer saves the artifact.
  - verified: qa-18 [qa] · run qa-2026-10-11-18 · 2026-10-11T15:15:35.960Z · commit 36a4860b4e5b56e785b933a40702b3ede50ba53f
- [ ] C9. `hub/README.md` and `nvim/README.md` describe the layers, the overrides and the artifacts.
  - failed: qa-18 [qa] · 2026-10-11T15:15:57.535Z · note M19-AIDE: nvim/README.md:56 says stopped Aides fold, but they remain Now under STOPPED.

## Dogfooding

From this epic on, the human's inbox holds only what needs them during the rest of the build, and agent traffic stays folded on every surface. The human's notes for v0.2 and the drafts of the v0.1 release notes live as their own folder artifacts, from which the release item's Notes are written.

## Constraints

- **ADRs.** 0005 (Neovim is the host): the browser and the folds are Neovim views, with no plugins. 0003 (The hub is a per-project daemon extracted from the BCAS driver hub): the hub keeps the artifact index and the retention sweep. No ADR covers layers or artifacts; §3.5 and §3.6 record none.
- **Risks** from the sizing: one classifier for every surface, or they disagree; folders through paths written for files (copy, promote, archive, retention delete), the path and partial-failure classes that cost the v0 run the most review rounds.
- **References.** The mockups in `docs/design/main-screen/`: `Inbox.dc.html` (the v0 inbox anatomy), `Thread.dc.html` (watch dimmed, the inbox column's sections), `SessionsPanel.dc.html` (the stopped fold), `ItemsBoard.dc.html` (folded backlog), `Palette.dc.html` (dimmed hits, the `~` group). No mockup shows the Artifacts browser, so §3.6's words are the reference.
- **The v0 tail.** No open tail item touches this code.
- **Order.** Last in the Neovim lane, after "The task graph"; it waits for "Workbench basics" and "Threads that read". "Release from the item" waits for it.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub.
- **Language.** Every artifact, item, commit and doc in English.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. Here the protocol covers the artifact tools, the retention sweep and the refusals.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.5 Visibility levels, §3.6 Artifacts as a workspace.
- Map T-81: decisions T-94 and T-95.
- GLOSSARY: Layer, Artifact, Aide, Topic, Agents topic.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- Mockups: `docs/design/main-screen/Inbox.dc.html`, `Thread.dc.html`, `SessionsPanel.dc.html`, `ItemsBoard.dc.html`, `Palette.dc.html`.

## Comments

### qa-18 · 2026-10-11T15:15:57.536Z

verdict: qa
result: not clear
by: qa-18 [qa]
run: qa-2026-10-11-18
commit: 36a4860b4e5b56e785b933a40702b3ede50ba53f

| Case | Result | Evidence |
| --- | --- | --- |
| M0 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M0.log) |
| M1 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M1.log) |
| M2 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M2.log) |
| M3 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M3.log) |
| M4 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M4.log) |
| M5 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M5.log) |
| M6 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M6.log) |
| M7 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M7.log) |
| M8 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M8.log) |
| M9 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M9.log) |
| M10 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M10.log) |
| M11 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M11.log) |
| M12 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M12.log) |
| M13 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M13.log) |
| M14 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M14.log) |
| M15 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M15.log) |
| M16 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M16.log) |
| M17 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M17.log) |
| M18 | PASS | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M18.log) |
| M19 | FAIL (supplement below) | [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M19.log) |
| M19-AIDE | FAIL | [screen](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M19-AIDE-stopped-aide.screen.txt), [command log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/M19-AIDE.log) |
| D1–D3 | BLOCKED, deferred under D19 | Two-day/daily-timer behavior, real agents, human visual judgement |

**Low — C9, M19-AIDE, nvim/README.md:56.** The sentence “Stopped Aides join the stopped fold” contradicts current behavior. In the scratch project, `cland session stop aide-1` followed by `cland session list --json` shows `status: stopped, layer: now`. The headless sessions panel displays NOW → STOPPED · 1 → aide-1, outside `more (2)`. This agrees with the classifier's aide-before-stopped precedence. The supplemental check supersedes the initial M19 PASS note. No product fix was made.

**Low — M19, docs/visibility.md:105.** The default table omits `inbox.plan`, which `hub/src/hub/visibility.ts:10` defines as watch. This reference file is outside C9's two README files.

**Brief corrections / observations:**
- M6's `more (3)` accurately includes two background epics plus the done task; the brief expected 1. The background filter includes all three containers.
- M9 requires a fixture close override because the scratch epic has no QA verdict. The Coordinator authorized the human-only override; it only established a closed parent for the test. Both post-close UI expectations passed.
- M11's moved id disappears from ordinary lists; opening it returns a resolved shared artifact with `movedTo`. The brief's moved status describes the underlying source index, not resolved open output.
- M11 promotion leaves preexisting init-generated files untracked too; the index and HEAD were unchanged.
- M17 inherited an explicitly open Archive from M15. `zR` preserved that choice; `A` hid the deleted entries.
- M3's warning-dismissal notice is visually shortened to an ellipsis at 160 columns. Warnings remain intact, as required; targeted layer tests pass.

**Validation:** all 62 tests passed across the brief's ten serial targeted invocations, with zero failures, skips or cancellations. Raw logs retain every passing test name. M0–M18 product checks passed. All 11 child items and T-109/T-110 were closed; T-130 is a release. The requested known README fixes are present.

**Build provenance:** run began at `2d231f9d3404929a0550cf7aef7521d6cdcc941c`. Dev moved during evidence collection to `36a4860b4e5b56e785b933a40702b3ede50ba53f`. Verified delta: only `nvim/test/plan.test.ts`, T-223 readiness waits, 15 insertions and 2 deletions; this test is excluded by the brief. No product source changed. The Coordinator explicitly authorized continuing and recording at the new tip. Logs retain the SHA at recording time; product evidence spans both identical product builds.

**Verdict:** not clear, run `qa-2026-10-11-18`, commit `36a4860b4e5b56e785b933a40702b3ede50ba53f`. Verify C1–C8 through separate structured criterion marks; fail C9 for the stopped-Aide README contradiction. D1–D3 are deferred to v0.1.1 under D19 and do not independently block this verdict.


Evidence artifact A-1298: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1298-t-115-qa-demo-evidence-qa-2026-10-11-18/report.md

Criteria: C9 failed (M19-AIDE: nvim/README.md:56 says stopped Aides fold, but they remain Now under STOPPED.).
