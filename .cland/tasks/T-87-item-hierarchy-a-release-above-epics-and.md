---
id: T-87
kind: question
title: "Item hierarchy: a release above epics, and whether levels are configurable"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:41.171Z
updated: 2026-10-09T19:09:41.171Z
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
