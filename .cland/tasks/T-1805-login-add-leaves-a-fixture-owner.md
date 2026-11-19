---
id: T-1805
kind: task
title: login-add leaves a fixture-owner registry whose roots list a removed fixture root and the live source worktree
state: open
status: review
size: M
criterion_seq: 3
labels: []
assignee: null
parent: E-1882
blocked_by: []
regression_of: T-1777
found_by: review
topic: topic-1655
branch: t/T-1805-login-add-leaves-a-fixture-owner
created: 2026-11-10T12:19:52.954Z
updated: 2026-11-19T14:12:48.924Z
---

## Summary

After `hub/test/login-add.test.ts` runs, its private TMPDIR keeps one fixture-owner registry JSON. Its `roots` list holds a removed `/tmp/hc…` fixture root and the live worktree of the source under test, which isn't a scratch root (checked with realpath). No deletion was observed. But any later owner-driven cleanup that trusted this registry could reach the live worktree, so a fixture registry must never name a non-disposable path.

## Evidence

Found by impl-1778 during T-1778's native slot at 1cba8d79c, 2026-11-10 12:18Z, topic-1461. The registry and both referenced paths were left untouched. All CLI and hub operations logged disposable project roots.

## Acceptance criteria

- [x] C1. The login-add fixture registers only roots it allocated under its scratch root, and the source worktree never appears in a fixture-owner registry's disposable roots. A separate non-disposable `sourceCheckout` field may name it only for PID- and birth-bound process selection during an authorized source-worktree removal (test).
  - done: impl-1805 · 2026-11-19T13:52:34.900Z
- [x] C2. The registry is removed, or marks every root released, once the file's cleanup has joined; a TMPDIR inventory after the file reads 0 → 0 (test).
  - done: impl-1805 · 2026-11-19T14:08:55.727Z
- [x] C3. A guard in the shared fixture-owner code refuses to register a path outside the scratch roots, with a planted control (test).
  - done: impl-1805 · 2026-11-19T11:25:30.483Z

## Comments

### coord · 2026-11-14T22:17:25.602Z

Occurrence in E-1537 stage-3 QA at 932f3018c (run qa-e1537s3-2026-11-14-qa678-1, evidence A-19436, rows 63/99). `hub/test/login-add.test.ts:17,27–28` leaves source-worktree receipt `f68a3881-c9e3-4be1-86c4-00344d909b3a.json`. Owner PID 6397 is absent, fixture /private/tmp/hc-kyQw68 is gone and no handle is open; the surviving source root is QA's worktree. The producers (login-add, host-create-fixture, harness, cli/hub, shared/fixture-ownership, host/records) are byte-identical to b3a30c490. The receipt was left untouched. Trace and hashes: A-19436 row63-residue-trace.json.

### impl-1805 · 2026-11-19T10:20:12.944Z

Consumer census: writers are shared/fixture-ownership.ts via hub/src/cli/hub.ts serve, nvim/test/client.ts createClient, nvim/test/stub-hub.ts; direct fixtures in fixture-orphans, fixture-socket-path and fixture-socket-lifecycle tests. Reader is hub/src/fixture-processes.ts (discovery, sweep, removeWorktreeWithFixtures), also direct fixture-socket-path tests. Root allocation is hub/test/harness.ts tempProject and nvim/test/fixture.ts tempProject. Search includes fixtureOwnership/readFixtureReceipt/fixtureReceiptDirectory/cland-fixture-owners across repo, skills/docs and all test tiers. No public wire change. Legacy receipt bytes will remain parseable only when every root has allocation proof; unproven legacy entries must fail closed.

### impl-1805 · 2026-11-19T10:24:54.795Z

Consumer census addendum: fixture-orphans-lifecycle.test.ts reads processPaths descriptors through readFixtureReceipt and remains compatible with version-1 root-local bytes. fixture-socket-lifecycle's synthetic missing-checkout root migrated to the live scratch root and worktree-scoped sweep (no non-allocated roots). nvim tempProject opts into the shared inode-bound grant without creating root contents; revoke runs after clients stop. Global legacy receipts intentionally lose signal authority because they lack a trustworthy scratch boundary. Existing QA briefs' global-registry references are historical residue evidence, not current writers/readers.

