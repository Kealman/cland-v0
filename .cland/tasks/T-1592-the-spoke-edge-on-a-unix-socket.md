---
id: T-1592
kind: task
title: The spoke edge on a Unix socket
state: open
status: in progress
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1329
branch: t/T-1592-the-spoke-edge-on-a-unix-socket
created: 2026-11-02T03:33:53.512Z
updated: 2026-11-02T07:42:41.893Z
---

## Summary

The hub listens for spokes on `.cland/run/spoke.sock`, mode 0600, beside its loopback port. It uses the same WebSocket protocol and the same bearer admission, so a spoke can dial `ws+unix:`. Local spokes and `hub.json` are unchanged.

Hot files: `hub/src/hub/server.ts`, `hub/src/hub/daemon.ts`, `hub/test/spoke-unix-edge.test.ts` (new)

## Acceptance criteria

- [x] C1. A started hub binds `.cland/run/spoke.sock` at 0600 (with the short-path fallback), and a spoke connecting through `ws+unix:` with the project secret gets a welcome like one on the loopback port (test).
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-2 · 2026-11-02T06:58:41.213Z · commit 48d290e775a1e0ff5ccc36d01cec35c3f6e54020
  - done: impl-1592 · 2026-11-02T07:16:49.954Z
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-4 · 2026-11-02T07:42:41.134Z · commit 0220773c00c4d8ccd6864b26b51fecad1d41b313
- [x] C2. A connection there without the bearer secret, or with a wrong one, is refused and logged as on the loopback edge (test).
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-2 · 2026-11-02T06:58:41.213Z · commit 48d290e775a1e0ff5ccc36d01cec35c3f6e54020
  - done: impl-1592 · 2026-11-02T07:16:52.021Z
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-4 · 2026-11-02T07:42:41.268Z · commit 0220773c00c4d8ccd6864b26b51fecad1d41b313
- [x] C3. A stale socket file left by a dead hub is replaced at start, and a hub stop removes only the file it bound (test).
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-2 · 2026-11-02T06:58:41.213Z · commit 48d290e775a1e0ff5ccc36d01cec35c3f6e54020
  - done: impl-1592 · 2026-11-02T07:16:54.444Z
  - verified: rev-38 [reviewer] · run rev-38-1592-evidence-4 · 2026-11-02T07:42:41.399Z · commit 0220773c00c4d8ccd6864b26b51fecad1d41b313
- [ ] C4. A client hello is refused on the Unix spoke edge exactly as on the spokes' WebSocket, and the spoke-reconnect and hub-socket test files pass with no test edited.
  - failed: rev-38 [reviewer] · 2026-11-02T07:42:41.893Z · note Daemon preservation remains 17/18 failed under acknowledged T-1627; pending explicit criterion exception or shared-fix/native green receipt.

## Notes

Shared files: `hub/src/hub/daemon.ts` (edge startup; 13 and 26 later)

## Comments

### impl-1592 · 2026-11-02T05:44:14.469Z

Consumer inventory (rule 20): searched createWebSocketEdge/WebSocketEdge/createSocketEdge across hub, shared, nvim, web, qa, docs and shipped skills. WebSocket production callers: server.createHub and daemon. Socket edge callers: daemon plus visibility-component, web-authority, session-brief[-component], session-credential-io, task-card-component, request-guard, plan-stage-fixture, item-lead, tracker-rank, prompt-races, artifact-lifecycle, name-reservation, artifact-host, roles-snapshot-cli, hub-status-component. Existing APIs/wire shape/discovery remain unchanged; additive Unix path option reuses WebSocket dispatch edge identity and bearer check. Shared bind lifecycle will retain socket edge API. project.layout gains additive spokeSocket; old layout consumers remain unaffected. Prior-shape coverage: existing hub/socket and spoke reconnect tests remain unedited. No per-host admission added (T-1596).

### impl-1592 · 2026-11-02T05:53:06.537Z

Implementation complete; final checks waiting on load ≤10. macOS arm64 / Node v24.21.0, local executor, no browser: npm run typecheck passed. Targeted receipts: spoke-unix-edge.test.ts 8/8 (short bind + long-root fallback bind, missing/wrong bearer vs loopback, stale socket replacement/removal, replacement preservation, client refusal vs loopback, UTF-8 path limits); unchanged daemon.test.ts T3 18/18, resilience.test.ts T3 3/3, edges-component.test.ts T2 1/1. No full suite or Linux run yet. Initial C1 red was ENOENT on spoke.sock before edge implementation. Lint caught and fixed missing tier entry and guide heading; final lint pending. Consumer search additionally covered colocated hub/src tests and QA briefs; local discovery/wire shape unchanged, no fixture migration required. Shared binder captures inode before publication and uses distinct short staging names for the two Unix listeners.

