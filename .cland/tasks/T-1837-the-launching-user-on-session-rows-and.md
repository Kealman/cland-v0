---
id: T-1837
kind: task
title: The launching user on session rows and Agents start lines
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1821
  - T-1822
topic: topic-1516
branch: t/T-1837-the-launching-user-on-session-rows-and
created: 2026-11-12T10:07:23.052Z
updated: 2026-11-15T06:36:42.698Z
closed: 2026-11-15T06:36:42.698Z
---

## Summary

In users mode the hub records which user launched a session, on its process row and its `session-launched` record. The Agents topic's start line and both workbenches' session rows name that user. Approval rows already name the answering user (T-1562).

## What to build

- **Recording.** A human launch carries the acting user, as other human actions do: an authenticated web user, or the CLI's first user or `--as` user where the launch takes it. The process row and the `session-launched` journal record gain an optional user id, kept across a hub restart.
- **Where it shows.** The process view and session row project the user's display name. The Agents start line reads "<session> started (<harness>) by <display name>" in users mode. The web's session row and Neovim's selected meta line name the user.
- **What stays unchanged.** A launch by the Coordinator or another agent records no user. Single mode is unchanged everywhere. Rows recorded before this change read without a user.

The site's sessions page gains one sentence on the launching user in users mode.

## Acceptance criteria

- [x] C1. In users mode a session launched by a second user from the web, and one launched from the CLI, record that user on the process row and the `session-launched` record (test).
  - done: impl-1837 · 2026-11-15T04:47:53.117Z
  - verified: rev-36 [reviewer] · run rev-36-1837-final-1 · 2026-11-15T05:17:47.063Z · commit f3e1899ec9b884661267fc067dfccb7a6beb2aa2
- [x] C2. The Agents start line names the launching user in users mode and is unchanged in single mode (test).
  - done: impl-1837 · 2026-11-15T04:33:26.208Z
  - verified: rev-36 [reviewer] · run rev-36-1837-final-1 · 2026-11-15T05:17:47.063Z · commit f3e1899ec9b884661267fc067dfccb7a6beb2aa2
- [x] C3. The web's session row and Neovim's selected meta line name the launching user in users mode, and nothing in single mode (test).
  - done: impl-1837 · 2026-11-15T04:47:53.358Z
  - verified: rev-36 [reviewer] · run rev-36-1837-final-1 · 2026-11-15T05:17:47.063Z · commit f3e1899ec9b884661267fc067dfccb7a6beb2aa2
- [x] C4. A session launched by an agent records no user, and process rows recorded before the change read without one after a hub restart (test).
  - done: impl-1837 · 2026-11-15T04:47:53.706Z
  - verified: rev-36 [reviewer] · run rev-36-1837-final-1 · 2026-11-15T05:17:47.063Z · commit f3e1899ec9b884661267fc067dfccb7a6beb2aa2
- [x] C5. The site's sessions page names the launching user in users mode, and its commands pass the docs command check (test).
  - done: impl-1837 · 2026-11-15T04:33:27.013Z
  - verified: rev-36 [reviewer] · run rev-36-1837-final-1 · 2026-11-15T05:17:47.063Z · commit f3e1899ec9b884661267fc067dfccb7a6beb2aa2

## Blocked by

