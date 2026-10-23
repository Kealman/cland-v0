---
id: T-1140
kind: task
title: Opening pages and files from the Artifacts area
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1139
topic: topic-878
branch: t/T-1140-opening-pages-and-files-from-the
created: 2026-10-22T15:16:16.302Z
updated: 2026-10-23T00:21:18.092Z
---

## Summary

Enter opens an HTML page in a sandboxed iframe at full height and a file as text when it is text or as a download otherwise, all through E-412's capability URLs.

## Parent

E-418 (§3.2; v0.2 §3.4 and §3.7; tracer step 6).

## What to build

Enter on a page artifact (and on a diagram) opens it in the drawer, or with ⌘Enter in the other pane, in an iframe at the drawer's full height whose `sandbox` is `allow-scripts` alone, never with `allow-same-origin`, loaded from a capability URL minted with `artifact.url`; the hub's response carries its own sandbox policy as well. A file artifact opens as text when its type is text (Markdown included until the notes slice renders it), otherwise as a download link with its name. Files inside a folder open the same way by their type. An artifact whose file is gone says so. E-417's inline HTML artifacts (Open full) may reuse this viewer; whichever epic lands first owns the shared component.

## Acceptance criteria

- [x] C1. Enter on an HTML page artifact opens it in an iframe whose `sandbox` attribute is exactly `allow-scripts`, loaded from a capability URL (Web test).
  - done: impl-1140 · 2026-10-23T00:00:20.686Z
  - verified: rev-26 [reviewer] · run rev-20261023-1140-final-1 · 2026-10-23T00:13:07.180Z · commit 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
- [x] C2. A script inside the page cannot read the workbench's document or cookie (Web test).
  - done: impl-1140 · 2026-10-22T23:45:09.498Z
  - verified: rev-26 [reviewer] · run rev-20261023-1140-final-1 · 2026-10-23T00:13:07.180Z · commit 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
- [x] C3. A text file opens as text and a binary file offers a download with its name, both from capability URLs (Web test).
  - done: impl-1140 · 2026-10-23T00:00:20.776Z
  - verified: rev-26 [reviewer] · run rev-20261023-1140-final-1 · 2026-10-23T00:13:07.180Z · commit 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
- [x] C4. `web/README.md` describes opening pages and files and the sandbox rule (docs).
  - done: impl-1140 · 2026-10-22T23:45:09.774Z
  - verified: rev-23 [reviewer] · run rev-20261022-1140-source · 2026-10-22T23:46:39.610Z · commit 6915865db68eaac76daa585a81e3f22da72dd5ee
  - verified: rev-26 [reviewer] · run rev-20261023-1140-source-2 · 2026-10-23T00:01:15.367Z · commit 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
  - verified: rev-26 [reviewer] · run rev-20261023-1140-final-1 · 2026-10-23T00:13:07.180Z · commit 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
  - verified: rev-26 [reviewer] · run rev-20261023-1140-source-3 · 2026-10-23T00:21:18.092Z · commit a448815a5def59b74ee3f7431fdc75e5eae0ed13

## Comments

### impl-1140 · 2026-10-22T23:43:51.189Z

Implemented capability-backed artifact viewing with a reusable SandboxedArtifactFrame (exact allow-scripts), full drawer/split sizing, literal text and named downloads, folder child selection, and missing-file alerts. TDD reds: missing iframe; missing file text; closed drawer did not reopen; raw Mermaid missing text. Direct malicious-page script now observes SecurityError for parent document and cookie. Coordinator decision in topic-878 keeps raw .mmd as source text + download; HTML/SVG diagrams use frame. Targeted key-contexts 3/3 and palette 11/11 passed on local Darwin arm64 working tree. npm run check passed (test lint report-only, 132 existing findings, zero refusals). Artifact tests being rerun after strengthening actual binary byte receipt using Playwright saveAs (remote connection does not support download.path). No suite/verification claim yet.

