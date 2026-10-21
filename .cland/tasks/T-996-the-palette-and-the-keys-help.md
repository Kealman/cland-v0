---
id: T-996
kind: task
title: The palette and the keys help
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-995
topic: topic-802
branch: t/T-996-the-palette-and-the-keys-help
created: 2026-10-20T16:51:40.983Z
updated: 2026-10-21T14:09:54.986Z
closed: 2026-10-21T14:09:54.986Z
---

## Summary

The palette opens on ⌘K and Space p over the dimmed shell, with the five prefixes and each action's key. `?` lists the area's keys. Both read the one key map, so the keys they show are the keys that work.

## What to build

The palette is one input with results grouped in the order of v0.1 §3.11, the matches in blue. The prefixes are `>` for actions, `#` for items, `@` for sessions, `~` for artifacts and `/` for topics. Enter opens the result, ⌘Enter opens it in a pane, Tab changes the kind, and Esc closes without acting. Each action shows its key from the key map. The objects come through the hub's ordinary reads on the web edge until E-412's snapshot is on `dev`. `?` lists the current area's keys from the same key map. `web/README.md` lists the shell's keys.

## Acceptance criteria

- [x] C1. ⌘K and Space p open the palette over the dimmed shell, and Esc closes it without acting or sending a frame (browser test).
  - done: impl-996 · 2026-10-21T13:24:16.921Z
  - verified: rev-23 [reviewer] · run rev-20261021-996-final · 2026-10-21T13:38:55.508Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f
- [x] C2. The prefixes `>`, `#`, `@`, `~` and `/` narrow the results to actions, items, sessions, artifacts and topics, grouped in the order of v0.1 §3.11, each action with its key (browser test).
  - done: impl-996 · 2026-10-21T13:35:11.392Z
  - verified: rev-23 [reviewer] · run rev-20261021-996-final · 2026-10-21T13:38:55.508Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f
- [x] C3. Enter opens the result, ⌘Enter opens it in a pane, and Tab changes the kind (browser test).
  - done: impl-996 · 2026-10-21T13:24:16.963Z
  - verified: rev-23 [reviewer] · run rev-20261021-996-final · 2026-10-21T13:38:55.508Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f
- [x] C4. `?` lists the current area's keys from the key map, and every key shown matches by code with Cyrillic key values (browser test).
  - done: impl-996 · 2026-10-21T13:35:11.412Z
  - verified: rev-23 [reviewer] · run rev-20261021-996-final · 2026-10-21T13:38:55.508Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f
- [x] C5. `web/README.md` lists the shell's keys.
  - done: impl-996 · 2026-10-21T13:24:16.999Z
  - verified: rev-23 [reviewer] · run rev-20261021-996-source-2 · 2026-10-21T13:34:56.403Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f
  - verified: rev-23 [reviewer] · run rev-20261021-996-final · 2026-10-21T13:38:55.508Z · commit 9304df00a4c0b6efce943374b20f61005ae8799f

## Comments

### impl-996 · 2026-10-21T13:24:17.019Z

Implemented the native modal palette and current-area keys help from the single physical-code map; ordinary hub rows supply the five fixed groups. Browser-first red/green slices cover dismissal with no frame, prefixes/matches, Enter/pane/Tab/arrows, every displayed shortcut with Cyrillic values, field drafts and Space leader across hub updates. Existing shell regression cases remain green. Web README documents all keys. Targeted macOS arm64/local: palette 5 cases, existing shell 8 cases, keymap T1 1 test; web typecheck/contrast/hooks and static/tier lint pass (repository test lint report-only). Source review precedes queued full verification. Inspected screenshot A-8419. QA remains after-stage per inherited policy.

