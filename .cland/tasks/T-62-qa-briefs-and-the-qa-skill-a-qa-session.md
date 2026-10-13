---
id: T-62
kind: task
title: "QA briefs and the qa skill: a QA session runs an item's brief and
  records its verdict and runs"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-2
assignee: null
parent: E-20
blocked_by:
  - T-54
  - T-57
topic: topic-28
branch: t/T-62-qa-briefs-and-the-qa-skill-a-qa-session
created: 2026-10-09T08:34:54.777Z
updated: 2026-10-10T00:58:17.703Z
closed: 2026-10-09T16:27:17.149Z
---

## Parent

Part of T-20 (slice 2, ticket 11 of 12). Spec sections 4.10 and 7(c); the qa-astra research.

## What to build

The brief, `qa/briefs/T-<n>.md`, is committed and self-contained, because a rescue run cannot ask. It names the item; the build (branch and commit); the cases (ids of `qa/cases/<ID>.lua`, run with `cland --headless --qa`, T-57); manual checks (commands and expected outcomes); the surface per case (`headless-grid` by default, or `tmux`, `web-terminal`, `hub-api`); what is out of scope; and the grants needed, none by default. Each case file opens with its catalogue header: id, title, preconditions, expected result, since, regression. Runs go one JSON line per case and run into `.cland/qa/runs.jsonl`, with evidence in `.cland/qa/T-<n>/<run>/` (decision D14); the QA role's default `writable_roots` gains `.cland/qa`, and the managed `.gitignore` ignores `qa/` under `.cland`. The `qa` skill (`.agents/skills/qa/`) has two parts. For the QA role: run each case of the brief from the item's worktree, append the lines, write the verdict (`task.comment --verdict qa --result … --run … --commit …`, T-54; clear only when every case in scope passed, with the case table in its text), and report to the Coordinator. For the Coordinator: write the brief, send `qa request T-<n>` naming it, or run it through `/codex:rescue --background --fresh --model gpt-6-astra "Run the QA brief in qa/briefs/T-<n>.md exactly"` and record the returned verdict itself (which the merge gate does not count, decision D5); file each finding as an item labelled `qa-found` and `needs-triage`. The QA clause and `docs/review-and-qa.md` follow.

## Acceptance criteria

- [ ] A brief with two cases, sent as a `qa request` to a real Codex QA session (gpt-6-astra), ends with a QA verdict on the item, written through the hub by that session with the commit and the case table, and two lines in `.cland/qa/runs.jsonl` holding `ts`, `item`, `run`, `case`, `build`, `surface`, `method`, `result`, `exit_code`, `evidence` and `session`. The run is recorded in a comment on this item.
- [ ] A FAIL, BLOCKED or INCONCLUSIVE case makes the verdict `not clear` and names the case.
- [ ] The same brief through `/codex:rescue` returns the case lines and the verdict in its output; recorded by the Coordinator, it shows in the item view as the Coordinator's.
- [ ] The `qa` skill is in the QA and Coordinator skill lists of the default `roles.toml`, and `docs/review-and-qa.md` describes the brief and the runs line.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Test seam: a real Codex QA session through the hub on a fixture item, and one rescue run, both recorded on the item; the skill's command sequences run against a real hub, as the skills-tracker test does for the tracker template. Size M. Implementer: Claude Code (the criteria need a real Codex QA session and a `/codex:rescue` run).

## Comments

### coord · 2026-10-09T08:39:13.470Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/57 (a sub-issue of #20; the item is the source of truth).

### qa-62 · 2026-10-09T15:23:08.104Z

verdict: qa
result: clear
by: qa-62 [qa]
run: qa-2026-10-09-62-1
commit: 8506808c0cd568d912b8d5c2798e834ba0f4c34b

| case | surface | result | evidence |
| --- | --- | --- | --- |
| SHELL-001 | headless-grid | PASS | .cland/qa/T-62/qa-2026-10-09-62-1/SHELL-001.screen.txt; SHELL-001.state.json |
| ITEMS-001 | headless-grid | PASS | .cland/qa/T-62/qa-2026-10-09-62-1/ITEMS-001.screen.txt; ITEMS-001.state.json |

Ran from T-62's worktree, in order:
- CLAND="node hub/bin/cland.ts" .agents/skills/qa/qa-record.sh run T-62 qa-2026-10-09-62-1 SHELL-001
- CLAND="node hub/bin/cland.ts" .agents/skills/qa/qa-record.sh run T-62 qa-2026-10-09-62-1 ITEMS-001

