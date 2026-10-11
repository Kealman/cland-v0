# T-225 release handover

The implementation publishes from the release item through `cland release --item T-n`: its version and Notes feed the annotated tag, GitHub main/tag are pushed atomically, main/tag advance locally and in the territory, then the hub adds `Released v<version> at <full commit>.` and closes the item. Open release selection therefore advances to the next open version. Version-only releases retain their previous behavior.

## Coordinator clause

The only changed line in the project's `.cland/roles.toml` is **line 59**, inside `[roles.coordinator]`'s clause (the clause ends at line 62). Its replacement is:

> - Release the current release item from your own shell through the `release` skill: run `cland release --item T-n --dry-run`, show its notes and version in an `ask`, then run `cland release --item T-n` after approval. The version comes from the human; an Aide or the human's named stand-in may relay it only when the human has recorded the decision (this project's D18 records v0.1.0), and never invents one. Follow the recorded acceptance policy (D19 uses QA's clear T-117 walkthrough). Never delegate a release. Use `cland sync` from a clean root to import GitHub work.

The equivalent shipped clause is in `hub/src/roles/default-roles.ts`, line 64; it refers to the project's recorded decision and acceptance policy without assuming other projects have cland's D18/D19. No role permissions change. The tracked roles.toml edit is in the task worktree; merging installs it into the root's watched configuration. `.agents/skills/release/SKILL.md` steps 2–4 supply the preview, approval and item publication sequence. Step 3 permits an Aide or the human's named stand-in to relay the version the human recorded, never to invent it.

## Recorded version and deferred checks

D18 in `docs/spec/v0.1.md` records the human's version v0.1.0. D19 uses QA's clear T-117 walkthrough rather than a separate human acceptance pass. T-130's Notes include:

> Verified in v0.1.1 (D19): two checks from the epic demos need what a scratch QA run cannot provide and move to the next release:
> - T-109 C1: the key-encoding matrix in real Ghostty and tmux terminals.
> - T-111 M7: the Coordinator following through on an Aide's decision with a real model.

The item-release integration test carries these checks through the preview, returned notes and annotated tag contents in root, territory and the GitHub stand-in. These lines describe the release-note decision, not tests of real terminals or a real model in this task.

## Recovery and verification

An item release receipt now includes the canonical item id with the pinned tag, commit and notes. A failed GitHub push leaves the item open. A failed local/territory follow-up also leaves closure pending. A failed item write returns `released; follow-up failed` with step `close` and retains the receipt. Repair the obstruction and retry the same item/version; later dev work is not published. A closed item with the matching release comment is recognized on recovery without adding a duplicate comment. A version-only or different-item retry cannot consume that receipt. Receipt deletion runs after territory lock cleanup, while still inside the hub's serial operation. A late lock-release failure therefore retains the receipt even when the item is already closed, allowing the same-item retry to finish without duplicating its comment.

Tests run only in scratch projects with a bare territory and a GitHub stand-in. No release was run in the root project. Targeted verification covers publication/closure, next-open release selection, refusal, pinned-build recovery across restart, idempotent closure and unchanged version-only behavior. The final full-suite result is delivered by `cland suite all` in T-225's topic, after fetching and merging origin/dev.
