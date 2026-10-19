---
id: T-857
kind: task
title: On an existing project the Aide imports the open GitHub issues on yes itself, and files "what next" as the first release
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-856
topic: topic-594
branch: t/T-857-on-an-existing-project-the-aide-imports
created: 2026-10-19T08:10:03.027Z
updated: 2026-10-19T16:13:07.823Z
closed: 2026-10-19T16:13:07.823Z
---

## Summary

The existing-project path loses its workarounds. The Aide runs `cland task import-github` itself on the human's yes: open issues only, closed ones untouched, `--repo` read from the `github` remote. It reports the count and files "what next" as the first release from the imported issues and new tasks. The brief's fallback for "existing" follows setup's rule (T-844).

## What to build

- **EXISTING.md step 3.**
  - On yes, `cland task import-github`, with no `--repo` because the import reads `github`, then `origin`.
  - The "Today the hub refuses the import" paragraph goes.
  - The report counts the imported items (`cland task list --state open --json`), and the import's own output names them.
  - Closed issues and pull requests stay on GitHub. Another tracker is only named.
- **EXISTING.md step 4** keeps the accepted flow: an imported issue joins the release with `cland task link T-<n> --parent R-<m>`, a size and status planned.
- **SKILL.md "The brief".** `existing` when a file beside cland's own paths is tracked, or is untracked and not ignored; else `empty`. This is the same rule as setup's T-844.
- **T2 case.** An Aide in an in-process hub whose project has a `github` remote and a fake `gh` with two open issues and one closed runs `task import-github`. Two items appear, and `task link --parent R-1`, `task edit --size S --status planned` are accepted on one of them.

## Acceptance criteria

- [x] C1. EXISTING.md step 3 runs `cland task import-github` on the human's yes with no refusal workaround, and says that closed issues and pull requests stay on GitHub (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-857-source-corrected · 2026-10-19T14:45:31.374Z · commit 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
  - done: impl-857 · 2026-10-19T14:45:37.582Z
  - verified: rev-30 [reviewer] · run rev-20261019-857-final · 2026-10-19T15:05:11.004Z · commit 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
- [x] C2. SKILL.md "The brief" classifies a folder as `existing` when a file beside cland's paths is tracked or untracked and not ignored, as T-844 does (source review against T-844's rule).
  - verified: rev-30 [reviewer] · run rev-20261019-857-source-corrected · 2026-10-19T14:45:31.374Z · commit 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
  - done: impl-857 · 2026-10-19T14:45:38.127Z
  - verified: rev-30 [reviewer] · run rev-20261019-857-final · 2026-10-19T15:05:11.004Z · commit 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
- [x] C3. Run as an Aide against an in-process hub with a fake `gh`, the import brings the two open issues and not the closed one, and the step's link, size and status lines are accepted on an imported item (T2).
  - done: impl-857 · 2026-10-19T14:45:38.771Z
  - verified: rev-30 [reviewer] · run rev-20261019-857-final · 2026-10-19T15:05:11.004Z · commit 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739

## Comments

### impl-857 · 2026-10-19T14:41:35.998Z

Implementation: EXISTING step 3 now runs import-github without --repo on yes and matches the imported output to the open-item list for the count. Closed issues/PRs remain on GitHub; step 4 and T-856's removal of the human-paste fallback are preserved. The brief uses tracked or untracked nonignored project files. T-844 is still backlog/unclaimed, so Decision 9 comparison is against its task rule and spec §3.3; whichever lands second must match. Added T2 CLI flow under an Aide on projectHub with fake gh (two open issues, closed issue on all-only endpoint, open PR), real github + territory origin remotes, import naming/count, exclusion, link R-1, size S and status planned. Targeted full file: 13/13 pass, 4.239s (new case 0.455s); npm run typecheck passes. Per-item QA scope none; no QA brief required.