Both commands exited 0. SHELL-001 showed a connected General thread with "hello from qa" queued. ITEMS-001 showed T-2 beneath T-1 (0/1), then opened T-2 with its body, comment, parent and ui label. Inspected the screen captures and verified exactly two JSON lines for this run, all required fields present, session qa-62, build 8506808, PASS and exit_code 0, in /Users/evgeniyivanov/Projects/cland/v0/.cland/qa/runs.jsonl.

Read task.view and checked CLI task list/view successfully. HEAD before and after matched the requested full SHA. The worktree already contained uncommitted changes to .agents/skills/qa/{BRIEF.md,SKILL.md,qa-record.sh}, qa/briefs/T-62.md and .cland/roles.toml; the run used those on-disk workflow files. No source files changed by QA. No manual checks in the brief; full suite excluded as requested.

Findings (high/medium/low): none in the two-case brief. Clear for this live acceptance run; this verdict does not assert the full suite or rescue acceptance criterion.

### impl-62 · 2026-10-09T15:43:33.882Z

Head fd8d581e94a8ff578760245122fc8ae4988de445. `npm run typecheck && npm test` pass: hub 443/443, nvim 91/91, 0 skipped.

Live runs (cases SHELL-001, ITEMS-001):
1. A real Codex QA session (gpt-6-astra) launched by the Coordinator in this project, qa-62, run qa-2026-10-09-62-1, pinned to 8506808: verdict clear, written through the hub, and two lines in .cland/qa/runs.jsonl:
{"ts":"2026-10-09T15:22:36Z","item":"T-62","run":"qa-2026-10-09-62-1","case":"SHELL-001","build":"8506808","surface":"headless-grid","method":"cland --headless --qa qa/cases/SHELL-001.lua","result":"PASS","exit_code":0,"evidence":[".cland/qa/T-62/qa-2026-10-09-62-1/SHELL-001.screen.txt",".cland/qa/T-62/qa-2026-10-09-62-1/SHELL-001.state.json"],"session":"qa-62"}
{"ts":"2026-10-09T15:22:41Z","item":"T-62","run":"qa-2026-10-09-62-1","case":"ITEMS-001","build":"8506808","surface":"headless-grid","method":"cland --headless --qa qa/cases/ITEMS-001.lua","result":"PASS","exit_code":0,"evidence":[".cland/qa/T-62/qa-2026-10-09-62-1/ITEMS-001.screen.txt",".cland/qa/T-62/qa-2026-10-09-62-1/ITEMS-001.state.json"],"session":"qa-62"}
2. Scratch project (cland init with this branch, own hub, removed afterwards), Codex qa-1 on gpt-6-astra, run qa-2026-10-09-1524 at 46bfed2: verdict clear, by qa-1 [qa], commit 46bfed2b, case table in the text, two runs.jsonl lines (session qa-1). It found one defect, fixed in 83dd2f2: `cland init` copies qa-record.sh without the executable bit, so the skill and briefs now say `sh .agents/skills/qa/qa-record.sh …`.
3. Rescue (/codex:rescue gpt-6-astra, --write) of the same brief in the scratch project, run qa-rescue-1 at b5bccf3, after the fix: returned both case lines (session rescue-job; it could not write .cland/qa, so evidence went to the temp dir and the lines were printed) and `verdict: qa / result: clear / commit / run`. Recorded by the Coordinator in the scratch project: the item view shows `[verdict qa: clear, by coord [coordinator], run qa-rescue-1]`, distinct from qa-1's verdict. The merge gate does not count it (D5).
4. Not clear: hub/test/skills-qa.test.ts runs the skill's sequence for real: a nonexistent case is BLOCKED (exit 2, still a line), the verdict `not clear` names it and the item view and `task list --verdict "qa=not clear"` show it. Partial failures tested: the append fails (line printed, "NOT recorded"), and the verdict is refused after the append (lines stay untouched, the QA session writes only the verdict again with the same run, no case reruns).
Not in this item's tests but changed with it: codex-adapter.test.ts expects QA's workspace-write profile to grant .cland/qa.

### qa-62 · 2026-10-09T15:45:51.965Z

verdict: qa
result: clear
by: qa-62 [qa]
run: qa-2026-10-09-62-2
commit: fd8d581e94a8ff578760245122fc8ae4988de445

| case | surface | result | evidence |
| --- | --- | --- | --- |
| SHELL-001 | headless-grid | PASS | .cland/qa/T-62/qa-2026-10-09-62-2/SHELL-001.screen.txt; SHELL-001.state.json |
| ITEMS-001 | headless-grid | PASS | .cland/qa/T-62/qa-2026-10-09-62-2/ITEMS-001.screen.txt; ITEMS-001.state.json |

