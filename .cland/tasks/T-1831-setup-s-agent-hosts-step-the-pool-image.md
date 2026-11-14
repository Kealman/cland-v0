---
id: T-1831
kind: task
title: "Setup's agent-hosts step: the pool image and the first logins"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1830
topic: topic-1511
branch: t/T-1831-setup-s-agent-hosts-step-the-pool-image
created: 2026-11-12T10:07:21.799Z
updated: 2026-11-14T19:50:29.769Z
closed: 2026-11-14T19:50:29.769Z
---

## Summary

Setup's agent-hosts step finishes the pool. It offers `cland host prepare agents`, then a first login for each harness of the roles placed on the pool, run with the harness's own sign-in in the human's terminal. Each offer that can start a paid machine names it and defaults to No.

## What to build

After T-1830 writes the pool:
- **The image.** The step offers `cland host prepare agents`; on DigitalOcean this builds the pool image on a paid build machine, which the question names. It runs the command on yes and prints the pool image's state.
- **The logins.** For each harness of the placed roles with no ready login of the pool's provider and region, it offers `cland login add <harness> --pool agents`. The question names that a host may boot for it. On yes, the sign-in runs in the human's terminal as `cland login add` runs it, and the line reports the login and its state.
- **Failures.** A failed or abandoned sign-in prints `open` with `cland login signin <name>`, and the step goes on.
- **Declines and no terminal.** A no prints `skip` with the exact command. Without a terminal, both print `open` with the exact commands and nothing runs.

No host is created without a yes. The step never prints a token.

## Acceptance criteria

- [x] C1. After the pool is written, the step offers `cland host prepare agents`, runs it on yes, and prints `done` with the pool image's state (test).
  - done: impl-1831 · 2026-11-14T18:33:35.584Z
  - verified: rev-35 [reviewer] · run rev-35-1831-final-1 · 2026-11-14T19:00:45.402Z · commit 3712d045c132975b815a13ffd823a78f7d9db87b
- [x] C2. For each harness of the roles on the pool without a ready login, the step offers `cland login add <harness> --pool agents` and runs its sign-in in the terminal, leaving a `ready` login on the fake harness (test).
  - done: impl-1831 · 2026-11-14T18:33:35.908Z
  - verified: rev-35 [reviewer] · run rev-35-1831-final-1 · 2026-11-14T19:00:45.402Z · commit 3712d045c132975b815a13ffd823a78f7d9db87b
- [x] C3. Each offer that can start a paid machine names it and defaults to No, a no prints `skip` with the exact command, and no host is created without a yes (test).
  - done: impl-1831 · 2026-11-14T18:33:36.153Z
  - verified: rev-35 [reviewer] · run rev-35-1831-final-1 · 2026-11-14T19:00:45.402Z · commit 3712d045c132975b815a13ffd823a78f7d9db87b
- [x] C4. A failed or abandoned sign-in prints `open` with `cland login signin <name>`, and setup goes on to the Aide (test).
  - done: impl-1831 · 2026-11-14T18:33:36.501Z
  - verified: rev-35 [reviewer] · run rev-35-1831-final-1 · 2026-11-14T19:00:45.402Z · commit 3712d045c132975b815a13ffd823a78f7d9db87b
- [x] C5. Without a terminal, the image and the logins print `open` with the exact commands, and nothing runs (test).
  - done: impl-1831 · 2026-11-14T18:33:36.717Z
  - verified: rev-35 [reviewer] · run rev-35-1831-final-1 · 2026-11-14T19:00:45.402Z · commit 3712d045c132975b815a13ffd823a78f7d9db87b

## Blocked by

- T-1830

## Notes

