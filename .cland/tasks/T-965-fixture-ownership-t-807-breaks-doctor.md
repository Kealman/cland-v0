---
id: T-965
kind: task
title: Fixture ownership (T-807) breaks doctor orphan-hub reporting and the Linux Neovim ownership descriptor (T-807 regression)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - regression
assignee: null
parent: E-952
blocked_by: []
regression_of: T-807
found_by: cover
topic: topic-741
branch: t/T-965-fixture-ownership-t-807-breaks-doctor
created: 2026-10-20T11:57:00.999Z
updated: 2026-10-20T12:25:40.333Z
closed: 2026-10-20T12:25:40.333Z
---

## Summary

The periodic dev T3 at 224d45cc (b5fc792c, log A-7568), Linux droplet, has three failures that trace to T-807's fixture-ownership change (bd64bdcb). impl-964 classified them while working T-964:
- doctor-isolation.test.ts "doctor --fix under one fixture root preserves another deleted-project hub": expected `/ended pid N/`, but doctor now reports the process as an orphan fixture rather than an orphan hub.
- orphan-servers.test.ts "doctor reports a hub whose project was deleted; --fix ends it…": same cause (actual undefined, expected true).
- fixture-orphans-lifecycle.test.ts "worktree removal reaps the receipt-bearing headless client and stub…": "Neovim retains its inherited ownership descriptor" is false on Linux. T-807's native proof ran only on macOS.

## What to build

- **Doctor classification:** a real project hub whose project was deleted is reported and ended as an orphan hub, even when it was launched by a fixture. Fixture ownership must not hide the hub classification the doctor tests and users rely on. Decide and document which wins when both apply.
- **Linux descriptor:** make the Neovim ownership descriptor survive on Linux, or replace the descriptor check with a mechanism that works on both platforms. Prove it on Linux.

## Acceptance criteria

- [x] C1. doctor-isolation.test.ts and orphan-servers.test.ts pass with fixture ownership in place, and the hub-vs-fixture precedence is documented in hub/README.md.
  - done: impl-965 · 2026-10-20T12:11:53.801Z
  - verified: rev-26 [reviewer] · run rev-20261020-965-final-1 · 2026-10-20T12:21:13.164Z · commit 0bdc85f41524e01f219a2ce6f189407f7b0758c0
- [x] C2. The fixture ownership receipt holds for headless Neovim on Linux; a native T3 case covers it (its Linux receipt is landing evidence from the next periodic dev T3), and the mechanism's Linux behaviour is stated in the evidence.
  - done: impl-965 · 2026-10-20T12:05:37.874Z
  - verified: rev-26 [reviewer] · run rev-20261020-965-source-2 · 2026-10-20T12:13:11.829Z · commit 0bdc85f41524e01f219a2ce6f189407f7b0758c0
  - verified: rev-26 [reviewer] · run rev-20261020-965-final-1 · 2026-10-20T12:21:13.164Z · commit 0bdc85f41524e01f219a2ce6f189407f7b0758c0

## Comments

### impl-965 · 2026-10-20T11:59:18.786Z

Feedback loop: sealed disposable runner, macOS arm64/local targeted existing doctor T3 cases. Both reproduced red at initial task tree. Native lifecycle file passes 2/2 on macOS, so this is not a Linux receipt. Investigating classification replacement plus startup fixture sweep races; Linux /proc and exec/CLOEXEC source semantics under examination.

### impl-965 · 2026-10-20T12:05:48.555Z

Source review requested from reviewer role at clean/pushed 56ea2ae747724040b7c7aed46a6716e234339fd1 after merging freshly fetched origin/dev. A-7599 contains diagnosis and qualified evidence. Exact-head npm run check passes (report-only lint, zero refusals); fixture-orphans/doctor-isolation/native fixture lifecycle 12/12 and deleted-project orphan-servers case 1/1 pass macOS/local. Full orphan-servers 18/18 is qualified working-tree evidence. No Linux T3 receipt claimed; deferred to periodic dev landing run. Repetition loop did not start because fresh load guard reached >=6. Waiting source clear before mode-free verification.

