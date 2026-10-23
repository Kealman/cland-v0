---
id: T-1121
kind: task
title: HTML artifacts inline in a sandboxed iframe
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1119
topic: topic-883
branch: t/T-1121-html-artifacts-inline-in-a-sandboxed
created: 2026-10-22T15:16:13.272Z
updated: 2026-10-23T01:07:20.359Z
closed: 2026-10-23T01:07:20.359Z
---

## Summary

An HTML artifact posted in a thread renders inline at 240 px in a sandboxed iframe under a header with Open full and Open in a pane; a file or folder artifact stays a chip.

## Parent

E-417 (§3.4 artifacts inline; P15; tracer step 5, the artifacts half).

## What to build

For an HTML (page) artifact the message shows a 240 px frame of it, loaded from the address the hub mints for the browser (`artifact.url`, served under `sandbox allow-scripts`). The iframe's `sandbox` is `allow-scripts` and nothing more: never `allow-same-origin`, never top navigation, popups or forms. The header names the artifact and offers Open full (the artifact's own address in a new tab) and Open in a pane (the artifact full height in the other pane). An artifact the hub cannot serve shows as its chip with the reason in the tooltip. Files and folders keep their chips.

## Acceptance criteria

- [x] C1. An HTML artifact in a message renders inline at 240 px in an iframe whose `sandbox` attribute is `allow-scripts` alone and whose source is the hub's artifact address (Web test).
  - done: impl-1121 · 2026-10-23T00:46:26.181Z
  - verified: rev-23 [reviewer] · run rev-20261023-1121-final · 2026-10-23T01:02:35.943Z · commit 8290b24091890c65d9b1e45fbb63757e0a11258f
- [x] C2. A script inside the artifact cannot read the workbench page or navigate the top window (Web test).
  - done: impl-1121 · 2026-10-23T00:46:26.267Z
  - verified: rev-23 [reviewer] · run rev-20261023-1121-final · 2026-10-23T01:02:35.943Z · commit 8290b24091890c65d9b1e45fbb63757e0a11258f
- [x] C3. Open full opens the artifact's address in a new page, and Open in a pane shows it in the other pane (Web test).
  - done: impl-1121 · 2026-10-23T00:52:15.258Z
  - verified: rev-23 [reviewer] · run rev-20261023-1121-final · 2026-10-23T01:02:35.943Z · commit 8290b24091890c65d9b1e45fbb63757e0a11258f

## Comments

### impl-1121 · 2026-10-23T00:20:30.632Z

TDD C1 red: new Web thread-artifacts test observes authenticated artifact.url source, script-only sandbox, 240 px frame/header and file/folder chips. On local macOS arm64, base 535012cf + test edits, fails at missing iframe (3000 ms locator timeout). Waiting for T-1140 shared frame to land; will reuse it rather than create another iframe.

### impl-1121 · 2026-10-23T00:46:35.091Z

Implemented and pushed a264521ddd456bb3d029491d9e15098317334355. Reuses T-1140's shared SandboxedArtifactFrame with optional inline class; all C1–C3 marked done. Web typecheck/build and 29/29 targeted Web checks pass on final implementation tree, local macOS arm64 / Node 24.21.0 / isolated Headless Shell. Evidence A-9702 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9702-t-1121-implemented-review-head-and-targeted-web-receipts.md. Source review requested from Reviewer in topic-883; mode-free verify will follow source clear at exact head. QA policy affected/after-stage; no per-item QA brief supplied.

### rev-23 · 2026-10-23T00:48:20.395Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1121-source
commit: a264521ddd456bb3d029491d9e15098317334355
scope: full
findings: [{"severity":"medium","text":"openedArtifacts is unioned into authoritative inventory/rows, resurrecting cached pre-move children after replaceArtifact removes them and after inventory replacement. Scope older-thread metadata to viewer selection, retaining authoritative live inventory; add public move-after-pane-open regression.","file":"web/src/Shell.tsx","line":214}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear, complete finding set M1 medium/C3: global cache overlay resurrects moved artifact inventory records. Sandbox/capability/activation/tab and pane-source source/tests otherwise reviewed without findings. A-9705: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9705-t-1121-source-review-pane-navigation-cache-resurrects-moved-artifacts.md. C1/C2 runtime remain unverified; A-9702 is summarized local targeted evidence, no configured proof. Fresh pushed-head source review before verification; no Reviewer runtime execution.

Criteria: C3 failed (Other-pane navigation cache reintroduces stale moved artifacts into top-level inventory; live integration regression needs correction.).

### rev-23 · 2026-10-23T00:52:08.365Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1121-source-2
commit: 8290b24091890c65d9b1e45fbb63757e0a11258f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear: M1 resolved by viewer/header-only fallback, with authoritative connection inventory untouched. Public move regression retains detached top-level/child-only-in-folder assertions and older-inventory/either-pane opening coverage. No findings. A-9711: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9711-t-1121-corrected-source-clear-with-viewer-only-fallback-at-8290b240.md. A-9707/9708/9709 raw local red/green outputs remain targeted corrected-tree evidence. C1–C3 await configured exact-head receipt; claimant must restore C3 done (task.view still showed prior failed mark). No Reviewer runtime execution; QA separate.

### rev-23 · 2026-10-23T01:02:35.943Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1121-final
commit: 8290b24091890c65d9b1e45fbb63757e0a11258f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C3 at unchanged 8290b240. A-9719/48f7f8fc Linux T1/all hub+Neovim T2/Web: 2619 ordinary passes, no fail/cancel/skip. All five new Web identities pass (1.086–2.739s), including direct sandbox attempts and M1 move regression; no allowance needed. Host check reused remotely; T3/T4 absent; generic budget/lint/resource/ratchet diagnostics report-only. A-9721: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9721-t-1121-final-evidence-clear-inline-sandbox-and-other-pane-opening.md. No findings; after-stage QA/Coordinator landing separate.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1121 · 2026-10-23T01:03:16.150Z

Ready at 8290b24091890c65d9b1e45fbb63757e0a11258f. Final Reviewer clear/no findings, C1–C3 verified; mode-free verify 48f7f8fc green 2619/2619, Linux x64 droplet T1/all fallback T2/Web (T3/T4 absent). Original suite A-9719; final provenance/conflict check A-9720; final review A-9721. Current origin/dev 15d97e15 conflict check clean without changing the reviewed head. Reported ready to Coordinator in topic-883, claim retained until merge. After-stage QA/landing separate.

### coord · 2026-10-23T01:07:20.359Z

Merged b1be9c1c117bf9b95f3e5f2331cc6b354c3cde45 onto dev.
