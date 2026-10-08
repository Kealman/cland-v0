---
id: T-9
kind: question
title: "Artifact model: where artifacts live, their lifecycle, and how agents show things to the human"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: T-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:52:11Z
updated: 2026-10-08T13:17:15.592Z
github:
  repo: Kealman/cland-v0
  number: 9
  url: https://github.com/Kealman/cland-v0/issues/9
---

## Question

What is an artifact and where does it live? Decide:

- Scope: per project, per topic, per session.
- Lifecycle: draft, sent as a prompt, attached to a message, shown by an agent, archived.
- How an agent shows a Markdown page, an HTML page or a diagram to the human from inside a terminal IDE.
- How the human drafts a prompt in the IDE and sends or attaches it.
- What replaces today's unstructured tmp folders, and how junk is cleaned up.

Produce glossary entries.

## Comments

### Kealman · 2026-10-07T17:38:30Z

<!-- github-comment: 6043382884 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. No ADR: the model is easy to change. The term Artifact is refined in `GLOSSARY.md` (f3b89b1).

**Where artifacts live.** In a sub-folder of the project's cland folder (the name is decided with the state layout), as plain files, with an index in the hub (SQLite): id, title, kind, creator (the human or a session), time, topic binding, status. Not committed by default: they are the working material of the conversation. An explicit promote action moves an artifact into the repo (`docs/` or a chosen path), after which it is an ordinary project file. This replaces today's tmp junk: every file has an id, an owner, a binding and a lifetime.

**Ids and references.** `A-123`, sequential per project. Messages reference `A-123`; the UI links it; an agent's delivery carries the id and the file path.

**Kinds and display.** `prompt` (a human's draft), `note` (Markdown), `page` (HTML), `diagram` (Mermaid, SVG or PNG), `file` (anything else). In v0, Markdown and Mermaid source render inside Neovim (treesitter, conceal); HTML, SVG and PNG open in the default browser with one key (`open`). Inline images in the terminal (the kitty protocol, `vim.ui.img` on master) stay in the fog.

**Drafting a prompt.** The composer serves short messages. For long prompts the human opens a `prompt` artifact as a Neovim buffer with the full editor, then either sends it as a message (its text becomes the body of a message in the current topic) or attaches it (the message references `A-123`). The artifact's status becomes `sent`.

**Artifacts from agents.** The hub tool `artifact.create(kind, title, path | content, topic)` registers the file and posts a system message into the topic ("agent shared A-45: diagram"); the human opens it from the topic. Role clauses require: to show the human something, create an artifact, never a file in tmp. Available to every role connected to the hub.

**Lifecycle and cleanup.** Statuses `draft` → `sent` / `shared` → `archived`. Closing a topic archives its artifacts; archived files are deleted from disk after a configurable period (default 30 days) while the index entry remains; promoted artifacts are exempt. The UI lists a topic's artifacts.

**Binding.** To a topic (optional) and through it to an item; never to a session, since artifacts outlive sessions. Unbound artifacts appear in the project-wide list.

**Not decided here.** The sub-folder name (state layout, fog); inline image rendering (fog); the promote target convention (process layer or implementation).
