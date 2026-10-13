---
id: E-20
kind: epic
title: "cland v0 slice 2, territory, artifacts and the QA lane"
state: closed
labels:
  - ready-for-agent
  - epic
  - slice-2
assignee: null
parent: null
blocked_by:
  - E-19
topic: null
branch: null
created: 2026-10-08T11:40:46Z
updated: 2026-10-09T16:44:26.541Z
github:
  repo: Kealman/cland-v0
  number: 20
  url: https://github.com/Kealman/cland-v0/issues/20
closed: 2026-10-09T16:44:26.545Z
---

Spec: `docs/spec/v0.md` on `main` (section 7). Depends on the slice 1 epic #19. ADRs: `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `0003-hub-is-a-per-project-daemon-from-the-bcas-core.md` (stdio addendum), `0004-agents-work-on-a-local-git-territory.md`. Research: branches `research/git-engines` and `research/qa-astra`. Decisions: https://github.com/Kealman/cland-v0/issues/14 (git strategy), https://github.com/Kealman/cland-v0/issues/9 (artifacts), https://github.com/Kealman/cland-v0/issues/16 (QA research), https://github.com/Kealman/cland-v0/issues/13 (hub, stdio transport).

## Problem Statement

With slice 1 in daily use, agents still work on branches whose remote is GitHub, so their many branches, reviews and merges land in the space meant for humans, and nothing gates a merge on the verdicts the tracker already holds. Prompts are still drafted in loose files and agents still show their work through files in temporary folders. QA runs by hand: there is no scripted way for the QA role to drive cland itself, and a sandboxed QA run cannot reach the hub over its socket.

## Solution

Slice 2 completes cland v0: a local git territory where agents branch, get reviewed and merge behind cland's verdict gate, with releases fast-forwarded to GitHub as one deployable version; artifacts as first-class files with ids, kinds, statuses and a promote action; the QA lane infrastructure (a Lua QA API, a brief format, the `qa` skill, the hub's stdio transport); and the two UI additions decided on the map. v0 is done when the first release of cland leaves for GitHub through `cland release` from inside cland.

## User Stories

1. As the human, I want `cland init` to re-point an existing project so that a local bare repository becomes `origin` and GitHub becomes the remote `github`, reversibly, so that agent traffic stays on my machine.
2. As the human, I want `main` to mirror GitHub and `dev` to be the agents' integration branch, so that the two audiences never collide.
3. As the Coordinator, I want cland to create a task branch and a worktree when an item is claimed, so that every Implementer works in isolation.
4. As an Implementer, I want my session to start in the item's worktree, so that I never touch another task's files.
5. As the Coordinator, I want `cland merge` to refuse a merge without a clear review verdict from a Reviewer session and, where the item requires it, a clear QA verdict from a QA session, so that the gate git lacks is enforced by cland.
6. As the Coordinator, I want `cland merge` to land a task on `dev` as one squash commit whose message comes from the item, after a rebase, so that `dev` stays readable.
7. As the human, I want conflicts on rebase to go back to the Implementer, so that the merge step never resolves them silently.
8. As the human, I want `cland release` to fast-forward `main` to `dev`, tag it, build release notes from the items' titles and push `main` and the tag to GitHub, so that GitHub receives one deployable version per task history and no pull requests.
9. As the human, I want collaborators' work on GitHub to come back with a fetch of `main` and a rebase or merge of `dev`, so that both audiences stay in sync.
10. As the human, I want abandoned items to have their worktree and branch removed after my confirmation, so that the territory stays clean.
11. As the human, I want tools that push to `origin` on their own to reach only the territory, so that nothing leaks to GitHub by accident.
12. As the human, I want every artifact to have an id, a kind, a status and an optional topic binding, so that agent output stops piling up in temporary folders.
13. As the human, I want to draft a long prompt as a prompt artifact in a full Neovim buffer and then send it as a message or attach it, so that the composer is for short messages only.
14. As an agent, I want `artifact.create` to register a file and announce it in the topic, so that showing the human a diagram or a page is one call.
15. As the human, I want Markdown and Mermaid artifacts rendered inside Neovim and HTML, SVG and PNG opened in the browser with one key, so that I can look at what agents made without leaving the flow.
16. As the human, I want to promote an artifact into the repo, so that the ones worth keeping become ordinary project files.
17. As the human, I want archived artifacts deleted from disk after a configurable period while their index entries remain, so that the folder cleans itself.
18. As the human, I want a topic's artifacts listed in the UI, so that I find what was shared where.
19. As the human, I want the Agents topic filterable by item and by session, so that I can follow one thread of agent activity.
20. As a QA session, I want a scripted way to start cland headless, drive it and read its screen and state, so that I can verify behaviour without a desktop or a terminal app.
21. As a QA session, I want a brief file format in the repo and a `qa` skill that runs it, so that QA runs are repeatable.
22. As a QA session, I want the hub reachable over stdio from inside the Codex sandbox, so that a sandboxed run can talk to the hub without a socket.
23. As the human, I want QA verdicts recorded as structured comments on the item and one line per case in a runs log, so that the merge gate and I can read them.
24. As the human, I want the first cland release to leave for GitHub through `cland release` from inside cland, so that v0 proves itself on its own repository.

