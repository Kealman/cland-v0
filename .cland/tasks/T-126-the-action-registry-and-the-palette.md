---
id: T-126
kind: task
title: "The action registry and the palette: every command, toggle, view, launch and ask answer registered with its key; ␣p over actions and objects with prefixes; ␣a on artifacts"
state: closed
status: done
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-109
blocked_by:
  - T-125
topic: topic-46
branch: t/T-126-the-action-registry-and-the-palette
created: 2026-10-09T21:57:18.399Z
updated: 2026-10-10T00:58:18.009Z
---

## Parent

T-109 (Workbench basics), slice 3 of 5. Spec §3.11 (The palette).

## What to build

**The action registry.** One registry holds every `:Cland` subcommand, panel toggle, view switch, session launch and open ask's answer. Each entry has a title, its key, and the place a panel-local key works, or says it has no key. Existing keymaps are generated from the registry, or checked against it, so the two cannot drift.

**The palette.** `␣p` opens a floating palette.
- Without a prefix it searches actions and objects together, grouped in a fixed order: actions, items, sessions, artifacts, topics. The cursor sits on the best match.
- Prefixes narrow it to one kind: `>` actions, `#` items, `@` sessions, `~` artifacts and `/` topics. `␣a` opens it on `~`.
- Each action shows its key. An open ask's options are one action per option.
- Keys: Enter runs or opens, `C-v` opens in a split, Tab moves to the next kind, Esc closes.
- Matched characters are blue. Until the visibility layers land, closed items, stopped sessions and closed topics are dimmed.

Matching uses Neovim's built-in fuzzy matching (ADR 0005).

## Acceptance criteria

- [ ] `␣p` and a few letters toggle the sessions panel; `#` and an id open an item; an open ask is answered from the palette and the answer reaches the hub.
- [ ] Every registered action shows its key or "no key"; a test fails when a mapped key is missing from the registry.
- [ ] Prefixes, group order, Tab, `C-v` and Esc behave as above; `␣a` opens on artifacts.
- [ ] Headless QA cases cover the palette; `nvim/README.md` documents the palette and the registry.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Reference: `prototype/panels` `palette.lua`; mockup `Palette.dc.html` and `screens/v01-palette.png`. The later Neovim epics reach their views through this registry, so keep its API small and documented.

## Comments

### impl-126 · 2026-10-09T23:44:50.018Z

Read T-126/T-109 and Coordinator brief; base d21dfb5 includes T-125. Sweeping every existing keymap and :Cland command into one registry. Headless UI and the existing inbox hub-answer boundary are the authorized test seams; dimming will have one replaceable classifier and palette rows will reuse bars.fit.

### impl-126 · 2026-10-09T23:51:19.364Z

Registry and palette are implemented. Six headless palette tests pass: sessions action/key, item centre/split, runtime mapping audit (negative missing/drift checks), inbox-backed ask answer observed at the stub hub, fixed group order/best cursor/prefixes/Tab/Esc/␣a, and dim/blue/wide-row fitting. Split coverage found and fixed missing object-split redraws. Updating the superseded picker tests and writing shipped QA cases/docs before commit and the one final full suite.

### impl-126 · 2026-10-09T23:56:24.909Z

Implementation committed at 1b39ea43de4a681aec652e16a03e94b578cc6ce8 (copied from git log -1), clean tree. Palette 9/9, migrated picker shell 4/4, artifacts 5/5, shipped PANELS-007/008 2/2, typecheck and diff check pass. Real-hub test confirms the Coordinator's spoke receives option 2 with the human's answer_to. Running the implement skill's read-only Standards/Spec reviews against base d21dfb5 before the final machine-locked npm test.

### impl-126 · 2026-10-10T00:02:32.884Z

Committed review fixes at 3be41403ecf8273570e72ba44d206c3992e93e1e. Added regressions for two-key aliases, local selected-row context, focused topic splits, Insert newline, Terminal Shift+Enter through a real PTY, and visible live-render failure. Palette 13/13, shipped PANELS-007/008 2/2, typecheck and diff check pass. Queuing final package suite on this head.

