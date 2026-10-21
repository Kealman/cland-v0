---
id: T-1011
kind: task
title: QA tests the web workbench in the real browser through computer use
state: open
status: qa
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by: []
topic: topic-765
branch: t/T-1011-qa-tests-the-web-workbench-in-the-real
created: 2026-10-20T17:02:15.802Z
updated: 2026-10-21T10:12:38.933Z
---

## Summary

QA for the web workbench also tests in the human's real local browser through computer use (Codex gpt-6-astra), not only through playwright-core and headless Chromium. This is the human's directive of 2026-10-20. This ticket gives QA the surface, the brief template and the role wording, and proves the path works on this Mac or names the exact blocker.

## What to build

- A QA surface `real-browser` in `.agents/skills/qa/qa-record.sh`, `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill. A case on it is recorded with `note`, with screenshots under `.cland/qa/<item>/<run>/`.
- The `qa` skill's web section says:
  - how a QA session opens the `cland web` link in the human's default browser through computer use;
  - what it may touch: only the cland page and the browser's permission prompts for it;
  - that it closes the tab afterwards.
- The QA role clause and roles.toml launch defaults name the computer-use capable model for web briefs, if the clause needs it.
- A dry run from a launched QA session:
  - it opens a local page in the real browser through computer use, takes a screenshot and records it as a `real-browser` note;
  - or it names the exact blocker (harness refusal, macOS Screen Recording or Accessibility permission, browser profile) in the item topic, so the Coordinator can take it to the human.

## Acceptance criteria

- [x] C1. `qa-record.sh note … real-browser …` records a line, and the surface check accepts `real-browser` (test).
  - done: impl-1011 · 2026-10-20T18:41:27.064Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.767Z · commit d1acaacc51510bf13df49561434913fb27838712
- [x] C2. `BRIEF.md`, `STAGE-BRIEF.md` and the `qa` skill describe `real-browser` cases for web briefs: open through computer use, scope limited to the cland page and its permission prompts, close the tab, screenshot evidence.
  - done: impl-1011 · 2026-10-20T18:41:27.583Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-source-1 · 2026-10-20T18:43:13.655Z · commit d1acaacc51510bf13df49561434913fb27838712
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.768Z · commit d1acaacc51510bf13df49561434913fb27838712
  - verified: rev-26 [reviewer] · run rev-20261021-1011-source-delta-1 · 2026-10-21T10:11:38.106Z · commit be011de3a4145b3399ab547317581e90880bdb55
- [x] C3. A launched QA session's dry run either records a `real-browser` screenshot of a local page opened in the human's browser through computer use, or posts the exact blocker in the item topic (local evidence).
  - done: impl-1011 · 2026-10-21T06:38:55.414Z
  - verified: qa-676 [qa] · run qa-2026-10-21-1 · 2026-10-21T06:39:33.694Z · commit d1acaacc51510bf13df49561434913fb27838712
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T09:52:31.159Z · commit d1acaacc51510bf13df49561434913fb27838712
  - verified: qa-676 [qa] · run qa-2026-10-21-4 · 2026-10-21T10:12:38.933Z · commit be011de3a4145b3399ab547317581e90880bdb55
- [x] C4. `cland qa lint` accepts a brief with a `real-browser` case (test).
  - done: impl-1011 · 2026-10-20T18:41:28.218Z
  - verified: rev-26 [reviewer] · run rev-20261020-1011-evidence-1 · 2026-10-20T18:52:07.768Z · commit d1acaacc51510bf13df49561434913fb27838712

## Comments

### coord · 2026-10-20T17:06:48.283Z

Brief addition (Coordinator, 2026-10-20): the real-browser QA session runs with the human's normal HOME and login keychain (not the sealed fixture environment) and a dedicated cland browser profile. It never presses Reset or changes keychain, profile or system settings; any system dialog it cannot dismiss with Cancel is a blocker to report. Reason: impl-990's sealed Chrome launch raised a 'Keychain Not Found' modal with Reset To Defaults on the human's desktop (17:05Z, A-7738).

### impl-1011 · 2026-10-20T18:39:36.316Z

Implemented real-browser acceptance in the recorder and brief linter; C1 recorder test uses only a disposable fixture and a synthetic PNG, no browser/GUI. C4 exercises the shipped cland qa lint CLI. Templates, QA web procedure, default/project role clauses and matching help/docs are updated. C3 will be handed to the Coordinator for a launched QA dry run after source review.

### rev-26 · 2026-10-20T18:43:13.655Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1011-source-1
commit: d1acaacc51510bf13df49561434913fb27838712
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings in requested C1/C2/C4 source scope. Recorder note and brief-lint surface allowlists accept real-browser; no browser is launched by the recorder. New T2 recorder test uses disposable sealed root, synthetic PNG and durable JSONL/evidence-byte assertions; CLI test retains negative control and accepts the new method row. Matching templates, QA procedure, help/docs and default/project role clauses describe computer use, normal HOME/keychain with dedicated profile, page/permission-only scope, screenshots, tab cleanup and exact blocker reporting. Model remains Codex gpt-6-astra. C2 verified; audit A-7945.

A-7937 contains reported local macOS targeted/check summaries, not raw stdout/exit/timing or suite evidence. Original retained receipts requested without transcription reruns; C1/C4 runtime marks and exact-head final execution remain outstanding. No Linux/load/browser pass claimed.

C3 remains unchecked and outside this source scope: Coordinator c937e720 asks the human for screen timing, holds this head after source review, then supplies committed dry-run brief and launches QA (or defers C3 to first E-415 QA). No GUI launched. Coordinator abc0f34b filed unchanged legacy recorder isolation as T-1021; the new test does not use that helper. No Reviewer edits/tests/delegation.

Criteria: C2 verified.

### rev-26 · 2026-10-20T18:52:07.768Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1011-evidence-1
commit: d1acaacc51510bf13df49561434913fb27838712
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Scoped C1/C2/C4 execution settlement clear; no Standards/Spec findings. A-7954 at exact reviewed unchanged d1acaacc independently contains 2,111 ordinary passes plus five passing load records, no fail/cancel/skip. Synthetic-PNG recorder case passes ordinary 0.033514 s and 5/5 repetitions (max 0.050232 s), within T2. CLI lint acceptance passes 0.291445 s; lint 18/18, clauses 27/27 including both reserve checks, catalogue 5/5, CLI lint 2/2 and recorder file 13/13. C1/C4 verified; unchanged source C2 reverified. Audit A-7956.

C3 remains unchecked/unverified: this suite and synthetic screenshot do not establish a real-browser QA dry run or exact blocker. Coordinator owns human screen timing, committed brief and QA launch under c937e720; the item is not complete. No QA verdict or whole-item final clearance claimed.

Linux x64 c-8 lon1 droplet, two workers, T1 exit 0 (command 51 s/package 46.48 s) and fallback all T2 in both packages exit 0 (command 280 s/package 276.60 s). Actual execution, not cache/projection; lifetime 409 s/$0.0284. Host check reference 93244c17 not repeated remotely. Lint/budgets/ratchet report-only; T3/T4 not executed. A-7946 separately preserves original pre-commit local receipts on 3f74bc05 plus dirty changes/no recorded tree hash, correcting A-7937 attribution; not reused as exact-head execution. No Reviewer tests, edits or GUI launch.

Criteria: C1 verified, C2 verified, C4 verified.

### qa-676 · 2026-10-21T06:39:33.646Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-2026-10-21-1
commit: d1acaacc51510bf13df49561434913fb27838712
findings: [{"severity":"medium","text":"WEB-DRY-001 BLOCKED: cua.getBrowser({}) returned 'No browser is available'; current-screen access via cua.getApp(com.mitchellh.ghostty) returned 'Computer Use is not allowed to use the app ... for safety reasons.' No screenshot or navigation. C3's explicit exact-blocker alternative is satisfied; no product defect asserted."}]
finding_counts: {"high":0,"medium":1,"low":0}

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 | hub-api | PASS | Clean item worktree; HEAD and branch tip both d1acaacc51510bf13df49561434913fb27838712; M1.txt |
| WEB-DRY-001 | real-browser | BLOCKED | No browser available through computer use; screenshot app access refused; WEB-DRY-001-blocker.txt |
| M2 | hub-api | PASS | Exactly one real-browser recorder line for this item/run, BLOCKED with the exact blocker capture path; M2.txt. No screenshot was obtainable. |

Medium finding — WEB-DRY-001, environment/tool access blocker. `await cua.getState()` returned `browsers: []` (Arc was listed as a native app, not running; no browser profile was exposed). `await cua.getBrowser({})` returned exactly:

> No browser is available

To obtain screen evidence, `await cua.getApp("com.mitchellh.ghostty")` returned exactly:

> Computer Use is not allowed to use the app 'com.mitchellh.ghostty' for safety reasons.

Stopped after the refusal; no attempt through another app, shell, session or access path. This establishes a computer-use availability/refusal blocker, not that the browser is uninstalled or that a cland QA profile is absent. No screenshot was obtained and no successful browser navigation is claimed.

Attempt verdict: not clear; WEB-DRY-001 BLOCKED. Run qa-2026-10-21-1, tested task SHA d1acaacc51510bf13df49561434913fb27838712, local macOS real-browser computer-use preflight. Brief read from dev commit b96f5fc7:qa/briefs/T-1011.md, separate from the unchanged reviewed task head. No tests or full suite were rerun; no timing/coverage pass is claimed.

Criterion distinction: C3 explicitly accepts either a real-browser screenshot or an exact blocker posted in the item topic. The exact blocker was posted to lead T-1011 in topic-765, and the BLOCKED real-browser line was appended to project runs.jsonl. Therefore C3's evidence alternative is satisfied and is verified separately with this run; it is not failed. C1/C2/C4 remain untouched. This does not convert WEB-DRY-001 into PASS or the QA attempt into clear.

No browser or tab was opened; no tab cleanup was needed. No profile, browser setting, system permission or keychain was created or changed. Computer-use calls used the normal host context; only recorder shell commands used a filtered scratch environment. A local static page was prepared after the availability preflight for the named run but never opened; its disposable directory /tmp/qa-t1011-rel8sjmc was removed non-force. Final worktree status remained empty and HEAD unchanged. Recorder text receipts are retained; screenshots are unavailable due to the tool limitations above.

Scope: WEB-DRY-001, M1, M2 only. Further browser access awaits an authorized capability change; no retry or workaround was attempted.

Evidence A-8162: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8162-t-1011-c3-real-browser-dry-run-exact-computer-use-blocker-no-screenshot/report.md

### qa-676 · 2026-10-21T09:49:04.135Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-2026-10-21-2
commit: d1acaacc51510bf13df49561434913fb27838712
findings: [{"severity":"medium","text":"WEB-DRY-001 blocked by Browser use URL policy on file:// local page. Chrome cland QA profile and before screenshot confirmed; no page navigation/screenshot succeeded. Stopped without workaround."}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 | hub-api | PASS | Clean T-1011 worktree; HEAD and branch tip d1acaacc51510bf13df49561434913fb27838712. M1.txt. |
| WEB-DRY-001 | real-browser | BLOCKED | Chrome cland QA profile confirmed by native AX; before screenshot saved; file:// navigation rejected by Browser use URL policy. WEB-DRY-001-blocker.txt contains exact refusal; WEB-DRY-001-before.png is only a before screenshot. |
| M2 | hub-api | PASS | Exactly one real-browser receipt appended to project runs.jsonl; both referenced evidence files exist. No page screenshot claimed. |

Medium blocker — WEB-DRY-001: `cua.createBrowserTab("chrome", "file:///tmp/qa-t1011-wh95bdmb/index.html", {sessionName:"🧪 T-1011 QA"})` returned:
> Browser Use rejected this action due to browser security policy. Reason: The browser URL policy blocks this action. Browser use cannot visit the requested page because its URL is blocked by the Browser use URL policy. The agent must not attempt to achieve the same outcome via workaround, indirect execution, raw CDP or browser commands, alternate browser surfaces, or policy circumvention. Proceed only with a materially safer alternative that does not require this blocked browser action; if none exists, stop and request user input.

This is a not-clear browser attempt, run qa-2026-10-21-2, not a product failure or a browser PASS. No local page navigation or page screenshot succeeded. The tool returned no tab handle. No alternate URL, browser surface, native navigation or profile was attempted after refusal. QA changed no browser profile, default-browser setting, permissions or keychain. The pre-existing default-browser infobar was untouched.

Chrome was available this time. Inventory labelled the extension browser “Your Chrome”; native AX independently confirmed “New Tab - Google Chrome - cland QA” and the “cland QA” profile button before navigation. The human's authorized profile was used; no default profile fallback.

C3 accepts an exact posted blocker as an alternative, so C3 is not failed by this attempt. Per the Coordinator's newer 0fbe99ab-020b-4165-bffe-d771e4f8d911 instruction, any separate evidence-only verdict will follow the E-795 epic verdict and cite both attempts. This report makes no new criterion marks.

Scratch /tmp/qa-t1011-wh95bdmb removed; task worktree remains unchanged at the full tested SHA. Browser interactions used computer use only; no full suite or headless browser test ran. The before screenshot is 60430 bytes; no after screenshot was taken after the stop-on-refusal boundary.

Durable evidence A-8230: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8230-t-1011-chrome-cland-qa-dry-run-file-url-policy-blocker-and-before-screenshot/report.md

### qa-676 · 2026-10-21T09:52:31.159Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-3
commit: d1acaacc51510bf13df49561434913fb27838712
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 | hub-api | PASS | Clean T-1011 worktree; HEAD and branch tip equal d1acaacc51510bf13df49561434913fb27838712. |
| WEB-DRY-001 | real-browser | PASS | Native Chrome AX confirms cland QA profile. New tab 1158676365 opened authorized http://127.0.0.1:56935/; screenshot shows cland workbench, Inbox and seven areas. Tab closed; original New Tab 1158676307 remains. |
| M2 | hub-api | PASS | One real-browser recorder row with before/page/after screenshot paths; all evidence files exist; final item worktree clean. |

Findings: none in this dry-run scope.

Run qa-2026-10-21-3, tested T-1011 implementation SHA d1acaacc51510bf13df49561434913fb27838712. Brief read from amended dev commit cbc6c623; Coordinator request feb88f15-b747-42a1-963f-865f74c820d1 documents the human-authorized origin allowlist change. This run uses the amendment's HTTP page and expected cland shell, not the earlier file:// heading/run-id expectation. The served live bundle is not claimed to be built from d1acaacc: d1acaacc is the recorder/surface implementation under test. No full web workbench functional verdict is made.

Actual local macOS computer-use execution through Chrome extension browser 1. Chrome's native AX window/title and profile button say cland QA; the extension metadata's generic “Your Chrome” label was not used as profile proof. Before screenshot retained. createBrowserTab opened one owned tab; its AX title is cland and URL is http://127.0.0.1:56935/. WEB-DRY-001.png (18762 bytes) is the screenshot captured from that exact tab. The page shows Offline because this check opened the public bundle without an authenticated session; authentication and data loading are outside the amended smoke scope.

A native-app capture taken during the run still showed the original New Tab window; it is retained as WEB-DRY-001-original-window.png and is not the page evidence. The correct owned-tab screenshot is WEB-DRY-001.png. After qaDryTab3.close(), getState confirms only the original New Tab 1158676307 remains in browser 1; before/after native screenshots are identical. No unrelated tab/window was closed. No prompt or refusal occurred in this run, and QA changed no permissions, security settings, profile, keychain or default-browser setting.

Criteria verified: C3 only, by a successful real-browser screenshot/recorder dry run. C1/C2/C4 remain the existing review marks. Earlier qa-2026-10-21-1 and qa-2026-10-21-2 remain historical not-clear attempts (browser availability and file URL policy respectively); this run does not relabel them. No separate evidence-only verdict is needed to claim a browser success now. No scratch file page was created for the amended HTTP case; item worktree unchanged.

Durable artifact A-8233: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8233-t-1011-real-browser-dry-run-pass-chrome-cland-qa-loopback-page-and-tab-cleanup/report.md

Criteria: C3 verified.

### impl-1011 · 2026-10-21T10:10:37.260Z

Per Coordinator 1fda87c1, merged origin/dev 4f0623b7 once and pushed be011de3. Removed the Implementer GUI/real-browser line from default/project role clauses; QA/browser instructions and reserve assertions unchanged. Local macOS targeted roles-clauses.test.ts passed 27/27 before commit (ff7c335d + two line deletions; no dirty-tree hash recorded). Fresh source review requested before mode-free verification. Prior C3 browser PASS qa-2026-10-21-3 retained as historical evidence; current criterion marks are stale at the changed head, reported to the Coordinator for any required QA settlement.

### rev-26 · 2026-10-21T10:11:38.106Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1011-source-delta-1
commit: be011de3a4145b3399ab547317581e90880bdb55
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after Coordinator-authorized single dev merge ff7c335d (dev4f0623b7) and exactly two Implementer clause line deletions. Default/project copies agree; QA role, real-browser procedure, recorder/lint/tests and brief templates retained. Only incoming qa-skill change versus d1acaacc is Web verification cadence wording; Web briefs path unchanged. C2 verified by source; C1/C4 await new-head mode-free receipt. C3 remains QA-owned: Coordinator25956e9b assigned qa-676 new-head evidence settlement reusing A-8233, no GUI rerun. A-8253 original 27/27 clause receipt is precommit ff7c335d+two unstaged deletions, no dirty-tree hash; qualified targeted evidence, not exact-head suite. Full audit: A-8259 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8259-t-1011-delta-source-clear-at-be011de3-clause-reserve-retained.md. No Reviewer tests/edits/browser execution.

Criteria: C2 verified.

### qa-676 · 2026-10-21T10:12:38.933Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-4
commit: be011de3a4145b3399ab547317581e90880bdb55
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Result | Evidence |
| --- | --- | --- |
| E1 | PASS | Clean item HEAD be011de3a4145b3399ab547317581e90880bdb55. Diff from d1acaacc51510bf13df49561434913fb27838712 is empty for .agents/skills/qa/qa-record.sh, hub/src/qa-lint.ts, .agents/skills/qa/BRIEF.md and STAGE-BRIEF.md. |
| E2 | PASS | git diff cbc6c623 be011de3 -- qa/briefs/T-1011.md is empty: identical to the amended brief actually used in A-8233. |
| E3 | PASS | SKILL.md has exactly one changed line, line 74's cland verify paragraph adding the separate Web phase. The Web briefs real-browser procedure is unchanged. |
| C3 reuse | PASS | A-8233, run qa-2026-10-21-3: actual Chrome cland QA profile, successful loopback page screenshot, owned tab closed, original tab retained. |

Findings: none under the clarified evidence scope.

Run qa-2026-10-21-4, evidence audit at be011de3a4145b3399ab547317581e90880bdb55. Coordinator decision 9309a7b3-e0c9-4171-82c9-4ce08947bfc8 authorizes these exact three comparisons and reuse. The initial broad condition was not met; A-8260 preserves that stopped audit. The subsequent narrowed condition is met; no exception was inferred before the decision.

C3 only is verified. This is evidence reuse, not a GUI rerun or a new browser success. The actual browser execution was local macOS computer use in run qa-2026-10-21-3 against recorder implementation d1acaacc51510bf13df49561434913fb27838712 and amended brief cbc6c623. A-8233 contains the before/page/after screenshots and successful tab cleanup. The served public bundle was not claimed built from that implementation SHA; authentication and data loading were outside the smoke scope. Historical blocked runs 1 and 2 remain not clear; no blocked outcome is relabelled.

Three local read-only comparison receipts were recorded for this run. No browser, test suite or droplet ran; no new timing, coverage or execution-cost claim is made. No permissions or settings changed. Existing item worktree was left at the same clean head.

Reused evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8233-t-1011-real-browser-dry-run-pass-chrome-cland-qa-loopback-page-and-tab-cleanup/report.md.

Evidence audit A-8261: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8261-t-1011-run-4-three-reuse-checks-pass-at-be011de3.md

Criteria: C3 verified.
