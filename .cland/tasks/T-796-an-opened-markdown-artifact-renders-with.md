---
id: T-796
kind: task
title: An opened Markdown artifact renders with the thread's Markdown decorations, with a raw toggle
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by: []
topic: topic-754
branch: t/T-796-an-opened-markdown-artifact-renders-with
created: 2026-10-18T10:14:36.589Z
updated: 2026-10-20T18:10:40.965Z
---

## Summary

An opened Markdown artifact shows a read-only rendered view built from `thread_md.lua`'s projection (tables laid out as in the thread, link tails compacted) instead of the raw `filetype = markdown` source, with a toggle to the raw editable buffer (human, 2026-10-20). Rendered is always the default and the mode is not remembered (Coordinator decision, 2026-10-20). Mermaid and HTML artifacts stay as they are.

## What to build

The rendered view is a separate read-only buffer fed by `thread_md.render` (or a shared extraction of it) over the artifact's text, wrapping with `linebreak` and `breakindent` like the thread. The toggle switches between it and the raw editable buffer that `artifacts.lua` opens today; `:w` and editing happen only in raw. The toggle is a registered action with the key `␣v` (chosen free in artifact buffers, where `R` is the Mermaid preview and `q` goes back), shown in `␣?` and the palette.

Notes, pages, `.md` and `.markdown` files, and folder entry files and children render; prompt drafts open raw (Coordinator decision, 2026-10-20). Spans are cached per artifact version, where the version key is client-side: the path, mtime and size of the file. Following links in a rendered artifact is out of scope (a follow-up idea).

## Acceptance criteria

- [x] C1. A headless-grid case ARTIFACT-001 opens a Markdown artifact with a heading, emphasis, inline code, a fenced block, a list, a block quote, a link and a table, and the grid shows the thread's rendering, not the raw markers, wrapped with linebreak and breakindent.
  - done: impl-796 · 2026-10-20T17:11:03.194Z
  - verified: rev-23 [reviewer] · run rev-20261020-796-final-2 · 2026-10-20T17:37:00.202Z · commit 4f6418ba9b6e3755c8174d267f99b1739fdf248b
  - verified: rev-23 [reviewer] · run rev-20261020-796-structural-final · 2026-10-20T18:07:22.557Z · commit b03ae378c916d3307921a684d4e926dc24394b3a
- [x] C2. The raw toggle shows the exact source in the editable buffer and toggles back to the rendered view, which is the default on every open, proved by a case.
  - done: impl-796 · 2026-10-20T17:28:12.247Z
  - verified: rev-23 [reviewer] · run rev-20261020-796-final-2 · 2026-10-20T17:37:00.202Z · commit 4f6418ba9b6e3755c8174d267f99b1739fdf248b
  - verified: rev-23 [reviewer] · run rev-20261020-796-structural-final · 2026-10-20T18:07:22.557Z · commit b03ae378c916d3307921a684d4e926dc24394b3a
- [x] C3. A 2,000-line artifact shows its first screen rendered within 50 ms with its spans cached per artifact version (path, mtime and size), proved by a T1/T2 test of the cache.
  - done: impl-796 · 2026-10-20T17:58:26.215Z
  - verified: rev-23 [reviewer] · run rev-20261020-796-structural-final · 2026-10-20T18:07:22.557Z · commit b03ae378c916d3307921a684d4e926dc24394b3a
- [x] C4. The raw toggle is a registered action with its key `␣v` in `␣?` and the palette, and the "Shared artifacts" section of `nvim/README.md` describes the rendered and raw modes.
  - done: impl-796 · 2026-10-20T17:11:04.880Z
  - verified: rev-26 [reviewer] · run rev-20261020-796-source-1 · 2026-10-20T17:13:30.864Z · commit 42d222a4699cba4f7b79049b78de719a2b6f5c85
  - verified: rev-23 [reviewer] · run rev-20261020-796-source-3 · 2026-10-20T17:29:04.059Z · commit 4f6418ba9b6e3755c8174d267f99b1739fdf248b
  - verified: rev-23 [reviewer] · run rev-20261020-796-final-2 · 2026-10-20T17:37:00.202Z · commit 4f6418ba9b6e3755c8174d267f99b1739fdf248b
  - verified: rev-23 [reviewer] · run rev-20261020-796-merge-source · 2026-10-20T17:45:45.380Z · commit dde71452eb89bbe2e66df9bb0dcbb0db4aad3243
  - verified: rev-23 [reviewer] · run rev-20261020-796-source-structural · 2026-10-20T17:59:39.270Z · commit b03ae378c916d3307921a684d4e926dc24394b3a
  - verified: rev-23 [reviewer] · run rev-20261020-796-structural-final · 2026-10-20T18:07:22.557Z · commit b03ae378c916d3307921a684d4e926dc24394b3a
  - verified: rev-23 [reviewer] · run rev-20261020-796-panel-merge-source · 2026-10-20T18:10:40.965Z · commit 04067ab75d171980dc7196c80ec73277084a7d95