### impl-126 · 2026-10-10T00:04:22.006Z

Final local review finding fixed in d0c1ab3166ee0167f2577a7ad29ba987dda81223: Agents reply composer topic actions target agents, not synthetic agents-reply. Regression reproduced the wrong hub request before the fix; 14/14 palette tests and typecheck now pass. Standards and Spec resolution reviews have zero remaining findings. Prior suite cancelled with runner SIGTERM cleanup (143); restarting final suite on the replacement committed head.

### rev-6 · 2026-10-10T00:06:42.784Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-126-1
commit: d0c1ab3166ee0167f2577a7ad29ba987dda81223

No high, medium or low findings remain. Standards and Spec are clear for the full d21dfb5..d0c1ab3 range.

The contextual command, focused-topic split, Insert/Terminal dispatch and multi-key declaration defects are resolved. The final Agents reply fix preserves its draft identity while targeting agents for topic actions. Memory probes confirm selected-row close, split-topic resolution, the second declared key, a native Insert newline, and the Agents reply target/replyTo.

Final typecheck and diff check pass; worktree clean. No suite run, as requested. Existing assertions remain substantive, and the real-hub answer test and shipped QA cases were inspected. Evidence: A-279, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-279-t-126-full-review-rev-6-126-1-at-d0c1ab3.md.

### impl-126 · 2026-10-10T00:18:36.791Z

Full npm test on d0c1ab3 passed hub 740/740 and Neovim 137/138; only failure was the startup test's stale literal Shift+Enter description. Fixed that literal in test-only e4d99845610990d0f17891d429cba8eba930c46f; terminal behavior assertions untouched. Targeted client.test.ts 7/7 passes. Full log A-290 is durable. Per Coordinator, rerunning the locked npm run test:nvim phase on the committed final head; hub code unchanged.

### rev-6 · 2026-10-10T00:19:35.115Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-126-2
commit: e4d99845610990d0f17891d429cba8eba930c46f

No high, medium or low findings remain. Standards and Spec are clear for the full item against d21dfb5, carrying rev-6-126-1 forward.

The sole delta at nvim/test/client.test.ts:120 preserves an independent literal expected value and strict comparison against the actual Terminal mapping. It is not a tautology; missing mappings and wrong titles still fail. The literal now matches the registry title. Production code and all behavior assertions, including exact harness CSI-u bytes, remain unchanged.

A-290 confirms that the old full-suite failure was precisely this stale description. Diff check passes; worktree clean. No suite run. Evidence A-291: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-291-t-126-test-delta-review-rev-6-126-2-at-e4d9984.md.

### impl-126 · 2026-10-10T00:23:37.577Z

Implementation complete at e4d99845610990d0f17891d429cba8eba930c46f, pushed to territory; worktree clean. Final npm run test:nvim passes 138/138 (exit 0), typecheck and base-to-head diff check pass. Hub phase previously passed 740/740 on d0c1ab3; final delta is the one-line literal test expectation only. Reviewer rev-6-126-2 clear on final head. Durable final suite log A-294 and complete handoff A-295; no merge performed.

### coord · 2026-10-10T00:23:51.848Z

Merged b4a6075dcff25be7d6c00578ddedc9b7f35b744e onto dev.

### coord · 2026-10-10T00:24:02.681Z

Merged by the Coordinator through `cland merge T-126`, after `cland push`: squash b4a6075 on dev.
Gate: review rev-6-126-2 clear on e4d9984, carrying rev-6-126-1 forward (clear on d0c1ab3). The local reviews fixed four defects in the round before rev-6-126-1, and one Agents reply-context case after it:
- panel-local action context;
- split topic target;
- Insert-mode dispatch;
- multi-key mapping.
Suites:
- full suite on d0c1ab3: 740 of 740 hub, 137 of 138 Neovim (A-290). The one failure was a stale Shift+Enter description assertion, fixed test-only in e4d9984 with a literal expected title.
- `npm run test:nvim` on e4d9984: 138 of 138 (A-294).
Handoff A-295.
