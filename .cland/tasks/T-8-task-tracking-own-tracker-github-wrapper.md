---
id: T-8
kind: question
title: "Task tracking: own tracker, GitHub wrapper or hybrid"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: T-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:52:07Z
updated: 2026-10-08T13:17:15.591Z
github:
  repo: Kealman/cland-v0
  number: 8
  url: https://github.com/Kealman/cland-v0/issues/8
---

## Question

Where do tasks live: an own tracker inside cland, a wrapper over GitHub Issues, or a hybrid? Decide:

- Which entities and capabilities beyond GitHub issues cland needs. The human's starting position: an own tracker, for full control.
- What must sync to GitHub for collaboration with other people, in which direction, and who owns the sync (the system or an agent).
- How the Matt Pocock skills (`to-tickets`, `triage`, `wayfinder`) target the chosen tracker; they already support an "other" tracker described in prose.

Look up facts as needed (GitHub sub-issues, dependencies, Projects v2, milestones, rate limits). Produce an ADR.

## Comments

### Kealman · 2026-10-07T17:10:57Z

<!-- github-comment: 6042888397 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. `GLOSSARY.md` (8f74e55) carries the terms; ADR 0002, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, records the choice and the rejected options.

**Source of truth.** cland's own tracker, inside the project, is the single source of truth in v0. Synchronisation with GitHub Issues is not in v0 (single-user tool; human collaboration goes through code and releases on GitHub, not issues); it stays in the fog as "export / sync to GitHub", and stable item ids keep it possible. When a GitHub issue is needed for people, an agent creates it by hand on request.

**Entity model.** One entity, **Item**, with a `kind` (epic, spec, task, question, map). Fields: `id`, `kind`, `title`, `state` (open / closed), `labels`, `assignee` (a role or the human: the long-term owner), `parent`, `blocked_by`, `topic`, `branch`, `created`, `updated`; the Markdown body is the item's text (spec, question, brief). Relations beyond GitHub, which are the reason for an own tracker: binding to a topic, to a branch or change on the agents' territory, a **Claim** by a session with live status, **Verdict** records of review and QA, token cost per item. This field set is exactly what the Matt Pocock skills need (`to-tickets`, `triage`, `wayfinder`, `implement`), so they work without a fork.

**Storage.** Files are the source of truth: one Markdown file per item, `T-123-short-slug.md`, YAML frontmatter for the fields, body in Markdown, in a sub-folder of the project's cland folder (the folder's own name is decided with the state layout), committed to git. The hub builds a SQLite index for queries and keeps live state (claims, session status) in its own store, never in the files.

**Comments and verdicts.** Comments live in the same file under `## Comments`, each with an author and time header. Verdicts of review and QA are comments with a structured header (`verdict: review | qa`, `result: clear | not clear`, `by: <session> [<role>]`, `run: <id>`), so the UI and the hub derive "in review" and "passed QA" from them and they can be grepped.

**Writes.** All writes go through the hub (the CLI `cland task ...` talks to the hub); the hub serializes writes and updates the index. Hand edits by the human are allowed: the hub watches the folder and re-indexes; last writer wins. A claim lives only in the hub; `assignee` in the file is the long-term owner.

**Access for agents and skills.** CLI `cland task` (create, view, list, comment, edit, close, link, claim) plus the same operations as hub tools. `docs/agents/issue-tracker.md` in cland projects describes this CLI; the skills use their "other" tracker mode. Provisioning that file is the process-layer ticket #17.

**States and labels.** Minimal: `state` open / closed, free-form labels (triage, wayfinder), claim. Workflow statuses such as "in review" or "in QA" derive from verdicts and claims rather than being stored; configurable workflows stay in the fog.

**Ids.** Short stable ids, sequential per project (`T-123`), in the file name and in every reference from topics, branches and commits.

**Commits.** Tracker files live in the project repo; cland never auto-commits them. The Coordinator commits tracker changes together with the work, in the same commits where possible ("closed T-123" with the code), or the human does. A separate branch or repo for state is rejected: it would complicate collaboration through GitHub.

**Closed items and milestones.** Closed items stay in place with `state: closed`; archiving stays in the fog. No milestone entity: epics group, labels mark releases.

**Not decided here.** The name and layout of the project's cland folder (state layout, fog); GitHub sync (fog); cost tracking details (fog); provisioning of `docs/agents/issue-tracker.md` (#17).
