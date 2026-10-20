---
id: T-1001
kind: task
title: The chosen layout survives restarts, and a reset restores the default sides and widths
state: closed
status: done
size: S
criterion_seq: 8
labels:
  - ready-for-agent
assignee: null
parent: E-789
blocked_by:
  - T-999
topic: topic-761
branch: t/T-1001-the-chosen-layout-survives-restarts-and
created: 2026-10-20T16:57:48.199Z
updated: 2026-10-20T18:58:30.767Z
closed: 2026-10-20T18:58:30.767Z
---

## Summary

Which side each panel lives on, and which panel each side shows, are saved in `.cland/ui.json` and in the `:restart` snapshot, and restored on the next start. A reset command and a palette action bring back the default sides and widths. An older `ui.json` loads into the default sides without losing its other preferences.

## What to build

The human puts Sessions on the left and Items on the right, quits, and starts the workbench again, and the layout is the same. `:restart` keeps it too. "Reset panel layout" in the palette (or `:Cland panel reset`) restores the default sides (Items on the left; Sessions, Inbox and Topics on the right) and the default widths (Coordinator decision, 2026-10-20). A broken or older `ui.json` never blocks the start: unknown or contradictory sides fall back to the default with one amber notice.

`ui.json` keeps version 2 and gains optional fields for the sides, so a version-2 file written before this change loads unchanged and E-413's one-time import of `events.last_look` and `plan_seen` can read the file either way (Coordinator decision, 2026-10-20). E-789 should land before E-413's third tracer bullet, which edits the same `ui.lua` and schema.

## Acceptance criteria

- [x] C1. A headless-grid case PANELS-019 sets Sessions left and Items right, reloads the UI state in-process, rebuilds the layout, and reads the same layout from the grid.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:48.108Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C2. Today's version-2 `ui.json` loads with the default sides and keeps its panels, sizes, filters, events preferences, plan receipts and release pick, proved by a T2 test over a fixture file.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:48.730Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C3. A `ui.json` with the new side fields stays at version 2, round-trips them through save and load, and keeps `events.last_look` and `plan_seen` readable for an import, proved by a T2 test.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:49.341Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C4. An invalid side assignment (an unknown panel, or one panel on both sides) falls back to the default sides with one amber notice and keeps every other preference, proved by a T2 test.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:49.853Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C5. The `:restart` snapshot carries the sides and the restore applies them, proved by a T2 test of the snapshot and restore functions.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:50.472Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C6. "Reset panel layout" (palette) and `:Cland panel reset` restore the default sides and the default widths and write `ui.json` at once, proved by a T2 test.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:50.988Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C7. The real cold restart in `ui.test.ts` and the real `:restart` in `shell.test.ts` keep a swapped layout, proved by targeted local runs of those T3 files with a swapped-layout case added.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:51.603Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
- [x] C8. The UI-preferences paragraph of `nvim/README.md` documents the new fields, the version handling and the reset.
  - verified: rev-23 [reviewer] · run rev-20261020-1001-source · 2026-10-20T18:33:02.300Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - verified: rev-23 [reviewer] · run rev-20261020-1001-final · 2026-10-20T18:41:32.323Z · commit d1ff39a2652599651adc193683868df9c063ce81
  - done: impl-1001 · 2026-10-20T18:44:52.112Z
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-source · 2026-10-20T18:46:08.636Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48
  - verified: rev-23 [reviewer] · run rev-20261020-1001-merge-final · 2026-10-20T18:53:51.048Z · commit 350c44757c41c6e7b4984ff32131d9fbdf307e48

## Comments

### impl-1001 · 2026-10-20T18:25:09.547Z

Implemented optional v2 panel_homes/panels.left_kind and actual right occupants, independent invalid-assignment fallback, restart snapshot/restore, home-aware presets, and immediate reset via command/palette. Reset follows Coordinator decisions 25967b18/ba5e77d4: preserve open panels, collision occupants and dock height; reset side widths only. Added T2 coverage and PANELS-019; real cold/restart cases are running at merged head 2adfdde0754de99561b41837b74d9959151df882 before review. Documentation updated in the same item.

