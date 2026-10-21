---
id: T-994
kind: task
title: The rail, the top strip and the key map
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-992
topic: topic-793
branch: t/T-994-the-rail-the-top-strip-and-the-key-map
created: 2026-10-20T16:51:40.769Z
updated: 2026-10-21T10:46:34.310Z
closed: 2026-10-21T10:46:34.310Z
---

## Summary

The rail lists the seven areas as words with counts only where something asks for attention, and collapses to icons with badges by its button and below 1280 px. The top strip holds the project, the release switcher, the palette, the Coordinator, the needs-you pill and the hub's dot. One key map matched by `KeyboardEvent.code` drives `1` to `7`, so the Russian layout works.

## What to build

The shell reads the counts it needs through the hub's ordinary frames on the web edge until E-412's snapshot is on `dev`:
- **The rail.** The seven areas in the spec's order. It collapses to a 60 px column of stroke icons with badges and tooltips, by its button or by itself below 1280 px, and the browser keeps the choice.
- **The top strip.** The project, the release switcher (its pick remembered), the palette button with ⌘K, the Coordinator's chip, the needs-you pill (a green check at zero), the live dot and `?`. The tab title carries the needs-you count.
- **The key map.** One table keyed by code and modifiers. It never binds the browser's reserved chords.
- **Interface state.** It lives in `localStorage` under one versioned key per area, with every access guarded, and the shell works without it.
- **Focus and type (P4).** The keyboard cursor is a 2 px blue ring on the selection background, and hover only lightens. Ids are set in JetBrains Mono and never break at the hyphen.

## Acceptance criteria

- [x] C1. The rail lists Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts as words, with a count only where something asks for attention (browser test with a fixture hub holding an ask and a busy session).
  - done: impl-994 · 2026-10-21T10:25:17.981Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C2. The rail collapses to a 60 px column of icons with badges by its button and by itself below 1280 px, and the button's choice survives a reload (browser test).
  - done: impl-994 · 2026-10-21T10:25:18.002Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C3. The top strip shows the project, the release switcher, the palette button, the Coordinator's chip, the needs-you pill and the hub's dot with `?`, and the tab title carries the needs-you count (browser test).
  - done: impl-994 · 2026-10-21T10:25:18.020Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C4. `1` to `7` switch the areas through one key map keyed by `KeyboardEvent.code`, also when the keys arrive with Cyrillic key values (browser test).
  - done: impl-994 · 2026-10-21T10:25:18.040Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C5. The key map binds none of ⌘T, ⌘W, ⌘N and ⌘⇧T (unit test).
  - done: impl-994 · 2026-10-21T10:25:18.062Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-source · 2026-10-21T10:30:34.483Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-source · 2026-10-21T10:37:33.979Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C6. The interface state lives under one versioned `localStorage` key per area, and the shell renders and switches areas with storage throwing on every access (browser test).
  - done: impl-994 · 2026-10-21T10:25:18.083Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
- [x] C7. The keyboard cursor shows a 2 px ring on the selection background, hover only lightens a row, and an id never breaks at its hyphen at a narrow width (browser test on computed styles and layout).
  - done: impl-994 · 2026-10-21T10:25:18.111Z
  - verified: rev-31 [reviewer] · run rev-20261021-994-final · 2026-10-21T10:34:52.911Z · commit 131fba16fe08c8d69c389debec62facac0def65f
  - verified: rev-31 [reviewer] · run rev-20261021-994-merge-final · 2026-10-21T10:41:32.888Z · commit 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f

## Comments

### impl-994 · 2026-10-21T10:25:18.135Z

Implemented at 131fba16fe08c8d69c389debec62facac0def65f (tree da8a2bd06725ac5f897cdfd230320d51f9d3fb08), pushed to origin. C1–C4/C6–C7 proved through production-edge browser DOM/style/layout checks; C5 through pure T1 shortcut resolver. Targeted local macOS/arm64 shell (7 test results including parent), smoke (4), reconnect (1), key-map (1) all green; npm run check green, duration/test lint in report mode. No full verification receipt yet. Expanded/collapsed visual previews: A-8275 and A-8276. No per-item QA brief; inherited QA is after-stage. Fetch/merge origin/dev completed before this first review; already up to date.

### rev-31 · 2026-10-21T10:30:34.483Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-994-source
commit: 131fba16fe08c8d69c389debec62facac0def65f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, Standards 0 / Spec 0 findings. A-8287 records all changed source/tests/docs, both inspected previews, and qualified original receipts A-8283. C5 established by resolver source and pure unit receipt; browser-dependent C1–C4/C6–C7 await exact-head mode-free verification with actual Web execution. No final suite/latency/after-stage QA claim; no merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-21T10:34:52.911Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-994-final
commit: 131fba16fe08c8d69c389debec62facac0def65f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C7. A-8289 audits exact-head mode-free ef4e6404/A-8288: local Darwin arm64, local check/T1/full fallback T2/Web all exit 0, 2245 ordinary passes plus five distinct passing T1 key-map repetitions. All six actual shell browser subtests pass; Web is outside repetition lanes. Clean unchanged head, all claimant done marks present. Inherited report-only diagnostics/missing baselines qualified; no T3/T4/Linux/latency or after-stage QA claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### impl-994 · 2026-10-21T10:36:24.804Z

Coordinator authorized one dev merge for tiers.json conflict at 3da31f0f (decision adf265bb-0d10-41b3-8209-c4675f5cd28f). New pushed head 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f, tree 4882e67d1ba9a0f7a79fc47207fdd2de1525fe5a. Resolved only tiers.json by retaining both T1 entries; shell code unchanged. Local macOS/arm64 tier lint/build + targeted T1 keymap and Web shell/smoke/connection exit 0; original outputs A-8290. Fresh delta source review requested; prior ef4e6404 green is for 131fba16 and does not satisfy this changed head.

### rev-31 · 2026-10-21T10:37:33.979Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-994-merge-source
commit: 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear: A-8291. Sole tiers conflict preserves exact union of both parent manifests (535 entries, no lost/changed values). All T-994 implementation/harness/test blobs unchanged; ordinary-frame subscription compatibility inspected. C5 source-established; remaining criteria await fresh exact-head local mode-free Web-inclusive verification. A-8290 targeted output is supplemental with request-level source/exit attribution, not an embedded queued receipt. No merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-21T10:41:32.888Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-994-merge-final
commit: 44e74ae98105ecbb769653d30c3e8b7fb83c6e2f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1–C7 at authorized merged head. A-8294 audits 08cf6d73/A-8293: exact clean 44e74ae9, local Darwin arm64, check/T1/full fallback T2/actual Web all exit 0; 2265 ordinary passes plus five distinct key-map repetition passes. All six shell browser cases pass, shell parent 2.883572125 s within Web test budget, censuses zero. Four missing baselines and inherited lint/resource/file regression diagnostics remain report-only and qualified. All claimant done marks present. No T3/T4/Linux/latency/after-stage QA claim or merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-21T10:46:34.310Z

Merged e70309cd2f55bf94aff8c0ec4c127bffe2152744 onto dev.
