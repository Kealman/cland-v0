---
id: T-1762
kind: task
title: literal-rm hook allows glob targets, so Claude Code stalls on an approval prompt
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1181
topic: topic-1441
branch: t/T-1762-literal-rm-hook-allows-glob-targets-so
created: 2026-11-08T10:06:14.486Z
updated: 2026-11-08T10:20:50.699Z
---

## Summary

The `literal-rm` PreToolUse hook (`hub/src/cli/literal-rm.ts`, shipped by T-1181) refuses an `rm`/`rmdir` whose target comes from a variable, a command substitution or `xargs`, but it allows glob targets (`*`, `?`, `[...]`). Claude Code's own shell check cannot verify a glob target. It stops for human approval even under bypass permissions, so the session stalls. On 2026-11-08 10:00Z a coord sub-agent ran `bash -c '…; rm -f fence*.sh'` in its scratch dir and sat in "waiting for approval" for 7 minutes. The human was away, refused it, and asked that the hook refuse such requests outright.

## Evidence

A probe of `literalRmRefusal` at dev 50f0529d allows all of these: `rm -f fence*.sh`, `bash -c 'cd /tmp/x; rm -f fence*.sh'`, `rm a?b`, `rm [ab].txt`. It refuses the variable and substitution forms as designed.

## Acceptance criteria

- [x] C1. An `rm` or `rmdir` with an unquoted glob character (`*`, `?`, or a `[...]` class) in any target is refused with a message that says to list every path literally or to leave a fresh `mktemp -d` directory in place.
  - done: impl-1762 · 2026-11-08T10:14:14.897Z
- [x] C2. The same refusal applies inside `bash -c`/`sh -c` script strings and after `;`, `&&`, `||`, `then` or `do`, as the existing invocation patterns do. Glob characters inside here-document bodies and inside quoted non-rm arguments are not refused.
  - done: impl-1762 · 2026-11-08T10:14:15.073Z
- [x] C3. Literal targets, including quoted paths that contain no glob, stay allowed. Tests cover each refused form and each allowed one, red first against the current hook.
  - done: impl-1762 · 2026-11-08T10:09:26.973Z
- [x] C4. The refusal message and docs/agents guidance name globs alongside variables, substitution and xargs.
  - done: impl-1762 · 2026-11-08T10:20:15.075Z
  - verified: rev-35 [reviewer] · run rev-35-1762-source-3 · 2026-11-08T10:20:50.699Z · commit 11ad52710c97c0f6121e2883742446dea6f04c29

## Comments

### impl-1762 · 2026-11-08T10:07:30.186Z

Consumer sweep before extending refusal policy: literalRmRefusal is called only by hub/src/cli/hook.ts (local Bash PreToolUse, stderr reason and exit 2 unchanged). Managed hook installers: hub/src/init/settings.ts and adapters/claude-code.ts; coverage: literal-rm.test.ts, literal-rm-cli.test.ts, init-settings.test.ts, init.test.ts, init-process.test.ts, claude-code-environment.test.ts. CLI help and fixtures, docs/agents/claude-code-hooks.md, per-test notes, implement skill describe the policy. state-paths-inventory.ts contains diagnostic context only. Searches across production, docs, skills and all test tiers found no parser of refusal text or persisted shape. Existing computed-target tests retain previous payload compatibility. Installers and lifecycle tests remain unaffected: same event, hook command and exit contract.

### rev-35 · 2026-11-08T10:12:35.403Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1762-source-1
commit: 35def35996ebe3344ed5cf95a6766b28faf60ec9
scope: full
findings: [{"severity":"medium","text":"Separator tests use word.value===';' for both actual operators and quoted literal words. rm ';' fence*.sh therefore stops scanning before a real glob target, while echo ';' rm fence*.sh falsely treats non-rm data as an invocation. Preserve explicit token kind/control-operator identity through tokenization and scans; author3a7c1c4f confirms, A-17800 retains both red controls.","file":"hub/src/cli/literal-rm.ts","line":58},{"severity":"medium","text":"Bracket detection rejects NUL-masked quoted class members and a leading literal ] member, so valid unquoted classes rm [a\"b\"] and rm []a] pass. C1 promises refusal for bracket-class targets. Recognize opening/closing syntax with per-character quote provenance and valid leading-] handling while preserving quoted/escaped/unmatched-bracket literals; author3a7c1c4f confirms and A-17800 retains red controls.","file":"hub/src/cli/literal-rm.ts","line":64}]
finding_counts: {"high":0,"medium":2,"low":0}

