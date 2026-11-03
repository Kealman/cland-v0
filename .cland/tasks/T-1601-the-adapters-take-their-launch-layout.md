---
id: T-1601
kind: task
title: The adapters take their launch layout and files from the session's Host
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1587
  - T-1556
topic: topic-1352
branch: t/T-1601-the-adapters-take-their-launch-layout
created: 2026-11-02T03:33:55.630Z
updated: 2026-11-03T03:41:45.600Z
closed: 2026-11-03T03:41:45.600Z
---

## Summary

Each adapter takes its session run directory, log directory, discovery file, node, CLI and spoke entries from the launch's Host layout instead of the hub's. It writes Claude Code's `mcp.json` and `settings.json`, Codex's socket directory and log, and OpenCode's config, password and log through `LaunchFiles` on that Host, and reserves OpenCode's port with the Host's freePort. On the `local` host every path and file is as today.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/contract.ts`, `hub/src/adapters/sessions.ts`, `hub/test/host-boundary.test.ts`

## Acceptance criteria

- [x] C1. With a recording Host whose layout maps into another tree, each harness's launch writes every session-side file, and names every path in its argv and environment, from that layout (test).
  - done: impl-1601 · 2026-11-03T00:17:57.727Z
  - verified: rev-36 [reviewer] · run rev-36-1601-final-1 · 2026-11-03T00:42:12.111Z · commit 6ac72d6a261442c803122c087a371c5c1e76f709
  - verified: rev-35 [reviewer] · run rev-35-1601-final-1 · 2026-11-03T01:51:10.676Z · commit f232340a7b702fc9153e3afe5686da4b010e2148
  - verified: rev-35 [reviewer] · run rev-35-1601-final-2 · 2026-11-03T02:24:18.828Z · commit a32b187faeebc08c5882e4b2661baaae4115de92
  - verified: rev-35 [reviewer] · run rev-35-1601-final-3 · 2026-11-03T02:56:58.582Z · commit e4211fc198223ced964b3d1646eafa69a5894656
- [x] C2. On the `local` host the argv, environment, file paths, modes and contents of a launch of each harness are byte-identical to today's (test).
  - done: impl-1601 · 2026-11-03T00:17:58.093Z
  - verified: rev-36 [reviewer] · run rev-36-1601-final-1 · 2026-11-03T00:42:12.111Z · commit 6ac72d6a261442c803122c087a371c5c1e76f709
  - verified: rev-35 [reviewer] · run rev-35-1601-final-1 · 2026-11-03T01:51:10.677Z · commit f232340a7b702fc9153e3afe5686da4b010e2148
  - verified: rev-35 [reviewer] · run rev-35-1601-final-2 · 2026-11-03T02:24:18.828Z · commit a32b187faeebc08c5882e4b2661baaae4115de92
  - verified: rev-35 [reviewer] · run rev-35-1601-final-3 · 2026-11-03T02:56:58.582Z · commit e4211fc198223ced964b3d1646eafa69a5894656
- [x] C3. OpenCode's port comes from the launch Host's freePort and its password is read through that Host (test).
  - done: impl-1601 · 2026-11-02T23:51:15.745Z
  - verified: rev-36 [reviewer] · run rev-36-1601-final-1 · 2026-11-03T00:42:12.111Z · commit 6ac72d6a261442c803122c087a371c5c1e76f709
  - verified: rev-35 [reviewer] · run rev-35-1601-final-1 · 2026-11-03T01:51:10.677Z · commit f232340a7b702fc9153e3afe5686da4b010e2148
  - verified: rev-35 [reviewer] · run rev-35-1601-final-2 · 2026-11-03T02:24:18.829Z · commit a32b187faeebc08c5882e4b2661baaae4115de92
  - verified: rev-35 [reviewer] · run rev-35-1601-final-3 · 2026-11-03T02:56:58.582Z · commit e4211fc198223ced964b3d1646eafa69a5894656
- [x] C4. The boundary lint also fails when an adapter or `opencode/server.ts` imports `writeFile`, `mkdir`, `rm` or `chmod` from `node:fs` or `node:fs/promises` for a session-side path (test).
  - done: impl-1601 · 2026-11-02T23:51:16.483Z
  - verified: rev-36 [reviewer] · run rev-36-1601-final-1 · 2026-11-03T00:42:12.111Z · commit 6ac72d6a261442c803122c087a371c5c1e76f709
  - verified: rev-35 [reviewer] · run rev-35-1601-final-1 · 2026-11-03T01:51:10.677Z · commit f232340a7b702fc9153e3afe5686da4b010e2148
  - verified: rev-35 [reviewer] · run rev-35-1601-final-2 · 2026-11-03T02:24:18.829Z · commit a32b187faeebc08c5882e4b2661baaae4115de92
  - verified: rev-35 [reviewer] · run rev-35-1601-final-3 · 2026-11-03T02:56:58.583Z · commit e4211fc198223ced964b3d1646eafa69a5894656
