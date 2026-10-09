---
id: T-118
kind: task
title: "The v0.1 release item: the release kind, the parenting rule, list --under and the path header; v0.1 created and its epics re-parented"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by: []
topic: topic-41
branch: t/T-118-the-v0-1-release-item-the-release-kind
created: 2026-10-09T21:56:01.700Z
updated: 2026-10-09T22:01:43.020Z
---

## Parent

T-107 (v0.1 release and status), slice 1 of 6. Spec `docs/spec/v0.1.md` §3.1 (Levels, Parenting rule, The release item, Tools, Migration).

## What to build

The tracker gains the `release` kind. Its frontmatter carries `version`, semver without the `v`, optional at creation. Its body has a `## Notes` section. The hub enforces the parenting rule on create and on link, with the default levels `release` › `epic`: an epic's parent is a release or none; a leaf's parent is any container or none; a parent that breaks the rule is refused. `cland task list --under T-n` lists a subtree. `cland task view` shows the path, release › epic › task, in its header. The MCP task tools mirror the CLI: `task.create` with `kind: release` and `version`, `task.list` with `under`, and the path in `task.view`.

Then the ticket performs the migration on this repository. It creates the v0.1 release item, version `0.1.0`, with a goal and a `## Notes` section taken from spec §1 and §4. It re-parents every epic labelled `v0.1` (T-107 to T-117) under it, through the hub. No release item is made for v0.0.1, and the v0 epics stay unscheduled. T-19 stays open as the parent of the v0 follow-ups.

In this slice the levels are the built-in default. Reading them from `[tracker] levels` is slice 2.

## Acceptance criteria

- [ ] `cland task create --kind release --version 0.1.0 "…"` creates a release item; a malformed version is refused.
- [ ] Linking an epic under a task, or a release under an epic, is refused on create and on link, with the rule named; a leaf under a release or an epic is accepted.
- [ ] `cland task list --under T-n` lists the subtree, and `cland task view` shows the path from the release in its header, both in the CLI and through the MCP tools.
- [ ] The v0.1 release item exists in this repository, and `cland task list --under` it lists the eleven v0.1 epics; the v0 epics have no release.
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` describe the release kind, the parenting rule, `--under` and the path header.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Tests through the hub's frame protocol and the CLI against a temporary project (`hub/test/harness.ts`); no new seams inside the hub. ADR 0002: the fields live in the item files and the hub indexes them. The migration on this repository runs through `cland task` once the code is merged and the hub restarted; the Coordinator runs it, or the Implementer documents the exact commands in its report.

## Comments

### impl-118 · 2026-10-09T21:58:04.745Z

Implementation started on the claimed task branch. I will cover release/version persistence, default parenting enforcement, subtree/path CLI and MCP behavior, docs, and exact post-merge migration commands for the Coordinator.

### impl-118 · 2026-10-09T22:01:43.020Z

Release/version persistence, shared default parenting checks (including kind-edit bypass guards), descendant filtering, and CLI/MCP ancestry headers are implemented. Focused red→green tests passed for the first three slices. Map children follow the approved question/task exception. Migration remains post-merge/restart, with commands to follow in the report.
