---
id: Q-95
kind: question
title: "Artifacts as a workspace: browser, folders, the human's own artifacts"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: M-81
blocked_by:
  - Q-94
topic: null
branch: null
created: 2026-10-09T19:09:47.634Z
updated: 2026-10-09T19:50:17.713Z
closed: 2026-10-09T19:50:17.715Z
---

## Question

What is the artifact model in v0.1: a workspace the human browses and edits like files in an IDE, with folders, categories and visibility, in which agents' reports stay reachable but out of the way?

## Context

Artifacts are flat files `.cland/artifacts/A-<n>-<slug>.<ext>` bound to topics (kinds prompt, note, page, diagram, file; statuses draft, sent, shared, archived), opened from chips, the artifact list or the picker; closing a topic archives them and they are deleted after 30 days unless promoted (none were promoted in v0; 118 notes and 43 files, mostly agents' reports). The human prepares long prompts outside cland because there is no comfortable place: they would split a prompt into several files in a folder and work on it for days. Visibility levels decide the layers; this ticket decides the model and the browser.

## To decide

- The model: a parallel file tree under `.cland/artifacts` with folders and kinds; human artifacts never auto-archived; what an artifact id names when it is a folder; promotion to the repo.
- The browser: a tree view with categories (mine, this topic, by author or role, archived), open and edit in place, create a folder, send or attach from it; its keys and where it opens (centre or a panel).
- The tools: `artifact.*` additions (folders, move, status), the cleanup rule, what agents see of the human's drafts.
- GLOSSARY: Artifact (updated), Workspace if a new term is needed; the spec section.

Record the resolution as a comment, the spec section and the GLOSSARY update.

## Comments

### human · 2026-10-09T19:50:08.623Z

Resolution (2026-10-09, the human accepted every point).

- An artifact is a file or a folder with an entry file; both carry an A-<n> id; files inside a folder are not artifacts and are listed on request.
- The human's and Aides' artifacts are never archived or deleted automatically (archive is a layer for them); agents' artifacts live with their topic and are swept after retention unless kept (a `kept` flag that also raises them to the watch layer).
- A centre view "Artifacts": a tree with sections mine, this topic, kept, by role (folded, background), archived (folded); keys Enter, n, m, s, p, k, d, x (delete, human only, confirmed); the ␣a picker and the palette's ~ prefix stay for quick opening.
- Tools: artifact.create takes a directory path or folder: true; new artifact.keep, artifact.move, artifact.archive; CLI `cland artifact new | open | keep | move | archive | promote`; agents read anything but cannot change the human's or an Aide's artifacts.
- Editing in place: the buffer is the artifact; external edits are fine.
- GLOSSARY: Artifact rewritten. No ADR.

Recorded in docs/spec/v0.1.md §3.6 and GLOSSARY.md.

### human · 2026-10-09T19:50:17.713Z

Resolved: see the resolution comment; spec v0.1 §3.6
