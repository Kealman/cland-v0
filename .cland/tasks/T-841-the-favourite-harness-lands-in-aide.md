---
id: T-841
kind: task
title: The favourite harness lands in `[aide.launch]`, marked as the human's choice
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: topic-582
branch: t/T-841-the-favourite-harness-lands-in-aide
created: 2026-10-19T06:34:13.175Z
updated: 2026-10-19T15:47:40.571Z
closed: 2026-10-19T15:47:40.571Z
---

## Summary

Setup asks which installed harness the human talks to. It writes the answer as `[aide.launch] harness` in `.cland/roles.toml`, with the `CHOSEN` mark that `projectSetUp` reads (T-651), and an effort that harness takes. Afterwards `cland open` stops printing `next: cland setup`.

## What to build

- **The choice.**
  - The installed harnesses are offered, in the order Claude Code, Codex, OpenCode, with the first as the default. A signed-out one is labelled.
  - With one installed, there is no question.
  - `--harness <h>` picks without asking, and fails when `<h>` is not installed.
  - `--yes` takes the default.
  - Without a terminal and without `--harness` or `--yes`, the step is `open`, naming both flags.
- **The write.** One table, through the roles editor:
  - the harness line carries the `CHOSEN` comment;
  - a change of harness resets `effort` (Claude Code `max`, Codex `high`, OpenCode none) and sets `model = ""`;
  - every other line of the file stays byte-identical.
- An already-marked favourite that is still installed is `ok` and asks nothing, unless `--harness` names another.
- A `roles.toml` the hub would refuse is `fail`, "repair it (cland doctor names the line)", and left untouched.

## Acceptance criteria

- [x] C1. Choosing Codex writes `harness = "codex" # the human's favourite, chosen in cland setup`, `effort = "high"` and `model = ""` in `[aide.launch]`, and no other line of the file changes (T1, a line diff).
  - done: impl-841 · 2026-10-19T11:28:47.705Z
  - verified: rev-30 [reviewer] · run rev-20261019-841-source · 2026-10-19T11:30:10.532Z · commit b223b0035a87c20f27390de72e41db2d362b70f0
  - verified: rev-30 [reviewer] · run rev-20261019-841-source-corrected · 2026-10-19T11:35:57.307Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-final · 2026-10-19T11:52:53.478Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-integration-source · 2026-10-19T12:21:52.441Z · commit 5781176e85b020f6db3f321fd612d08e30350e3a
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-source · 2026-10-19T12:47:50.892Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-final · 2026-10-19T13:06:49.593Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-source · 2026-10-19T14:17:27.135Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-final · 2026-10-19T14:37:18.428Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1
- [x] C2. After the write, `projectSetUp` is true, and a second run reports `favourite ok` without a question (T1).
  - done: impl-841 · 2026-10-19T11:28:48.206Z
  - verified: rev-30 [reviewer] · run rev-20261019-841-final · 2026-10-19T11:52:53.478Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-final · 2026-10-19T13:06:49.593Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-final · 2026-10-19T14:37:18.428Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1
- [x] C3. With one installed harness, no question is asked and that harness is written (T1).
  - done: impl-841 · 2026-10-19T11:28:48.599Z
  - verified: rev-30 [reviewer] · run rev-20261019-841-final · 2026-10-19T11:52:53.478Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-final · 2026-10-19T13:06:49.593Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-final · 2026-10-19T14:37:18.428Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1
- [x] C4. `--harness opencode` with OpenCode not installed is `fail` naming the installed set, and without a terminal and without flags the step is `open` and writes nothing (T1).
  - done: impl-841 · 2026-10-19T11:28:49.081Z
  - verified: rev-30 [reviewer] · run rev-20261019-841-source · 2026-10-19T11:30:10.532Z · commit b223b0035a87c20f27390de72e41db2d362b70f0
  - verified: rev-30 [reviewer] · run rev-20261019-841-source-corrected · 2026-10-19T11:35:57.307Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-final · 2026-10-19T11:52:53.478Z · commit 595ed1f06cd84f2dad9297333cd24e53b4878b1c
  - verified: rev-30 [reviewer] · run rev-20261019-841-integration-source · 2026-10-19T12:21:52.442Z · commit 5781176e85b020f6db3f321fd612d08e30350e3a
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-source · 2026-10-19T12:47:50.892Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-installer-integration-final · 2026-10-19T13:06:49.593Z · commit 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-source · 2026-10-19T14:17:27.135Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1
  - verified: rev-30 [reviewer] · run rev-20261019-841-trust-integration-final · 2026-10-19T14:37:18.428Z · commit dca23852347a0eda21e2825b2399c4b7c328aed1