Ran each case in brief order from the requested worktree with CLAND="node hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run T-62 qa-2026-10-09-62-2 <CASE>. Both exited 0. SHELL-001 showed General connected and the typed message queued; ITEMS-001 showed the parent/child tree and opened T-2 with its body, comment, parent and label. Inspected screen/state evidence. Exactly two lines appended to /Users/evgeniyivanov/Projects/cland/v0/.cland/qa/runs.jsonl for this brief run, with PASS/0, build fd8d581 and session qa-62. CLI task list/view succeeded. HEAD matched the requested SHA and git status was clean before and after. No source changes, manual checks, or full suite run.

Findings (high/medium/low): none in the requested brief.

Additional negative check, kept separate as requested: a throwaway Lua case NEGATIVE-001 deliberately failed qa.expect after hub connection. The real recorder/CLI/Neovim returned FAIL and exit 1, with QA_SESSION=qa-62-negative retained, under run qa-2026-10-09-62-negative-1. The temporary CLAND wrapper only redirected the catalogue path to the temporary case. Under the skill this negative case would require a not clear verdict naming NEGATIVE-001; no negative verdict was submitted to T-62. This clear verdict covers the two acceptance cases above.

Evidence artifact A-107: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-107-t-62-final-head-qa-and-intentional-fail-fd8d581.md, including the case table, three JSON lines, all six captures, negative source and method. Read-only fallback was not exercised by this delta request.

### rev-6 · 2026-10-09T15:51:17.492Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-62-1
commit: fd8d581e94a8ff578760245122fc8ae4988de445

High: none.

medium (Standards) — .agents/skills/qa/qa-record.sh:25: item pattern T-[0-9]* accepts /../../../ suffixes, and line 26 accepts empty/dot run IDs; these escape the required evidence tree. Validate numeric item IDs and each nonempty safe path component.

medium (Standards/Spec) — .agents/skills/qa/qa-record.sh:52: unquoted $out splits a valid project/TMPDIR path containing spaces or globs into multiple arguments, blocking the case or misplacing evidence. Pass --out and its quoted directory separately.

medium (Spec) — .agents/skills/qa/qa-record.sh:68: final JSON-generation failure is unchecked; an empty line is appended, “recorded” is reported and a passing case exits 0. Check serialization and refuse invalid/empty appends while preserving outcome/captures for recovery.

medium (Spec) — .agents/skills/qa/SKILL.md:15: rescue recovery appends returned lines without copying temporary captures into .cland/qa/T-<n>/<run>/ or normalizing their references, leaving disposable evidence outside the required durable record. Also document/recover both evidence-directory failures rather than silently dropping inline captures.

medium (Spec) — qa/briefs/T-62.md:12: “the commit the request names” makes the committed brief depend on external context; the documented fresh rescue command supplies only its path. Pin the build or supply a self-contained resolution rule.

medium (Spec, requested rollout scope) — docs/review-and-qa.md:40 / hub/src/roles/default-roles.ts:48: existing role clauses/skill lists do not inherit these defaults, cland update preserves roles.toml, and no migration instructions/report explain how to activate the QA workflow. Preserve customized roles and provide the migration; automatic overwrite would violate repository ownership.

Low: none additional. Verdict rule is correct: clear only for every scoped case/check PASS; FAIL/BLOCKED/INCONCLUSIVE produce not clear and name the case. Managed .gitignore refresh and omitted restricted QA roots work; explicit roots/custom files remain preserved.

Read-only /bin/sh probes with mocked filesystem/evidence/append boundaries reproduce accepted traversal/dot/empty IDs, split --out arguments and blank “recorded” output on encoding failure; no actual writes. Actual parseRoles of the existing worktree instance confirms neither role inherits qa skills/brief clauses. Read A-101/A-107 live QA evidence and item suite report; no suite rerun. Exact head verified, TypeScript noEmit and diff check pass.

Separate axes and runnable probes: A-110, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-110-t-62-review-rev-6-62-1-at-fd8d581.md.

### rev-6 · 2026-10-09T16:07:09.939Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-62-2
commit: f77057e2d9487cb5803b83ba77cd261bb4677435

High: none.

medium (Spec) — .agents/skills/qa/SKILL.md:65: recovery ignores mkdir/copy failures, then rewrites all evidence paths and appends them; line69 permits appending after captures disappear. Durable references can name files never copied. Check each step, preserve sources for retry, and publish only truthful references to preserved captures with explicit evidence-loss handling.

medium (Spec) — .agents/skills/qa/BRIEF.md:12 / qa/briefs/T-62.md:12: “A request that names another commit changes nothing” tells QA to ignore an explicit Coordinator build request. Honor it or report the conflict BLOCKED; the self-contained branch-tip rule is a valid default.

low (Spec) — docs/review-and-qa.md:45: replacing the QA skills list with the defaults drops project-added skills; add qa to the existing list.

