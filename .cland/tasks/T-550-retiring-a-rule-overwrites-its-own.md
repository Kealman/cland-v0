---
id: T-550
kind: task
title: Retiring a rule overwrites its own origin with the retirement's origin
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.3
  - hub
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-455
topic: topic-346
branch: t/T-550-retiring-a-rule-overwrites-its-own
created: 2026-10-16T00:31:38.513Z
updated: 2026-10-16T02:01:50.831Z
closed: 2026-10-16T02:01:50.831Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, case L10, at cdad9cdc). Retiring a rule replaced its origin (`session:qa-aide`) with the retiring human message's origin (`message:general/<id>`). The E-423 brief, and the rulebook's purpose, require each rule to keep its own origin. The cause is in `hub/src/rules/file.ts:120`: `retire()` spreads `{ origin }` over the rule whenever an origin is passed.

## Acceptance criteria
- [x] C1. Retiring a rule keeps its own `origin` unchanged and records the retirement's origin in a separate field (for example `retired_origin`), which `cland rule show` and `rule.list --all` display.
  - done: impl-550 · 2026-10-16T00:45:38.787Z
  - verified: rev-30 [reviewer] · run rev-20261016-550-source · 2026-10-16T00:46:54.016Z · commit b02a703b2189a8462413e315fc954ae9adb34b4e
  - verified: rev-30 [reviewer] · run rev-20261016-550-manifest-delta · 2026-10-16T01:22:30.796Z · commit 2fba6dc60a2117bee5593b6d804f17fec9139108
  - verified: rev-30 [reviewer] · run rev-20261016-550-final · 2026-10-16T02:01:28.433Z · commit 2fba6dc60a2117bee5593b6d804f17fec9139108
- [x] C2. A test retires a rule added by an Aide session through a human-origin retirement, and reads back both origins. `rule edit` keeps its current origin behaviour, and RULES.md round-trips the new field.
  - done: impl-550 · 2026-10-16T00:45:40.095Z
  - verified: rev-30 [reviewer] · run rev-20261016-550-final · 2026-10-16T02:01:28.433Z · commit 2fba6dc60a2117bee5593b6d804f17fec9139108

## Comments

### impl-550 · 2026-10-16T00:34:45.564Z

Implementation started: preserve origin on retirement, add separate retired_origin with an optional RULES.md Retired-origin field, retain edit semantics. Regression seam: existing hub rule tool scenario (Aide-added rule retired by Coordinator from a human message), CLI show/list reads, and pure codec round-trip. Local tests waiting for the under-15 Mac load gate.

### rev-30 · 2026-10-16T00:46:54.016Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-550-source
commit: b02a703b2189a8462413e315fc954ae9adb34b4e
scope: full

Source review T-550 clear at b02a703b2189a8462413e315fc954ae9adb34b4e, direct parent/fixed point 4ee9368e0e7b02b8bc7f1357f7d0054d8f6d8a62. Standards and Spec reviewed directly. No high, medium or low findings.

C1 verified: RulebookFile.retire leaves origin untouched and writes supplied retirement provenance to retired_origin. The shared codec accepts an optional Retired-origin line only for retired status, applies the existing origin grammar and reports its exact bad line. Old retired rules without it remain readable. Rendering and rewriting a changed retired rule preserve both fields; untouched source spans still preserve bytes, including CRLF. File writes parse the rendered candidate before atomic replacement, so an invalid supplied retirement origin does not replace RULES.md.

Checked both caller paths: live session tools still resolve a Coordinator origin to a real stored human message and an Aide origin to the held session identity, rechecking authorization before write. Shell/Aide-shell/workbench dispatch now supplies shell/session:<name>/workbench as retirement origin instead of silently omitting it. Neither path changes edit behavior: session tools retain origin updates, shell edits preserve origin, workbench edits retain their existing origin behavior. CLI show/list display both fields, and socket/tool JSON returns the shared Rule with retired_origin. No client protocol shape duplication or invented authority bypass.

C2 implementation reviewed: public session scenario now retires the distinct Aide-created rule using a Coordinator's human-message origin, then checks both original and retirement origins through every role's tool list and CLI show/list text and JSON. Existing edit-origin assertion remains. CLI tests also retain shell, memory-origin Aide and workbench semantics. Pure codec regression checks legacy compatibility, exact unchanged round trip, changed-entry re-render/reparse and malformed/active retirement-origin refusal. Original assertions are retained, with list expectations adjusted for which rule was retired. README accurately distinguishes current edit behavior and separate retirement provenance.

A-3504 reports before-fix red for overwrite/unknown codec field and corrected serial Mac whole-file passes: rulebook3/3, rule-sessions7/7, rule-cli7/7; loads3.84/3.84/3.79, no Coordinator local suite. New codec case0.627ms, changed human/Aide scenario1.162s; typecheck and diff check pass. Immutable diff whitespace check independently clear. These targeted receipts support source clearance, not final same-head suite evidence. C2 final criterion verification stays pending the required post-source cland verify at this head. No per-item QA; E-423 owns the L10 stage demo rerun after merge.

Read item file for criteria/body under Coordinator bd00929a's T-548 guidance; no task.view journal scan. No Reviewer tests, compiler execution, edits, installs, commits, merges or provider actions.

Review artifact A-3506 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3506-t-550-source-clear-at-b02a703b-separate-retirement-provenance.md.

Criteria: C1 verified.

### rev-30 · 2026-10-16T01:22:30.796Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-550-manifest-delta
commit: 2fba6dc60a2117bee5593b6d804f17fec9139108
scope: delta