### rev-26 · 2026-10-20T12:08:58.683Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-965-source-1
commit: 56ea2ae747724040b7c7aed46a6716e234339fd1
scope: full
findings: [{"severity":"medium","text":"projectHub has a separate environment path without CLAND_TEST_ORPHAN_ROOT. Existing orphan-servers tests enable its startup sweep, so daemon.ts:404 performs unscoped fixture cleanup and can consume another test's deleted-root target. Add the same root default before explicit scratch overrides and an enabled embedded-sweep foreign-root regression.","file":"hub/test/harness.ts","line":437}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: medium M1 harness.ts:437, separate projectHub environment omits the startup scope added to runCland:336. Existing orphan-servers.test.ts:62/79/100/284/293/307/317 enables that embedded sweep; daemon.ts:404 then receives no hubScopeRoot. Give it the same project-root default with explicit scratch overrides and cover completed embedded startup preserving a foreign deleted root. C1 fails. Spec otherwise: OS-proven hub precedence and documented behavior checked; one-second child birth margin retains private/open/UID/PID/fresh identity gates. T2 boundaries/native T3 design checked; Linux source semantics verified from primary sources, actual native Linux execution explicitly deferred to periodic landing evidence by C2. A-7603 has audit/source links, A-7599 qualified local check summaries; original stdout retention requested. No Reviewer tests or edits. Corrected head needs source re-review before verification.

Criteria: C1 failed (Embedded projectHub startup sweeps remain machine-wide when explicitly enabled, so cross-test doctor cleanup races remain reachable.).

### impl-965 · 2026-10-20T12:11:53.782Z

M1 corrected at clean/pushed 0bdc85f41524e01f219a2ce6f189407f7b0758c0, no dev merge after review. Embedded projectHub now defaults startup sweep scope to its own project before explicit scratch overrides. Expanded existing native doctor-isolation case red→green (A-7605/A-7606), observing embedded sweep completion and both foreign roots alive before doctor. Exact corrected-head targeted T2/T3: four affected files, all 30 tests pass, no skips, macOS arm64/local, 66.95s invocation; no manual duration gate. Exact-head npm run check exit0, lint report-only, zero refusals (A-7610). Original historical stdout retained in A-7604. Native Linux T3 remains deferred landing evidence; no verification at rejected head.

### rev-26 · 2026-10-20T12:13:11.829Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-965-source-2
commit: 0bdc85f41524e01f219a2ce6f189407f7b0758c0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1 resolved. projectHub now defaults startup scope to root before explicit scratch overrides. Existing doctor-isolation native test arms log observation before enabled embedded startup, observes sweep completion, asserts both deleted-root targets survive, then retains doctor's classification/termination/foreign-root assertions. No identities/tiers/allowances weakened. Spec: hub precedence and one-second child birth mechanism unchanged; private/open/UID/PID/fresh identity checks and native fd/birth/both-receipt/death controls retained. C2 source/native-test/evidence verified under its explicit native Linux landing-evidence deferral; no Linux T3 pass claimed. A-7605 red, A-7606 corrected partial green, A-7611 exact-head local 30/30 and A-7610 root check exit 0 (existing test lint report-only) inspected; old working-tree proof separately labelled A-7604. A-7614 has audit and primary-source links. C1/final pending accepted mode-free receipt at 0bdc85f4. Reviewer ran no tests or edits.

Criteria: C2 verified.

### impl-965 · 2026-10-20T12:20:33.855Z

Verification 29ae64a8/A-7622 passed at unchanged 0bdc85f41524e01f219a2ce6f189407f7b0758c0: 2057/2057, zero failures/skips, Linux x64 droplet c-8 lon1, Node24.21.0/Neovim0.12.5, T1 plus infrastructure fallback all T2 in hub and Neovim. Lint/duration gates report-only. Receipt attributes host typecheck gate separately to f505de77308e6520ddedbf68e496e25b55dafbfd (not repeated); exact task-head local T0 check is A-7610. Droplet lifetime383s, cost$0.0266. No native T3 executed; Linux native T3 remains next periodic dev landing evidence. Reviewer receives same result and settles final verdict.

### rev-26 · 2026-10-20T12:21:13.164Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-965-final-1
commit: 0bdc85f41524e01f219a2ce6f189407f7b0758c0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. A-7622 pins reviewed head and host check; enforcing static guards/typechecks green, later host reference not repeated remotely. Existing lint/budgets/ratchet report-only, eleven missing baselines/incomplete T3 timing basis disclosed. Own fixture-orphans T2 9/9 pass (max .103865 s), PID/birth control .003084 s. Spec: accepted 29ae64a8 at 0bdc85f4 exits 0, 2057/2057 passed, no fail/skip/cancel. C1 native doctor classification/isolation checks additionally pass exact-head macOS A-7611 (all four files 30/30); M1 red/green A-7605/A-7606 retained. C1/C2 verified under current wording: C2 native Linux T3 remains explicitly deferred to next periodic dev landing evidence. The three native files did not execute in A-7622; no Linux T3 pass claimed. Linux c-8 lon1 two workers, lifetime 383 s/$0.0266, T1/all T2 includes regular Neovim. A-7624 records scope/limits. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T12:23:05.096Z

Coordinator note on attribution: the dev-t3 culprit search went green at bd64bdcb (T-807) and red at 13e652a7 (T-955) for doctor-isolation.test.ts (A-7627). T-955 changes only role-clause test files (roles-clauses/roles/surface tests, tiers.json), so it cannot cause a doctor failure. The green probe at bd64bdcb is a lucky pass of the race impl-965 found: the fixture startup sweep added by T-807 consumes the doctor target. regression_of T-807 stands. Any bug the search files against T-955 for this file closes as a duplicate of T-965.

### coord · 2026-10-20T12:25:40.333Z

Merged 0d0808a79934eea18f9d6c267e6f2986c8dc6bc0 onto dev.