### rev-23 · 2026-10-20T18:33:02.300Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1001-source
commit: d1ff39a2652599651adc193683868df9c063ce81
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7924 audits13-file diff against6ec2883a. Optional v2 homes/occupants, legacy preference retention, isolated invalid-side fallback/amber notice, shared restart validator, home-aware presets and reset reviewed. Reset matches Coordinator25967b18/ba5e77d4: collision keeps both panels; clear only side widths, keep dock height/open panels and other preferences; both entry points immediately flush. Matching registry/live help/nvimREADME/hubREADME/testing docs agree; C8 verified. Original A-7914 targeted exact-head local Mac logs inspected: T2 panel20/shell60/palette13, whole targeted T3ui10/shell25 and four selected shipped T4 cases pass. These remain supplemental, not Linux/load/full-tier or QA evidence; root check exit0 attributed to manifest, lint131/59 report-only. C1-C7 final runtime marks await mode-free exact-head gate. E-789 after-stage QA afterT-1002 separate. No Reviewer execution or edits.

Criteria: C8 verified.

### rev-23 · 2026-10-20T18:41:32.323Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1001-final
commit: d1ff39a2652599651adc193683868df9c063ce81
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7936 audits exact-head A-7928/run058977fe:2106 ordinary tests/330 files all pass, seven new panel persistence/reset/preset identities each5/5 load passes; panel20/shell-component60/palette13 ordinary passes. Linux x64 droplet allT1/fallback allT2 across hub/Neovim completed,432s/$0.0300. C1 physical grid and C7 real cold/:restart proof use separately inspected same-head local Mac A-7914: four selected shipped T4 passes includingPANELS019, whole targeted T3ui10/10 andshell25/25. C2-C6 runtime proof now green under task load; C8 sourceA-7924 retained. C1-C8 review verified. Linux task gate did not executeT3/T4; E-789 after-stage QA afterT-1002 separate. Host typecheck5fc97736 not remotely repeated; lint/duration/missing-baseline/ratchet diagnostics report-only. No Reviewer execution or edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### impl-1001 · 2026-10-20T18:44:52.761Z

Coordinator-authorized post-review integration: e8f75b8a merges dev with the sole qa-shipped catalogue conflict resolved by retaining all cases, including ARTIFACT-001 and PANELS-017/018/019. Full shipped run exposed incoming ITEMS-002 file=nil (A-7944); Coordinator diagnosed T-1007 and posted T-1022 shared fix 751d1bd1, cherry-picked as 350c4475. Clean/pushed 350c4475 actual local Darwin arm64: full shipped29/29, requested ui10/10 and shell25/25 T3, panel20/20 T2, typecheck exit0 including web. Fresh review requested before current-head mode-free verification.

### rev-23 · 2026-10-20T18:46:08.636Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1001-merge-source
commit: 350c44757c41c6e7b4984ff32131d9fbdf307e48
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7950 audits directed dev mergee8f75b8a and posted sharedT-1022 fix350c4475 under Coordinator4844206f/a6fb004c. Sole catalogue conflict retains all cases, includingARTIFACT001/PANELS017/018/019; shared patch independently identical to751d1bd1. Panel persistence/reset core and tests/case byte-equal tod1ff39a2; incoming artifact layout/help/registry and summary-loading paths coexist. Matching docs retained; C8 refreshed. A-7949 exact-head local original logs inspected: full shipped29/29, targetedT3ui10/shell25, T2panel20 and typecheck includingweb. No Linux/load/new-head suite claim; old A-7928 historical only. IntermediateA-7944 ITEMS002 file=nil failure retained and repaired by authorized shared fix. C1-C7 final review awaits fresh mode-free exact-head gate, local process/grid proof separate. E-789 after-stageQA unchanged. No Reviewer execution/edits.

Criteria: C8 verified.

### rev-23 · 2026-10-20T18:53:51.048Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1001-merge-final
commit: 350c44757c41c6e7b4984ff32131d9fbdf307e48
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7961 audits exact-head A-7960/run87996a17:2117ordinary tests/332files pass; seven new panel identities each5/5 load passes; panel20/shell-component60/palette13 pass. Linuxx64 droplet allT1/all-T2 fallback across hub/Neovim completed,387s/$0.0269. C1/C7 additionally proved by current-head local MacA-7949 full shipped29/29 and whole targetedT3ui10/shell25, including real cold/:restart/reattachment. C1-C8 review verified with sourceA-7950. OldA-7928 green and intermediateA-7944 failure retained as historical. Host18703a56 not repeated remotely; lint/duration/baseline/ratchet report-only. No LinuxT3/T4 task claim or stageQA verdict; E-789 full after-stageQA remains afterT-1002. No Reviewer execution/edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-20T18:58:30.767Z

Merged c9ee75f0a61072eabd13070ad7f4fe8e806103c8 onto dev.