Delta source review T-550 clear at 2fba6dc60a2117bee5593b6d804f17fec9139108, direct parent/source-reviewed b02a703b2189a8462413e315fc954ae9adb34b4e. Standards: no findings. Spec: no findings in this data-only delta.

Independent immutable audit: only hub/test/durations.json changes. Conflict resolution matches Coordinator-posted2149fe33d178b5ef93d2742151d7290026dc2d8e byte for byte. Strict JSON parsing rejects duplicate keys; root keys remain version/source/budget/files/tests/allow. All non-allow fields equal the posted payload, including2177 baseline test identities; all229 shared allowance keys and values/reasons remain, with zero drops or changed common values. No extra task allowances. No production code, test cases, bounds or dependencies changed; no dev merge. Immutable diff whitespace checks clear.

Shared evidence A-3493/c0c04df1 is the full integrated cover at a06020a3478184c604165d70d0d0e81b30a956a7, exit0, hub and Neovim completed. It supports this Coordinator-directed baseline refresh; it is not a task-head verification. No additional local rerun requested for this shared data-only pick under launch rules.

Original rule provenance implementation/tests and A-3504 targeted17/17 remain unchanged; source A-3506 stands. C2 final verification pending. Old-head verify97a70087 is historical until received and assessed. Preserve the stated wait for posted T-556 fix instead of knowingly repeating it; any additional pick requires source review.

Only source-established criteria C1 reverified here. No final evidence/merge readiness claimed. Any subsequent source/head change needs delta review; verification follows the lead's stated prerequisites/admission sequence. No per-item QA change. Read task files/earlier review chain; no task.view full-journal scan. No Reviewer tests, binaries/compiler execution, edits, installs, signals, commits, merges or provider actions.

Review artifact A-3554 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3554-t-550-shared-manifest-delta-clear-at-2fba6dc6.md.

Criteria: C1 verified.

### coord · 2026-10-16T02:00:24.969Z

Gate decision (Coordinator, 02:00Z): Linux receipt 97a70087 (at the pre-pick head, before 2149fe33) is accepted for 2fba6dc6. The head moved only by the reviewed shared manifest pick. All 17 rulebook, rule-sessions and rule-cli cases passed in the ordinary run and 5/5 in load-gate repetition, including the changed Aide→human retirement regression. The only red lines are load-gate repetitions of tests outside the diff, stale-manifest artefacts per the 01:17Z ruling (executor-run cross-executor cache 4/5), and T-556's known suite-runner timestamp 0/5. There's no nvim diff. No further run.

### rev-30 · 2026-10-16T02:01:28.433Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-550-final
commit: 2fba6dc60a2117bee5593b6d804f17fec9139108
scope: evidence

Final evidence review T-550 clear at current pushed/source-cleared2fba6dc60a2117bee5593b6d804f17fec9139108. Standards and Spec: no new findings. C1 source analysis A-3506 and manifest-only delta A-3554 remain current; remote branch ref independently resolves to this exact head.

Gate authority: read Coordinator d6dc3712-d6de-4bae-8bfe-903c8be02a29 in topic-346 (02:00:21Z). It explicitly accepts receipt97a70087-dcd9-4064-a82e-7ebb093db384, requires no resubmit, counts the reviewed shared2149fe33-only head movement as same head, and classifies its unrelated repetition reds under the recorded stale-baseline/T-556 handling. This is the item-specific gate disposition, not a claim of an exit0 whole suite.

Read durable raw log A-3582 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3582-t-550-old-head-droplet-verify-97a70087-log.log. It identifies old head b02a703b2189a8462413e315fc954ae9adb34b4e and executes from /home/runner/cland in the reported Linux droplet verification. Typecheck completed, hub free and machine phases completed; suite duration2528.23s, extra load-gate wall1234.70s, peak1m13.72, exit1. No ordinary failing test, cancellation or hard duration-budget failure is printed. Ordinary phase counts are free38pass and machine1811pass/4skip; do not confuse file-wide slowdown notices with a failing duration budget.

Independently extracted all17 own exact identities across rule-cli7, rule-sessions7 and rulebook3. Each has an ordinary completion/timing and its own5/5 passing repetition line. This includes rule shell provenance/retirement behavior (4.536s ordinary) and separate retirement provenance codec/rejection regression (.001789s). Thus the task's changed cases are green in ordinary Linux execution and all five repeated executions; existing targeted17/17 source receipts A-3504 also stand.

Exactly two red lines: executor-run explicit droplet/cross-executor cache case4/5, outside the task diff and classified stale-manifest repetition artefact by the Coordinator; suite-runner old-version holder timestamp identity0/5, knownT-556. No Neovim phase reached after hub exit1. Preserve these limitations in the record. Task has no nvim diff; Coordinator explicitly accepts this receipt with no local Neovim supplement. The only movement from verified-run head to current head is the exact shared baseline2149fe33 payload already independently reviewed in A-3554; product and task tests are unchanged.

C2 verified under that explicit disposition; C1 reverified/current by the unchanged source chain. No further run, source edit or merge performed by Reviewer. Ready for lead/Coordinator settlement through normal merge gate. No per-item QA requirement. No task.view scan, tests, compiler/binary execution, edits, installs, signals, commits, provider actions or subagents by Reviewer.

Review artifact A-3583 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3583-t-550-final-evidence-clear-at-2fba6dc6-under-accepted-linux-receipt.md

Criteria: C1 verified, C2 verified.

### coord · 2026-10-16T02:01:50.831Z

Merged 5bbc0e8b7a4755d8957f7cc8814c178fd135b570 onto dev.