## Comments

### impl-841 · 2026-10-19T11:25:56.303Z

Implementation starts at the existing setup/roles-editor seams. T1 proofs will cover C1–C4 through the favourite step, exact source bytes, projectSetUp and no-question reruns; CLI injection covers --harness routing. No per-item QA required by inherited policy.

### rev-30 · 2026-10-19T11:30:10.532Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-source
commit: b223b0035a87c20f27390de72e41db2d362b70f0
scope: full
findings: [{"severity":"low","text":"L1: Setup documentation still says nonterminal/JSON mode never writes and favourite is future work (982–992). This change intentionally permits favourite writes with --yes/--harness, including --json. Update the setup paragraph to match the CLI help and flag policy.","file":"hub/README.md","line":982}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear with one low documentation finding L1; A-5964. No high/medium findings. Shared roles editor preserves non-Aide bytes, marks CHOSEN and resets only changed-harness model/effort; invalid files/unknown choices fail without writes, cancellation propagates, marked reruns skip questions. Nonterminal flags policy matches E-613 clarification. C1/C4 source verified; C2/C3 await exact-head mode-free gate. Nine pure tests and updated flow/CLI carriers retain controls; A-5961 host checks recorded. README needs flag-write exception and built favourite update; CLI help is correct. No Reviewer edits/tests.

Criteria: C1 verified, C4 verified.

### rev-30 · 2026-10-19T11:35:57.307Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-source-corrected
commit: 595ed1f06cd84f2dad9297333cd24e53b4878b1c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-5974. Sole README delta resolves L1: built favourite and explicit --yes/--harness nonterminal/JSON write policy now match source, with selection/reset/rerun/invalid-file guidance. Production/tests unchanged against b223b003; no dev merge. C1/C4 refreshed; C2/C3 await exact-head mode-free verification. Prior full source/18 host passes retained, no findings. T-838 installer documentation overlap remains for later authorized integration.

Criteria: C1 verified, C4 verified.

### impl-841 · 2026-10-19T11:52:31.593Z

Exact reviewed head 595ed1f06cd84f2dad9297333cd24e53b4878b1c passed mode-free verification 64565817-0370-4e57-9111-50184263d024: 1516 passed, zero failures/skips/cancellations. Linux droplet c-8 lon1, lifetime 948s, cost $0.0659. Durable log A-6000: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6000-suite-64565817-0370-4e57-9111-50184263d024-auto-at-595ed1f.log. T3 runs in the merge batch. Reviewer received the same-head receipt and settles final verdict; no source changes.

### rev-30 · 2026-10-19T11:52:53.478Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-final
commit: 595ed1f06cd84f2dad9297333cd24e53b4878b1c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6004 audits same-head A-6000 / 64565817. Ordinary 1516/1516, zero fail/cancel/skip/TODO; all 439 load-gate groups 5/5 and zero tier-mismatch rows. All nine favourite cases, including projectSetUp/rerun and single-installed choice, complete ordinarily and in five repetitions. C1–C4 verified. Existing report-only findings retained; T3 is merge-batch landing evidence. No Reviewer tests run.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-19T12:21:52.442Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-integration-source
commit: 5781176e85b020f6db3f321fd612d08e30350e3a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration source clear; A-6027. Hub merge-conflict/rebase instruction 93c4bcb9 verified. Automatic dev merge preserves all favourite/source/test blobs; README and manifest compose correctly with incoming reviewed changes. A-6026 targeted passes retained; prior task gate is historical. C1/C4 refreshed, C2/C3 await exact-head mode-free evidence. No Reviewer tests or edits.

Criteria: C1 verified, C4 verified.

### impl-841 · 2026-10-19T12:22:03.547Z

Merge queue retry: 5781176e merges current dev cleanly and has source-clear delta review A-6027. Read-only merge-tree against pending T-838 c7e36da5 confirms inter-candidate conflicts. Coordinator decision fde30a4b authorizes holding verification until T-838 lands, then one further dev merge and fresh source review/verification at combined head. Waiting for Coordinator's landing delivery; no verification submitted for 5781176e.

### impl-841 · 2026-10-19T12:46:11.785Z

Integrated landed T-838/T-524 per Coordinator authorization. Head 7d6e52b73839788f752c5ff92c52d8e74e6feeb2 composes --install and --harness, keeps JSON installer stderr routing and both README behaviors, preserves all install/favourite assertions, and adds a pure combined install+favourite CLI test. All 26 targeted tests, typecheck and lint pass; fresh-fetch merge-tree against origin/dev clean before push. New source review requested; no verification before clear.

### rev-30 · 2026-10-19T12:47:50.892Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-installer-integration-source
commit: 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Installer integration source clear; A-6042. Coordinator integration authority confirmed. Both flag parsers, copied env, JSON stderr/narration and fresh installer detection compose with unchanged favourite module. Existing assertions retained; combined T1 install+choice JSON proof added. C1/C4 refreshed; C2/C3 await exact-head mode-free evidence. Separate existing favourite-writer sandbox omission reported for follow-up scoping; C1's three-line contract unchanged. No Reviewer execution.

Criteria: C1 verified, C4 verified.

### impl-841 · 2026-10-19T13:06:24.304Z

Combined reviewed head 7d6e52b73839788f752c5ff92c52d8e74e6feeb2 passed mode-free verification bfda2eb1-096a-4cde-b1fd-7fc7b415b94f: 1545/1545 passes, zero failures/skips/cancellations. Linux droplet c-8 lon1, lifetime 1037s, cost $0.0720. Log A-6046: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6046-suite-bfda2eb1-096a-4cde-b1fd-7fc7b415b94f-auto-at-7d6e52b.log. Reviewer has the exact-head receipt and settles the final evidence verdict. T3 remains merge-batch landing evidence; source unchanged.

### rev-30 · 2026-10-19T13:06:49.593Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-installer-integration-final
commit: 7d6e52b73839788f752c5ff92c52d8e74e6feeb2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration final clear; A-6048 audits A-6046 / bfda2eb1 at unchanged reviewed head. Ordinary 1545/1545, zero fail/cancel/skip/TODO, all 464 load groups 5/5, zero tier-mismatch rows. Ten favourite, ten installer-flow and six CLI cases pass, including combined install+choice JSON proof. C1–C4 refreshed. Coordinator separately filed sandbox follow-up T-874 and retained this head. Report-only findings retained; T3 is landing evidence. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-19T14:17:27.135Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-trust-integration-source
commit: dca23852347a0eda21e2825b2399c4b7c328aed1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized trust integration source clear; A-6085, findings []. Coordinator 83b75bdb read. Runner combines project/harnesses/logins/favourite/trust; CLI retains --harness and installer/JSON policy plus incoming rootSpelling/--yes trust gates. Favourite source unchanged from prior final-clear parent; trust modules and eleven tests unchanged from incoming reviewed dev. Existing controls retained with scratch HOME/trust isolation; new T1 control proves --harness writes favourite but leaves missing trust open/config absent without --yes. A-6084 reports 39/39 targeted passes and typecheck/lint/diff/merge-tree green. C1/C4 source requirements refreshed; final C1–C4 needs exact-head mode-free task receipt. T-874 separate, not fixed here. No Reviewer tests or further dev merge.

Criteria: C1 verified, C4 verified.

### rev-30 · 2026-10-19T14:37:18.428Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-841-trust-integration-final
commit: dca23852347a0eda21e2825b2399c4b7c328aed1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Trust integration final clear; A-6087 audits exact-head b261667a/A-6086. Ordinary 1566/1566, zero fail/cancel/skip/TODO, all 486 load groups 5/5, zero tier-mismatch rows. All 39 relevant favourite/flow/trust/CLI tests pass ordinary plus five repetitions; combined install+choice JSON, --harness without --yes leaving trust open/config absent, and Codex original-root spelling all pass. C1–C4 verified and claimant done marks present. Source composition A-6085 unchanged; inherited report-only duration/baseline/lint debt retained. T-874 remains separate. Native T3 remains Coordinator landing evidence; no further item run or Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T15:47:40.571Z

Merged 3c6c2715271eae1abef444256aee9dc08336fd92 onto dev.
