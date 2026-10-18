---
id: T-638
kind: task
title: The launcher's model field offers the models the harness lists
state: open
status: ready
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
updated: 2026-10-18T21:07:47.626Z
---

## Summary

The workbench launcher's model field offers the model ids `cland models` lists for the harness in the harness field, from the hub's cache, so the human picks a model instead of typing an id that may not exist. Free text stays allowed.

## What to build

- When the model field gets focus, the launcher asks the hub for the models of the harness the harness field names (and of the account field's account, when set) and offers them as the field's completion, the default first.
- Changing the harness or the account field changes the offered list on the next focus.
- The list is asked for only when the field is focused, never when the launcher opens, and never blocks typing; a failed or empty answer leaves the field as free text with a one-line hint naming the reason.
- The role-defaults behaviour of the launcher (a role fills the harness, model and effort; another harness clears the model meant for the role's) stays as it is.

## Acceptance criteria

- [x] C1. With the harness field on opencode, the model field's completion offers the ids the fake OpenCode lists, default first (headless Neovim test against the protocol).
  - done: impl-638 · 2026-10-18T20:34:56.479Z
  - verified: rev-31 [reviewer] · run rev-20261018-638-final · 2026-10-18T21:07:46.225Z · commit 37c87576f72056721c4461b6a0fad22987ce1b97
- [x] C2. Changing the harness field to codex offers the fake Codex's ids on the next focus, and a failed answer leaves free text with its hint.
  - done: impl-638 · 2026-10-18T20:14:18.900Z
  - verified: rev-31 [reviewer] · run rev-20261018-638-final · 2026-10-18T21:07:46.226Z · commit 37c87576f72056721c4461b6a0fad22987ce1b97
- [x] C3. Opening the launcher sends no models request until the model field is focused (the test counts the frames).
  - done: impl-638 · 2026-10-18T20:14:19.316Z
  - verified: rev-31 [reviewer] · run rev-20261018-638-final · 2026-10-18T21:07:46.226Z · commit 37c87576f72056721c4461b6a0fad22987ce1b97
- [x] C4. The existing launcher tests for the role defaults stay green.
  - done: impl-638 · 2026-10-18T20:14:19.725Z
  - verified: rev-31 [reviewer] · run rev-20261018-638-final · 2026-10-18T21:07:46.226Z · commit 37c87576f72056721c4461b6a0fad22987ce1b97

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

### impl-638 · 2026-10-18T20:34:56.464Z

Fixed task-owned A-5571 registry failure without relaxing the audit: completion continuations now install through checked actions.map. Reproduced original audit red, then green (0.31s); full palette file 13/13 (3.40s). Coordinator-directed split retains all eight launcher bodies verbatim: launcher 8/8 (2.44s, final new-slice run 2.10s), shell 56/56 (16.00s). Generated slices refreshed; host npm run check green. T2 tier and files-only duration summary added, leaving per-test load-gate identities absent. Details A-5581; logs A-5578/A-5579/A-5580. Ready for fresh source review at 37c87576; no dev merge since initial review.

### rev-31 · 2026-10-18T20:38:37.956Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-638-source-2
commit: 37c87576f72056721c4461b6a0fad22987ce1b97
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-638 corrected source review

Head: 37c87576f72056721c4461b6a0fad22987ce1b97
Fixed base: dc05341fab56e071f05a5d1319557d3a2358fece
Correction comparison: 689242089fde661ea9fe4ed597c807fba6f5672e → reviewed head.
Scope: full; source correction, test extraction, recorded fixtures and manifest entries. No dev merge.

## Standards

Clear; no findings. Completion continuation mappings now live inside the checked actions.map adapter, after declaration/scope/mode validation. The launcher supplies its continuation and native-completion predicate through that adapter. Completion acceptance still precedes the continuation in input order, and runtime binding metadata records the wrapper. Neither the static registry guard nor runtime mapping audit is weakened.

The Coordinator-directed T2 split extracts the existing owned stub-client fixture. The complete contiguous block of eight launcher cases is byte-identical; the assertion-line multiset across shell plus launcher is unchanged. The remaining shell changes are fixture imports/extraction. The helper retains explicit stub CLAND_COMMAND, bounded readiness checks and existing resource ownership. Both refreshed recording slices parse as JSON.

The new file has a T2 manifest entry and measured files-only duration summary. No per-test duration identities were added, so moved launcher cases remain eligible for repetition gates. Coordinator decisions 8068141c and 763e00d8 authorize the split and resumed serial validation; touching tiers retains the separate E-676 demo merge dependency.

## Spec

Clear; no findings. The original focus-only asynchronous models.list behavior, current harness/role-account frame checks, default-first completion, free-text fallback, stale-response rejection and role-default preservation remain covered without assertion changes. The adapter relocation preserves those behavior paths.

Independently inspected raw local receipts: A-5578 launcher 8/8, 2.438 s; A-5579 remaining shell 56/56, 16.000 s; A-5580 palette/registry 13/13, 3.401 s, including the exact previously failing mapping audit. Each has zero failure, cancellation or skip. A-5581 records the old-source audit reproduction and fixed-source validation, host check and final slice replay.

These establish correction/source readiness, not post-source task execution. C1–C4 remain unverified until the exact-head task receipt is audited, including registry integration, moved repetition gates and actual file budgets. One mode-free droplet verification may follow at this unchanged head. No per-item QA. Any head change requires fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5582.

### rev-31 · 2026-10-18T21:07:46.226Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-638-final
commit: 37c87576f72056721c4461b6a0fad22987ce1b97
scope: evidence
findings: [{"severity":"low","text":"Remaining file measures 31.001 s against 30 s budget; Coordinator 8068141c explicitly accepts an improving assertion-preserving split from pre-existing 34–37 s, with under 30 s a bonus. No allowance added.","file":"nvim/test/shell-component.test.ts","line":1}]
finding_counts: {"high":0,"medium":0,"low":1}

# T-638 final execution review

Head: 37c87576f72056721c4461b6a0fad22987ce1b97, unchanged from source-2 / A-5582.
Scope: evidence.
Run: 3112a16e-0dc1-4d30-8069-6511b5b929ed / A-5585, full, raw exit 0. Task receipt and branch head independently agree.

## Standards

Clear with one low residual budget finding. nvim/test/shell-component.test.ts:1: the remaining file measures 31.001086026 s against its 30 s T2 file budget. Coordinator decision 8068141c explicitly identifies the pre-existing 34–37 s dev result, requires an assertion-preserving split that does not worsen it, and calls reaching 30 s a bonus. The reviewed split satisfies that disposition; this report does not claim the file is under budget or create an allowance.

The new launcher file measures 3.530632749 top-level test-seconds. All 56 remaining shell cases and all 13 palette cases pass ordinarily, with all 56 and 13 respective load gates at 5/5. The exact previously failing registry audit passes ordinarily in 0.5881772 s and 5/5 repetitions. No task-owned runtime tier mismatch or quarantine outcome appears.

Four unrelated report-only tier mismatches remain the known init-next identity (C-326) and three suite-close-component identities (T-803), previously deduplicated. Other unrelated report-only duration lines are disclosed in A-5585; no global zero-budget-debt claim is made.

## Spec

Clear. Independently parsed all eight ordinary launcher finish outcomes: all pass, no cancellation/skip/TODO. Their eight exact identities each pass 5/5 load repetitions (40/40):
- role defaults, typed override and session.launch;
- model focus-only request and default-first completion;
- harness and matching role account on each focus;
- responsive typing while an answer is pending;
- rejection of a previous visit's late reply;
- failed/empty answer with free text and one-line reason;
- item-based launch;
- visible refusal and roleless confirmation.

C1 is established by the OpenCode/default-first protocol case; C2 by harness/account switching and failed/empty free-text cases; C3 by the explicit initial-opening and focus frame counts; C4 by the preserved role-default case. Source-2 already audited the byte-identical eight-case move and unchanged assertion multiset.

Overall ordinary result: 2661 total, 2653 pass, 0 fail, 0 cancelled, 8 skips, 0 TODO. Skips concern platform/tool availability; the idle-sleep case's raw reason is generic, not a task-owned skip. All three shard failure arrays are empty. Hub free 80.31 s, hub machine 1143.97 s, Neovim 335.86 s; complete suite 1560.17 s, workers 2, peak 1m load 8.08. Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5; droplet lifetime 1641 s, cost $0.1140.

Final result clear; verify C1–C4. No per-item QA. The Coordinator's separate E-676 demo merge dependency remains outside this verdict.

Findings: Standards 1 low residual file-budget overrun under explicit Coordinator disposition; Spec 0.

Evidence: A-5586.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