### rev-23 · 2026-10-22T23:46:39.610Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1140-source
commit: 6915865db68eaac76daa585a81e3f22da72dd5ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 6915865db68eaac76daa585a81e3f22da72dd5ee. Standards and Spec: no findings. Exact iframe sandbox/capability path, direct script-denial tests, text/download/folder selection and Coordinator diagram decision reviewed. C4 verified; C1–C3 await exact-head mode-free evidence. A-9571: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9571-t-1140-source-review-capability-artifact-viewer-at-6915865d.md. Local targeted claims in A-9566 remain summary evidence; no Reviewer runtime runs or QA claim.

Criteria: C4 verified.

### rev-23 · 2026-10-22T23:58:09.659Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1140-evidence
commit: 6915865db68eaac76daa585a81e3f22da72dd5ee
scope: evidence
findings: [{"severity":"medium","text":"Configured run fails assert.ok(detail.textContent().includes(id)): the new Artifacts viewer renders the fixture's 'A note' content/download rather than prior generic id metadata. Reconcile this integration test with a bounded exact viewer/selection receipt, retaining slot/identity/pane/drawer coverage; aggregate opening evidence is not clear.","file":"web/test/area-slots.test.ts","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

A-9601 exits 1: actual area-slots.test.ts:37 assert.ok(detail.textContent().includes(id)) is false. New artifact tests pass but integrated Web fails (one leaf plus parent); T1/all T2 exit0. Medium integration-test mismatch identified against fixture content 'A note' and new ArtifactViewer. A-9603: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9603-t-1140-evidence-not-clear-artifact-viewer-slot-assertion-mismatch.md. C1/C3 failed; C4 source mark stands, C2 not finally settled. Fresh source review required for correction before new verify. No runtime rerun by Reviewer.

Criteria: C1 failed (Same-head configured run 40885ffa fails area-slots detail identity/content assertion; integrated opening evidence incomplete.), C3 failed (Artifact content viewer integration must reconcile area-slots compatibility assertion and pass a fresh reviewed-head receipt.).

### rev-23 · 2026-10-22T23:58:58.163Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1140-evidence-correction
commit: 6915865db68eaac76daa585a81e3f22da72dd5ee
scope: evidence
findings: [{"severity":"medium","text":"The test waits for the page slot, then immediately reads asynchronously loaded viewer text for id. The download filename eventually contains the id, so local success is timing-dependent. Retain explicit selected identity and bounded content readiness rather than relying on a later incidental download label. Configured Web failed this assertion.","file":"web/test/area-slots.test.ts","line":37}]
finding_counts: {"high":0,"medium":1,"low":0}

Diagnosis correction to prior evidence verdict/A-9603: generated download filenames do contain the artifact id after loading. My claim of permanent absence was incorrect. The actual failure reflects slot presence preceding asynchronous capability/content readiness; no receipt fences the immediate includes(id) assertion. Medium finding and not-clear outcome remain, with corrected wording. A-9608: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9608-t-1140-evidence-diagnosis-correction-asynchronous-identity-receipt.md. No new runtime execution.

Criteria: C1 failed (Configured run 40885ffa remains red on area-slot identity/content readiness; corrected-head integration receipt needed.), C3 failed (Configured run 40885ffa remains red; opening integration must retain explicit identity and bounded content readiness.).

### impl-1140 · 2026-10-23T00:00:12.109Z

Corrected area-slots race at 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13. The old generic detail id assertion was supplied accidentally by the asynchronously loaded download filename. Holding capability HTTP reproduced the same assertion failure locally before the fix. Viewer now retains visible selected id and explicit selection metadata independently of file reads; the strengthened area-slot test keeps slot/split/drawer and original id assertions, plus exact viewer identity under held reads. No dev merge after first source review. Targeted local Darwin arm64: artifacts 7/7, area-slots 4/4, key-contexts 3/3, palette 11/11; npm run check completed (lint report-only, zero refusals). Original captured stdout preserved in topic artifact. Linux 40885ffa remains failed: T1/T2 exit0, Web exit1. Its three new artifact tests measured 1.399/1.744/1.866s, below the >=4s allowance threshold.

### rev-26 · 2026-10-23T00:01:15.367Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1140-source-2
commit: 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 43e05f4f; A-9617 carries rev-23’s prior full source audit and checks all five corrective files. Selected artifact ID and explicit viewer selection are synchronous before capability bytes; the test holds HTTP before interaction and retains original slot/key-context/pane/drawer/split/ID assertions with exact bounded viewer observation. Gate released in finally; matching docs updated. Capability/sandbox/content logic unchanged. No remaining findings. A-9611 original targeted local output remains source-equivalent supporting evidence, not configured/Linux proof. C4 docs verified; C1–C3 pending fresh mode-free configured same-head receipt. Earlier failed A-9601 remains historical, no QA or merge claim.

Criteria: C4 verified.

### impl-1140 · 2026-10-23T00:11:03.998Z

Mode-free verify c8092ce9 passed at unchanged reviewed head 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13: 2543/2543, T1 + fallback all T2 across hub/Neovim + Web. Executor: Linux x64 6.8.0-142-generic, c-8 lon1, Node24.21.0, Neovim0.12.5; droplet lifetime517s, cost$0.0359. Host typecheck gate527f135b not repeated remotely. Lint/budget report-only. A-9633 original log inspected: new Web identities1.443/1.714/1.774s (prior Linux worst1.866s); none reaches4s or appears in would-fail lines, no duration allowance needed. Existing shell/connection/items/T2-scale warnings retained as report-only; no T3 or after-stage QA claim. Source tree remains clean; final Reviewer evidence settlement pending.

### rev-26 · 2026-10-23T00:13:07.180Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1140-final-1
commit: 43e05f4f7efafaaa20fbed6dd3c01ec11fcbfc13
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged 43e05f4f. A-9637 records independent parsing of original A-9633 / c8092ce9: exit 0, 2543 ordinary tests and 386 files passed, no failed/cancelled/skipped finishes; all T1, fallback all T2 across hub/Neovim, and Web completed on Linux x64 c-8 lon1. Host check passed with zero lint refusals; gate 527f135b was not repeated remotely. Corrected held-read area-slot case passes, as do direct sandbox/document/cookie isolation, literal text and named byte-verified download, folder/missing-file and diagram cases. Three new artifact samples 1.443/1.714/1.774 seconds stay below the allowance trigger. C4 carried from source-2. Generic lint/tier/duration/ratchet diagnostics remain report-only; actual Web wall 59.726 seconds exceeds report-only 40 seconds. Earlier failed receipt remains historical; no T3/T4 or after-stage QA claim. No findings; C1–C4 verified. Artifact A-9637: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9637-t-1140-final-evidence-review-at-43e05f4f.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1140 · 2026-10-23T00:20:29.235Z

Coordinator-authorized one merge of origin/dev535012cf after T-1134(740d6f0f), T-1137(ab8d5d6b), T-1120(535012cf), producing a448815a5def59b74ee3f7431fdc75e5eae0ed13; pushed origin. Resolved additive conflicts in AreaSlot, Shell TSX/CSS and README by retaining every area's callbacks, Artifact folder-child resolution/full-height sizing and Sessions phone drawer rule. Exact-head local Darwin arm64 check and four targeted Web files all exit0 under set-e: area-slots4/4, key-contexts3/3, palette11/11, artifacts7/7. Original captured logs posted as artifact. New source delta review requested before mode-free verification; previous green c8092ce9 applies only to43e05f4f.

### rev-26 · 2026-10-23T00:21:18.092Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261023-1140-source-3
commit: a448815a5def59b74ee3f7431fdc75e5eae0ed13
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear at a448815a, tree 558653db, after Coordinator-authorized merge of dev 535012cf into reviewed 43e05f4f. Standards and Spec: no findings. A-9653 compares both parents and all combined files: retains artifact open callback/child selection/full-height styling, Accounts pane navigation, Sessions openPage/closePage and phone drawer behavior, plus both documentation sets. Artifact implementation, security/text/download cases and held-read area-slot regression are unchanged from accepted 43e05f4f. C4 verified; C1–C3 await fresh mode-free configured evidence at this merged head. A-9652 preserves supporting local check and targeted receipts (Darwin arm64; zero lint refusals, lint report-only); not configured/Linux/QA proof. Prior A-9633 remains historical after the merge. Artifact A-9653: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9653-t-1140-merged-head-delta-source-review-at-a448815a.md.

Criteria: C4 verified.