### impl-1592 · 2026-11-02T05:58:20.592Z

C4 preservation filename mapping: the draft's spoke-reconnect file refers to current hub/test/resilience.test.ts (3 native tests, including a spoke surviving hub outage/reconnecting); hub-socket refers to current hub/test/daemon.test.ts (18 native tests including wrong-secret refusal, long socket path, both-edge protocol, and owned socket cleanup). Neither draft filename exists at reviewed head cb4454659b8ff019913d8c2ceab712cc138860ec. Both current files passed unchanged locally on macOS arm64/Node 24.21.0. Supplement: unchanged hub/test/edges-component.test.ts 1/1. These executable owners are also named in A-15601 and the committed per-test guide.

### rev-37 · 2026-11-02T05:59:29.312Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1592-source-1
commit: cb4454659b8ff019913d8c2ceab712cc138860ec
scope: full
findings: [{"severity":"medium","text":"Spoke path selection budgets bytes only, but raw ws+unix URL cannot dial valid short paths with spaces/Unicode/colon/#: installed ws percent-encodes pathname or splits/truncates it and never decodes socketPath. Select URL-safe endpoint/fallback including TMPDIR, preserving human layout, and test real bind/welcome on short special roots.","file":"hub/src/project.ts","line":110}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: one Spec medium at project.ts110/server.ts265, raw ws+unix path incompatible with short space/Unicode/colon/# roots and potentially TMPDIR. Confirmed installed ws implementation plus pure Node URL parser output; no native behavioral run claimed. Lead confirmed144a0661. Standards no separate findings; shared inode-owned bind lifecycle/bearer/dispatcher/rollback source otherwise sound. Preservation aliases clarified: unedited resilience(reconnect), daemon(socket/auth/cleanup), edges-component(JSON edge). Runtime criteria remain unverified. No Reviewer hub/browser/test run. Fixed head requires fresh source review before mode-free verify.

Criteria: C1 failed (Valid short special-character project paths bind one filename but ws+unix resolves a different socketPath; spokes cannot connect.).

### impl-1592 · 2026-11-02T06:05:48.160Z

Corrected C1 review finding in pushed head 34431ebf2fe6d15b2ea06dd00a359763c85ed4c2. Four real scratch bind/welcome regressions first failed for spaces (ENOENT space%20here), Unicode (ENOENT %C3%A9), colon (truncated native path), and # (URL fragment SyntaxError). Both unsafe root and unsafe TMPDIR now select a URL-compatible hashed /tmp endpoint; human socket default remains unchanged. Current-tree macOS arm64 local receipts: edge tests 12/12, unchanged project-layout 1/1, typecheck exit 0, test:lint exit 0 with zero refusals and advisory findings unchanged. Correction evidence A-15617. Fresh review requested; no dev merge after first review and no verification submitted yet.

### rev-38 · 2026-11-02T06:06:55.050Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1592-source-1
commit: 34431ebf2fe6d15b2ea06dd00a359763c85ed4c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source review clear; Standards 0 findings, Spec 0 findings. Reviewed full two-commit task against c14994a24 and correction against cb4454659. Prior medium resolved: root/TMPDIR spoke candidates now preserve literal ws URL pathname, reject colon/search/fragment, and fall back to short /tmp hash; human JSON-lines layout unchanged. Four actual bind/welcome regressions exercise space/Unicode/colon/# roots plus unsafe TMPDIR and mode 0600. Shared binder publication/owned cleanup, daemon rollback, bearer/refusal parity and unchanged preservation owners inspected. C4 aliases explicitly map to unedited resilience.test.ts and daemon.test.ts; edges-component supplemental. Docs/ADR/skill provenance updated. No reviewer test/browser run. A-15617 local targeted receipts are reported macOS arm64 Node24 evidence; A-15601 preservation receipts are prior-head only. C1–C4 remain runtime-unverified pending same-head mode-free verification and current-head required native preservation receipts. Review: A-15623 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15623-t-1592-refreshed-source-review-at-34431ebf.md).

### rev-38 · 2026-11-02T06:30:13.514Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1592-evidence-1
commit: 34431ebf2fe6d15b2ea06dd00a359763c85ed4c2
scope: evidence
findings: [{"severity":"medium","text":"Listener log consumer still expects two listening events; queued run observes three after the new Unix spoke edge. Migrate this assertion while preserving the gateway no-extra-listener intent and record the consumer in the rule-20 inventory.","file":"hub/test/gateway.test.ts","line":274}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear. Actual A-15653 failure: AssertionError 'only the existing spoke and Unix socket listeners are bound', 3 !== 2, hub/test/gateway.test.ts:274. This is the obsolete listener-count consumer of the newly added edge, not a load/timing classification. Run f9ba51d5-b726-4bd7-85e0-196b5f771b36 at exact source-clear head: T0/T1 exit 0, T2 exit 1, Web unexecuted; remaining T3 deferred. Uncached Linux x64 droplet / Node24.21 / Neovim0.12.5; browser provenance null, no browser run. Budgets/lint report-only. Twelve named spoke-unix-edge cases pass, so no direct C1–C4 defect is asserted; all criteria remain unverified because final queued evidence failed. A-15631 reports current-head unedited macOS daemon18/resilience3 targeted passes. Correct missed consumer, request fresh source review before another verification. Detail A-15654 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15654-t-1592-failed-listener-count-consumer-evidence.md).

### impl-1592 · 2026-11-02T06:31:18.993Z

Consumer migration after A-15653 / rev-38-1592-evidence-1: missed gateway.test.ts:274 listener-log aggregate expected 2 and failed 3 !== 2. Changed it to the exact complete multiset of listener identities: discovered loopback spoke URL, discovered human Unix socket path, and layout(root).spokeSocket WebSocket URL. Extra, duplicate or missing listeners still fail, preserving proof that gateway opens none. Inventory now includes this non-import log consumer; repeated scans cover event/listening/listener aggregate assertions as well as symbol imports. Both Unix edges share bindUnixSocket, which chmods 0600 before publication; C1 real bind tests assert 0600, and README/ADR plus gateway per-test guidance document owner-only permissions. No production change and no dev merge. Fresh source review and verification required.

### rev-38 · 2026-11-02T06:36:06.163Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1592-source-2
commit: 48d290e775a1e0ff5ccc36d01cec35c3f6e54020
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards 0 findings, Spec 0 findings. Entire change since source-clear 34431ebf2 is gateway listening assertion plus its per-test guide. Complete sorted multiset now requires loopback spoke, discovered human Unix socket and Unix spoke identities; extra/duplicate/missing listeners still fail. A-15654 medium resolved, no production change; full task source analysis A-15623 carries forward. Required C4 preservation files unchanged. C1–C4 remain runtime-unverified pending exact-new-head mode-free verification/evidence. Reported local macOS arm64 Node24 gateway20/typecheck/lint exit0 with zero refusals are targeted evidence only. Prior Linux queued A-15653 stays failed, A-15631 preservation is prior-head/same-production. No reviewer tests/browser run. Fresh source correction artifact in this topic.

### impl-1592 · 2026-11-02T06:58:06.637Z

Final exact-head evidence: run 0597cc5d at 48d290e775a1e0ff5ccc36d01cec35c3f6e54020 exits 0, 4711/4711 reported tests; T0/T1/T2/Web complete, T3 deferred to merge batch. A-15686 uncached Linux x64 droplet c-8 lon1 / Node24.21.0 / Neovim0.12.5; Chrome Headless Shell Google Chrome for Testing156.0.8078.4, binary chromium_headless_shell-1248. Lifetime967s, cost$0.0671. Fact scan confirms each of 12 named edge cases passes once in tier and five times in load-gate, and corrected gateway case passes. Raw named macOS daemon/resilience native outputs + exits copied from retained tool transcript into A-15688, labelled 34431ebf2 prior-head/same-production (only gateway test+guide changed). Final evidence review requested. Fresh origin/dev fetch5bfd7c24a5a02fedc1c2244d851194c3518ee083, merge-tree exit0/conflict-free; no head change or dev merge.

### rev-38 · 2026-11-02T06:58:41.213Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1592-evidence-2
commit: 48d290e775a1e0ff5ccc36d01cec35c3f6e54020
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. Exact-head source-clear rev-38-1592-source-2 carries forward. A-15686/run0597cc5d has 12 named edge base passes and 5/5 load receipts each: 0600 welcomes/default/long/special-root/TMPDIR, missing/wrong bearer logging parity, stale/owned socket cleanup, client hello refusal. Corrected gateway lifecycle has outcome:pass. A-15688 supplies raw native outputs and exits0 for unchanged daemon18/resilience3 at prior head34431ebf2, macOS arm64 Node24.21 local. Carried forward explicitly as prior-head/same-production because only gateway test/guide changed; required native files, fixtures and production unchanged. Current uncached Linux x64 droplet / Node24.21 / Neovim0.12.5: T0/T1/T2/Web exit0, 4711 reported pass, zero fail/cancel/skip. Isolated chromium_headless_shell-1248 / Chrome for Testing156.0.8078.4. Budgets/lint report-only; T3 deferred to merge batch, no full T3/T4 claim. Reviewer ran no tests/browser. C1–C4 verified; A-15690 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15690-t-1592-final-evidence-at-48d290e7.md) maps evidence and limits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-38 · 2026-11-02T07:17:12.205Z

