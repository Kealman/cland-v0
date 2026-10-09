---
id: T-55
kind: task
title: "artifact.create: an agent shows the human a file in one call, and the topic lists what was shared"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: impl-55
parent: T-20
blocked_by: []
topic: topic-12
branch: t/T-55-artifact-create
created: 2026-10-09T08:33:53.670Z
updated: 2026-10-09T08:39:13.053Z
---

## Parent

Part of T-20 (slice 2, ticket 6 of 12). Spec sections 4.8 and 7(b), 7(d).

## What to build

The artifact store: files `.cland/artifacts/A-<n>-<slug>.<ext>` and an index in the hub's database (id, title, kind, creator, time, topic, status). `artifact.create(kind, title, path | content, topic)` is a spoke tool for every role (the grant exists already), a frame for the UI, and `cland artifact create`, with `cland artifact list [--topic]` beside it. A `path` is copied, never moved, so an artifact outlives its worktree; `content` is written. The hub posts a message into the topic that carries the artifact (id, kind, title, absolute path) as a structured field, and marks it `shared`; an agent's delivery names each artifact's id and path in the envelope. The thread shows the artifact as a chip, `▣ A-3 diagram · Merge flow`, and `↵` on it opens it by extension: Markdown and Mermaid in a read-only Neovim buffer (Mermaid as its source with the `mermaid` filetype, plus a key that opens a rendered view in the browser through a generated page loading a pinned mermaid.js; no image rendering in the terminal, decision D12); HTML, SVG, PNG and PDF in the browser through the system opener, which an environment variable replaces in tests. The topic's artifact list, a view per topic with a count in the thread header, shows id, kind, title, creator, status and time, and opens each. The picker's artifacts kind (`␣a`) replaces its "slice 2" placeholder. There is no versioning (spec 8): a new create is a new id. The size cap and the rate limit apply to the message it posts as to `send`. The four role clauses and `AGENTS.md`'s block say to show work through `artifact.create`, never through tmp files.

## Acceptance criteria

- [ ] A spoke's `artifact.create {kind:"diagram", title:"Merge flow", content:"graph TD…", topic:"topic-3"}` writes `.cland/artifacts/A-1-merge-flow.mmd`, returns the id and the absolute path, and posts a message in topic-3 whose artifact field names A-1.
- [ ] With `path`, the file is copied: deleting the source leaves the artifact readable.
- [ ] An unknown kind, a missing file, an unknown topic, a topic the caller may not write to, or both `path` and `content` is refused with a typed error.
- [ ] The thread shows the chip; `↵` opens the Mermaid source in a read-only buffer, and on a page it calls the opener with the file, as the test's opener variable records.
- [ ] The topic's artifact list and the picker's artifacts kind list A-1 and open it.
- [ ] The message a Codex or OpenCode session gets injected names A-1 and its path.
- [ ] `cland artifact create` and `cland artifact list --topic topic-3` follow the same rules.
- [ ] `npm run typecheck && npm test` pass; `hub/README.md` and `nvim/README.md` document artifacts, the chip and the list.

## Notes

Test seam: spokes and the CLI against a real hub; the files in the temp project's `.cland/artifacts`; a headless Neovim against the hub for the chip, the opener, the list and the picker; the fake harnesses for the injected envelope. Size L. Implementer: Codex gpt-6.1-sol. Can start immediately.

## Comments

### impl-55 · 2026-10-09T08:38:01.390Z

Claimed. Implementing through the item’s agreed seams: real hub/spoke and CLI, headless Neovim artifact views/opener, and fake harness envelope delivery. Starting with persistent artifact creation and publication.

### coord · 2026-10-09T08:39:13.053Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/50 (a sub-issue of #20; the item is the source of truth).
