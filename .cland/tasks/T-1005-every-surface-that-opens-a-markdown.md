---
id: T-1005
kind: task
title: Every surface that opens a Markdown artifact renders it
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by:
  - T-796
topic: topic-777
branch: t/T-1005-every-surface-that-opens-a-markdown
created: 2026-10-20T16:58:42.045Z
updated: 2026-10-20T21:20:35.929Z
---

## Summary

Rendering applies wherever a Markdown artifact opens: folder entry files and children from the artifacts browser, and the palette's `CTRL-v` split beside the centre. Prompt drafts open raw, and sending a prompt always sends the saved source text.

## What to build

The human opens `ideas.md` inside a folder artifact from the browser and it renders, with the same toggle. From the palette, `CTRL-v` on a note opens it rendered beside the thread, and it toggles independently of the centre. A prompt draft opens in the raw editable buffer, as today, and `␣ps` and `␣pa` send exactly what was saved (Coordinator decision, 2026-10-20). Following links in a rendered artifact is out of scope.

## Acceptance criteria

- [x] C1. A `.md` file inside a folder artifact, and a folder's entry file, opened from the artifacts browser render and toggle to raw, proved by a T2 component test.
  - done: impl-1005 · 2026-10-20T21:08:41.787Z
  - verified: rev-23 [reviewer] · run rev-20261020-1005-final · 2026-10-20T21:20:35.907Z · commit bcd215f8af816b87d644144440bff0819f9c6939
- [x] C2. A Markdown artifact opened with `CTRL-v` from the palette renders in its split and toggles independently of the centre, proved by a T2 test.
  - done: impl-1005 · 2026-10-20T21:08:41.798Z
  - verified: rev-23 [reviewer] · run rev-20261020-1005-final · 2026-10-20T21:20:35.907Z · commit bcd215f8af816b87d644144440bff0819f9c6939
- [x] C3. A prompt draft opens raw, and `␣ps` and `␣pa` send the saved source bytes, proved by a T2 recorded-frames test.
  - done: impl-1005 · 2026-10-20T21:08:41.812Z
  - verified: rev-23 [reviewer] · run rev-20261020-1005-final · 2026-10-20T21:20:35.907Z · commit bcd215f8af816b87d644144440bff0819f9c6939
- [x] C4. A headless-grid case ARTIFACT-002 opens a folder child and a palette split rendered, and reads both from the grid.
  - done: impl-1005 · 2026-10-20T21:08:41.824Z
  - verified: rev-23 [reviewer] · run rev-20261020-1005-final · 2026-10-20T21:20:35.907Z · commit bcd215f8af816b87d644144440bff0819f9c6939

## Comments

### impl-1005 · 2026-10-20T21:08:19.292Z

Implemented the single artifact-open route for palette splits, destination-window dimensions through layout/views/artifacts, and per-width projection buffers for simultaneous views. Added T2 recorded-client facts for browser folder entry/.md/.markdown child rendering and raw toggle, palette split beside a thread plus same-artifact unequal-width independent modes, and ps/pa exact saved source bytes/flags. Regenerated protocol recordings with recorder (append-only catalogue changes). ARTIFACT-002 appended to shipped grid catalogue. Local macOS targeted artifact-render 14/14 and ARTIFACT-002 1/1 pass on dirty task source, plus typecheck; no full suite receipt yet. Regression with all five production Lua files restored to pre-change source fails: "each rendered table matches its own window width: not within 15000 ms". Final reviewed-head verification follows review.

### rev-23 · 2026-10-20T21:12:30.684Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1005-source
commit: bcd215f8af816b87d644144440bff0819f9c6939
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards and Spec audit A-8072 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8072-t-1005-source-review-at-bcd215f8.md). All 13 changed files reviewed. Common folder/palette artifact opener, destination width projection cache, independent raw toggles and exact prompt-byte assertions match C1–C4. Existing protocol records all preserved. A-8069 is matching pre-commit local Darwin arm64 targeted evidence (T2 render/compat, targeted T3 palette and one T4 case), not the configured task gate or after-stage QA. No findings. Runtime C1–C4 remain unverified pending exact-head mode-free verification; no Reviewer runtime launched.

### rev-23 · 2026-10-20T21:20:35.907Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1005-final
commit: bcd215f8af816b87d644144440bff0819f9c6939
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec audit A-8078 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8078-t-1005-final-evidence-review-at-bcd215f8.md). Exact-head configured 1246626b/A-8077 exited 0 on Linux x64 droplet: T1/all-T2 fallback, 2,154 ordinary test passes/335 passing files. Three new C1–C3 identities each pass 5/5 load repetitions; artifact-render 14/14, compatibility 9/9 and thread 23/23. C4 reviewed ARTIFACT-002 registration/grid assertions and A-8069's separate matching pre-commit local Darwin arm64 targeted 1/1 establish its scoped case evidence; no Linux T4/whole-shipped or after-stage QA claim. Host check 48006be2 not repeated remotely; lint/duration/ratchet report-only, existing timing diagnostics retained. No findings; verify C1–C4. E-795 full after-stage QA remains separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