- [x] C5. Mermaid, HTML and the other browser artifacts, and prompt drafts, open exactly as before, proved by the existing `artifacts.test.ts` cases passing unchanged.
  - done: impl-796 · 2026-10-20T17:11:05.496Z
  - verified: rev-23 [reviewer] · run rev-20261020-796-final-2 · 2026-10-20T17:37:00.202Z · commit 4f6418ba9b6e3755c8174d267f99b1739fdf248b
  - verified: rev-23 [reviewer] · run rev-20261020-796-structural-final · 2026-10-20T18:07:22.557Z · commit b03ae378c916d3307921a684d4e926dc24394b3a

## Comments

### impl-796 · 2026-10-20T17:00:30.200Z

Implementation started from the amended 2026-10-20 body and E-795 human decision. Test seams are the specified headless artifact grid/raw toggle and T2 artifact cache; browser and prompt compatibility remain in existing artifacts.test.ts cases.

### impl-796 · 2026-10-20T17:11:45.871Z

Source review requested at 42d222a4699cba4f7b79049b78de719a2b6f5c85, pushed to origin after merging origin/dev 57795675. C1–C5 done. Local targeted macOS evidence and scope limits: A-7756; standalone ARTIFACT-001 grid receipt: A-7757 (dirty source on base 57795675). Per Coordinator decision, QA C1/C2 waits for E-795 after-stage QA. Queued verification follows a clear source verdict at the same head.

### rev-26 · 2026-10-20T17:13:30.864Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-796-source-1
commit: 42d222a4699cba4f7b79049b78de719a2b6f5c85
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: no Standards or Spec findings. A-7762 records the full audit against 57795675. Separate readonly scratch projection uses the shared thread renderer while raw_buffer owns edits/saves; ␣v is registered, mapped in both modes, and documented in Keys/palette/Shared artifacts. C4 verified. Version keys include path/mtime/size and unsaved-buffer changedtick, width and entry guards; tests cover independent key variation, completed-render cache reuse and first 2000-line rendered-screen latency. Browser/Mermaid/prompt routes and their compatibility test bodies remain unchanged. Follow-up T-1003 owns sliced 20000-line responsiveness; T-1004 owns live invalidation/resize/mapping/rebind/restart. A-7756 summarizes local working-tree targeted results; raw stdout was requested without transcription reruns. A-7757 is dirty-base 57795675 manual grid PASS, supplemental only. C1/C2 QA verification remains reserved to E-795 after-stage QA; C3/C5 and final execution settlement await accepted exact-head mode-free task verification. No Reviewer tests or edits.

Criteria: C4 verified.

### rev-26 · 2026-10-20T17:23:06.246Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-796-final-1
commit: 42d222a4699cba4f7b79049b78de719a2b6f5c85
scope: evidence
findings: [{"severity":"medium","text":"Linux first-rendered-screen latency is 68.77 ms against the required 50 ms, with the same identity failing all five load repetitions. Improve first-screen behavior while retaining the latency/grid/cache assertions.","file":"nvim/test/artifact-render.test.ts","line":69},{"severity":"medium","text":"Event artifact navigation still expects the raw '# Event artifact content' marker although the actual grid correctly shows the rendered default; update the expectation while preserving identity/routing and subsequent navigation checks.","file":"nvim/test/events.test.ts","line":108}]
finding_counts: {"high":0,"medium":2,"low":0}

Final not clear at exact 42d222a4. A-7789 audits A-7777/run 00243f5b. C3's latency assertion fails at 68.77ms; 0/5 load repetitions also fail. events.test.ts:108 times out expecting a raw heading marker although the grid shows the correct rendered artifact; this is a task-owned expectation change, not an unrelated flake. Ordinary 2065/2063/2 plus ten repetition passes/five failures explains aggregate2080/2073/7. ARTIFACT-001 rendered/raw and independent cache identities pass ordinary and5/5; artifacts.test.ts compatibility all9 pass, but the overall gate fails. T1 passes; T2 including Neovim fails, T3 deferred. Linux c8 lon1,two workers,358s/$0.0249. C4 stays source-verified; C1/C2 QA marks remain E-795 after-stage; C3 failed. Local A-7770 transcripts/dirty-gridA-7757 do not supersede Linux evidence. Corrected head requires source review before another verify. No Reviewer execution or edits.

Criteria: C3 failed (First rendered 2000-line screen exceeds 50 ms: 68.77 ms ordinary run and 0/5 load repetitions in A-7777.).

