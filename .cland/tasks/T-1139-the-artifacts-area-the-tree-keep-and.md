---
id: T-1139
kind: task
title: "The Artifacts area: the tree, keep and archive"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: topic-876
branch: t/T-1139-the-artifacts-area-the-tree-keep-and
created: 2026-10-22T15:16:16.169Z
updated: 2026-10-22T23:36:13.885Z
closed: 2026-10-22T23:36:13.885Z
---

## Summary

The Artifacts area shows the tree of v0.1 §3.6 with its sections, unfolds folder artifacts into their files, and keeps (`k`) and archives (`d`) as Neovim does.

## Parent

E-418 (§3.2; v0.1 §3.6; tracer step 6).

## What to build

- **Sections**, each a fold remembered in this browser with its count: Mine (the human's and the Aides' artifacts, folders first), Kept, By role (Coordinator, Implementers, Reviewers, QA and Other, folded as background) and Archived (folded; `A` unfolds it). This topic joins in the notes slice, after E-417.
- **A row:** the kind, the id, the title, the creator, the status mark and "kept".
- **Keys:** `j`, ↓ and ↑ move (`k` keeps, as in Neovim); Enter on a folder unfolds it into its files, listed by the hub on request; `k` toggles keep; `d` archives (for the human's and the Aides' artifacts archive is a layer, not a deletion). Opening files is the next slice.

Creating, moving, promoting, deleting and editing in place stay in Neovim and the CLI in 0.2.0. Changes arrive live from `artifact` frames. Neovim's `artifact_browser.lua` defines the sections and the keys.

## Acceptance criteria

- [x] C1. With artifacts by the human, an Aide, each crew role and one archived, each lands in its section of Mine, Kept, By role and Archived, with By role and Archived folded (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.336Z
  - verified: rev-23 [reviewer] · run rev-20261022-1139-final · 2026-10-22T23:31:01.130Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061
- [x] C2. `k` on an agent's artifact moves it to Kept and `k` again unkeeps it, as the hub's artifact list reads (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.426Z
  - verified: rev-23 [reviewer] · run rev-20261022-1139-final · 2026-10-22T23:31:01.130Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061
- [x] C3. `d` archives an artifact into Archived, and Enter on a folder artifact lists its files (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.679Z
  - verified: rev-23 [reviewer] · run rev-20261022-1139-final · 2026-10-22T23:31:01.130Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061
- [x] C4. A folded section stays folded after a reload, and ↑ moves the cursor up while `k` keeps (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.783Z
  - verified: rev-23 [reviewer] · run rev-20261022-1139-final · 2026-10-22T23:31:01.130Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061
- [x] C5. `web/README.md` gains an Artifacts section with the sections and the keys (docs).
  - done: impl-1139 · 2026-10-22T23:16:53.875Z
  - verified: rev-23 [reviewer] · run rev-20261022-1139-source · 2026-10-22T23:19:35.141Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061
  - verified: rev-23 [reviewer] · run rev-20261022-1139-final · 2026-10-22T23:31:01.130Z · commit 59f8de9034c5edab1a6f190186d0ed2571577061

## Comments

### impl-1139 · 2026-10-22T23:16:10.379Z

Implemented the Artifacts pane with Mine/Kept/By role/Archived folds, provenance/status rows, visible-row navigation, keep/archive commands and lazy folder files. Extended the existing bounded inventory with More artifacts; live replacements win over pending pages and reconnect invalidates old page replies. TDD reds were observed before each slice. Targeted local macOS Web tests pass (4 tests, worst 1.034 s); callback T1 passes (9 tests). T0 and existing slot/help regression checks in progress. QA policy is after-stage, so no per-item QA request.

### rev-23 · 2026-10-22T23:19:35.141Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1139-source
commit: 59f8de9034c5edab1a6f190186d0ed2571577061
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; no findings. Ten-file delta from 52657840 reviewed against item/Neovim grouping, shared physical shortcuts and docs. Grouping/folds/counts, keep/archive server boundaries, on-demand folder effects, unique bounded inventory continuation and live/reconnect race guards match the scope. No client deletion, dependency or permission change. C5 verified: README accurately documents implemented sections/keys and later file/topic/composer slices. C1–C4 remain run-dependent pending exact-head mode-free configured evidence. A-9490 is local implementation-tree targeted evidence only; topic separately reports exact-head check. New Web tier registration and shared palette expectation are consistent. No Reviewer test/browser execution; after-stage QA separate. Detailed source artifact posted in topic-876.

Criteria: C5 verified.

### rev-23 · 2026-10-22T23:31:01.130Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1139-final
commit: 59f8de9034c5edab1a6f190186d0ed2571577061
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; all C1–C5 verified at unchanged head. A-9522/723c9140 passes 2535 ordinary tests, no fail/skip/cancel, actual Linux x64 c-8 lon1 all T1/fallback hub+Neovim T2/Web. All four new Artifacts cases pass: grouping/folds 3.411317242 s, keep/up 1.300305448 s, archive/folder 1.267047536 s, bounded paging 2.606032950 s; each below >=4 s allowance trigger. Callback paging race has five distinct repeated passes with explicit 5/5. C5 source docs retained. Host check 7b6d9734 reused remotely; generic budget/lint/resource/ratchet warnings report-only, Web 57.49 s > 40 s report budget, one missing baseline. No T3/T4/QA claim; after-stage QA separate. No findings or source change; detailed final artifact posted in topic-876.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-22T23:36:13.885Z

Merged adde2c7c8eeff334a78b74adc8bfda202b9bcf66 onto dev.
