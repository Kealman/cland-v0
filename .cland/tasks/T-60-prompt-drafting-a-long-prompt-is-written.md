---
id: T-60
kind: task
title: "prompt drafting: a long prompt is written in a full buffer as a prompt artifact, then sent or attached"
state: closed
status: done
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
updated: 2026-10-10T00:58:17.688Z
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

### impl-60 · 2026-10-09T15:24:43.669Z

Implemented drafts, native editable Neovim buffers, send/attach commands, and spoke attachment ids. Targeted tests pass for exact/over/multibyte cap boundaries, real-Neovim save/reopen/event preservation, multiple attachments, foreign/unknown/missing ids, and deferred archive/topic deletion versus send. Status-write failure rolls back the stored post before any delivery. Completing async await audit, docs, and final review.

### impl-60 · 2026-10-09T15:36:20.084Z

Review fixes committed at 1f0670d311f58d8d374c9fe40f2a622516f96893: permission ownership uses indexed facts; entire artifact continuations are measured; final asynchronous file checks refuse artifacts deleted during preparation. Six deferred race tests pass. Coordinator assigned inherited permission-gate and journal synchronous I/O to T-75; T-60 README documents that boundary. Final typecheck passed; npm test is waiting on the package's machine-wide suite lock.

### rev-65 · 2026-10-09T15:41:15.640Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-60-1
commit: 1f0670d311f58d8d374c9fe40f2a622516f96893

Medium — hub/src/hub/dispatch.ts:484: attachment fallback interpolates an unrestricted artifact title, so a valid draft can still exceed max_text_bytes in automatic or explicit attach mode. With cap64 and a65-byte title, the pointer is77 bytes and both paths refuse. Use a UTF-8 byte-bounded pointer/fallback and cover long/multibyte titles. The invariant is that the escape message itself must fit the same cap.

High none; other medium/low none. Standards0 (clear); Spec1 medium (not clear). Swept automatic/explicit prompt fallback together and spoke/topic attachment sends; the latter intentionally keep the normal text cap. Existing tests cover exact-cap, one-over and multibyte body boundaries but only short titles.

Independent in-memory actual HubCore/Store/Dispatcher prompt.send probe: short title +65-byte body succeeds and becomes sent;65-byte ASCII title +65-byte body and65-byte multibyte title +explicit attach both return message-is77-bytes/cap64 and remain draft. Verified worktree head; fake content port and existing read-only file for stat, no filesystem writes or external hub traffic.

Sibling sweep covered artifact.create/list and all attached send routes, creation/read/stat continuations, current caller/topic/status/path rechecks, Store.record/registerArtifact transaction/cleanup, multiple attachments, unknown/foreign/missing ids, and Neovim prompt/list/thread/Agents callbacks. Post/status are atomic before delivery; editor events preserve cached native text/cursor. No other issue found within scope. RolesFile.get and journal.writeSync exclusions remain T-75.

Read item, A-96, A-102 and targeted/race evidence. Final suite remains pending in latest evidence; Reviewer ran no suite and made no edits. Full evidence/runnable probe: A-105, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-105-t-60-review-attachment-pointer-exceeds-the-byte-cap.md

### rev-65 · 2026-10-09T15:47:33.177Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-60-2
commit: 2bfec6fd2c3fa382e02466adc4433cf5d2742024

High none; medium none; low none. Standards 0 (clear); Spec 0 (clear).

Reviewed git diff 1f0670d 2bfec6f. Both automatic and explicit attachment use the UTF-8 byte-bounded pointer while full title/identity remain in metadata; minimum cap 1 remains nonempty. Draft help now describes saving/sending/attaching instead of read-only. The previous medium and QA help low are resolved.

Verified worktree head and reran the A-105 actual in-memory dispatcher probe: previously failing 65-byte ASCII-title automatic and 65-byte multibyte-title explicit attachments now succeed and become sent. Pure Hygiene probe passed 320 prefix cases across caps 1..80 and UTF-8 widths 1..4, with no split/replacement characters and no oversized/empty pointers. Read added cap/title and Neovim help regressions; git diff --check passes. Full suite is running per request; Reviewer ran no suite, made no edits or external sends in the probes.

Evidence A-109: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-109-t-60-resolution-review-byte-bounded-pointers-and-draft-help.md

### qa-12 · 2026-10-09T15:54:01.688Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-60-1
commit: 2bfec6fd2c3fa382e02466adc4433cf5d2742024

Commit: 2bfec6fd2c3fa382e02466adc4433cf5d2742024. Run: qa-12-60-1.

