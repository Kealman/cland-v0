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
updated: 2026-11-19T11:44:35.101Z
---

## Summary

After `hub/test/login-add.test.ts` runs, its private TMPDIR keeps one fixture-owner registry JSON. Its `roots` list holds a removed `/tmp/hc…` fixture root and the live worktree of the source under test, which isn't a scratch root (checked with realpath). No deletion was observed. But any later owner-driven cleanup that trusted this registry could reach the live worktree, so a fixture registry must never name a non-disposable path.

## Evidence

Found by impl-1778 during T-1778's native slot at 1cba8d79c, 2026-11-10 12:18Z, topic-1461. The registry and both referenced paths were left untouched. All CLI and hub operations logged disposable project roots.

## Acceptance criteria

- [x] C1. The login-add fixture registers only roots it allocated under its scratch root, and the source worktree never appears in a fixture-owner registry's disposable roots. A separate non-disposable `sourceCheckout` field may name it only for PID- and birth-bound process selection during an authorized source-worktree removal (test).
  - done: impl-1805 · 2026-11-19T11:25:28.671Z
- [x] C2. The registry is removed, or marks every root released, once the file's cleanup has joined; a TMPDIR inventory after the file reads 0 → 0 (test).
  - done: impl-1805 · 2026-11-19T11:42:40.353Z
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