### rev-36 · 2026-11-19T10:41:57.663Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1805-source-1
commit: 9d3e0f00bcd38886a261d195d7ead4b3632dc840
scope: full
findings: [{"severity":"medium","text":"Removing source checkout from all receipt writers also removes its process-selection association: fixture-processes.ts:48 matches source-worktree removal only against roots, so external scratch fixtures are no longer joined before Git removal. nvim client:132/stub:45 have the same change; docs/hub/artifacts.md:131–144 still promises the behavior. Coordinator226cd522 authorizes separate non-disposable sourceCheckout selection metadata with PID/birth-bound join, no-traversal controls and reader census; never put source back in roots.","file":"hub/src/cli/hub.ts","line":329},{"severity":"medium","text":"New async tempProject/mkdir/receipt setup and forged-receipt callback use raw t without a whole-caller normal/signal fence, separately named setup bound or joined original continuation. Changed login-add.test.ts:16–32 likewise outlives fixture()'s setup owner and its cleanup stack. Teardown can race late acquisition/writes. Implementer6856d848/7bb19cbb confirms no omitted owner. Own the changed callbacks before acquisition, capture late roots/resources and join original work before storage removal (rules9/12).","file":"hub/test/fixture-orphans.test.ts","line":16},{"severity":"medium","text":"Injected OS readers/end are semantic fakes; the new fake orphan control and rewritten fixture install no positively controlled native-launch guard over setup/body/cleanup. residueControl in the socket-path file does not cover this file. Implementer6856d848 confirms no exemption; keep positive callback/custom/sync/lower-spawn refusal and post-cleanup zero-attempt verification (rule38).","file":"hub/test/fixture-orphans.test.ts","line":53}]
finding_counts: {"high":0,"medium":3,"low":0}

Full Standards/Spec source NOT CLEAR at9d3e0f00bcd38886a261d195d7ead4b3632dc840/tree92559af04116fd51348b658f38d0902737d48d9b, base1ae83dc7b. A-21720 consolidates3medium findings (Standards2/Spec1), no high/low. Shared allocation/root confinement, bounded16KiB reader, unsafe-global refusal, positive socket-path control and sealed Neovim project grant reviewed; source association and changed-callback ownership remain incomplete. Coordinator direct226cd522 keeps sourceCheckout correction in this item with join/no-traversal proof and field-reader census; product docs/hub/artifacts.md is an affected consumer. A-21718 corrects A-21714:126-file1291green T1 overlapped edits and is mixed-worktree, not fixed-head proof. Final lint straddled commit after content edits (0refusals/129report-only findings), finaltypecheck0 aftercommit; retained postcommitT2 15+11 and Coordinator-slot nativeT3 2+11+2+4 excerpts retain their stated scope, no skips. Native means isolated CLI/Git/headless Neovim; exact binary/per-invocation tree/platform/raw facts unknown where unretained. Consumer inventory remains qualified, source-association native scenario unproven. No configured/fullT3/Web/T4/QA/real-provider coverage claimed. C2/C3 failed; C1 remains done unverified; nothing verified. Hold released for consolidated bounded correction then fresh immutable-head source review before configured verification. Reviewer made no edits, runtime/probes, scans/generators or provider calls.

Criteria: C2 failed (Changed acceptance/control callbacks lack whole-caller fencing and joins, so cleanup/census can race late setup/body continuations.), C3 failed (The new forged-receipt orphan control has neither whole-caller setup ownership nor the required positive native-launch guard.).

### impl-1805 · 2026-11-19T10:44:31.876Z

Correction contract census before sourceCheckout: writer/reader helper shared/fixture-ownership.ts; writers CLI hub serve, nvim client and stub; process-selection reader hub/src/fixture-processes.ts via territory.ts, hub/merge-batch-territory.ts and hub/dev-t3-probe.ts. Direct fixture readers: fixture-orphans.test.ts, fixture-orphans-lifecycle.test.ts, fixture-socket-path.test.ts, fixture-socket-lifecycle.test.ts. Root/receipt raw QA readers found in qa/briefs/E-1535-stage-2.md and E-1537-stage-4.md parse roots only: new sourceCheckout is non-disposable and must not enter those removal inventories; existing historical receipt evidence remains historical. docs/hub/artifacts.md and shared test guidance will be migrated. New field is optional at version 1; previous local shape remains conservative (scratch matching only), global/unproven roots still refused. Rule-20 census will be retained with file/tier execution dispositions in correction evidence.