- Hot files: `hub/src/setup/steps/hosts.ts`, `hub/src/setup/types.ts` (the machine's command runner), `hub/test/setup-prompter.ts`.
- Tests: `hub/test/setup-hosts.test.ts` (T2, scripted prompter and terminal, `projectHub`, the fake host provider, the fake transport and the fake harness binaries).
- Serves epic C5.

## Comments

### impl-1831 · 2026-11-14T17:36:01.242Z

Rule 20 sweep before edits: setup runner/types and cli/setup render text and JSON; setup-flow, setup-hosts, setup-cli, setup-hub, setup-remotes, setup-remote-component, setup-favourite, setup-handover, setup-trust and scenarios/setup consume rows/order or exit status. Unconfigured rows/order remain unchanged; configured pools gain image/login detail rows before Aide. No production Neovim/web/doctor SetupReport consumer found. Their hosts.agents/role.launch.pool consumers use existing shared config parsers and stay unaffected (no key changes). QA E-611/612/613/614/616/617 and E-1537-stage-1/2 plus E-1533/1534 host briefs, onboarding/implement skills and docs cland-setup/README/CLI usage describe setup or host configuration; only setup guidance changes. Existing host image/login list wire replies remain unchanged; setup adds optional read methods with conservative missing-reply handling.

### impl-1831 · 2026-11-14T17:45:05.935Z

Implementation committed/pushed 26d136e66ee817d05584ad231fae4b375e85e039. C1-C5 done; review requested from responsible Reviewer in topic-1511, resolved rev-35. A-19411 candidate evidence distinguishes T2 simulated native-close receipts from deferred native stage QA. Local macOS Node24.21: setup-hosts25/25, setup-flow21/21, CLI usage1/1, full typecheck and tier/wording lint passed; /private/tmp exact inventory delta0. No configured verification yet; waits for source clear. Coordinator builder-price decision dd458e97 incorporated.

### impl-1831 · 2026-11-14T17:45:38.323Z

Evidence correction: early new full-runner fixture attempts used env:{} before correction to fixtureEnvironment and may have added scratch trust entries through HOME fallback. Incident reported to lead for Coordinator assessment; no live config/credential inspection or cleanup by Implementer. Final committed fixture and final25/25 use scratch account environment. A-19411 early candidate isolation statement is qualified by this comment; /private/tmp delta0 proves only directory preservation.

### coord · 2026-11-14T17:45:57.878Z

Isolation incident (impl-1831, 2026-11-14 ~17:40Z, reported 17:45Z): an early failing candidate built the setup-runner fixture with env:{}, so trust's HOME fallback could have reached the human's Claude config. Coordinator assessment (keys only, no values printed): ~/.claude.json has 5 scratch-path project keys, all older (three Claude scratchpads, cland-T-236 and cland-T-249 of 2026-10-11), none from this item's runs; ~/.codex/config.toml unchanged since 2026-10-29. Nothing cleaned or edited. Fixture corrected to fixtureEnvironment(root, {}, {}) with scratch CODEX_HOME; a regression asserting HOME/CLAUDE_CONFIG_DIR/CODEX_HOME under the disposable root is requested (rule 15).

### rev-35 · 2026-11-14T17:53:18.170Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1831-source-1
commit: 26d136e66ee817d05584ad231fae4b375e85e039
scope: full
findings: [{"severity":"medium","text":"Rule23: full retained login.list reads before/after each operation plus repeated some() name scans add unbounded/quadratic work. Use shared bounded naming/named read ownership and a retained-heavy work-count control.","file":"hub/src/setup/steps/hosts.ts","line":59},{"severity":"medium","text":"C1: ready logins return ok before any image/current-key receipt, bypassing absent/stale image repair. Readiness must include the shared current-image check and retain the image offer.","file":"hub/src/setup/steps/hosts.ts","line":91},{"severity":"medium","text":"C5: incomplete configured nonterminal --yes skips required command rows; rejected hub status/provider reads similarly collapse to generic guidance. Preserve exact open image/login commands without effects, while retaining untouched unconfigured skip/exit0.","file":"hub/src/setup/steps/hosts.ts","line":93},{"severity":"medium","text":"C4: an intended name is used for signin recovery even if the terminal runner failed before login admission and no matching row exists. Require admitted row/name facts or keep add guidance.","file":"hub/src/setup/steps/hosts.ts","line":68},{"severity":"medium","text":"C2: missing-role snapshot is not refreshed after successful logins; a new pinned-A login can satisfy a later unpinned same-harness role yet a second add is still offered. Revalidate shared account-aware readiness before later offers.","file":"hub/src/setup/steps/hosts.ts","line":25}]
finding_counts: {"high":0,"medium":5,"low":0}

Full immutable26d136e source pass not clear; A-19414 records Standards1 medium and Spec4 medium, no runtime verification claims. A-19412 excerpts retain candidate/raw-stream/simulated-close limits and early isolation correction; Coordinator assessment is attributed, not Reviewer live-file inspection. A-19413 all976 paths/tiers independently match pinned manifest,54 explicit roots retained and others unknown. afebfe test-only assertion successor was pushed during pass; this verdict covers immutable26d136e only. Complete pass releases hold for consolidated fixes and a fresh exact-head review before verify. All criteria remain unverified; C3 separate-consent implementation has no source finding.

Criteria: C1 failed (Ready-login fast path does not establish a current image or retain its repair offer.), C2 failed (Stale missing-role snapshot can offer a duplicate login after prior success; retained inventory work is unbounded.), C4 failed (Pre-admission failure can produce signin guidance for a login that was never admitted.), C5 failed (Configured nonterminal --yes and failed hub reads omit required exact image/login open commands.).

### impl-1831 · 2026-11-14T17:53:59.003Z

Review-fix Rule20 sweep: shared current-image checker consumers doctor/hosts and setupMachine (refines T1830 C6 per Coordinator81c7660d); pool-image module/provider preparation tests and doctor-hosts. Additive login.list name filter touches protocol validator, shared wire and dispatch; unfiltered CLI login/web hosts/list fixtures, host/login tests, Neovim/wire snapshots, web authority allowlist stay same array shape. Setup new named-read client filters prior-wire full arrays. terminalLogin optional admission callback/output mode reused by CLI default and setupMachine, with existing login-add/login-terminal T3 contracts explicitly reached. Coordinatora4278215: no capability-first item needed due old-hub fallback; keep hub-assigned readable names; existing hub reserveDiskLogin uses indexed get loop (linear, not setup quadratic inventory scan), noted as existing owner. Complete manifest unknown accounting A-19413 remains conservative pending configured selection.

### coord · 2026-11-14T18:02:15.526Z

Notes (Coordinator, 2026-11-14): T-1830 C6 is refined per decision 81c7660d. A configured pool reports a quiet ok only when its local image is current AND the placed roles' logins are eligible; doctor and setup share one read-only image-key comparison (local, no provider call). Per decision a4278215, login names stay hub-assigned and readable; setup reads the new login back with an additive named login.list filter, which keeps the old full-array reply for unfiltered clients and falls back on older hubs, so no capability-first item is needed (rule 19). Builder price per decision dd458e97: c-8 $0.25/h and c-16 $0.50/h (docs/hub/running.md:303); other prepare sizes leave the image offer open.

### rev-35 · 2026-11-14T18:12:44.870Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1831-source-2
commit: d8e3cd7b4a0255d5d970fbfaed3cd8c15cc460dd
scope: full
findings: [{"severity":"high","text":"addLogin ignores its supplied sealed env when selecting discovery: hubDiscovery(root) reads ambient process.env.CLAND_HUB_FILE. Pass env and prove safe ambient-sentinel/explicit-env selection without live lookup.","file":"hub/src/setup/machine.ts","line":23},{"severity":"medium","text":"Named login.list still enumerates every retained binding via bindings(name). Implement Coordinator71b7b475 metadata-only named row/type without bindings; preserve exact unfiltered ListedLogin[] and old-hub fallback; add a reader-heavy work control.","file":"hub/src/hub/dispatch.ts","line":2325},{"severity":"medium","text":"AsyncDisposableStack joins pending in-process work before socket destruction on failure/timeout. Disconnect/cancel owned work first, positively join work and sockets/server, then allow root disposal, with a held/failure control.","file":"hub/test/login-terminal.test.ts","line":50},{"severity":"medium","text":"C3: displayed paid terms are not reread after yes. Apply Coordinatordea7353d's setup-local recheck immediately before prepare/add; changed terms must produce open with exact command and no effect. Document one-human config ownership; residual shared admission/CAS race is T-1858, out of scope.","file":"hub/src/setup/steps/hosts.ts","line":39}]
finding_counts: {"high":1,"medium":3,"low":0}

Complete second full source pass not clear; A-19416 records Standards 1 high/2 medium and Spec 1 medium. First-pass current-image, nonterminal commands, admitted recovery name and readiness refresh fixes are present. Coordinator-approved metadata-only named row and setup-local consent bar govern correction; no shared admission pin/CAS expansion requested beyond T-1858. Candidate native successes do not prove ambient isolation or failure drainage; capture/candidate/T-1806 and earlier isolation limits remain explicit. All criteria unverified; no configured run. Complete pass releases hold for consolidated fixes and fresh pinned review. Reviewer read-only.

Criteria: C2 failed (New default terminal path can escape supplied discovery isolation, named read still scans unbounded readers, and fixture failure cleanup does not interrupt before joining.), C3 failed (Missing agreed setup-local post-consent paid-terms revalidation; residual shared admission pinning remains explicitly deferred to T-1858.).

### impl-1831 · 2026-11-14T18:17:16.505Z

Second-fix Rule20 sweep per71b7b475: named login.list now returns own shared-wire LoginMetadataRow (no bindings field), setup reader explicitly accepts metadata or older ListedLogin rows; unfiltered exact array+bindings remains. No existing unfiltered CLI/web/Neovim consumer migrates. Reader-heavy regression verifies129 real bindings in unfiltered result and zero binding enumeration in named path. terminal default discovery now receives supplied env, ambient scratch sentinel/explicit fixture discovery regression; held-result cleanup disconnects then joins. Paid-term post-yes reread follows dea7353d; residual admission/CAS race stays T1858.

### rev-35 · 2026-11-14T18:21:46.872Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1831-source-3
commit: 0d80c7c9cfa7aee8a25e39a4e30addff0a72ded3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source recheck clear, no findings; A-19418. All A-19416 corrections present: supplied-env discovery plus scratch hostile ambient control; own metadata-only named row/no binding inference with reader-heavy zero-enumeration and old/unfiltered compatibility; disconnect-before-join held native cleanup; immediate post-yes paid-terms reread with changed/open/no-effect controls. Original image readiness, admitted-name recovery, nonterminal guidance and eligibility refresh retained. Coordinator dea7353d scope accepted: residual shared admission/CAS window is documented T-1858, not required here. A-19417 candidate/capture, early-isolation and T-1806 limits remain explicit; all976 consumer roots retained conservatively. All run-dependent criteria remain unverified. Clean exact pin; mode-free verify may run here, final verdict follows receipt audit. Reviewer read-only.

### rev-35 · 2026-11-14T18:24:18.900Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1831-evidence-1
commit: 0d80c7c9cfa7aee8a25e39a4e30addff0a72ded3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence not clear: configured 3c705d47/A-19419 failed during acquisition; delivered error DigitalOcean422: Size is not available in this region (c-8 ams3). A-19420 independently audits all114 log lines: T0 host check passed, no runtime progress events; T1/T2/changed login-terminalT3/Web all unexecuted, counts unavailable. Provenance matches exact reviewed head/tree, but platform/browser null; no runtime or browser pass. No new source defect; A-19418 source clearance remains applicable. C1–C5 remain unverified, not failed from absent execution. Preserve failed history; lead awaits Coordinator disposition, no Reviewer retry authorization or source change. Complete failed-evidence pass releases hold.

### rev-35 · 2026-11-14T18:32:15.003Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1831-evidence-2
commit: 0d80c7c9cfa7aee8a25e39a4e30addff0a72ded3
scope: evidence
findings: [{"severity":"medium","text":"Descriptive suffix breaks shared/hub-reference.ts's anchored link-only reader, omitting the setup guide. Both README remote-docs cases deterministically fail split() on missing setup heading. Restore the bare pointer with prose continuation and preserve both checks; record helper/site/wrapper consumers.","file":"hub/README.md","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed configured retry evidence not clear; A-19422. Actual TypeError Cannot read properties of undefined (reading split) at site remote-docs176:58/190:46 is caused by this item's README pointer suffix, confirmed read-only and by lead. I missed this consumer in prior source review. Stream audit: ordinary1677 pass/2 fail and219 files pass/1 fail; load115 pass/10 fail separately. T0 passed; T1 failed; T2/changed T3/Web unexecuted. Provenance same head/tree, Linux droplet Node24.21; browser null. C1–C5 remain unverified; no unavailable phase upgraded to pass. Complete failed-evidence pass releases hold for minimal pointer correction and fresh source review before a new configured run; no unchanged retry/native or provenance rerun requested. Prior acquisition red retained; T-1858 scope unchanged.

### impl-1831 · 2026-11-14T18:33:00.960Z

README consumer correction after A19421/A19422: shared/hub-reference.ts reads bare index pointer lines; readers site/test/remote-docs.test.ts (through hub/test/remote-docs.test.ts wrapper), hub/test/session-usage.test.ts, roles-clauses.test.ts and web-readme.test.ts. suite-task-selection and durations fixtures preserve wrapper ownership/runtime identity. Own README suffix excluded setup guide; restored bare link with prose continuation. Existing site assertions retained, local red22/20/2 then green22/22. Prior complete manifest unknown inventory remains conservative; these paths now explicit. No unchanged retry; fresh source review before new exact-head verify.

### rev-35 · 2026-11-14T18:34:16.803Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1831-source-4
commit: 3712d045c132975b815a13ffd823a78f7d9db87b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Minimal README delta clear; A-19424. Bare setup pointer restored, descriptive prose retained on continuation; matches existing exact-line reader. No parser/assertion/test/runtime changes. Shared helper/site/wrapper/additional readers now explicit; conservative consumer floor retained. Clean matching local/origin pin. Prior source behavior, candidate/native limits and agreed T-1858 scope carry unchanged. Both failed configured runs retained; all C1–C5 unverified. Exact-head mode-free verify may run, final settlement awaits actual positive receipts. Reviewer read-only.

### impl-1831 · 2026-11-14T19:00:35.865Z

Exact-head verify01aaf92f passed at3712d045c; A19425 full log, A19426 streamed named/976-root ledger. Aggregate6314/6314 no fail/cancel/skip/todo. T0,T1,allT2,changedT3,Web exit0;695positive basefile receipts and281deferred unchangedT3/T4. Linuxx64 Node24.21 HeadlessShell1248/CfT156.0.8078.4, no cache. Report-only budget/lint warnings retained. Final criterion verdict pending Reviewer; no ready claim or source changes. Prior failed receipts, T1806 baseline residue classification, early isolation/Coordinator no-live-write assessment and T1858 boundary remain retained.

### rev-35 · 2026-11-14T19:00:45.402Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1831-final-1
commit: 3712d045c132975b815a13ffd823a78f7d9db87b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C5 verified. A-19427 independently audits A-19425: all33 setup base cases,21 new identities each5 load passes, all4 changed native terminal cases once, all9 doctor cases, and both repaired README cases base+5 pass. Full finish audit6314 ordinary tests/695 files and230 separate load test/file positives, no negatives. All976 conservative paths preserved:220T1+420T2+54Web+1changedT3 ordinary file passes, zero selected missing;264T3+17T4 deferred. Exact reviewed head/tree and Linux droplet Node24.21/HeadlessShell1248 Chrome156 provenance match. Report-only advisories, candidate/raw-stream/early-isolation/T-1806 limits remain explicit; final billed lifetime/cost unavailable in inspected receipt. Both prior failed runs remain failed. Accepted local consent bar met; residual shared admission/CAS is T-1858. Full remaining native scenarios/T3/T4 and after-stage QA remain separate. Clean unchanged head; Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1831 · 2026-11-14T19:01:16.310Z

Hub status ready confirmed at3712d045c132975b815a13ffd823a78f7d9db87b; C1-C5 verified by rev-35-1831-final-1, A19427. Exact-head run01aaf92f/A19425 passed6314/6314 across T0/allT1/allT2/changedT3/Web;695selected file receipts,281unchangedT3/T4 deferred. Claim retained; Coordinator owns enqueue/merge and after-stageQA. Ready-note qualifications: early empty-env fixture risk was corrected and Coordinator assessment8bdd3f06 found no live trust/config changes; explicit scratch-path and hostile-ambient regressions now pass. Two native residue entries matched origin/dev baseline and remain trackedT1806. Accepted shared-admission/CAS gap remainsT1858. Prior failed receipts retained; worktree clean, no source changes after review.

### coord · 2026-11-14T19:50:29.769Z

Merged acb4d0af1950627219daf9a1b993ce218119a0ab onto dev.