## Implementation Decisions

- Agents work on a local git territory (ADR 0004): the project's `origin` is a bare repository inside `.cland/territory.git`, GitHub is the remote `github`; `main` mirrors GitHub, `dev` integrates, task branches `t/T-123-slug` start from `dev`; one worktree per item under `.cland/worktrees/`, created by cland at claim time and removed after the merge; harnesses do not create their own worktrees (Claude Code's `WorktreeCreate` hook is intercepted).
- `cland merge` is a hub tool available to the Coordinator; it checks a clear review verdict by a session holding the Reviewer role, a clear QA verdict by the QA role where the item is marked as requiring QA, and a branch rebased on `dev`; otherwise it refuses with the reason. The hub guarantees the reviewer's identity by the calling session's role; no commit signing in v0.
- `cland release` fast-forwards `main` to `dev`, tags `vX.Y.Z` with a number the human chooses, builds release notes from the titles of the items in `main..dev` into the tag message, and pushes `main` and the tag to `github`. Squashing a release into one commit is rejected.
- `cland init` in a project whose `origin` is GitHub creates the bare repository, renames `origin` to `github`, adds the bare repository as `origin`, creates `dev` from `main` if absent, pushes nothing, and is reversible with `cland init --undo`.
- Artifacts live in `.cland/artifacts/` as `A-123-slug.<ext>` with a hub index (id, title, kind, creator, time, topic binding, status); kinds prompt, note, page, diagram, file; statuses draft, sent, shared, archived; not committed unless promoted; closing a topic archives its artifacts; archived files are deleted after a configurable period (default 30 days); bound to topics, never to sessions.
- The hub gains `artifact.create(kind, title, path | content, topic)`, available to every connected role; role clauses require agents to show things through artifacts, never through files in tmp.
- The QA lane: `cland --headless --qa <case>` with a Lua QA API, stub harnesses, a JSON state snapshot and the exit code as the verdict; briefs as files in the repo; runs through `/codex:rescue --background --fresh --model gpt-6-astra` or through the QA role; the hub's JSON-lines frames over the stdio of a child process for sandboxed runs (ADR 0003 addendum). tmux and ttyd lanes stay optional for real-TUI and visual cases, with their grants documented in the qa-astra research.
- The `qa`, `merge` and `release` skills ship with the process layer; the `AGENTS.md` rule becomes: only `cland release` pushes to `github`.
- UI additions: Agents-topic filters by item and session; the topic's artifact list.

## Testing Decisions

- Same seams as slice 1: the hub's frame protocol as the primary seam, the harness process boundary as the only other one.
- Git operations are tested against real git on disk: a temporary project with a bare territory, task branches and worktrees; `cland merge` and `cland release` are asserted through the resulting git state (refs, commits, tags) and the verdicts in the item files, never through mocks of git.
- Artifacts are tested through the hub tools and the files they produce in a temporary cland folder.
- The QA lane is tested by running a headless cland against a stub hub over stdio and asserting on the screen text and the state snapshot; this doubles as the first scripted QA case.
- Prior art: the slice 1 suite; the research probes on branch `research/qa-astra` (headless Neovim driven by `nvim_input`, tmux capture, ttyd in Chrome).

## Out of Scope

Everything in the map's fog: a sessions board as a separate screen, cost per item, crew presets, a journal viewer, the build's distribution format, the keymap scheme, inline images in the terminal, GitHub sync of the tracker, the per-item change tour, commit signing per role, a forge (Gitea stays the fallback), remote access, multi-user mode.

## Further Notes

- The git-engines research (branch `research/git-engines`) records why no forge is used and what GitHub's personal-account limits are; the qa-astra research records that Computer Use cannot drive terminal apps and that the Codex sandbox blocks Unix sockets while network is off.
- v0 is complete when slice 2 is closed and the first release of cland has left for GitHub through `cland release` from inside cland.

## Comments

### coord · 2026-10-09T08:36:57.490Z

