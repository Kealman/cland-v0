---
id: T-638
kind: task
title: The launcher's model field offers the models the harness lists
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - nvim
assignee: null
parent: E-611
blocked_by:
  - T-635
topic: topic-532
branch: t/T-638-the-launcher-s-model-field-offers-the
created: 2026-10-16T16:04:13.257Z
updated: 2026-10-18T20:25:42.940Z
---

## Summary

The workbench launcher's model field offers the model ids `cland models` lists for the harness in the harness field, from the hub's cache, so the human picks a model instead of typing an id that may not exist. Free text stays allowed.

## What to build

- When the model field gets focus, the launcher asks the hub for the models of the harness the harness field names (and of the account field's account, when set) and offers them as the field's completion, the default first.
- Changing the harness or the account field changes the offered list on the next focus.
- The list is asked for only when the field is focused, never when the launcher opens, and never blocks typing; a failed or empty answer leaves the field as free text with a one-line hint naming the reason.
- The role-defaults behaviour of the launcher (a role fills the harness, model and effort; another harness clears the model meant for the role's) stays as it is.

## Acceptance criteria

- [ ] C1. With the harness field on opencode, the model field's completion offers the ids the fake OpenCode lists, default first (headless Neovim test against the protocol).
  - failed: rev-31 [reviewer] · 2026-10-18T20:25:42.940Z · note Launcher completion integration fails the existing mapping-registry audit; touched component file also exceeds its T2 file budget without disposition.
- [x] C2. Changing the harness field to codex offers the fake Codex's ids on the next focus, and a failed answer leaves free text with its hint.
  - done: impl-638 · 2026-10-18T20:14:18.900Z
- [x] C3. Opening the launcher sends no models request until the model field is focused (the test counts the frames).
  - done: impl-638 · 2026-10-18T20:14:19.316Z
- [x] C4. The existing launcher tests for the role defaults stay green.
  - done: impl-638 · 2026-10-18T20:14:19.725Z

## Comments

### impl-638 · 2026-10-18T20:13:18.036Z

TDD at the Coordinator-confirmed T2 stub-hub/client seam. Focus now requests models asynchronously, sorts default first, and opens native completion without selecting text. Role launch.account follows the current harness; each field visit invalidates older replies. Held-frame tests cover typing before the reply, harness/account switches, stale replies, and failure/empty fallback. Existing role defaults remain green. Host npm run check passed; preparing source review.

### rev-31 · 2026-10-18T20:15:58.825Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-638-source
commit: 689242089fde661ea9fe4ed597c807fba6f5672e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-638 source review

Head:689242089fde661ea9fe4ed597c807fba6f5672e
Fixed base:dc05341fab56e071f05a5d1319557d3a2358fece
Scope:full; launcher Lua, approved stub catalog, recorded protocol fixtures and component tests.

Standards:clear. UI requests are asynchronous; native completion uses noinsert/noselect and input-ordered completion acceptance before navigation/submission. One visit token plus current frame comparison rejects stale replies. No added native harness subprocess or global account/state fixture. The existing T2 real-Neovim/stub-client seam matches Coordinator b1db5cb8, independently read; role launch.account is the agreed scope and no new account field is added. Generated recording changes support the new requests rather than changing production protocol.

Spec:clear. Focusing model requests models.list for the current harness and matching role account; initial launcher/name/harness fields make no request. Revisit invalidates previous replies and refetches after harness/account changes. Default models are grouped first with catalog order retained. Completion leaves typed text untouched until explicit selection; Enter accepts a selection before launch. Failed/empty replies leave editable free text with a newline-sanitized single-line reason. Existing role-default synchronization and alternate-harness clearing remain intact.

A-5563's raw ordinary component log was inspected:64/64 pass,zero fail/cancel/skip,20.215s. Positives include the unchanged role-default test plus focus/frame-count/default-first, role-account switch, typing while held, reversed stale reply, failed/empty free-text and item/refusal cases. A-5562 records targeted red-to-green and host npm run check. Both committed recording JSON files parse. These local receipts support source review; C1–C4 remain unverified pending the exact-head post-source task verification.

Findings:none. One mode-free droplet verification may follow at this unchanged head. No per-item QA. Fresh source review is required if head changes before another run.

Evidence:A-5565.

### rev-31 · 2026-10-18T20:25:42.940Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-638-runtime-1
commit: 689242089fde661ea9fe4ed597c807fba6f5672e
scope: evidence
findings: [{"severity":"medium","text":"Internal Plug mappings bypass actions.lua with direct vim.keymap.set; existing registry audit fails ordinary execution and0/5 repetition gate.","file":"nvim/lua/cland/launcher.lua","line":384},{"severity":"medium","text":"Touched T2 file takes34.837s against30s file budget; retain assertions and address the limit or obtain explicit Coordinator disposition, currently absent.","file":"nvim/test/shell-component.test.ts","line":498}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-638 runtime evidence: not clear

Head:689242089fde661ea9fe4ed597c807fba6f5672e, matches source verdict.
Scope:evidence. Runfb74dd98-7323-4284-9df7-5fdf657af42a / A-5571, raw exit1,nvim-only.

Standards findings:
M1 (medium), nvim/lua/cland/launcher.lua:384: internal Plug mappings directly call vim.keymap.set outside actions.lua. Existing palette-component.test.ts:189 rejects the registry bypass: ordinary audit fails and its repetition gate is0/5. Route the internal mapping mechanism through the checked actions adapter while retaining both static guard and runtime metadata audit. Implementer confirmed task ownership in e91892fe/f21f9618.
M2 (medium), nvim/test/shell-component.test.ts:498: the touched T2 file measures34.837s against the30s file budget (A-5571). Individual new cases pass, but the whole-file budget remains exceeded. Preserve assertions while addressing the file budget or obtain an explicit Coordinator disposition; f21f9618 confirms no such disposition exists yet and the lead is deciding the split/exception route. Report-only mode is not a recorded exception.

Spec evidence: all64 ordinary shell-component cases positively pass, including existing role defaults and all new focus/harness/account/free-text/stale-response cases. All eight launcher-related repetition gates are5/5. Those positives do not clear the task-owned registry integration regression or owned file-budget issue. Ordinary Neovim result387tests,383pass,1fail,0cancelled,3 platform sandbox skips. The interruption total1132 includes repetitions; the six registry failures are one ordinary plus five repetitions, not six separate ordinary tests. No runtime tier trips.

C1 fails the completion integration/readiness check at this pass; C2–C4 remain unverified pending corrected same-head execution. Linux x64 c-8lon1,workers2,Node24.21.0/Neovim0.12.5,lifetime438s,cost$0.0304. No unchanged-head retry. Source changes need fresh review; local exclusive-load restrictions remain the Coordinator's control. No per-item QA.

Review evidence:A-5572.

Criteria: C1 failed (Launcher completion integration fails the existing mapping-registry audit; touched component file also exceeds its T2 file budget without disposition.).
