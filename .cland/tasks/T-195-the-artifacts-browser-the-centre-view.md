---
id: T-195
kind: task
title: "The Artifacts browser: the centre view with mine, this topic, kept, by
  role and archived, editing in place, attaching with s"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-195b
parent: E-115
blocked_by:
  - T-193
  - T-194
topic: topic-125
branch: t/T-195-the-artifacts-browser-the-centre-view
created: 2026-10-10T16:25:07.170Z
updated: 2026-10-11T11:22:26.625Z
closed: 2026-10-11T11:22:26.656Z
---

## Parent

T-115, slice 6 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The centre view with its sections and keys, editing in place, attaching to the composer with `s`.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-195b · 2026-10-11T09:24:39.221Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T195-r3 · 2026-10-11T10:54:44.399Z
- [x] C2. Demo: the human creates a folder "v0.2 notes" in the browser, adds two files, and attaches it to a message with `s`.
  - done: impl-195b · 2026-10-11T09:14:19.172Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T195-r3 · 2026-10-11T10:54:44.399Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-195b · 2026-10-11T09:14:19.303Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T195-r3 · 2026-10-11T10:54:44.399Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-195b · 2026-10-11T10:54:22.069Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T195-r3 · 2026-10-11T10:54:44.399Z

## Comments

### impl-195b · 2026-10-11T08:58:55.648Z

Implementing §3.6 in the claimed worktree. Confirmed test seams from T-115: hub JSON-lines protocol and headless Neovim with real daemon; targeted artifact UI tests then cland suite nvim, unless hub changes are needed.

### impl-195b · 2026-10-11T09:14:18.967Z

Implemented the browser, editing in place and composer attachments on 1ece8f9. Targeted headless tests: browser 4/4, existing artifacts 9/9, palette 18/18; typecheck passes. Coordinator deferred x/deletion to T-219; no hub or role clause changes. Running two-axis self-review before rev-15 review and final cland suite nvim.

### impl-195b · 2026-10-11T09:17:48.219Z

Self-review found and fixed zR missing mixed-role background subgroups and pending attachments being consumed by ask answers. Commit 2992ccd includes real-hub regressions for both: browser tests 6/6 pass; typecheck passes. Existing artifact tests 9/9 and palette tests 18/18 passed. Fetched and merged origin/dev (already current); ready for rev-15 review and the final cland suite nvim.

### rev-15 · 2026-10-11T09:20:23.606Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T195
commit: 2992ccdd94d93e22edc288bbe0c7e1304265a56b

Standards:
Medium — nvim/lua/cland/artifact_browser.lua:124: s stages foreign-topic/archived IDs that dispatch.ts:654 rejects; each refused send restores that ID and no detach action exists, so later messages remain blocked. Validate selections and provide recovery for unavailable staged IDs.
Low — nvim/README.md:411: the retained Shared artifacts section says Markdown opens read-only and describes the old list, contradicting the new writable browser.

Spec:
Medium — nvim/lua/cland/composer.lua:123: failed ordinary sends restore through attach(), whose answering guard rejects IDs if the human armed an ask during the pending send; text returns but captured attachments are lost. Restore them independently of that guard.

C1 failed. C2 demo reviewed; C3 docs present with the low contradiction. C4 suite pending. Deletion excluded per Coordinator's T-219 deferral. No edits or tests run by Reviewer. Evidence: review artifact in topic-125.

Criteria: C1 failed (Invalid staged artifact IDs strand the composer; a send failure after arming an ask silently drops captured attachments.).

### impl-195b · 2026-10-11T09:25:03.528Z

Fixed rev-15 findings in 8ced8b9: reject foreign-topic/archived s selections, expose :Cland attachments clear recovery without altering draft text, restore captured ids independently when an ask is armed during a pending send, and correct the old README paragraphs. Browser tests 8/8 pass (both new regressions failed before fixes); typecheck/diff check pass. Earlier suite c91008ae remains pending at old recorded head; awaiting its result before a fresh suite for this head.

### impl-195b · 2026-10-11T09:59:25.012Z

Merged origin/dev 237d152; pushed 5db950d. Updated the single failing legacy snapshot assertion to explicitly reveal Archived with A, retaining late-event metadata verification; targeted test passes. Requesting final review and fresh nvim suite on merged head.

### impl-195b · 2026-10-11T10:54:22.254Z

C4 complete at 5db950d05ed573bb9b270f9ab66fd45f32827b5f: cland suite nvim 879d67d7-5877-44d2-b498-b216601e54f6 exited 0; typecheck passed and all 266 Neovim tests passed. Durable log A-1192: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1192-suite-879d67d7-5877-44d2-b498-b216601e54f6-nvim-at-5db950d.log. All acceptance criteria marked done; awaiting rev-15 final verdict.

### rev-15 · 2026-10-11T10:54:44.399Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T195-r3
commit: 5db950d05ed573bb9b270f9ab66fd45f32827b5f

Standards: clear, no remaining findings; earlier documentation inconsistency and attachment validation/recovery issues resolved.
Spec: clear. C1 browser sections/nondeferred keys, editable files/folder children and attachment behavior established by code plus public real-hub/headless and controlled-stub regressions. C2 v0.2 notes two-file folder attachment demo passes. C3 docs consistent; no role clause changes. Deletion x excluded per Coordinator's T-219 deferral.
C4 verified from A-1192: fresh suite 879d67d7 at exact reviewed head 5db950d completed npm run typecheck and npm run test:nvim, exit 0; 266/266 passed, zero fail/cancelled/skipped/todo. Previously failing delayed snapshot test passes with explicit Archived reveal and metadata check retained. No exception needed.
All C1–C4 verified. Code review A-1176, attachment fix review A-1158, final review artifact in topic-125. Reviewer made no edits and ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T10:55:38.389Z

Merged fbd37e8d2844a151178f36c6fea3ae1a362d97c0 onto dev.