- [x] C5. The claude-code-adapter, codex-adapter, opencode-adapter, opencode-native and launch-files test files pass with no test edited.
  - done: impl-1601 · 2026-11-02T23:51:17.164Z
  - verified: rev-36 [reviewer] · run rev-36-1601-final-1 · 2026-11-03T00:42:12.111Z · commit 6ac72d6a261442c803122c087a371c5c1e76f709
  - verified: rev-35 [reviewer] · run rev-35-1601-final-1 · 2026-11-03T01:51:10.677Z · commit f232340a7b702fc9153e3afe5686da4b010e2148
  - verified: rev-35 [reviewer] · run rev-35-1601-final-2 · 2026-11-03T02:24:18.829Z · commit a32b187faeebc08c5882e4b2661baaae4115de92
  - verified: rev-35 [reviewer] · run rev-35-1601-final-3 · 2026-11-03T02:56:58.583Z · commit e4211fc198223ced964b3d1646eafa69a5894656

## Notes

Shared files: `claude-code.ts` (T-1556 first, then 21 and 25), `codex.ts` (20, 25), `opencode.ts` and `opencode/server.ts` (17, 25), `contract.ts`, `sessions.ts` (T-1586 also edits it)

## Comments

### impl-1601 · 2026-11-02T23:44:10.835Z

Consumer inventory (rule 20): Host/HostLaunchLayout and launch operations searched across hub/src (including colocated tests), hub/test, web/test, nvim/test, qa, shipped skills and docs/agents. Production: three adapters, opencode/server.ts, launch-files.ts, sessions.ts (Host selection and durable recovery), host/{host,local,test-host}. Existing layout/Host wire shape unchanged; no registry/session protocol migration. Tests: host-{boundary,local-contract,contract}, launch-files, claude-code-{host,adapter,sessions,schedule,environment,accounts}, codex-{host,adapter,native}, opencode-{host,adapter,native}, session-{host,host-placement,host-routing,launch,stop-races}, adapter-native-boundary and src/adapters/opencode.test.ts. QA historical/stage briefs use local layouts and remain compatible. Coordinator decisions 96379b59 and 7b27eb1c: local shared-ignore atomic algorithm moves unchanged to host/local-opencode-files.ts; remote prepare refuses naming T-1644. LaunchFiles retains local metadata only on local Hosts; remote existing-file replacement refuses because mode metadata unavailable, new files allowed. T-1644 owns missing metadata/atomic publish/append. Local launch baseline recorded before production changes; C4 negative control failed before lint extension.

### impl-1601 · 2026-11-02T23:46:32.599Z

Coordinator decision b4c39b35 authorizes optional HostLaunchLayout.modDir. Local Host returns historical MOD_DIR from shared host/launch-layout.ts; Claude reexports its existing MOD_DIR symbol for compatibility. Remote Claude refuses missing modDir before native launch; stage-3 SSH Host must supply it. Field consumers searched by HostLaunchLayout, layout calls and MOD_DIR: three adapters, Host local/test implementation, host-contract, launch-files fixtures, hub-status-component and new layout tests. Only local host-contract's exact layout expectation needs migration; other structural consumers accept the optional additive field. No Host agent operation/wire change.

### rev-36 · 2026-11-02T23:54:00.050Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1601-source-1
commit: 5630f6aa064cfdb59598ed6f00bcc7356f7fe7da
scope: full
findings: [{"severity":"high","text":"Mapped Codex sockets use Host.layout().runDirectory, but threadPolicy still denies only dirname(discoveryFile)/run. For the new recording layout /host/runtime remains under an allowed parent, so a network-local sandbox can reach the app-server command/exec surface; the baseline test supplies no sandbox and misses this mismatch.","file":"hub/src/adapters/codex.ts","line":958}]
finding_counts: {"high":1,"medium":0,"low":0}

# T-1601 source review