Slice 2 planned on 2026-10-09 (the Coordinator, from a sub-agent's draft read against main b8368b3; the human's stand-in approved the list, the merge order and the four shaping decisions through ask 343ab54b, option 1). Twelve tracer-bullet tickets under this epic, with native blocking edges: T-53 cland init territory (none); T-54 verdict commit and provenance (none); T-55 artifact.create and the topic's list (none); T-56 Agents topic filters (none); T-57 cland --headless --qa (none); T-58 task branches and launch with an item (T-53); T-59 cland merge (T-53, T-54); T-60 prompt drafting (T-55); T-61 promote, archive, cleanup (T-55); T-62 QA briefs and the qa skill (T-54, T-57); T-63 cland release and sync (T-59); T-64 v0 done, the definition of done (all). First wave: T-53, T-54, T-55, T-56, T-57. T-58 and T-59 run serially (both extend the territory module). T-52 (the cold OpenCode catalog) is a small slice-1 item scheduled beside T-58.

Decisions (each ticket names the ones it rests on): D1 the project root lives on dev; the Coordinator's tracker and docs commits land there; task work reaches dev only through cland merge; main moves only by cland release and cland sync. D2 one territory module runs the territory's git commands, without a hub for cland init and inside the hub for worktrees, merges, releases and syncs, under one lock; spec 4.2 is amended accordingly (recorded with T-59). D3 task worktrees stay linked to the project's own repository; the territory is origin. D4 a verdict pins a commit; the gate counts it while its commit is the branch tip or has the same patch-id. D5 only the latest verdict of each kind written through the hub by a session holding the role, not claiming the item, satisfies the gate; a verdict the Coordinator records for a rescue run does not; the human overrides with a reason. D6 the label qa-required says an item needs a QA verdict for the gate. D7 a worktree is made at the first claim of an open task, and by session.launch with an item. D8 only Claude Code sessions launched with an item get the worktree-creation refusal; the Coordinator's sub-agent worktrees stay. D9 cland merge never rewrites a task branch; on a conflict the Implementer rebases. D10 a merge closes the item, releases the claim and removes the worktree and branch once no running session stands inside. D11 cland release is the human's, or the Coordinator's from its shell after the human answered the version ask (the human's own, not the stand-in's); cland never edits version files. D12 Mermaid renders as its source in a buffer plus a browser view. D13 a QA case always runs against a fixture project with its own stdio hub or the stub hub. D14 QA runs and evidence live under .cland/qa, briefs and cases under qa/. D15 cland's own repository moves onto its territory right after T-53 merges; until T-63 lands the Coordinator squashes onto dev by hand and the stand-in pushes a verified checkpoint of main to github at step-level milestones. D16 no check command in the gate in v0.

Risks carried into the tickets: Unix sockets still blocked for rescue runs and network-less roles (the QA lane keeps one process over stdio); approvals auto-declined in rescue runs (self-contained briefs); the Codex embedded-mode trap (-c stays on the app-server); a sub-agent in the Coordinator's shell is taken for the Coordinator (the merge and release skills forbid delegating them); the size cap and rate limit apply to artifact messages; hand-written verdicts (provenance, D5); the root moving under the Coordinator during a merge (refusal on touched uncommitted files); a worktree removed under a live session (the merge waits); gh still reaches GitHub through the github remote (only the AGENTS.md rule stops it).

### coord · 2026-10-09T10:10:54.026Z

Decision D15 executed 2026-10-09 10:11Z: `cland init` ran on cland's own repository (root on main at a833dc5, clean, suite green). Result: `.cland/territory.git` with `main` and `dev` both at a833dc5 and HEAD on `dev`; `origin` is the territory, `github` is https://github.com/Kealman/cland-v0.git; doctor 21 ok; the hook refuses a direct push to `dev`; AGENTS.md carries the territory push rule (e7abf62). Documented deviation from D1, approved by the human's stand-in: the root stays on `main` until T-59 (`cland merge`) is merged, because the running hub and the Coordinator's `git merge --no-ff` integration live on main and no `cland merge` exists yet; `dev` receives hand-squashed checkpoints of merged task work meanwhile, and the stand-in pushes `main` checkpoints to `github` by hand. The condition that ends it: once T-59 is merged and the hub restarted, the root goes to `dev` and task work reaches `dev` only through `cland merge`.

### coord · 2026-10-09T10:23:54.149Z