Ran:
- Read T-60 and checked its acceptance criteria and prompt/attachment documentation in hub/README.md and nvim/README.md.
- Base archive 1f0670d311f58d8d374c9fe40f2a622516f96893: npm run typecheck passed. Used the same parent node_modules installation that T-60 resolves (its worktree has no local node_modules).
- Independent live matrix against a scratch project and its own real hub, Coordinator and Implementer spokes, and one headless Neovim using the project's nvim_input/screenstring harness. CLAND_HUB_FILE, CLAND_SESSION_ID and CLAND_SESSION_NAME were unset for the runner and explicit CLI commands. Exercised cland task list/create/view.
- :Cland prompt Brief for T-12 opened an empty editable Markdown buffer; :w saved exact multiline text at .cland/artifacts/A-1-brief-for-t-12.md. Topic artifact list and picker showed draft. Picker reopened saved text.
- Four hub messages arrived while typing in the reopened draft: buffer identity, cursor, text and Insert mode remained identical; subsequent input continued at the same location.
- Under-cap prompt send saved unsaved edits, delivered exact human text and the artifact path, and marked the artifact sent. Observed queued message and delivered stage.
- A multibyte 8193-byte prompt automatically attached above the default 8192-byte cap; explicit attach also attached a short prompt. Both one-line deliveries carried the durable path and full artifact metadata and became sent.
- A Coordinator spoke's send with artifacts:[id] delivered the attachment/path to an Implementer spoke. Unknown A-999999 returned artifact-unavailable with neither stored post nor delivery.
- Final archive 2bfec6f delta only, as requested: independent Neovim screen checks showed ':w saves · ␣ps send · ␣pa attach' on writable drafts, without read-only/Mermaid help. At max_text_bytes=29, automatic and explicit attach each passed for a 101-byte ASCII title and a 216-byte mixed CJK/accented/emoji title. Received pointers were respectively 29 and 26 bytes, matching the longest complete UTF-8 prefix; metadata retained full title, artifact path and sent status, and the saved content was intact.

Shared suite evidence: Coordinator relayed impl-60's final-head result: npm run typecheck passed; npm test exit 0, 448/448 hub + 92/92 Neovim = 540 passed, zero failed/skipped/cancelled, 498.00 seconds. I did not run another full suite, per instruction.

Findings by severity:
- High: none.
- Medium: none remaining in the requested scope; final independent pointer tests verify the reported long-title fix.
- Low, resolved: at base 1f0670d, nvim/lua/cland/bars.lua:250 displayed 'read-only · R render Mermaid · q back' for writable prompt drafts. Captured in A-104 screenstring grids. The 2bfec6f delta corrected it, verified in A-108.

Probe limitation/history: the first independent driver stopped on its own Lua filename-pattern assertion (hyphen treated as a pattern operator), after the first three checks passed. Corrected the driver to literal matching and reran the entire live matrix successfully. Both attempts are retained; no product source was changed.

Evidence:
- A-104: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-104-t-60-independent-prompt-qa-raw-evidence-on-1f0670d.zip — base script, CLI responses, screen grids, deliveries, cursor/text comparisons, typecheck and cleanup. SHA256 8909c049bf7607cf46f794cb23f949b6ac6edea50ff61c3108b3b154d38a1360.
- A-108: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-108-t-60-final-delta-qa-help-and-attachment-cap-on-2bfec6f.zip — final delta script, all four attachment cases, help grids, delivery metadata and cleanup. SHA256 0616d9dd906e71411b63bbeca8ef509cb06027243c2fd16be810c30d766b0393.

Own hubs, spokes and Neovim processes exited; scratch projects, exports and staging removed after verifying durable artifact hashes. Task worktree clean.
Summary: A-112, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-112-t-60-qa-clear-on-2bfec6f.md.

### impl-60 · 2026-10-09T15:54:10.101Z

Implementation complete at 2bfec6fd2c3fa382e02466adc4433cf5d2742024, pushed to the local origin territory; worktree clean. Prompt drafting/save/send/attach, spoke attachment ids, atomic sent/post state, races, cap boundaries, UTF-8 pointer truncation and draft hints are implemented and documented. npm run typecheck passed. Final npm test exited 0: hub 448/448, Neovim 92/92, total 540 passed, zero failures/skips/cancellations; duration 498.00s. Evidence: A-113, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-113-t-60-completion-evidence-and-review-resolution.md. Artifact file operations/indexed ownership are async apart from the inherited permission gate and journal, assigned to T-75 by the Coordinator. No defaults changed.

### rev-65 · 2026-10-09T15:57:45.757Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-60-3
commit: 770ee107f0820e5c79c16278482fb2fa3b47c4e5

High none; medium none; low none. Standards 0 (clear); Spec 0 (clear).

Focused rebase review: git range-diff bf37548~2..2bfec6f bf37548..770ee10 maps all three commits; the first two differ only in README context and the final pointer/help fix is equal. Complete patches excluding hub/README.md have the same stable patch-id, 49806dd1c77749bf5308664c22c89fbf9ad50ea9, from their respective bases. No code or test patch changed.

The README delta from bf37548 adds only T-60's reviewed artifact/draft/send documentation. Read-only byte comparisons confirm T-70's termination/orphan tail remains exactly as in bf37548, and T-60's complete Artifacts section remains exactly as in 2bfec6f; T-70's process/table updates also remain. No suite run or edits. Prior 540-pass suite/QA evidence read from the item; this review verifies resolution equivalence, not a new suite on 770ee10.

Evidence A-114: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-114-t-60-rebase-resolution-review-770ee10.md.

### coord · 2026-10-09T15:57:57.908Z

Merged 1be69e400b887b9d4c27f3c83545ca62a28d5ff8 onto dev.

### coord · 2026-10-09T15:58:14.268Z

Merged by the Coordinator through `cland merge T-60`: squash 1be69e4 on dev. The first attempt refused on a hub/README.md conflict with T-70; impl-60 rebased to 770ee10. Gate: review rev-65-60-3 clear on 770ee10 (resolution only; rev-65-60-2 clear on 2bfec6f). QA qa-12-60-1 clear on 2bfec6f. Suite on 2bfec6f: 448 hub + 92 Neovim passed (A-113). Shared synchronous permission and journal I/O is T-75. impl-60 stopped.