Head: 5630f6aa064cfdb59598ed6f00bcc7356f7fe7da
Baseline: 986afe46b (single implementation commit).
Run: rev-36-1601-source-1; scope full; result not clear.

## Standards

One high finding, also the Spec finding below: the path policy is still re-derived in threadPolicy instead of consuming the same Host runDirectory now used by socket launch (project rule24). New mapped-layout tests never supply a sandbox, so they assert the new launch path without checking its paired denial. Other checked points: C5 files are unchanged; C4 extends the existing compiler-based boundary scanner with named/namespace negative controls, rather than a parallel checker. New tests use disposable roots and shared sealed environment builders; no real harness or browser is launched in the new T2 recording cases.

## Spec

High — hub/src/adapters/codex.ts:958 (socket selection :443; policy :229–230). #threadPolicy passes the full Host layout, but the exported function accepts only discoveryFile and derives its deny as join(dirname(discoveryFile), 'run'). #socketPath now binds under layout.runDirectory. The new test's mapped layout therefore launches at <ROOT>/host/runtime/cx-....sock, while network=local would allow <ROOT>/host and deny only <ROOT>/host/run. The actual app-server socket remains reachable under that allowed parent. This loses the existing sandbox fence against the app-server command/exec surface, documented in the function's own policy contract. The wrapper additionally creates the actual runtime directory but may leave the incorrectly denied old directory absent, which Codex may ignore during normalization.

Resolve the actual run directory through the selected Host and deny that exact directory in the generated policy. Preserve the local project and local long-socket fallback denies. Add a recording launch regression with network=local, an independently mapped runDirectory, and assertions tying the emitted socket path to the canonicalized deny; retain the unchanged local controls. The current recording test stops before native launch and omits sandbox entirely, so its baseline cannot establish this invariant. No native reproduction was run by Reviewer; this is a source-proven mapping mismatch.

## Authorized scope and other checks

Read Coordinator decisions96379b59/7b27eb1c/b4c39b35 in the item topic. The local atomic ignore helper and explicit T-1644 nonlocal refusals, missing mode/size refusal, and optional modDir are approved scope. The shared-ignore algorithm is moved intact; local installed mod path resolves to the same location and Claude keeps its MOD_DIR export. Consumer inventories cover Host layout/operation readers, fixture exact-shape migration and downstream stage ownership. Source changes adopt Host reads/writes/password/freePort and mapped MCP/hook entries as described. The five C5 preservation files remain byte-identical to baseline.

C1 failed for the mapped launch-policy path mismatch. C2–C5 remain unverified pending corrected source and exact-head post-source verification/native evidence. A-16001 explicitly contains implementation-snapshot targeted results; none counts as current-head final evidence. QA affected/after-stage. No edits, tests, probes or browsers run by Reviewer.

Criteria: C1 failed (Mapped Codex launch moves the app-server socket into layout.runDirectory but network-local sandbox denies only the old discovery-derived run path.).

### impl-1601 · 2026-11-02T23:55:30.786Z

Fix for source finding A-16005: new mapped network-local launch regression failed with profile denying '<scratch>/host-state/run' and omitting '<scratch>/canonical-runtime', while argv bound '<scratch>/host-state/runtime-alias/cx-mappedsessio.sock'. threadPolicy now accepts optional HostLaunchLayout.runDirectory and canonicalizes that exact directory through the selected Host before emitting its denial. Production passes the complete layout; legacy discovery-only callers retain their previous shape/bytes. Regression now4/4 passes including unchanged local byte-policy and legacy mapped-policy controls. Consumer search threadPolicy(...) covers adapter spawn/relaunch and roles-template-component, codex-workspace-git and codex-sandbox-host tests; direct legacy callers need no migration. No dev merge after first review. Hub typecheck and closed-item wording pass; lint rerun ongoing.

### rev-36 · 2026-11-02T23:57:39.525Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1601-source-2
commit: 862ac30430e15c841311a085fdddad2567a8ae64
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1601 corrected source review

Head: 862ac30430e15c841311a085fdddad2567a8ae64
Prior source: rev-36-1601-source-1 / A-16005 at5630f6aa064cfdb59598ed6f00bcc7356f7fe7da.
Run rev-36-1601-source-2; scope full; clear, findings none.

## Standards

No findings. The socket selection and serialized network policy now consume the same Host layout.runDirectory. The exported threadPolicy accepts that field additively and canonicalizes it through the selected Host; discovery-only callers keep the original discovery-relative path. The wrapper still creates the denied runtime directory before launch. Existing temporary fallback denial and full local serialized policy byte fixture remain unchanged. No C5 preservation file changed and no dev merge occurred. Correction updates subsystem and per-test docs.