### impl-1805 · 2026-11-19T10:55:42.729Z

Consolidated sourceCheckout consumer inventory at correction head 74de1dbc3 (Coordinator226cd522):

Production read/write contract: shared/fixture-ownership.ts writes optional version-1 sourceCheckout, validates only lexical metadata (never traverses it); hub/src/fixture-processes.ts is its sole production semantic reader, only when authorized removal supplies worktree, with PID/birth and fresh association revalidation. Writers hub/src/cli/hub.ts, nvim/test/client.ts and nvim/test/stub-hub.ts now pass source separately, never in roots. Callers hub/src/territory.ts, hub/src/hub/merge-batch-territory.ts, hub/src/hub/dev-t3-probe.ts remain on the shared guarded removal function and require no separate parser.

Tests: fixture-socket-path (T2) adds source-associated join, positively controlled no-traversal + real guarded scratch removal, and previous-local-shape conservative regression; fixture-orphans (T2) migrates whole callers/setup seam to receiptFixtureCase and shared positive native guard; fixture-socket-lifecycle (T3) adds native source-associated join with script physically launched from separate synthetic checkout; fixture-orphans-lifecycle (T3) and nvim/client (T3) are preserved regressions. receipt-fixture-case.ts is an item-local helper; no independent tier. Runtime proof at final head is pending, not inferred from earlier candidate runs.

Cleanup/copy owners do not read sourceCheckout: shared/fixture-sockets.ts, hub/test/process-cleanup.ts, hub/src/suite-lock.ts and shared/fake-layout.ts keep directory traversal tied to owned scratch roots; copy filter excludes receipt storage entirely.

Docs migrated: docs/hub/artifacts.md, docs/agents/tests.md and file guides for fixture-socket-path, fixture-socket-lifecycle, fixture-orphans and login-add; index regenerated equivalently. docs/agents/tests/hub-test-merge-batch-dependencies.test.ts.md references shared guarded removal; behavior preserved, no field parser.

Historical QA references found (no current field parser, no per-item QA executed): qa/briefs/E-1532-stage-4.md, qa/briefs/E-1532-stage-6.md, qa/briefs/E-1533-stage-1.md, qa/briefs/E-1533-stage-2.md, qa/briefs/E-1533-stage-3.md, qa/briefs/E-1533.md, qa/briefs/E-1534-stage-1.md, qa/briefs/E-1534-stage-2.md, qa/briefs/E-1534-stage-3.md, qa/briefs/E-1534.md, qa/briefs/E-1535-stage-1.md, qa/briefs/E-1535-stage-2.md, qa/briefs/E-1535-stage-3.md, qa/briefs/E-1537-stage-2.md, qa/briefs/E-1537-stage-4.md. Raw roots parsers are E-1535-stage-2.md:300 and E-1537-stage-4.md:654; they continue inventorying disposable roots only and must ignore non-disposable association metadata. They refer to historical global-receipt residue and are retained as evidence, not rewritten into current receipts. No help/wire format changed; frozen cli-usage bytes unaffected. No frozen receipt JSON fixture was identified; previous-shape regression is generated in the T2 test.

Remaining T3/T4/Web beyond named targeted files are unexecuted here and deferred to configured selection/integrated occasions; no filenames borrow proof from another tier.

