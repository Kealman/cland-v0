---
id: Q-87
kind: question
title: "Item hierarchy: a release above epics, and whether levels are configurable"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: M-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:41.171Z
updated: 2026-10-09T19:26:30.982Z
---

## Question

How does a release sit above epics in the tracker, and are the hierarchy levels configurable per project?

## Context

Items have kinds epic, spec, task, question and map, a `parent` and `blocked_by`; a release exists only as a git tag made by `cland release`; the items tree never folds and the board shows every item. The human wants a release above epics now (v0.1 is one: a set of epics, each with its tasks) and a hierarchy that can differ per project later (sprints, milestones for others), because each project's organisation differs. GLOSSARY already defines Release as the act of moving `main` and pushing to GitHub.

## To decide

- `release` as a new kind, or levels configured in `config.toml` (an ordered list of kinds and which kind may parent which), or both.
- What a release item holds: goal, its epics, the cut, the source of its release notes; how it relates to the git release and its tag (one term or two in the GLOSSARY).
- Whether the items tree folds by level, and what the items panel and the board scope to (the open release, an epic).
- What `cland task` and the MCP task tools gain (create with kind, link, list by level), and how the v0.1 epics move under the release.
- The GLOSSARY entries and whether the configurable-levels choice needs an ADR.

Grill with the design canvas at hand for the tree. Record the resolution as a comment, the spec section in `docs/spec/v0.1.md`, and the GLOSSARY update.

## Comments

### human · 2026-10-09T19:26:18.877Z

Resolution (2026-10-09, the human accepted every point).

- Container kinds come from `levels` in `.cland/config.toml`, default `["release", "epic"]`, top-down; leaf kinds `task`, `question`, `spec` stay fixed; `map` is outside the ladder.
- Parenting rule enforced by the hub: a container sits under the container one level above it or nowhere; a leaf sits under any container or nowhere.
- Release is one term: the item (kind `release`, frontmatter `version`, children are its contents, a `## Notes` section opens the release notes) and the act (`cland release`). `cland release --item T-n` tags `v<version>`, builds the notes from the item and its epics, comments the tag and closes the item; it refuses open children or a missing version. Without `--item` nothing changes.
- A container with open children cannot be closed; no force flag.
- The items panel folds by level; a "current release" (lowest open version unless chosen) persists in `.cland/ui.json`, shows in the top bar, and scopes the panel, the board and the graph; items under no release form the "unscheduled" group; "all" shows everything.
- Tools: `create --kind release --version`, validated `--parent`, `list --under T-n`, the ladder path in `view`; MCP mirrors the CLI.
- Migration: the first v0.1 build ticket creates the v0.1 release item and re-parents the `v0.1` epics; no retroactive v0.0.1 release.
- Sprints and milestones are groupings across the tree, not levels; still fog. No ADR: the choice is reversible.

Recorded in docs/spec/v0.1.md §3.1 and GLOSSARY.md (Release rewritten, Unscheduled added).

### human · 2026-10-09T19:26:30.982Z

Resolved: see the resolution comment; spec v0.1 §3.1
