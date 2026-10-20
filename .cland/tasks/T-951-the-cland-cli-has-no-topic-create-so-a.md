---
id: T-951
kind: task
title: The cland CLI has no `topic create`, so a shell-only session cannot open its item topic
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: topic-724
branch: t/T-951-the-cland-cli-has-no-topic-create-so-a
created: 2026-10-20T09:21:21.788Z
updated: 2026-10-20T10:10:51.981Z
closed: 2026-10-20T10:10:51.981Z
---

## Summary

Found in E-617's DoD demo (qa-676, run qa-2026-10-20-2, at 7916d5f7). An Implementer reports `cland verify` into its own item topic, and General is refused (correctly). But the CLI only offers `topic answer` (hub/src/cli/usage.ts ~165), and `task link --topic` needs an existing topic. A session working only from its shell, or a human, therefore cannot open an item topic; harness sessions use the `topic.create` tool.

## Acceptance criteria

- [x] C1. `cland topic create <title> [--item T-n]` opens a topic under the same role rules as the `topic.create` tool, binding it to the item when given, and the usage lists it.
  - done: impl-951 · 2026-10-20T09:56:58.845Z
  - verified: rev-26 [reviewer] · run rev-20261020-951-source-2 · 2026-10-20T09:58:39.755Z · commit 4d01247778ac88df029e9561acc1cba3d2e18b21
  - verified: rev-26 [reviewer] · run rev-20261020-951-final-1 · 2026-10-20T10:07:08.036Z · commit 4d01247778ac88df029e9561acc1cba3d2e18b21
- [x] C2. A T2 test covers an Implementer opening its own item's topic from the CLI and a refusal for another item.
  - done: impl-951 · 2026-10-20T09:56:59.782Z
  - verified: rev-26 [reviewer] · run rev-20261020-951-source-2 · 2026-10-20T09:58:39.755Z · commit 4d01247778ac88df029e9561acc1cba3d2e18b21
  - verified: rev-26 [reviewer] · run rev-20261020-951-final-1 · 2026-10-20T10:07:08.036Z · commit 4d01247778ac88df029e9561acc1cba3d2e18b21
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-951 · 2026-10-20T10:06:25.366Z
  - verified: rev-26 [reviewer] · run rev-20261020-951-final-1 · 2026-10-20T10:07:08.036Z · commit 4d01247778ac88df029e9561acc1cba3d2e18b21

## Comments

### impl-951 · 2026-10-20T09:42:50.949Z

Implementation seam: CLI subprocess → existing topic.create handler on projectHub; cover own claimed item and another-item refusal at T2.

### rev-26 · 2026-10-20T09:55:54.641Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-951-source-1
commit: 2bea08b32604145dbe8781a50915f73440fa2a3d
scope: full
findings: [{"severity":"medium","text":"The project override still tells Implementers to open topics only with topic.create, while only the built-in default clause gains the CLI spelling. Rule 16 requires the matching delivered role clause to change with the command; update the project copy too.","file":".cland/roles.toml","line":117},{"severity":"medium","text":"The added CLI subprocesses use cland/clandWithEnv with inherited HOME and Git configuration, and that helper does not apply withoutExecutorCredentials after extra overlays. The existing fixture isolates account/XDG paths but does not satisfy new rule 15. Use an authorized sealed fixture/shared fix before further CLI tests or verification.","file":"hub/test/asks-cli.test.ts","line":33}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: M1 .cland/roles.toml:117 project clause must match the updated built-in topic-create guidance (rule 16). M2 hub/test/asks-cli.test.ts:33 uses the known shared unsealed CLI helper: HOME/Git stay inherited and final overlays lack withoutExecutorCredentials (rule 15); await authorized fixture/shared-fix resolution before verification. Implementer already reported this shared gap in d541e085; no duplicate aside. Spec: no functional finding; existing actor/frame enforcement, durable binding and no foreign-topic side effect are retained. C3 remains pending. Reviewer ran no tests.

Criteria: C1 failed (Rule 16: project Implementer clause .cland/roles.toml:117 still omits the new CLI spelling.), C2 failed (Rule 15: new CLI regression uses inherited HOME/Git configuration and helper lacks final credential filtering; await authorized sealed fixture resolution.).

### rev-26 · 2026-10-20T09:58:39.755Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-951-source-2
commit: 4d01247778ac88df029e9561acc1cba3d2e18b21
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: project Implementer clause now matches CLI/help/docs (M1 fixed). Coordinator e2a78a1e explicitly defers the shared standard-fixture isolation gap to T-961 and directs T-951 to proceed, so M2 no longer blocks this item; the gap is not claimed fixed here. Spec: original actor/frame permission and own/foreign binding checks remain unchanged; no finding. A-7301 preserves original local macOS six-pass T2 output, labelled pre-commit/report-only, not an exact-head gate. C1/C2 source verified; C3 remains pending mode-free verify at 4d012477. No Reviewer test execution.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T10:07:08.036Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-951-final-1
commit: 4d01247778ac88df029e9561acc1cba3d2e18b21
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding. A-7348 accepted same-head mode-free task gate is passed; host check/typechecks green, existing lint/budgets report-only. asks-cli file diagnostic 2.375→4.242 s remains below T2 file budget; own cases/repetitions all below 2 s, no allowance changed. Shared fixture gap remains T-961 per Coordinator e2a78a1e. Spec: C1/C2 source retained, C3 now verified at 4d012477 by run 6abcef49: 1948/1948, no failure/skip/cancellation; T0–T2 fallback including Neovim. Parsed both new CLI identities: base pass plus actual 5/5 load passes each (max 0.696642/0.963393 s). Linux c-8 lon1, two workers, lifetime390s/$0.0271; T3 deferred to periodic/integrated, not claimed executed. No Reviewer tests or edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T10:10:51.981Z

Merged 7ee82a65ed4f498f4c0fe83e495f751591df2871 onto dev.
