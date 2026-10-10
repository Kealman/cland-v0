---
id: T-117
kind: epic
title: "Epic: Release from the item"
state: open
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: T-130
blocked_by:
  - T-107
  - T-108
  - T-109
  - T-110
  - T-111
  - T-112
  - T-113
  - T-114
  - T-115
  - T-116
topic: null
branch: null
created: 2026-10-09T21:51:34.973Z
updated: 2026-10-10T17:03:43.026Z
---

## Goal

The human ships v0.1.0 from its release item: `cland release --item` takes the version from the item, writes the notes from the item and its epics, tags and pushes, and closes the item. This epic also runs the v0.1 acceptance pass on `dev` and the release itself, so v0.1 is done when its item closes. Today `cland release vX.Y.Z` takes the version by hand, and the notes are only the commit subjects.

## Contents

- **§3.1 Item hierarchy, Releasing**: `cland release --item T-n` tags `v<version>`, writes the notes from the item's `## Notes`, its epics' one-line deliverables and the commit subjects, refuses an item with open children or no version, and on success comments the tag on the item and closes it; without an item, a release behaves as today, so a hotfix needs no planning.
- **The release flow**: the `release` skill and the Coordinator's clause release from the item after the human approves the version and the notes.
- **The v0.1 acceptance pass and v0.1.0**: every v0.1 epic's definition-of-done demo replayed on `dev`, the open `tech-debt` items triaged, and v0.1.0 released from its item.

Not in this epic: anything the other ten epics own. It waits for all of them.

Choices where the spec is silent:

- An epic's one-line deliverable is the first sentence of its `## Goal`; every v0.1 epic opens its Goal with one.
- With `--item`, a version given on the command line must match the item's.
- The `tech-debt` triage follows the standing rule: fix before the release only what blocks it; the rest stays for the v0.1 tail.

## Tracer-bullet order

1. **A dry run from the item.** `cland release --item T-n --dry-run` reads the release item, refuses on open children or a missing version and names them, and previews the tag and the notes. Demo: a dry run on the v0.1 item lists the open epics that still block it.
2. **Notes from the item.** The item's Notes section, its epics with the first sentence of their Goal, then the commit subjects; the `release` skill shows them to the human in an ask before the real run. Demo: the dry run's notes read as finished release notes.
3. **Release and close.** The tag `v<version>`, `main` fast-forwarded to `dev` and pushed to GitHub as today; the hub comments the tag on the item and closes it; the next open release becomes the current one; a release without `--item` behaves as before. Demo: a scratch project releases from a test release item, which then closes with the tag in its comments.
4. **The v0.1 acceptance pass.** QA replays every epic's definition-of-done demo on `dev`, with the cases the epics shipped, and records a QA report artifact; findings are filed as `qa-found` and `needs-triage`; the open `tech-debt` items are triaged; the v0.1 item ends with no open children. Demo: the report lists each epic's demo and its result.
5. **v0.1.0.** The item's Notes are written with the human (or an Aide for them); the Coordinator runs `cland release --item` from its own shell after the human approves; GitHub's `main` carries the tag `v0.1.0`; the item closes with the tag comment. Demo: `v0.1.0` on GitHub and the v0.1 release folded as closed in the items panel.

## Definition of done

The acceptance pass below is the human's, and the only human acceptance of v0.1: the version, the notes and one walkthrough on v0.1 (decision D16). Before it, QA replays the other ten epics' demos on `dev` as their own paragraphs say, through the `cland` CLI and a headless workbench, and each of those epics is closed on a clear verdict with its checkboxes verified by id; QA also runs this epic's `cland release --item --dry-run` and the checks that need no human, and records a clear verdict on this epic for them, leaving the approval of the version, the notes and the walkthrough, and the release itself, to the human.

The Coordinator runs `cland release --item T-<v0.1> --dry-run`: it shows `v0.1.0`, the Notes the human approved, the ten other epics with their one-line deliverables, and the commit subjects. After the human's approval it runs the release: `main` moves to `dev`, is tagged `v0.1.0` and pushed to GitHub; the hub comments the tag on the release item and closes it; the items panel folds v0.1 as a closed release.

- [ ] `cland release --item` refuses an item with open children or no version, and names the reason.
- [ ] The notes hold the item's Notes, its epics with their one-line deliverables, then the commit subjects.
- [ ] A successful release comments the tag on the item and closes it; a release without `--item` behaves as before.
- [ ] The `release` skill and the Coordinator's clause release from the item after the human's approval.
- [ ] Every v0.1 epic's definition-of-done demo passes on `dev`, recorded in a QA report artifact.
- [ ] The v0.1 release item has no open children, and the open `tech-debt` items are triaged.
- [ ] The build used what it shipped: the release item, item leads, an Aide, `crew.toml` and epic plans each show in the tracker or the journal.
- [ ] `v0.1.0` is tagged on GitHub's `main`, and the v0.1 release item is closed.

## Dogfooding

v0.1 ships from its own release item. The next release starts as a release item from its first epic, its epics planned with `plan-epic` and its work staffed by `crew.toml`; hotfixes keep releasing without an item.

## Constraints

- **ADRs.** 0004 (Agents work on a local git territory): a release fast-forwards `main` to `dev`, tags it and pushes to GitHub, and only `cland release` pushes there. 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): the notes come from the item files. 0001 (Roles are hub-held state delivered as events): the Coordinator releases from its own shell and never delegates a release.
- **Research.** `research/git-engines` (`docs/research/git-engines.md`): the territory and the release mechanics. `research/qa-astra` (`docs/research/qa-astra.md`): the QA lane the acceptance pass runs on.
- **The v0 tail.** T-78 (merge, worktree and release checks read the tracker's synchronous view) touches the release checks. It is not a prerequisite unless it blocks the release; otherwise it carries `tech-debt` and the acceptance pass triages it.
- **Order.** Last in the hub lane and last of all: it waits for every other v0.1 epic.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub. This epic's release is the one push that ships v0.1.0.
- **Language.** Every artifact, item, commit and doc in English, the release notes included.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. The release runs against a temporary project with a bare territory and a stand-in GitHub remote, as `hub/test/release.test.ts` does today.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.1 Item hierarchy (Releasing, Tree and scope); §4 Outside v0.1, which the cut fills.
- Map T-81: decision T-87; the cut, T-101.
- GLOSSARY: Release, Territory, Item.
- ADRs: `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0001-roles-are-hub-held-state.md`.
- Branches: `research/git-engines`, `research/qa-astra`.

## Comments

### coord · 2026-10-10T16:54:24.008Z

Deferred to the acceptance walkthrough (D16): T-109 C1, the real Ghostty and tmux key-encoding matrix (brief M2), BLOCKED in qa-2026-10-10-15-109-c because it needs real terminals.

### coord · 2026-10-10T17:03:43.026Z

Deferred to the acceptance walkthrough (D16): T-111 M7, the Coordinator following through on an Aide's decision with a real model (qa-2026-10-10-15-111-c; the decision delivery itself passed).
