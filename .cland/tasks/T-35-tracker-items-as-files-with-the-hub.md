---
id: T-35
kind: task
title: Tracker items as files with the hub index and the cland task CLI
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-22
topic: null
branch: null
created: 2026-10-08T11:55:05Z
updated: 2026-10-10T00:58:17.397Z
github:
  repo: Kealman/cland-v0
  number: 35
  url: https://github.com/Kealman/cland-v0/issues/35
---

## Parent

Part of #19. Spec section 4.6; ADR 0002; decision https://github.com/Kealman/cland-v0/issues/8. Runs in parallel with the adapters.

## What to build

The tracker: one Markdown file per item in `.cland/tasks/`, named `T-123-short-slug.md`, with YAML frontmatter (`id`, `kind` in epic / spec / task / question / map, `title`, `state` open or closed, `labels`, `assignee`, `parent`, `blocked_by`, `topic`, `branch`, `created`, `updated`) and the body as the item's text; comments in a `## Comments` section with author and time headers; verdicts as comments with a structured header (`verdict`, `result`, `by`, `run`). The hub keeps a SQLite index for queries, serializes writes, watches the folder and re-indexes hand edits (last writer wins), and holds claims (a session's live hold) separately from the file's assignee. The `cland task` CLI (create, view, list, comment, edit, close, link, claim) talks to the hub; the same operations exist as hub tools for spokes. Ids are sequential per project. Nothing is auto-committed.

## Acceptance criteria

- [ ] `cland task create` writes a file with the frontmatter and a sequential id; `cland task list --state open --label x` queries the index
- [ ] Editing a file by hand updates the index within a second; a concurrent hub write and hand edit end with the last writer's content and a journal note
- [ ] `cland task claim T-12` records a claim in the hub without touching the file; `cland task view T-12` shows both assignee and claim
- [ ] A verdict comment with the structured header is stored in the file and queryable through the index (`cland task list --verdict review=clear`)
- [ ] Tests drive the CLI against a real hub in a temporary project and assert on the files and the index

## Comments

### Kealman · 2026-10-08T12:58:57Z

<!-- github-comment: 6060401186 -->

Done on main (merge e2e117d): item files in .cland/tasks with YAML frontmatter, SQLite index rebuilt from files with a watcher for hand edits, claims in the hub, task.* over both transports, cland task CLI. 10 tests through the CLI, the Unix socket and a spoke. Open: nothing releases a claim when its session disconnects; a title edit does not rename the file.