### rev-23 · 2026-10-21T13:27:58.696Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-996-source
commit: 1b968526aa0e68f663c0f4b300a7a8cb972968c1
scope: full
findings: [{"severity":"medium","text":"A pending Space leader is resolved before checking whether the new target is a field. Press Space in the shell, focus a textarea/select (or open the palette by mouse), then type physical KeyP: it resolves to palette, which the field guard explicitly permits, so the p is swallowed and the palette opens/stays open. Apply leader sequences only in their shell/non-field context while retaining direct Meta+KeyK from fields; add a focus-transition browser regression.","file":"web/src/keyboard.ts","line":9},{"severity":"medium","text":"match records String.indexOf UTF-16 offsets but line105 highlights Array.from(text) code-point indexes. An emoji before matched text shifts the blue marks: searching Cat in 'T-1 🐈 Cat' records 7/8/9 while C/a/t render at 6/7/8. Keep matcher/render positions in the same Unicode coordinate system and add a non-BMP-title highlight regression.","file":"web/src/Palette.tsx","line":18},{"severity":"low","text":"The Backslash replacement literal contains four source backslashes, producing two displayed backslashes. Help/action labels therefore show a doubled slash for the single Meta+Backslash chord, and the test currently expects that incorrect label. Render one backslash and retain physical-code execution coverage.","file":"web/src/keymap.ts","line":31}]
finding_counts: {"high":0,"medium":2,"low":1}

Not clear; A-8423 records full eight-file audit against fixed dev5f120a47. Standards0 / Spec2 medium+1 low. M1 keyboard.ts:9 resolves pending Space before field/context filtering; Space→focus field→KeyP invokes permitted palette action and swallows draft p. Keep direct MetaK in fields, restrict leader context and add focused-draft/query regression. M2 Palette.tsx:18 records UTF16 positions but105 renders code-point indexes, shifting blue marks after emoji (Cat in T-1 🐈 Cat). Add consistent Unicode position mapping and regression. L1 keymap.ts:31 displays two backslashes for one chord; test repeats incorrect label. C2/C4 failed, others execution-dependent/unverified. Existing native modal/shared listener/read-only integration and Web tier reviewed; no other findings. These are source-derived counterexamples, no executed failure claimed. Correct/push then request fresh source review before verify; no Reviewer runtime.

Criteria: C2 failed (Palette highlight offsets mix UTF-16 matching with code-point rendering; non-BMP titles mark incorrect characters.), C4 failed (Pending Space leader crosses into fields/palette input and consumes physical KeyP as an unintended palette action.).

### rev-23 · 2026-10-21T13:34:56.403Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-996-source-2
commit: 9304df00a4c0b6efce943374b20f61005ae8799f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8426 records Standards/Spec audit. M1 resolved: leader now requires same originating target in shell/non-field context, retaining direct MetaK from fields and same-target hub-update behavior. M2 resolved: folded Unicode code points retain original positions, including emoji and lowercase expansion; browser regressions preserve exact highlight/draft assertions. README matches behavior; C5 verified. L1 explicitly withdrawn as my review error: committed source encoded one displayed Backslash all along; JSON-escaped output was misread. Added DOM [8984,92] assertion confirms intended contract. No remaining findings. C1–C4 need queued execution evidence at this exact unchanged head; no Reviewer runtime or pass claimed. C2/C4 claimant marks still show prior failures and need refreshing before final settlement. Source clear permits requested mode-free local verification including actual Web; after-stage QA remains separate.

Criteria: C5 verified.

### rev-23 · 2026-10-21T13:38:55.508Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-996-final
commit: 9304df00a4c0b6efce943374b20f61005ae8799f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-8428 audits queued local 6ee29cce/A-8427 against source-clear A-8426. Actual Darwin arm64/Node24.21.0/Neovim0.12.5 check + full T1/fallback all T2 in both packages + actual Web four files exit0: 2303 ordinary test passes,352 passing file finishes,zero failures/cancel/skip/todo. Seven palette cases explicitly pass at12622–12651, covering C1 dismissal/no frame, C2 prefixes/groups/blue Unicode marks, C3 Enter/pane/Tab,C4 current-area physical-code keys, stable leader and focus-transition draft/query preservation. C5 source docs remain verified; C2/C4 claimant done marks refreshed before submission. All C1–C5 verified; no findings. L1 remains withdrawn as my original escaped-output reading error. Check/typecheck/build/static enforced; test lint132/59, duration and ratchet report-only, one missing palette baseline. No load-gate finishes recorded/no browser repetitions claimed. Web shard5.38s is measured phase time, not interaction latency. No T3/T4/Linux browser/stage integration/after-stage QA pass claimed; inherited after-stage QA remains separate. Origin tip unchanged; Reviewer inspected evidence read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-21T14:09:54.986Z

Merged b4264fddcab0990a997f622d612652adcfd09a85 onto dev.
