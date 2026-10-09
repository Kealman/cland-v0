---
id: T-60
kind: task
title: "prompt drafting: a long prompt is written in a full buffer as a prompt artifact, then sent or attached"
state: open
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: T-20
blocked_by:
  - T-55
topic: topic-27
branch: t/T-60-prompt-drafting-a-long-prompt-is-written
created: 2026-10-09T08:34:54.748Z
updated: 2026-10-09T15:15:06.945Z
---

## Parent

Part of T-20 (slice 2, ticket 7 of 12). Spec sections 4.8 and 7(b).

## What to build

From a thread, `:Cland prompt [title]`, and a key next to the composer's, opens a new `prompt` artifact (T-55) bound to the topic in a full Neovim buffer, status `draft`; `:w` saves its file. `:Cland prompt send` posts its text as the human's message when it fits the message cap (`max_text_bytes`, 8 KiB by default). Otherwise, or with `:Cland prompt attach`, it posts a one-line message with the artifact attached, whose delivery carries the path. Either way the artifact becomes `sent`. Drafts show in the topic's artifact list and the picker, and reopen with their text; hub events arriving while the human types move neither the cursor nor the text. The spoke's `send` takes `artifacts: ["A-3"]`, so the Coordinator can draft a long brief as a prompt artifact and hand it to an Implementer.

## Acceptance criteria

- [ ] `:Cland prompt Brief for T-12` in a thread opens an empty buffer; `:w` creates `.cland/artifacts/A-<n>-brief-for-t-12.md`, listed as `draft` for the topic.
- [ ] Sending a draft under the cap posts its text as the human's message, with the usual delivery stages, and marks it `sent`; over the cap it is attached, and the agent's delivery carries the path.
- [ ] A draft reopened from the picker shows its saved text; hub events arriving while the human types in it move neither the cursor nor the text.
- [ ] A spoke's `send` with `artifacts: ["A-3"]` attaches it; an unknown id is refused.
- [ ] `npm run typecheck && npm test` pass; `nvim/README.md` and `hub/README.md` document prompt artifacts and `send` with artifacts.

## Notes

Test seam: a headless Neovim against a real hub; the artifact file; the frames a spoke receives. Size M. Implementer: Codex gpt-6.1-sol.

## Comments

### coord · 2026-10-09T08:39:13.363Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/55 (a sub-issue of #20; the item is the source of truth).

### impl-60 · 2026-10-09T15:15:06.945Z

Starting prompt drafting from the assigned branch. I will use the existing artifact model and test real-hub/headless-Neovim behavior, cap boundaries, attachment validation, races, and partial failure before committing.