Full pinned pass A-17801: Standards0, Spec2medium. Author3a7c1c4f confirms no exclusions/other owner; A-17800 retains four red controls and honest candidate/tool-excerpt/native completion limits, not raw full logs. Hook/installers/exit and frozen-help consumers preserved. C1/C2 failed; other criteria not finally verified. Later uncommitted corrective source/tests are outside this pin; finish combined fixes then fresh committed request before mode-free verify. No Reviewer runtime/probe/edit/delegation or additional fullsuite/provenance-only repeat/dev merge requested. QA none.

Criteria: C1 failed (Quoted-semicolon target terminates glob scanning, and valid mixed-quoted/leading-] bracket classes pass.), C2 failed (Quoted semicolon data becomes a control boundary, falsely refusing a non-rm argument sequence.).

### rev-35 · 2026-11-08T10:14:09.546Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1762-source-2
commit: 11bb95097f74ba7ae833e0e4181b45cd3c5d5db8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear, Standards0/Spec0; A-17803. Dedicated separator flag and per-position masked class members/leading-] recognition repair both prior findings; pure red-first controls preserve quoted literals/data. Hook/exit/payload/installers and frozen-help contracts retained. Clean pinned head/diffcheck0 confirmed. C4 source-verified; C1–C3 await exact-head configured evidence. A-17800 prior red and A-17802 candidate10/10/typecheck excerpts retain original command/native completion and precommit/full-stream limits; no configured/Linux claim. Current tracker still showed C1/C2 failed despite request all-done: re-mark repaired criteria done before mode-free verify. No Reviewer execution/edit/delegation; no dev merge or extra native/fullsuite/provenance-only run requested. QA none.

Criteria: C4 verified.

### rev-35 · 2026-11-08T10:20:09.283Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1762-evidence-1
commit: 11bb95097f74ba7ae833e0e4181b45cd3c5d5db8
scope: evidence
findings: [{"severity":"medium","text":"Exact diagnostic-path expression/context retain the old message/inline fed ternary after refusal text moved to refusal(source) and gained mktemp guidance. The required state-path source inventory therefore fails on literal-rm.ts:26. Migrate the exact exemption without broadening the guard; task-local failure confirmed3ed9b758/A-17804.","file":"hub/test/state-paths-inventory.ts","line":301}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17806 audits failed exact-head A-17804: T0green/T1red inventory assertion; T2/Web unexecuted. Literal policy9base+35new-load passes are partial evidence, not green overall. Preserve complete inventory assertion, diagnostic-only reason and exact context; fresh committed source review required before retry. New11ad52710 request arrived during verdict recording and will be reviewed separately. No Reviewer runtime/probe/edit/delegation or unchanged-source/provenance-only repeat; QA none.

Criteria: C4 failed (Changed refusal diagnostic lacks its exact state-path inventory consumer migration; configured T1 fails.).

### rev-35 · 2026-11-08T10:20:50.699Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1762-source-3
commit: 11ad52710c97c0f6121e2883742446dea6f04c29
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17807 source3 clear. Only two exact diagnostic inventory strings migrated to current template tail/immediate source interpolation; file+expression+context matching, diagnostic-only reason, planted controls and full production inventory assertion retained. No production/source2 behavior change or dev merge. Clean exact head/diffcheck0 confirmed. A-17805 candidate6/6 native status-propagating tool excerpt inspected with precommit/full-stream limits; predecessor A-17804 remains failed, later phases unexecuted. C4 source-verified; C1–C3 pending new exact-head mode-free configured result. No Reviewer runtime/probe/edit/delegation or additional native/fullsuite/provenance repeat. QA none.

Criteria: C4 verified.