- E-1536 (closed)
- T-1821 (Neovim's session row)
- T-1822 (the web's session row)

## Notes

- Hot files: `hub/src/adapters/sessions.ts` (the launch record), `hub/src/hub/agents-topic.ts`, `web/src/sessions/SessionRow.tsx`, `nvim/lua/cland/panels.lua`, `site/src/content/docs/docs/sessions.mdx`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`, `nvim/test/fixtures/protocol-frames.json`.
- Tests: new `hub/test/launch-user.test.ts` (T2, `projectHub` in users mode with two users); `web/test/sessions.test.ts` and `nvim/test/sessions.test.ts` cases.
- Serves the Contents' users stage (the user on session-launch rows; the approval rows are T-1562's); no checkbox names it.

## Comments

### impl-1837 · 2026-11-15T04:24:06.436Z

Rule 20 sweep: searched HarnessProcessView, SessionRow, session-launched, session.process, session_meta_parts and session-start across hub/src, shared, web/src, nvim/lua, all test tiers, shipped skills, QA briefs, docs and site (162 files). Production migrations: dispatch -> answerSession -> LaunchRequest (including waiting persistence and worktree spread), HarnessProcess/ProcessTable SQLite migration/read/write, Sessions.view/listRows, agents-topic live/replay, protocol/shared wire types, web SessionRow, nvim panels metadata. CLI sessionLine/list and agents_log consume optional additive facts and tolerate absence; startup/visibility/workspace snapshots reuse process views; journal reader keeps arbitrary fields; no positional contract removed. Tests: launch-user, sessions web/nvim, protocol-frames and wire compatibility; older QA and fixtures keep absent fields as compatibility cases. Existing launch/recovery/pool/role/host tests remain unaffected because attribution is optional and resolved only for human users-mode dispatch. No role clause or permissions change.

### rev-36 · 2026-11-15T04:40:39.102Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1837-source-1
commit: e4de7c8a18170ce4c146a304c89169b5caad366a
scope: full
findings: [{"severity":"medium","text":"Fresh resume and cross-host relaunch reconstruct #launchNew requests without the retained userId (also around line2270). They preserve the stable cland sessionId, but put resets omitted attribution to null. Carry the current durable user through both paths and cover row/journal/projection preservation; normal resume already preserves it. Confirmed by claimant 23f4be12.","file":"hub/src/adapters/sessions.ts","line":2301},{"severity":"medium","text":"Over-wide metadata wraps only when host is present. Local process views omit host, so the newly appended launching name can be clipped behind normal model/account facts at the ordinary 34–50-column panel. The width80 short-fact test misses it. Preserve name visibility with rendered normal/narrow local controls; no approved clipping exception (claimant1df9006e).","file":"nvim/lua/cland/panels.lua","line":295},{"severity":"medium","text":"The additional Store closes in standalone t.after after the earlier shared cleanup hook has disposed the fixture root. Register an ordered shared resource owner that joins dependent peers/work before Store close and before root disposal; cover early failure. inProcessSpoke already owns its shared close, so its extra standalone hook is redundant. Confirmed by claimant8c3c983a.","file":"hub/test/launch-user.test.ts","line":54}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear: Standards 1 medium / Spec 2 medium; complete consolidated findings and checked trusted-admission/transaction/legacy/wire paths in A-19508. A-19501 transcript and A-19496–A-19499 saved inventories read with candidate-only/later-locked-slot limits; first unlocked Neovim baseline remains incomplete. No criterion verified and no current-head runtime pass claimed. Consolidate fixes, retain current authority/legacy/rendered tests, refresh frame data as needed and request fresh committed source review before verify. Pin released for repair; no Reviewer execution or delegation. Affected QA remains after-stage on dev.

Criteria: C1 failed (Retained-session fresh/cross-host launch publication can erase the recorded human user.), C3 failed (Normal-width local Neovim metadata can clip the newly appended launching name.), C4 failed (New legacy/attribution fixture has an extra Store whose teardown follows root disposal.).

### impl-1837 · 2026-11-15T04:46:12.974Z

Source-review fixes: retained fresh and cross-host launch requests now carry the existing durable userId; host-relaunch T3 cases add users-mode row/view/emitted-journal assertions. launch-user uses withFixtureStore to read a snapshot and close its metadata Store before the web peer is created; fixture-store held/rejected setup controls cover this shared owner. Neovim attributed local metadata wraps at normal/narrow widths, with 34/50/80 rendered controls and retained legacy assertions. Raw serial rerun evidence follows; the overlapping cross-host green is excluded by Coordinator instruction. No post-review dev merge.

### rev-36 · 2026-11-15T04:49:50.224Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1837-source-2
commit: f3e1899ec9b884661267fc067dfccb7a6beb2aa2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards 0 / Spec 0. A-19529 records all three corrections: retained durable userId through fresh/cross-host requests, actual wrapped local metadata at34/50/80 widths, and withFixtureStore snapshot setup closed before dependent web peer creation with shared held/rejected cleanup controls. Prior authority/legacy/agent/regular-resume/web/docs assertions retained; global catalog preserves old entries. A-19528/raw R2 evidence read with evolving-candidate, excluded-overlap and R1 missing-baseline limits; actual saved inventory pairs equal. C1–C5 remain unverified until fresh same-head mode-free evidence, including changed host-relaunch and rendered UI cases. Full remaining T3/T4 and affected after-stage QA separate. No Reviewer execution or delegation.

### rev-36 · 2026-11-15T05:17:47.063Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1837-final-1
commit: f3e1899ec9b884661267fc067dfccb7a6beb2aa2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C5 verified. A-19537/d09b914c passes 6330/6330, zero fail/cancel/skip/todo. Independently checked named launch-user/Agents/legacy/fresh-resume, changed cross-host retention, rendered Neovim normal/narrow+Web, cleanup and docs base/load receipts. T0/all T1/all fallback T2/changed T3(4 cases once)/mapped T4(1 base guard only)/Web exit0. A-19539 records detailed criterion/provenance/allowance/capture limits; A-19538 reconciles all978 manifest paths (698 positive file receipts,264 T3+16 T4 deferred, no missing lower/Web). New Web case2.341s; no Web repetition claim; unchanged C-216 allowances cover existing relaunch cases. Linux x64 Node24.21/Nvim0.12.5, pinned Headless Shell1248/CfT156.0.8078.4, no cache/skips, report-only notices retained. R1 missing unlocked baseline and excluded R2 overlap remain explicit. Full T3/T4 and affected after-stage QA separate. No Reviewer execution; hub/Coordinator owns ready/landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-15T06:36:42.698Z

Merged 01c97ad5bfbf4801a88cd185081fa89ad7cf77f9 onto dev.