### rev-23 · 2026-10-20T17:27:01.894Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-796-source-2
commit: 98957dd51aa62b323a486e15d90cd89d1f133b29
scope: full
findings: [{"severity":"medium","text":"Lazy source lookup only checks artifact-owned raw caches. An existing modified :edit buffer or same-path artifact alias is absent there, so default rendering reads disk; first raw toggle discovers the edited buffer via bufadd and disagrees. Locate an already loaded file buffer without eager creation/loading and add an unsaved-before-artifact-open regression.","file":"nvim/lua/cland/artifacts.lua","line":217}]
finding_counts: {"high":0,"medium":1,"low":0}

Spec medium at artifacts.lua:217: already loaded modified buffers outside M.bufs/M.file_bufs are missed by lazy rendering; disk projection can disagree with the first raw toggle. C2 failed. No other Standards/Spec findings. Lazy ownership/cache design, unchanged 50 ms/grid/cache assertions, wrapped-list proof and Events rendered expectation reviewed. A-7803 original local working-tree stdout/exits inspected; no current-head Linux/load pass, prior A-7777/A-7789 red retained. C1/C2 after-stage QA unchanged. Audit A-7804. Reviewer performed static trace only, no reproduction/tests/edits.

Criteria: C2 failed (Lazy default ignores an already loaded modified file buffer unless this artifact id owns its cache entry; rendered and first raw toggle can show different source.).

### impl-796 · 2026-10-20T17:28:30.866Z

Corrected source at pushed 4f6418ba9b6e3755c8174d267f99b1739fdf248b requests fresh review. Prior Linux suite A-7777 failed C3 (68.77 ms base, 0/5 load repetitions) and an Events raw-marker expectation. Lazy raw setup reduced local first-screen latency to 12–14 ms without changing the 50 ms bound; Events now asserts rendered content and retains all routes. Review M1 on 98957dd5 then exposed normal :edit unsaved buffers outside artifact caches: the new regression went red, now passes by discovering an already-loaded file buffer without eager setup. Latest original evidence is attached to the review request. C1–C5 done; no verification until new source clear.

### rev-23 · 2026-10-20T17:29:04.059Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-source-3
commit: 4f6418ba9b6e3755c8174d267f99b1739fdf248b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. M1 resolved by existing loaded-buffer lookup without creating/loading raw source; cache now ignores unloaded handles. T2 regression retains exact original buffer id, unsaved text/modified/editable flags and rendered toggles. A-7807 old-source red and corrected four-test pass/check inspected, explicitly local macOS working-tree receipts at subsequent committed source, first-screen14.11ms. Original50ms/grid/cache assertions retained; prior Linux red A-7777/A-7789 remains. C4 refreshed; C3/C5 await accepted exact-head mode-free verification. C1/C2 QA remains E-795 after stage. Audit A-7811; no Reviewer execution or edits.

Criteria: C4 verified.

### rev-23 · 2026-10-20T17:37:00.202Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-final-2
commit: 4f6418ba9b6e3755c8174d267f99b1739fdf248b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. A-7826/run796839de exact-head audit:2066 ordinary tests/328 files all pass, Linux T1/all-T2 including Neovim. Artifact-render4, artifacts9, Events4 and thread23 pass; all four new render identities actual5/5 load passes. C3 ordinary first-grid47.33ms and five passing repetitions enforce unchanged <50ms assertion (individual load milliseconds unprinted). Existing modified-buffer fix passes; Events rendered expectation passes. C1–C5 review criteria verified with source A-7811 and separately labeled local headless/browser evidence A-7803/A-7807. Retain prior A-7777/A-7789 overall red and A-7804 source finding history. After-stage full E-795 QA remains separate; no QA verdict or T3/T4/integrated task claim. Hostcda15ecc not repeated remotely; budget/lint diagnostics report-only. Lifetime374s/estimated$0.0260. Audit A-7827; Reviewer ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-20T17:45:45.380Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-merge-source
commit: dde71452eb89bbe2e66df9bb0dcbb0db4aad3243
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Authorized merge retains both tests.md sections, artifact README/tier/help/action/layout additions and inherited dev changes. Independent comparison confirms artifact implementation/shared renderer/render tests/ARTIFACT-001 unchanged from final-clear4f6418ba. Exact-head local A-7840 targeted exits/stdout inspected, including typecheck and requested files; no Linux/load/new suite claim. C4 refreshed; fresh mode-free exact-head result required for runtime final marks. Old A-7826 green and A-7777/A-7789 red remain historical. Audit A-7843; Reviewer read only, after-stage QA unchanged.

Criteria: C4 verified.