### rev-30 · 2026-10-19T14:43:45.930Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-857-source
commit: 78f63c1f3dc38ddff0c620f10eed8639dc26edde
scope: full
findings: [{"severity":"medium","text":"M1: New T2 fixture directly launches git init and two git remote add calls through execFileSync, outside the documented exception for a cland CLI subprocess as the subject. Replace the native fixture setup with a hermetic/prepared filesystem or injected boundary while preserving remote precedence and all import/link/edit assertions.","file":"hub/test/skills-onboarding.test.ts","line":247}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; A-6094. C1 import instructions and C2 tracked-or-untracked-nonignored rule match source/spec/T-844 declaration. C3 behavioral assertions are well targeted, but its test-side execFileSync Git setup violates T2 resource boundaries; report-only tripwire is not clearance. Keep fake-gh and authenticated Aide CLI/frame/import/link/size/planned proof while replacing only native setup. T-856's item-specific T-877 acceptance is not a general exemption. No verify at this head; fresh source review after fix, no dev merge. Reviewer ran no tests.

Criteria: C3 failed (New T2 import control uses forbidden native Git subprocesses for fixture setup; preserve the CLI proof while correcting the setup boundary.).

### impl-857 · 2026-10-19T14:44:57.417Z

M1 fixed at 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739: filesystem-only Git fixture (same pattern as aide-import-cli), no direct Git setup child processes. Full-file validation exposed a brittle issue→task number assumption, so test now captures IDs from import output before checking the list and planning #10. Typecheck pass; full file 13/13 pass in 5.715s (new case 0.422s); new test under enforce-mode T2 tripwire pass in 0.455s, no mismatch. Fresh fetched origin/dev 998f4178; merge-tree clean (aba7bcc36b77cf2bb350580096176f890a6f01e4). No post-review dev merge per rule 11. Fresh source review requested before verify.

### rev-30 · 2026-10-19T14:45:31.374Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-857-source-corrected
commit: 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6096, M1 resolved. Filesystem-only Git metadata fixture replaces all three native setup subprocesses, matching existing aide-import-cli fixture; CLI/fake-gh remains the subject. Capturing distinct output IDs removes an unjustified allocation-order assumption while retaining exact two-task list, exclusions, initial unsized/unparented state, R-1 link, size S/planned and #10 readback. C1/C2 source wording unchanged and verified; C3 awaits exact-head mode-free receipt. A-6095 reports 13/13 full file and isolated enforce-mode new case green/no mismatch. Inherited T-856/T-877 case unchanged. No dev merge or Reviewer tests.

Criteria: C1 verified, C2 verified.

### impl-857 · 2026-10-19T15:04:47.794Z

Same-head verification green: run 06c615a2-da38-45c6-ba10-695f476f1532 at 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739, auto exit 0, 1559/1559 pass, no failures/cancelled/skipped. All T1 and fallback all T2; T3 deferred to merge batch by queue protocol. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5; lifetime 1107s, cost $0.0769. Durable receipt A-6127: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6127-suite-06c615a2-da38-45c6-ba10-695f476f1532-auto-at-0b0b7c0.log. Head remains unchanged and clean; awaiting Reviewer's final C3 evidence verdict.

### rev-30 · 2026-10-19T15:05:11.004Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-857-final
commit: 0b0b7c00c6dcaabcdeac9aa508ee404b734a3739
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6128, C1–C3 verified, findings []. Exact-head mode-free 06c615a2/A-6127: ordinary 1559/1559, zero fail/cancel/skip/TODO, all 479 load groups 5/5. New import/link/size/planned C3 control passes ordinary 1.236407 s plus 5/5; whole 13-test file green. No tier trips from new import case; four inherited T-856 push trips at 54276–54279 match Coordinator c322ebda/T-877 disposition, not a new waiver. Corrected source A-6096 unchanged, M1 native setup removed. C1/C2 wording and T-844 later-landing matching obligation retained. Claimant marks present, report-only debt retained, T3 landing remains Coordinator-owned. No further item run.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T16:13:07.823Z

Merged 116c8cf97cb8bc8331ab9bb3242919e3e564ed5b onto dev.
