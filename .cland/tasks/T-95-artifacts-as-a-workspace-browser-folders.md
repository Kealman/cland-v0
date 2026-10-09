---
id: T-95
kind: question
title: "Artifacts as a workspace: browser, folders, the human's own artifacts"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by:
  - T-94
topic: null
branch: null
created: 2026-10-09T19:09:47.634Z
updated: 2026-10-09T19:10:29.549Z
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
