---
id: T-52
kind: task
title: OpenCode launch with no model on a cold catalog picks the first listed free model before the Zen models arrive
state: open
labels:
  - slice-1
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T08:04:42.494Z
updated: 2026-10-09T08:35:16.619Z
---

## Parent

Part of T-19. Observed by qa-4 during T-46's QA (2026-10-09, branch 9a73ec4, a scratch hub under a sandboxed QA session with isolated XDG directories, OpenCode 2.0.24): the first no-model launch after the OpenCode server started (`o1`) selected `openrouter/inclusionai/ling-3.1-flash`; a later `GET /api/model` on the same server returned 438 models including the active, free, tools-enabled `opencode/big-pickle`, and the branch's `pickFreeModel` on that catalog returns big-pickle; a second no-model launch (`o3`) on the warm server selected big-pickle. Not reproduced with catalog snapshots; qa-4's suspicion: the launch takes the first non-empty model list (hub/src/adapters/opencode.ts around line 156) while the server is still assembling its catalog, so the known-good list (T-46) is not yet offered and the fallback to the first listed free model fires.

## What to do

- Reproduce with the fake OpenCode server answering a partial catalog first (without the Zen models) and the full one on a later request, then once with the real server cold.
- If real: wait for the catalog to settle before picking (poll until the list stops growing, with a bounded wait, or until a model of the known-good list appears), or re-pick on the first turn's failure; say which in hub/README.md.

## Acceptance criteria

- [ ] A test against the fake server: a staged catalog yields `opencode/big-pickle` for a no-model launch, not the first model of the partial list
- [ ] `hub/README.md` says how the launch waits for the catalog
- [ ] `npm run typecheck && npm test` pass