## Spec

A-16005 high finding resolved. Actual mapped socket placement and the deny now agree even when the Host runDirectory is a symlink independent of discovery. The new T2 recording regression creates that exact alias, obtains its independent canonical filesystem path, invokes the production Codex spawn path with network=local, captures the emitted native command, and asserts both the socket's mapped path and canonical parent deny plus network_proxy=true. It fails the old discovery-derived policy rather than merely testing a standalone policy helper. No native process/browser starts; final assertions are retained before adapter cleanup. The existing discovery-only/local policy bytes and spawn/relaunch controls remain intact. A-16010's reported red-first/green4 local observations are supplemental, not queued final proof.

Earlier source checks remain applicable to unchanged Claude/OpenCode/LaunchFiles/layout/boundary changes. Coordinator-authorized missing remote mode/size/atomic-operation refusals remain explicit under T-1644; optional modDir behavior is unchanged. C1 source defect is resolved. C1–C5 remain runtime-unverified until same-head post-source mode-free verification and named preservation receipts. Required evidence includes layout10, sandbox Host4 with the new mapped case, boundary negatives, selected Host controls and unchanged C5 cases; distinguish exact-head Codex supplementation from older-head unaffected receipts. No full task all-tier run requested. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

### rev-36 · 2026-11-03T00:15:25.133Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1601-evidence-1
commit: 862ac30430e15c841311a085fdddad2567a8ae64
scope: evidence
findings: [{"severity":"medium","text":"Linux launch baselines fail full deep equality: generated ignore/config mode436 (0664) versus420 (0644). The macOS-captured fixture assumes one umask; preserve the byte/mode assertion with an explicit test baseline condition rather than changing historical production mode semantics.","file":"hub/test/host-launch-layout.test.ts","line":58},{"severity":"medium","text":"Three unchanged Host-routing consumers now throw 'test host t1 refuses layout' from attachCommand during process/session rendering. Migrate their fake layout contract or correct unexpected lookup while preserving collision/birth/signal assertions; current queued integration is not clear.","file":"hub/test/session-host-routing.test.ts","line":40}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1601 failed evidence review

Head862ac30430e15c841311a085fdddad2567a8ae64; source remains clear under rev-36-1601-source-2/A-16011. Run rev-36-1601-evidence-1, scope evidence, not clear.

Actual A-16027 failure output before classification:
- host-launch-layout.test.ts58 full deep equality: `+ mode: 436` / `- mode: 420` for .gitignore and opencode.json, in both local/mapped OpenCode cases. Each also failed all5 load repetitions. These are0664 vs0644, consistent with the fixture assuming its capture platform's umask; do not alter historical production semantics just to match a platform-specific expected mode.
- session-host-routing.test.ts40/72/130: `Error: test host t1 refuses layout`, through OpenCode.attachCommand/#files and Codex.attachCommand/#socketPath while Sessions.view/ProcessTable change renders existing rows. Three unchanged routing controls fail. This is a missed shared layout consumer, not proof that native collision isolation assertions passed. Migrate fixture layout support or remove unintended operation dependencies, retaining those assertions.

Standards: medium portable-baseline setup gap and medium missed test-consumer contract migration, both listed in findings. Spec: C1/C2 evidence is not clear. C3–C5 remain unverified. The corrected mapped network-local fence is not reopened by these failures.

Queued e071ee2a-6356-4c5c-b958-003b2dd50c37/A-16027 exited1. Completed failure accounting reports15 outcomes including repetitions, across5 distinct named identities. T0/T1 exit0, T2 exit1; remaining task phases T3/Web/T4 unexecuted. Tier T2 summary4151/4146pass/5fail differs from aggregate completed accounting. The hub event records completed4341/4326pass/15fail including extra work. No overall pass.

Provenance: exact reviewed head, treebffa5890d095c552b2cb9de73d3aa64802606889, uncached Linuxx64 6.8.0-142-generic droplet c-8sfo2, Node24.21.0/Neovim0.12.5, workers2. Browser binary/version null, no browser execution. Budgets/lint/ratchet/skip checks report-only; skips[]/missing0. Earlier local receipts remain supplemental. Implementer is investigating; no root-cause or shared-defect waiver inferred. Fresh changed-head source review before verification. Reviewer ran no tests/probes/browser and made no source edits.

Criteria: C1 failed (Mapped OpenCode baseline and three unchanged Host-routing consumers fail in the reviewed-head Linux run.), C2 failed (Local OpenCode file-mode baseline deep equality fails on Linux (0664 versus0644), including0/5 repetitions.).

### impl-1601 · 2026-11-03T00:17:26.610Z

Failed Linux run e071ee2a/A-16027 reproduced locally: OpenCode mode assertions showed actual0664(expected0644) under umask002; production remains unchanged. Snapshot matrix now scopes/restores explicit022 and002, asserts historical0644/0664 default modes and0600 private modes. Both outer masks pass16/16. Routing16 reproduced three 'test host t1 refuses layout' errors in attach rendering; doubles now supply scratch pure layout while retaining registry Host process methods, native birth/signal/local-PID assertions. First fixture also had pure setup getter local:limitPolls in its trace; this configuration read is excluded while the no-local-process assertion stays intact. Routing16/16 now passes. Only tests/docs change after862ac3043; no dev merge. Hub typecheck passed; lint running. Fresh source review before verification.

### rev-36 · 2026-11-03T00:18:32.001Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1601-source-3
commit: 6ac72d6a261442c803122c087a371c5c1e76f709
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1601 portable fixture source review

Head6ac72d6a261442c803122c087a371c5c1e76f709. Run rev-36-1601-source-3, scope full, source clear, findings none. Complete delta from862ac3043 is tests/docs only; no production or dev merge.

## Standards

A-16029 fixture findings resolved. Capture matrix fixes each test's process umask to022 or002 and restores the caller's prior mask in finally before adapter close. It retains the full deep equality and independent captured baseline; only the two historically default-mode OpenCode files have the explicit0664 expectation under002. Password/Claude0600, argv/env/content and every other baseline field remain compared. No chmod/default change shipped in production. Six harness/layout combinations under each mask plus four controls produce16 cases.

Routing doubles add only the scratch local Host's pure layout function, retaining their remote name/identity/stop/refusal implementations. The projectHub case still obtains the actual CLAND_TEST_HOSTS registry Host then overrides only adapter-side layout. Collision survival, no-local-process-operation, exact birth and stop/persistence assertions remain. The first trace excludes only the pure limitPolls getter invoked while spreading a test double, not process observations. Matching per-file guides explain the seam.

## Spec

No findings. Earlier mapped Codex socket fence, canonical symlink regression, local fallback controls, Host file/password/freePort behavior and explicit T-1644 limitations are unchanged. All five C5 preservation files remain unedited. Prepared local matrix/routing passes are supplemental; failed Linux A-16027 remains failed history.

C1/C2 source failures resolved; C1–C5 remain runtime-unverified pending fresh same-head post-source mode-free verification. Require all failed base identities and corrected022/002 matrix outcomes on Linux, plus existing named feature/preservation receipts. No Reviewer tests/probes/browser or edits. QA affected/after-stage unchanged.

### rev-36 · 2026-11-03T00:42:12.111Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1601-final-1
commit: 6ac72d6a261442c803122c087a371c5c1e76f709
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1601 final evidence review

Head6ac72d6a261442c803122c087a371c5c1e76f709, branch tip independently unchanged. Run rev-36-1601-final-1, scope evidence, clear; findings none. Source rev-36-1601-source-3/A-16037. C1–C5 verified.

## Standards

No findings. Corrected umask baselines keep full argv/env/file-byte/mode equality, and Host-routing controls retain original authority/collision assertions. Five C5 preservation files remain unedited. Earlier A-16027 stays failed history; this is a fresh run and fresh retained native evidence.

## Spec

Independently streamed A-16050 generated facts apart from exit status:
- C1/C2: host-launch-layout16 pass: local/mapped Claude/Codex/OpenCode captures under umask22 and2; complete argv/env/file contents/modes compare to independent historical fixtures, plus four Host/refusal controls. Every one has5/5 load repetitions. Previously failed OpenCode baseline identities are replaced by the two explicit-mask identities, both pass; production remains ambient-umask-dependent.
- Corrected canonical socket fence: sandbox-host4 pass, including mapped network-local launch denying the canonical directory containing its app-server socket; new case5/5 load repetitions. Local policy byte fixture retained.
- C3: supplied-Host password read case and captured OpenCode port43210 pass. Other Host lifecycle controls pass: ClaudeHost18/CodexHost19/OpenCodeHost9/placement11.
- C4: host-boundary12 pass, including mutation import/namespace negative controls for both fs modules and the live recursive scan.
- Routing16 pass, including all three formerly failing collision/stop/birth identities.
- C5 current Linux queued outcomes: OpenCode-native32 and LaunchFiles3 pass. Read all actual named native local outcomes in A-16053/A-16054/A-16055: Claude adapter6, Codex adapter13, OpenCode adapter21, all zero fail/cancel/skip/todo. A-16056 records each separate native command completion exit0 at this exact head, serial fake harness runs with disposable sealed fixtures; no browser. Reported platform corrected by the lead to Darwin27.0.0 arm64/Node24.21.0; the25.1.0 in A-16056 is superseded by its durable correction. These raw logs replace count-only predecessor notes for final C5 verification.

## Provenance and limits

f6994bb2-1fc0-445e-a36b-e946182ab8a0/A-16050 exit0,4852pass,zero fail/cancel/skip/todo. T0/T1/fallback allT2/Web complete. No T3 queued task file selected; remaining T3 belongs to merge batch,T4 unexecuted. C5 native supplements are targeted macOS T3 executions, not complete T3 coverage.

Verification tree64e1368c1050cb7ed77759ff593d3b22d2f89ee9; uncached c-8sfo2 droplet Linuxx64 6.8.0-142-generic, Node24.21.0/Neovim0.12.5, workers2. Isolated browser /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; Google Chrome for Testing156.0.8078.4. Budgets/lint/ratchet/skip checks report-only, skips[]/missing0/occasion null. Lifetime1098s/$0.0762 are resource metrics, not test-only wall time. QA affected/after-stage separate. Reviewer ran no tests/probes/browser and made no source edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1601 · 2026-11-03T01:26:10.067Z

Coordinator-authorized post-T1593 integration: mergea33b126ac combines6ac72d6a2 withdev53ecaf873 once, local.ts uses shared fileOperations/worktreeOperations and explicit modDir. Followupbc1b426a8 restores dev's Users-mode remote publications SKILL section beside Subsystem documentation with provenance CHANGES. Final exact-head raw layout16/C5 Claude6,Codex13,OpenCode21,OpenCode-native32,LaunchFiles3 all pass; logs A-16082–87, native exit0 receipts in integration artifact. Typecheck/lint pass; current skill provenance pass. C5 preservation files unchanged from original baseline. Requesting delta source review before fresh verification; no additional dev merge.

### rev-35 · 2026-11-03T01:27:52.759Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-delta-source-1
commit: bc1b426a8e9d2cadab579d7ceb08fd07a36caea4
scope: delta
findings: [{"severity":"low","text":"The restored Users-mode remote publications section was copied from newer dev, but this merge includes only dev53ecaf873: remotePublications and RemoteStore.publicationPairings are absent in this head, and the linked #telegram-publications-in-users-mode anchor is absent from remote-commands.md. Reconcile this guidance with the source/docs actually shipped by the reviewed tree; otherwise the skill directs agents to APIs that do not exist here (rule16). Host launch behavior itself is unaffected.","file":".agents/skills/implement/SKILL.md","line":134}]
finding_counts: {"high":0,"medium":0,"low":1}

Authorized integration source clear, one low documentation finding. local.ts keeps shared fileOperations/worktreeOperations with explicit LOCAL_MOD_DIR/layout.modDir; no duplicated helpers, layout not overwritten. Harnesses/LaunchFiles/sandbox/layout matrix/boundary/C5 tests unchanged from prior clear6ac72d6a2. Low: copied newer-dev Users-mode skill section references remotePublications/publicationPairings and a docs anchor absent at actual merged53ecaf873 tree; reconcile guidance with shipped source, no extra merge authorization implied. No high/medium. A-16088 current-head local layout16/C5 native receipts and production-equivalent static receipts are targeted supplements only. C1–C5 await fresh same-head mode-free verify; prior Linux evidence is predecessor only. QA affected/after-stage separate. Reviewer ran no tests/browser and edited nothing. Detail A-16090: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16090-t-1601-integration-delta-shared-host-helpers-and-layout-preservation.md.

### rev-35 · 2026-11-03T01:29:52.297Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-delta-source-2
commit: f232340a7b702fc9153e3afe5686da4b010e2148
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected delta source clear; A-16090 low resolved. Only SKILL/CHANGES changed: users-mode section now names existing RemoteStore.pairing and gateway/state/authority files plus live #remote-commands anchor; both required sections retained, no future API claims. hub/src and hub/test unchanged from bc1b426a8, so shared Host helper/modDir integration inspection carries forward. A-16082–87 remain production/test-equivalent predecessor targeted receipts with actual heads disclosed, not queued final evidence. C1–C5 await fresh same-head mode-free verify. QA affected/after-stage separate. Reviewer ran no tests/browser and made no edits. Detail A-16094: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16094-t-1601-skill-correction-source-review.md.

### rev-35 · 2026-11-03T01:51:10.677Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-final-1
commit: f232340a7b702fc9153e3afe5686da4b010e2148
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integration clear; C1–C5 verified, no findings. Exact-head23a40c56/A-16100 exit0,4931 pass/zero fail/cancel/skip/todo; actual layout16,sandbox4,routing16,boundary12,native32,LaunchFiles3 and Host/coverage incoming controls pass. C5 Claude6/Codex13/OpenCode21 raw native names+exit0 retained A-16083–85/A-16088 at actual predecessorbc1b426a8; independent hub/src+hub/test diff to docs-onlyf232 empty, explicitly production/test-equivalent, not exact-commit native execution. Five C5 test files unedited. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/selected T3 fourfiles75identities/Web completed, remainingT3 deferred,T4 unexecuted. Budgets/lint/ratchet/skip checks report-only; full affected/after-stage QA remains separate. Reviewer ran no tests/browser and edited nothing. Detail A-16103: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16103-t-1601-final-integration-evidence-layouts-and-native-preservation.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1601 · 2026-11-03T01:56:48.613Z

Coordinator1239b18e authorized immediate merge instead of waitingT1597. Heada32b187fa merges pinned incomingd39161065 once with priorf232340a7. Only skill paragraph conflicted; all six headings from both actual parents retained, incoming current APIs/anchor verified present. Raw current-head layout16/C5 Claude6,Codex13,OpenCode21,OpenCode-native32,LaunchFiles3 pass, nativeexit0, logsA-16110–15. Hub typecheck/testlint pass (report-only122findings59files). Delta review requested before fresh verification; no prior queued receipt counted current.

### rev-35 · 2026-11-03T01:57:53.672Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-delta-source-3
commit: a32b187faeebc08c5882e4b2661baaae4115de92
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second authorized merge delta source clear; no findings. Coordinator1239b18e read; actual f232/d391 parents pinned. All six skill sections retained against both parents, incoming skill exact; named publication APIs/docs anchor now exist. Only CHANGES authored merge content. Launch implementations/Host local/layout/sandbox and layout/boundary/C5 tests unchanged from prior clearf232; incoming Telegram/Cookie runtime requires fresh integration verification. A-16116 raw exact-head local layout16/C5 native exits0 are targeted supplements, no queued carry-over. C1–C5 remain runtime-unverified pending fresh mode-free verify at this head. QA affected/after-stage separate. Reviewer ran no tests/browser and made no edits. Detail A-16117: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16117-t-1601-second-integration-delta-source-review.md.

### rev-35 · 2026-11-03T02:24:18.829Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-final-2
commit: a32b187faeebc08c5882e4b2661baaae4115de92
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Second integration final clear; C1–C5 verified, no findings. Exact-head d8b34180/A-16124 exit0,4953 pass/zero fail/cancel/skip/todo. Independently read layout16/sandbox4/boundary12/routing16/Host preservation/native32/LaunchFiles3 timing facts plus incoming Telegram/shared/cookie/Host-agent/coverage controls. C5 native Claude6/Codex13/OpenCode21 raw named outcomes and separate exits0 now exact-head A-16111–13/A-16116, Darwin27 arm64 Node24.21 sealed fake harnesses/no browser; all five preservation files unchanged. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/selected T3 fourfiles75identities/Web completed,remainingT3 batch-deferred,T4 unexecuted. Budget/lint/ratchet/skip diagnostics report-only; no incomplete baseline/projection counted as pass. QA affected/after-stage separate. Reviewer ran no tests/browser/probes or edits. Detail A-16125: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16125-t-1601-second-integration-final-evidence.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### hub · 2026-11-03T02:28:24.100Z

Merge-delta assessment (report-only)
{"reviewed":"a32b187faeebc08c5882e4b2661baaae4115de92","head":"c4d737064e479b3808252bfe65cd5a57509402f6","dev":"e352d2995af8d4c25ef6a83165804f9c4bae248c","mergeBase":"d391610653bc108d2e8ae2b394929a52d5eb3a19","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1601-integration.md","docs/agents/tests/hub-test-claude-code-host.test.ts.md","docs/agents/tests/hub-test-codex-sandbox-host.test.ts.md","docs/agents/tests/hub-test-host-launch-layout.test.ts.md","docs/agents/tests/hub-test-session-host-placement.test.ts.md","docs/agents/tests/hub-test-session-host-routing.test.ts.md","docs/agents/tests/index.md","docs/hub/adapters-and-sessions.md","hub/src/adapters/claude-code.ts","hub/src/adapters/codex.ts","hub/src/adapters/launch-files.ts","hub/src/adapters/opencode.ts","hub/src/adapters/opencode/server.ts","hub/src/host/host.ts","hub/src/host/launch-layout.ts","hub/src/host/local-opencode-files.ts","hub/src/host/local.ts","hub/test/claude-code-host.test.ts","hub/test/codex-sandbox-host.test.ts","hub/test/fixtures/host-launch-claude.json","hub/test/fixtures/host-launch-codex.json","hub/test/fixtures/host-launch-opencode.json","hub/test/host-boundary.test.ts","hub/test/host-boundary.ts","hub/test/host-contract.ts","hub/test/host-launch-layout.test.ts","hub/test/session-host-placement.test.ts","hub/test/session-host-routing.test.ts","hub/test/tiers.json"],"devPaths":[".cland/tasks/T-1591-the-per-host-git-socket-and-git-daemon.md",".cland/tasks/T-1594-the-supervisor.md",".cland/tasks/T-1596-per-host-secret-admission-and-revocation.md",".cland/tasks/T-1597-the-per-host-allow-list-of-leased-task.md",".cland/tasks/T-1601-the-adapters-take-their-launch-layout.md","hub/test/durations.json"],"overlap":[],"dependency":{"status":"unknown","reason":"import graph incomplete or budget exceeded"},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1601 · 2026-11-03T02:29:29.771Z

Merge-prep stale duration key repaired ate4211fc19 after authorized one-time merge of incominge352d2995. Old placement spawn title renamed to current nonlocal shared-ignore refusal title; value0.109388 retained. npm run test:tiers reproduced refusal before edit and passes all manifest identities afterward (182free/497machine). No production/test-source diff beyond durations; diff clean. Delta review before fresh verify.

### rev-35 · 2026-11-03T02:30:29.820Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-delta-source-4
commit: e4211fc198223ced964b3d1646eafa69a5894656
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Duration-only authorized delta source clear, no findings. Coordinator96d1028a read. Incoming e352d2995 is reviewed T-1647 manifest/tracker metadata; runtime/test sources and skill unchanged from prior cleara32. Repair changes exactly one tests-map key to the actual placement refusal test title at159, retaining0.109388 as explicitly authorized historical baseline, no new measurement claim. A-16133 records old-key exact identity refusal then test:tiers exit0/global182free+497machine. No other repair timing/cap/expiry edits. C1–C5 remain runtime-unverified pending fresh same-head mode-free verify; prior queued/native receipts retain historical heads. QA affected/after-stage separate. Reviewer executed no tests/browser or edits. Detail A-16135: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16135-t-1601-duration-identity-repair-source-review.md.

### rev-35 · 2026-11-03T02:56:58.583Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1601-final-3
commit: e4211fc198223ced964b3d1646eafa69a5894656
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear after duration repair; C1–C5 verified, no findings. Exact-head244a1293/A-16136 exit0,4953 pass/zero fail/cancel/skip/todo. Independently checked layout16/boundary12/sandbox4/routing16/placement11/native32/LaunchFiles3 and incoming consumers; repaired exact placement identity has actual pass receipt18296, distinct from retained historical baseline. C5 Claude6/Codex13/OpenCode21 native raw outcomes/exits0 remain actuala32 head A-16111–13/A-16116; comparison confirms identical .ts production/test sources with only durations.json changed, explicitly predecessor source-equivalent evidence. Uncached Linux x64 c-8sfo2 Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/selectedT3 fourfiles75identities/Web complete,remainingT3 batch-deferred,T4 unexecuted. Budget/lint/ratchet/skip diagnostics report-only. QA affected/after-stage separate. Reviewer ran no tests/browser/probes or edits. Detail A-16138: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16138-t-1601-final-evidence-after-duration-identity-repair.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-03T03:41:45.600Z

Merged ff7e6ec8fbca6c0b84535a3653f947480b869a36 onto dev.