verdict: review
result: clear
by: rev-38 [reviewer]
run: rev-38-1592-source-3
commit: 0220773c00c4d8ccd6864b26b51fecad1d41b313
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear; Standards 0 findings, Spec 0 findings. Both-parent read-only diffs inspected. Unix spoke/Host records/Host process README sections preserved verbatim, no conflict markers. Prior binder/server/path selectors, gateway/edge regressions and daemon/resilience preservation files unchanged; incoming daemon Host registration and Store.hosts do not disturb three-listener binding/rollback/owned shutdown. Incoming T-1590 is merged with clear source/final verdicts; T-1584 ownership was separately reviewed clear. Incoming runtime changes prevent docs-only waiver. Fresh exact-head mode-free verification/evidence required; C1–C4 remain runtime-unverified, A-15686 is pre-merge only. Reported merged-tree macOS edge12/gateway20/typecheck/lint exit0 are targeted local evidence. Reviewer ran no tests/browser. Git remerge reconstruction requires forbidden temporary writes, so no such reconstruction claimed; explicit parent/section comparisons performed instead. Detail A-15713 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15713-t-1592-authorized-merge-delta-source-review.md).

### rev-38 · 2026-11-02T07:20:19.732Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1592-evidence-3
commit: 0220773c00c4d8ccd6864b26b51fecad1d41b313
scope: evidence
findings: [{"severity":"medium","text":"Required unedited native preservation test fails at merged head: extra verification-wait event between socket-kept and stopped; C4 lacks passing hub-socket preservation.","file":"hub/test/daemon.test.ts","line":583}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear. Independently read raw A-15718: actual ['stopping','socket-kept','verification-wait','stopped'], expected ['stopping','socket-kept','stopped']; daemon.test.ts:583, generated case 'a stopping hub leaves alone a socket that is no longer the one it bound, and hub.json goes only at the end'. Exact merged head0220773c0, local macOS arm64 Node24.21 targeted T3, native exit1/17pass/1fail/zero cancelled/skipped. No browser. No merged-head queued verify yet; older A-15686 remains pre-merge only. C4 failed because the explicitly required unchanged hub-socket owner does not pass. Source verdict rev-38-1592-source-3 is unchanged; this failure requires owning shared-fix guidance, then fresh source review if head changes. Similar verification-wait shutdown failure is already reported under T-1627; this evidence alone does not establish its exact cause. No reviewer tests/browser run. Raw artifact A-15718 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15718-t-1592-post-merge-native-daemon-failure-raw-receipt.txt).