### rev-36 · 2026-11-19T11:30:08.004Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1805-source-2
commit: e3a6da7328555d66d5ad9ace1cec082d1fbbd781
scope: full
findings: [{"severity":"medium","text":"Here and at231, removeWorktreeWithFixtures starts outside owner admission; the original promise is awaited through step only after an earlier bounded entered/completed observation. If that observer/assertion fails, caller teardown does not join the detached removal; release only opens its gate, and146 has no immediate rejection handler. Implementer457f3530 confirms no omitted owner. Enroll both original sequences at production before observing intermediate receipts, immediately observe rejection and retain final awaits/assertions of those same owned promises (rules9/12).","file":"hub/test/fixture-orphans.test.ts","line":146}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source NOT CLEAR ate3a6da7328555d66d5ad9ace1cec082d1fbbd781/tree348089838cd1af639a92b7ca1694675662257877; A-21751. Three correction commits since9d3e0f00b, no dev merge. One residual medium original-work finding, no high/low or additional Spec finding. Prior source1 points otherwise resolved: separate optional sourceCheckout/all3writers, lexical no-traversal reader, fresh PID/birth/association selection revalidation, native source join and sentinel, positive actual guarded scratch/no-source-traversal control, previous local shape, migrated docs/census; receiptFixtureCase caller/signal fence and positive full native guard; login producer captures daemon stop and resource cleanup joins first child-disposal promise before guarded root removal. C1 clarification perCoordinatoreed0bb1f/226cd522 retained. A-21750 stream hashes/byte completeness checked; exact pinned T1 index232files/1924pass direct-phase retry, postcommit T2 11+17 and nativeT3 2+11+2+4pass, full static0/129report-only findings. Expected head/tree fields remain expected; session Git association and unknown Neovim binary/version are distinguished. Original same-head T1 code1/1917pass7fail remains failed,182325.090708ms; retry code0/1924pass165778.939375ms binds prior receipt/hash and positiveHOME perCoordinator500c560b, no speedup claim. Earlier1291mixed-tree distinct. No configured/runtimeWeb/Linux/fullT2T3/T4 proof. C2failed; C1/C3done unverified; nothingverified. Hold released for narrow two-sequence ownership correction then fresh exact-head source review before configuredverification. No Reviewer edits/runtime/probes/scanners/generators/provider/browser.

Criteria: C2 failed (Two rewritten orphan controls can leave their original removal work unjoined when an intermediate bounded observation/assertion fails.).

### rev-36 · 2026-11-19T11:44:35.101Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1805-source-3
commit: 48953e6a8e6685ed11d3c7ca3327775050bd136c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec SOURCE CLEAR at48953e6a8e6685ed11d3c7ca3327775050bd136c/treee05ab974ceade9bf0e83ec788cdc371c8b1d7e54; A-21757. Parent e3a6da732, no dev merge, exact one-file5+/4- correction. Both original removal operations enter step at production before intermediate observations, retain immediate rejection forwarding and final await/assertions on those same owned handles; normal/signal caller fence, releases and positive full native guard unchanged. Source2 residual medium resolved; prior source1 production/field/cleanup/docs/census corrections remain the reviewed basis in A-21751. A-21756 log hashes/bytes/completeness inspected: changedT2 11/11 incl exact2controls, all232pinnedT1 files/1924pass with no index gap, code0/signalnull/HOMEpositive; fullstatic0/129report-only. Expected head/tree fields remain expected, session Git association distinct. No speedup claim. A-21750 native/otherT2 at e3a remains prior-head evidence, failed7-case launcher-HOME attempt+orderedretry retained;1291mixed-tree earlier stays separate. No new native/Web/Linux/fullT2T3/T4/QA/configured proof at48953, actualNeovimbinary/versionunknown. Findings[]; C1/C2/C3 remain test-dependent unverified, no criterion verification. Hold released; Implementer may obtain Coordinator window for mode-free configured verification at exact cleanhead, final settlement awaits same-head named receipts/phases. Reviewer read-only source/log/metadata, no edits/runtime/probes/scanners/generators/provider/browser.

### rev-36 · 2026-11-19T12:44:44.114Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1805-evidence-1
commit: 48953e6a8e6685ed11d3c7ca3327775050bd136c
scope: evidence
findings: [{"severity":"medium","text":"Configured385be52a/A-21770 has44 literal ownership-refusal errors. Layers:27–31/palette:26–30 allocate valid scratch roots via mkdtemp+ownDirectory but no grant, then nvim/client:132 reaches the new strict guard. Missed legitimate producer migration breaks native coverage (literal errors47817–47820/47847–47850). Coordinator46293447 attributes this to T-1805: migrate allocation sites and complete caller/root census; keep guard strict.","file":"shared/fixture-ownership.ts","line":30},{"severity":"medium","text":"Ownership registration runs before serving with no refusal containment; nvim/test/stub-hub.ts:45–47 catches only permission/read-only errors. Coordinator46293447 requires root-local refusal to produce structured secondary diagnostics while the hub keeps serving, with positive control. QA INCONCLUSIVE/stdio-exit and later expectation failures remain distinct pending actual case stderr/SHELL-001 confirmation; do not infer all57 failures from44 refusal occurrences or invent receipt authority.","file":"hub/src/cli/hub.ts","line":329}]
finding_counts: {"high":0,"medium":2,"low":0}

Same-head configured evidence NOT CLEAR at48953e6a8e6685ed11d3c7ca3327775050bd136c,run385be52a-b01b-4030-abc1-9b061b6e8dbc/A-21770 exit1; A-21772 consolidates2medium/nohigh/low. A-21772 corrects only A-21771's T0 transcription: actual90.214s atlog106, not90.186s. All232T1/440T2/272T3filesfinished:937pass7fail; T0/T1/T2exit0,T3exit1,Web55filesunexecuted,T4unexecuted. Ordinary8769tests=8700pass57fail12skip plus30separateloadgatepasses; owner8799/8730 includesloadgate. No duplicate/unfinishedidentities. Own login/registration/source-association/previous-shape controls passed but failed round supplies no acceptance. Census-only loadgate is not repeatedlogin-bodycleanup. Literalerrors includeownershiprefusal atlayers103/palette51/shell316; QA SHELL001INCONCLUSIVE wait_for10000ms emptyGeneral connected /stdiohubexit1Node24.21.0 remains separate, actualstderrconfirmation stillneeded. Coordinator46293447/impl7aff59fa scope:allocation grants atproducers,strictguard unchanged,structured nonfatalhubrefusal+servingcontrol,completecensus,affectedNeovim/SHELL001 undernewslot,thenfreshsourcereview/newverifyall;laterexpectationclassesonlyassessedafterSHELL001. Provenance48610 exacthead/runtime treea18a6aa08cb2afff2d612b462b7833f0e4404909,uncachedLinuxx64Node24.21Nv0.12.5,c8ams3,3037539ms/$0.21094020833333332,browsernull.12skips areprerequisitesnotpasses;budgets/lint/tiernoticesreport-onlynotfailurecauses. C1failed;C2/C3unverified;nothingverified. Hold released for authorizedcorrection/diagnosis; retainfailed385be52a and all prior epochs,no blindresubmit. Reviewer read-only source/loginspection,noedits/runtime/scans/generators/provider/browser.

Criteria: C1 failed (The shared strict ownership contract has missed legitimate scratch-root producers; configured native Neovim consumers fail registration.).

### impl-1805 · 2026-11-19T12:59:04.941Z

Post-full-run consumer/root census before correction (Coordinator46293447; guard remains strict):
Registration writers: shared/fixture-ownership; CLI hub serve (hub/src/cli/hub.ts); nvim/test/client.ts receives caller project root, allocates a separate socket/account dir; nvim/test/stub-hub.ts self-registers cwd, also imported by nvim/test/qa-stub-hub.ts. Source selection readers/copy/removal owners unchanged from A-21750.
Missed raw allocated-project producers: nvim/test/layers.test.ts start; palette.test.ts start; shell.test.ts startShell (parent dir + proj-shell child); ui.test.ts start; graph.test.ts start; vboard.test.ts start; qa.test.ts tempDir (including direct startClient callback). These must grant at actual mkdtemp allocation, not inside createClient/ownDirectory for arbitrary caller paths. Graph/vboard were outside default full T1-T3 coverage if their manifest tier is T4; preserve tier and name any limited local controls.
QA: hub/src/cli/qa.ts runDir actually allocates the run root; Lua qa.build_fixture creates validated plain-name project children under it, or read-only stub fallback /var/empty or /. Its manually constructed Nvim env currently does not carry the sealed allocation grant. Use shared builder after overlays for actual allocated run root, and do not grant read-only fallback paths. QA cases are data under that root; qa-stub-hub imports stub receipt writer. nvim/test/qa-runner.ts outer CLI root already uses hub tempProject, but runQa allocates a different sibling root.
Already granted project factories: hub/test/harness.tempProject and nvim/test/fixture.tempProject; all remaining createClient/startClient call sites inspected by filename/root-helper searches are fed by those or the seven raw producers above. Account/socket-only allocations in nvim/test/client.ts and sessions-lifecycle.test.ts are not caller project registration roots. nvim-path.test.ts cache roots and web-graph-layout.test.ts render roots do not register fixture owners.
Web: web/test/harness uses hub tempProject; pairing passes that fixture.root to Nvim; readme checkout lies within its sealed outer scratch root; browser installer/prerequisite allocations do not register receipts. Recorder: hub/test/record-nvim-frames.ts owns output/account root and seals worker env; project root producers are the test factories above. Startup-budget support gets its subject root from fixture factories and seals it explicitly.
New nonfatal boundary must be shared by real CLI serve and stub, emit structured producer refusal metadata (unknown stays unknown), and preserve serving with no ownership grant/receipt for refused root. Add T2 refusal outcome control and real native serving control. No field parser/receipt root guard will be weakened. Actual QA primary stderr is not present in old A-21770 bounded hub detail: stdio SHELL-001 passed, stub variant disconnected, so old class2 linkage remains unconfirmed until explicit local checks; later expectations remain unattributed.

### impl-1805 · 2026-11-19T13:05:35.057Z

Nonfatal registration contract before implementation: introduce shared registerFixtureOwnership result (registered owner or refused diagnostic), used by real CLI hub serve and nvim/test/stub-hub (including qa-stub importer). Strict fixtureOwnership still throws for ungranted roots; diagnostics carry producer-selected reason/native code/cleanup diagnostics, never infer cause from message text. A guard refusal happens before receipt creation; initial write failures must close/unlink their just-created receipt before returning refusal. CLI/stub log the shared diagnostic and keep serving. createClient remains a strict consumer and is repaired only by actual allocator grants. Direct tests in fixture-socket-path will cover structured refusal and FD/receipt cleanup; fixture-socket-lifecycle adds real serving-after-refusal control. No stdout wire/help export change. New field/result consumers are these two server entry points, strict client and their tests; old version-1 receipt reader/roots shape unchanged.

### impl-1805 · 2026-11-19T13:14:07.613Z

Correction census update: two further raw allocated-project producers are hub/test/discord-workbench-fixture.ts project() and hub/test/telegram-marks-fixture.ts project(). Their actual owned mkdtemp roots now get grants before return; shared directory owners already retire discarded grants on disposal. Consumers include nvim/test/remotes.test.ts, nvim/test/telegram-marks.test.ts, web/test/remotes.test.ts, web/test/telegram-marks.test.ts, hub/test/doctor-remotes.test.ts and hub/test/telegram-marks-setup.test.ts. telegram-liveness-fixture.ts and host-create-fixture.ts already allocate via hub tempProject. Correcting my earlier conditional tier note: production readTierAssignments at this tree says graph.test.ts and vboard.test.ts are T2, not T4; neither is deferred as T4. Seven Neovim raw producer helpers plus these two shared helpers and QA's allocated runDir comprise the allocation correction. Full filename/tier dispositions will be retained with the next pinned evidence.

### impl-1805 · 2026-11-19T13:23:15.867Z

Observer epoch correction: eae4b2889 full lint/typecheck and all232 T1/1924 tests passed, but its first native serving control failed `incomplete structured registration refusal: exit pending, signal none` / `refusal diagnostic: not within 5000 ms` after discovery named the live child. No later native file ran. A-21784 preserves this failed/partial epoch plus 65-file consumer/tier census and exact commands/raw bounded logs. Native slot released. Commit34df63aaa arms a <=16KiB JSON-line observer inside the spawn producer, retains the producer's structured object and validates the whole schema/value before a separate real hub.status reply; no diagnostic-text cause inference. Repeating required full static/T1 before renewed native slot per Coordinatorc4ea479e.

### impl-1805 · 2026-11-19T13:40:33.841Z

ENV-001 producer correction consumer census BEFORE new channel use: CLAND_NODE readers are nvim/lua/cland/init.lua cli_command (ordinary value unchanged outside QA), nvim/lua/cland/qa.lua cland_cli and stub command (migrated to descriptor validation), hub/mod/cland/hooks/register.ts (launched harness values supplied separately by claude-code adapter, not the QA case shim), hub/src/adapters/claude-code.ts (writer per session), hub/test/fakes/claude-code/fake-claude.ts (exec-compatible path, no argument-shape assumption), nvim/test/explorer.test.ts explicit Node path (not QA projection), nvim/test/qa-cases/ENV-001.lua (unchanged allowed Node path), hub/test/mod-bridge.test.ts, claude-code-remote.test.ts and doctor.test.ts (synthetic launch/override records, unaffected). nvim/README.md updated with QA-specific condition. Historical stripping examples qa/briefs/T-270/T-271/T-272/T-276,E-423/E-424/E-425/E-426/E-468/E-579 remain isolation examples. No frozen CLAND_NODE bytes identified. New private descriptor/nodeDiagnostic reply is only QA CLI->qa.lua->QA CLI; ordinary CLI result fields unchanged, structured refusal forwarded on stderr. Optional before_spawn callback is passed qa.lua->init.lua->hub.lua for repeated stdio attempts; absent callback preserves previous client shape. Six introduced generated keys (OWNED_ROOT, HOST_SOCKET_ROOT, EXECUTOR_STATE and three API roots) are removed only by qaCaseEnvironment; ordinary fixture/runner/host consumers keep fixtureEnvironment unchanged. Pure positive-control red/green shows no new CLAND key in the case projection; native ENV-001 remains unchanged and pending.

### impl-1805 · 2026-11-19T13:52:35.090Z

Final local correction at854cb29d3525cbd2cbb8893b0c9c46d788ca3ecb/tree2eb45474c32b1501037844f3955326e61c8b8262 pushed local origin, clean before/after checks; no post-first-review dev merge. A-21806 retains full lint0 (129report-only/0refusals), full typecheck0, all232T1/1925pass, five selectedT2 files/73pass, eleven selectedT3/102pass, all0fail/skip/cancel. Local darwinarm64Node24.21, actual Nvim binary/version not independently captured; browsernone. Full QA30 includes unchangedENV-001, positive stdio/stub receipt, four missing/tampered not-started controls. Native slot released; no more local run. Census includes65client files and76six-key consumer matches with tiers/dispositions; CLAND_NODE/private descriptor/callback consumers and historical/frozen readers listed. Prior failed epochs A-21781/A-21782/A-21784/A-21803 and configuredA-21770/A-21772 remain retained at original scope, no failed proof admitted. C1 re-marked done; C2/C3 done preserved. Request fresh full source review next, then Coordinator submits authorized fullverifyall after clear; no per-itemQA brief/policy requirement (scope none/after-stage).

### rev-36 · 2026-11-19T13:59:12.063Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1805-source-4
commit: 854cb29d3525cbd2cbb8893b0c9c46d788ca3ecb
scope: full
findings: [{"severity":"medium","text":"Standards M1: the five new native QA callbacks (also lines 122–137) use raw TestContext without a pre-acquisition whole-caller normal/signal fence/join or separate setup bound. qa-runner.ts:16–26 awaits tempProject before spawn/process ownership; tamper cases also await raw tempDir/writeFile. Resource hooks do not join the remaining caller continuation, so late setup/write/launch can escape teardown. Implementer a1f7b0fe confirms no omitted owner or approved disposition. Own/fence/join the original sequences and late acquisitions while preserving exact positive receipt, refusal/not-started and final assertions.","file":"nvim/test/qa.test.ts","line":113}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source NOT CLEAR at 854cb29d3/tree2eb45474c32b1501037844f3955326e61c8b8262; A-21807. One medium Standards finding, no additional Spec/high/low finding. Three actual correction commits since 48953e6a8, no dev merge, clean. Nine allocator grants preserve strict registration and separate sourceCheckout authority. Structured optional refusal/initial-write cleanup and native serving-after-refusal control match Coordinator scope; producer object observed before startup tail displacement, exact-PID discovery, real status response and native exit0 retained. QA sealed projection, fixed-root shim/preload, pinned argument descriptor bytes/identity before fixture CLI and each stdio attempt, read-only no-grant fallback, positive stdio/stub persisted receipts and exact missing/tampered not-started controls reviewed positively. This is the approved accidental mismatch boundary, not an OS exec fence. Matching docs/censuses read; ENV-001 unchanged, ordinary stdout/wire unchanged.

A-21806: all 38 log hashes match declared values; T1 command exactly all 232 pinned files, 1925 pass; selected five T2/73 and eleven T3/102 pass, QA30 includes five new controls. Full lint/typecheck code0/signalnull, 129 report-only findings/zero refusals. Local darwin arm64 Node24.21, expected head/tree plus separate clean readbacks, actual Neovim binary/version unknown; no browser/real providers/cloud. Remaining tiers/new configured Linux proof unexecuted. Prior A-21770 remains failed/partial, 44 ownership refusals separate from other QA failure classes; A-21772 corrected T0 90.214s and all earlier failed/precommit epochs retained. C2 failed, C1/C3 done unverified, nothing verified. Hold released for bounded caller-ownership correction; fresh pinned source review before Coordinator's new verify all. Reviewer read-only inspection only, no edits/tests/probes/scans/native/browser/delegation.

Criteria: C2 failed (The five new QA callbacks lack whole-caller setup/cleanup ownership and a separate setup bound, allowing late allocation/write/launch to escape teardown despite passing normal local runs.).

### impl-1805 · 2026-11-19T14:02:38.298Z

Source4 lifetime correction census before helper option use: qa-runner.ts has only qa.test.ts and qa-shipped.test.ts importers (repo-wide qa-runner search). Added optional rootAllocated callback immediately after actual tempProject acquisition and before env/spawn; existing callers omit it and remain unchanged, no result/wire field change. Five new callbacks only enter existing receiptFixtureCase pre-acquisition normal/signal owner. An item-local ownedQa enrolls the original qa() promise before separate native-ownership setup observation, immediately handles rejection and retains the same final completion. Actual late roots adopt into the guard; close before root completion refuses launch, and a known child is signalled through its observed handle before joining. Tamper dir/script/wrapper each use named setup steps. Exact positive receipt/refusal/not-started assertions preserved. QA file guide updated; no helper-wide migration or tier/config change.

### impl-1805 · 2026-11-19T14:09:21.993Z

Source5 final evidence A-21809 at16369c145dd69171e6e7cd5cf6ade3327f3b0b22/treeaba17086f9b5880ae719e3150f0e4c88b55b20fe. Full lint0 (129report-only/0refusals), full typecheck0, all232T1/1925pass, QA T3 whole30 and ownershipT2 11+19, all0fail/skip/cancel/code0/signalnull. Localdarwinarm64Node24.21, Nvim actualbinary/versionnotindependentlycaptured, browsernone. Three-file lifetime correction only; C1/C2/C3 done, no criterion verification claimed. Source review accepted byrev-36; worktree/experiments held fixed. Coordinator owns subsequent fullverifyall. OlderrawQA callback migration is T-2007. Prior broad854/local/configuredfailed epochs stay separate; no borrowed proof. Native slot released.

### rev-36 · 2026-11-19T14:12:48.924Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1805-source-5
commit: 16369c145dd69171e6e7cd5cf6ade3327f3b0b22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at 16369c145/treeaba17086f9b5880ae719e3150f0e4c88b55b20fe; A-21811. Sole parent854cb29d3, exactly three correction files, clean, no dev merge. Source4 M1 resolved: all five new callbacks enter receiptFixtureCase before acquisition; named tamper setup steps, original QA operation admitted before its separate native-ownership observation, immediate rejection forwarding and final await of the same operation. Actual qa-runner root is adopted before env/spawn; closure refuses a late launch and stops a captured live child through its observed handle. Shared owner fences before release, retains original pending work behind bounded observations, joins caller/resources before cleanup, retains roots on incomplete join. Positive receipt and exact structured refusal/not-started/final assertions unchanged. Native T3 branch is intentional; no fake guard required for real QA lifecycle.

Optional rootAllocated hook consumers checked: qa.test and qa-shipped only; omitted default unchanged, qa-shipped T4 deferred. File guide updated. Prior allocator/strict guard/structured serving refusal/fixed-root QA channel/sourceCheckout/ENV-001 implementation from A-21807 unchanged. Remaining older caller-family work is separate T-2007, not claimed complete.

A-21809 read-only audit: 12 stream hashes match; all232 pinned T1 files exactly/1925pass, QA T3 whole30pass including five controls, selected T2 11+19pass; all0fail/cancel/skip/code0/signalnull. Full lint/typecheck0,129 report-only findings/zero refusals. Local darwin arm64 Node24.21, positive HOME and start loads below4; expected head/tree plus clean readbacks, actual Neovim binary/version unknown, browser none. Broader T2/T3/T4/Web/new configured Linux proof unexecuted. A-21806 broad854 receipts and all earlier configured/local failures remain separate. Findings[]; C1/C2/C3 unverified by source, hold released for Coordinator-owned new exact-head verify all. Any changed head needs review. Reviewer read-only inspection only; no edits/runtime/scans/generators/native/browser/delegation.