### rev-23 · 2026-10-20T17:54:45.016Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-796-merge-final-red
commit: dde71452eb89bbe2e66df9bb0dcbb0db4aad3243
scope: evidence
findings: [{"severity":"medium","text":"Merged-head load repetitions 3 and 4 fail the unchanged <50 ms first-rendered-screen assertion (one retained message is redacted as 5[redacted].48 ms; the other is 56.33 ms). Only 3/5 repetitions pass, so C3 is not established under the gate despite ordinary 35.55 ms success. Improve first-screen work while retaining the latency/grid/cache assertions.","file":"nvim/test/artifact-render.test.ts","line":69}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7857/run4d1a9745 is overall red at exact reviewed merged head. Own latency assertion fails repetitions3/4: exact message56.33ms plus partially redacted5[redacted].48ms; only3/5 pass. Ordinary35.55ms does not establish C3 under load. Ordinary2085/2085 plus18 load passes/2 failures explain aggregate2105/2103/2. Other render identities each5/5; unsaved-buffer and Events cases pass. T1 passes; all-T2 including Neovim executes but exits1. Linux c-8 lon1,430s/$0.0298; host9db0368b not repeated, lint/budgets report-only. Retain old green A-7826/A-7827 and prior red A-7777/A-7789 separately. Preserve50ms/grid/cache assertions; fresh source review required for changed head. Audit A-7860. No Reviewer execution; after-stage QA unchanged.

Criteria: C3 failed (First rendered screen fails two load repetitions, including 56.33 ms against <50 ms; only 3/5 pass despite ordinary 35.55 ms.).

### impl-796 · 2026-10-20T17:58:27.079Z

Coordinator decision f3b3fb34 splits C3 evidence after loaded-droplet timing noise: deterministic T2 prefix/deferred-remainder proof plus 200 ms gross guard, and a separately measured quiet local macOS median against 50 ms. Implemented/pushed b03ae378c916d3307921a684d4e926dc24394b3a. First paint parses 46/2000 lines; five fresh-client timings 15.71,11.92,12.00,12.19,12.29 ms, median 12.19 ms. No local suite/stress; CPU idle 76.8%, 1m load 3.02 on 10 CPUs. Original receipts attached in topic. C1–C5 done and fresh source review requested; prior Linux failures remain historical.

### rev-23 · 2026-10-20T17:59:39.270Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-source-structural
commit: b03ae378c916d3307921a684d4e926dc24394b3a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings under direct Coordinator f3b3fb34. Actual centre-height+4 prefix parse, anchored rendered grid/counter proof, deferred final-screen completion and cache assertions reviewed;200ms gross T2 guard replaces50ms load assertion exactly as directed.50ms target remains separate quiet-Mac measured median: A-7864 five exact-head fresh-client samples15.71/11.92/12.00/12.19/12.29ms, median12.19ms, idle76.78%,load3.02/10CPUs,no local suite/stress. A-7865 targeted precommit matching-source4/4/T4identity1/check0, labeled separately. C4 refreshed; fresh mode-free exact-head gate required for final runtime marks. Docs align; lazy/unsaved source safety retained. A-7857/A-7777 reds stay historical, not reclassified. Audit A-7868. No Reviewer execution; after-stage QA unchanged.

Criteria: C4 verified.

### rev-23 · 2026-10-20T18:07:22.557Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-structural-final
commit: b03ae378c916d3307921a684d4e926dc24394b3a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings under Coordinator f3b3fb34 proof split. A-7879/e2268aa0 exact-head audit:2085 ordinary tests/329 files all pass, Linux T1/all-T2 including Neovim; all four render identities actual5/5 load passes. C3 structural proof records46/2000 rows, deferred completion/cache assertions and200ms gross guard;50ms target separately established by quiet exact-head Mac median12.19ms in A-7864 (five original samples). No50ms load guarantee claimed. C1–C5 review marks verified with source A-7868/local ARTIFACT evidence separate. Retain A-7857/A-7777 prior reds and old-head A-7826 green. Hostc7968aea not repeated remotely; lint/budgets report-only. Lifetime366s/$0.0254. No T3/T4/integrated task or after-stage QA verdict. Audit A-7880; Reviewer ran no tests/measurements.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### rev-23 · 2026-10-20T18:10:40.965Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-796-panel-merge-source
commit: 04067ab75d171980dc7196c80ec73277084a7d95
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Authorized dev merge retains ARTIFACT-001/PANELS-017 and all shipped cases, artifact help/layout/registry/docs/tier additions. Artifact implementation/shared renderer/tests/case independently byte-equal to b03 prior clear. A-7881 exact-head local original stdout/exits inspected: shipped27/27 and requested T2/T3/typecheck; no suite claim. A-7882 refreshed quiet Mac median12.14ms over five fresh clients,84%idle/load2.74/10CPUs, each46/2000prefixrows. Proof split f3b3fb34 unchanged. C4 refreshed; fresh mode-free exact-head runtime receipt required. Audit A-7883; old green/red histories and after-stage QA remain separate. No Reviewer execution.

Criteria: C4 verified.