Criteria: C4 failed (Required unchanged daemon.test.ts fails at merged head: shutdown events include unexpected verification-wait (A-15718, 17 pass/1 fail, exit 1).).

### rev-38 · 2026-11-02T07:42:41.893Z

verdict: review
result: not clear
by: rev-38 [reviewer]
run: rev-38-1592-evidence-4
commit: 0220773c00c4d8ccd6864b26b51fecad1d41b313
scope: evidence
findings: [{"severity":"medium","text":"C4 literal unchanged-file pass remains unsatisfied by A-15718 (known clean-dev-red T-1627); fresh queued green run does not execute T3 daemon preservation.","file":"hub/test/daemon.test.ts","line":583}]
finding_counts: {"high":0,"medium":1,"low":0}

Partial evidence: A-15735/run f0ecd0aa at exact source-clear0220773c is finished/passed; independently checked all12 named Unix edge base passes and corrected gateway pass. C1–C3 separately verified under this run. Uncached Linux x64 droplet Node24.21/Neovim0.12.5, Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/T2/Web exit0,4721 reported pass,zero fail/cancel/skip in selected scope. Budgets/lint report-only; T3 deferred. C4 client-refusal component is green, but unchanged daemon native file remains failed in A-15718, already attributed to clean-dev-red T-1627 by Coordinator decision625aceae. Source remains clear. This not-clear is confined to C4's literal preservation requirement, pending explicit exception/amendment or shared-fix green evidence; no T-1592 production fix requested. No tests/browser run by reviewer.

Criteria: C4 failed (Daemon preservation remains 17/18 failed under acknowledged T-1627; pending explicit criterion exception or shared-fix/native green receipt.).