Addendum to the D15 deviation (10:23Z): T-58 makes the task base a territory setting, `cland.taskBase` in `.cland/territory.git/config` (must name an existing local branch; else `dev` when present, else `main`). On cland's own repository it is set to `main` now (`git --git-dir .cland/territory.git config cland.taskBase main`), so task branches start from main during the interim; the condition that ends the deviation gains one step: after T-59 merges and the hub restarts, `git --git-dir .cland/territory.git config --unset cland.taskBase`, the root to `dev`, merges only through `cland merge`.

### coord · 2026-10-09T14:28:32.999Z

The D15 interim ended on 2026-10-09 at 14:28Z, by decision of the human's stand-in (ask 23ed05f8, option 1), after T-59 merged and the hub restarted on a9a204f (pid 71019).
- `dev` was fast-forwarded from a833dc5 to `main` 5ae9cc3, as an ancestor, so nothing was rewritten.
- `dev` and `main` were pushed to the territory once with cland's marker, as a migration.
- `cland.taskBase` is unset in the territory's config.
- The root checkout is on `dev`, tracking `origin/dev`. Doctor's territory check is ok.
From here D1 holds as written: task work reaches `dev` only through `cland merge`, the Coordinator's tracker and docs commits land on `dev`, and `main` moves only by release. Until T-63 (`cland release`), the Coordinator fast-forwards `main` to `dev` with the marker at milestones, and the stand-in pushes `main` to `github`. Branches still open from before the switch (T-70) are claimed from `main`. They merge through `cland merge` onto `dev`; the gate's conflict check covers the difference in base.

### coord · 2026-10-09T15:01:00.742Z

Run note, 15:01Z: the first live `cland merge` on this repository.
- `cland merge T-70` refused correctly with `merge-conflict` in hub/src/adapters/sessions.ts. T-70 branched from `main` before the switch, and T-71 changed the same file on `dev`. No ref moved. impl-70 rebases onto `dev`, per D9.
- The Coordinator's tracker commit f54beb9 on `dev` was refused by the territory's hook on a plain push. D1 expects those commits on `dev`, so I pushed it with the marker, as a fast-forward of the tracker commit only. The missing sanctioned path is filed as T-74.
- T-73, the retrospective the human asked for, is running on Claude Code Sonnet. Run notes go on this item from now on, by the human's decision (ask dfccb3a6, option 1).

### coord · 2026-10-09T15:22:24.654Z

Run note 15:22Z. T-63 merged (70a9cde) and T-70 merged (88fe9b7); the Coordinator's release and sync grants are in b39e3b8. The human decided (ask 7793c000, option 2): no restart now; restart once after T-60, T-61 and T-62 merge, then the first release. T-60 (impl-60, Codex), T-61 (impl-61, Codex) and T-62 (impl-62, Claude Code on Sonnet) run in parallel, merge order T-60, T-61, T-62. qa-62 (Codex gpt-6-astra) launched for T-62's live QA criterion. Tracker pushes to dev still use the marker until T-74.

### coord · 2026-10-09T16:28:37.534Z

Run note 16:30Z. T-60 (1be69e4), T-61 (9a95f99) and T-62 (db7b7d7) merged in that order. T-60 needed one README rebase after T-70; T-61 one rebase after T-60; T-62 three review rounds on qa-record.sh recovery and one rebase. Brief rules from the retrospective (A-96) caught the request-path class in self-review twice (T-60, T-61) before external review. Rounds came from partial failure (T-60 pointer cap, T-61 retention and rollback, T-62 recovery), class C as forecast. Filed T-75 (shared synchronous permission and journal I/O). Project config: a8ba2b2 adds artifact.promote and [artifacts] retention_days; roles.toml QA workflow edits await the human (ask a8e6dc43). Full suite on dev 82617d8 running, then the single restart and the first release, by the human's decision (ask 7793c000).

### coord · 2026-10-09T16:39:45.086Z

Run note 16:40Z. First release: v0.0.1, by the human's own answer in topic-30 (ask 73657edc). `cland release v0.0.1` from the Coordinator's shell, exit 0. Commit 8ffd8ca; annotated tag object e1aefa8. GitHub main and its tag, local main and the territory's main all read back at 8ffd8ca; no .cland/release.tmp left. Before it: the hub restarted on dev (pid 14410; doctor 20 ok, 2 warn, 0 fail), and roles.toml adopted the defaults (c4db73a, ask a8e6dc43). Remaining slice 2: T-64 (v0 done, with the human). Follow-ups: T-74, T-75, T-76.

### coord · 2026-10-09T16:44:26.541Z

Closed with T-64, as its body says. Slice 2 is complete: T-53 to T-63 are merged, and v0.0.1 left for GitHub through `cland release` from inside cland (commit 8ffd8ca). Open follow-ups now under T-19: T-74 (moved from slice 2), T-75 and T-76.