low (Spec) — .agents/skills/qa/SKILL.md:56: the prescribed rescue answer omits inline captures emitted to script stderr when both destinations fail, although line72's Coordinator recovery requires that payload; forward it explicitly.

Standards clear. Safe IDs now refuse before writes; --out/executable are quoted; invalid/empty JSON is blocked with exit70 and recovery information. Migration and build resolution are documented; verdict rule remains correct.

Read-only /bin/sh probes reproduce exit64 for unsafe IDs, one argument for a spaced evidence path, exit70/no append on encoding fault, and the remaining copy-failure bug: mocked mkdir/cp fail yet recovery appends rewritten PASS evidence and exits0. No actual writes or suite. Exact head verified; TypeScript noEmit/diff check pass. Coordinator reports the completed538-test suite, not rerun here.

Separate axes and executable evidence: A-117, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-117-t-62-delta-review-rev-6-62-2-at-f77057e.md.

### rev-6 · 2026-10-09T16:15:26.577Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-62-3
commit: 6945669aca3b793d886351b49fd95e7d9b9920a5

High: none.

medium (Standards/Spec) — .agents/skills/qa/qa-record.sh:71: a failed jq evidence extraction is replaced with paths="", so no captures are copied; line_ok remains1 and the independent rewrite at line88 appends the original references under the durable tree and reports success. This breaches SKILL.md:66 and the requested checked recovery guarantee. Treat extraction failure as a lost line: preserve sources, name the case, append nothing for it and exit73.

Low: none additional. The other fixes pass: requested-commit mismatch is BLOCKED naming both commits; migration preserves existing skills; rescue forwards inline captures. Directory/copy/verification/missing/conflict/append failures correctly refuse the affected line.

Eight read-only /bin/sh probes with filesystem/input/append boundaries mocked reproduce normal success, exit71 for mkdir failure, exit73 for other recovery failures, and the remaining extraction fault: zero CP calls, rewritten PASS line appended, exit0. Real jq handles all other steps. No actual writes or suites. Exact head verified; diff check and TypeScript noEmit pass. Coordinator reports 14 targeted tests on this head, last full suite on f77057e.

Both axes and executable probe evidence: A-122, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-122-t-62-recovery-review-rev-6-62-3-at-6945669.md.

### rev-6 · 2026-10-09T16:27:10.744Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-62-4
commit: 7f4501b9dadf7e5415c476aca645769562e9f79c

High, medium, low: none remaining in the requested resolution delta. Standards clear; Spec clear.

The prior evidence-extraction failure is closed at .agents/skills/qa/qa-record.sh:74: failed extraction reports the case, preserves sources, appends nothing and contributes to exit73. Case extraction and rewriting now check their status too, including nonempty partial rewrite output on failure. A rewrite failure may leave verified destination copies as harmless retry leftovers, with no line appended.

Rebase confirmed: git range-diff 6945669~8..6945669 5d6d357..770ae4f marks all8 patches equal. T-61's Coordinator artifact.promote permission remains at hub/src/roles/default-roles.ts:69 beside T-62's qa skills and clauses. dev5d6d357 is an ancestor; exact head and clean worktree verified.

Thirteen read-only /bin/sh probes pass: success and empty evidence, mkdir/copy/cmp/missing/conflict/append failures, and selection/case/evidence/rewrite faults including partial output. No actual files written. Diff check and TypeScript noEmit pass. No suite run as requested; Coordinator reports500hub+94Neovim on770ae4f and15targeted skills-qa tests on this head.

Separate axes, range comparison and runnable evidence: A-123, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-123-t-62-final-resolution-review-rev-6-62-4-at-7f4501b.md.

### coord · 2026-10-09T16:27:17.148Z

Merged db7b7d75d59aa0631ae059c2ccabc369656fc269 onto dev.

### coord · 2026-10-09T16:28:20.206Z

Merged by the Coordinator through `cland merge T-62`: squash db7b7d7 on dev. Gate: review rev-6-62-4 clear on 7f4501b, covering the rebase onto 5d6d357 and the fix for rev-6-62-3. Earlier rounds were rev-6-62-1 (six mediums) and rev-6-62-2 (two mediums, two lows), each fixed. Live criteria, on this repository: qa-62 (Codex gpt-6-astra) runs qa-2026-10-09-62-1 on 8506808 and qa-2026-10-09-62-2 on fd8d581, both clear, with a deliberate FAIL case (A-101, A-107). In scratch projects: impl-62's Codex QA run and rescue run. Suite on 770ae4f, the rebase of 6945669: 500 hub + 94 Neovim passed. The fix after it touched only qa-record.sh and its test (15 skills-qa tests pass). impl-62 and qa-62 stopped. This project's roles.toml edits for the QA workflow wait for the human's answer (ask a8e6dc43).
