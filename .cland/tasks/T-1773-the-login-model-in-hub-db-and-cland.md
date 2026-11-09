---
id: T-1773
kind: task
title: The login model in `hub.db` and `cland login list`
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by: []
topic: topic-1453
branch: t/T-1773-the-login-model-in-hub-db-and-cland
created: 2026-11-09T12:44:08.406Z
updated: 2026-11-09T15:20:17.029Z
closed: 2026-11-09T15:20:17.029Z
---

## Summary

A login becomes a row in `hub.db` with its name, harness, account, kind (`disk` or `key`), `exclusive`, provider, region, volume id, snapshot ids, state (`creating`, `ready`, `in-use <host>` or `signed-out`) and last sign-in. `cland login list` (frame `login.list`) shows every field, for the local human CLI or Neovim only. No login is created here; later tickets write rows through this store.

## What to build

A login store beside the host records, with a `logins` table and a `login_bindings` table (login, host, writer or reader, volume id), so that an in-use login names its host and a non-exclusive login can later name its readers. The store validates transitions:
- `creating` to `ready` or `signed-out`;
- `ready` to `in-use`, and `in-use` back to `ready` or to `signed-out`;
- `signed-out` to `creating` (signing in again), then `ready`.

A `creating` login is never free and never bound. Names are lowercase, `[a-z0-9][a-z0-9-]{0,31}`, unique in the project. The harness is `claude-code`, `codex` or `opencode`. A key login has no volume, no snapshot ids and no `exclusive`; a disk login's `exclusive` defaults to true. `cland login list [--json]` shows name, harness, account, kind, exclusive, state with its host, region, volume, snapshots and last sign-in; the capacity line is T-1787's. Every `login.*` frame is refused from a session, the web and the remotes, as the `host.*` frames are. The user-level accounts registry is neither read nor changed.

## Acceptance criteria

- [x] C1. A disk login row and a key login row round-trip through `hub.db` with every field, and the key login row holds no volume, no snapshot ids and no `exclusive` (test).
  - done: impl-1773 · 2026-11-09T12:55:09.089Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1
- [x] C2. Each invalid transition is refused naming the current state, and a `creating` login is reported neither free nor bound (test).
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - done: impl-1773 · 2026-11-09T13:28:02.054Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1
- [x] C3. `cland login list` and `cland login list --json` show name, harness, account, kind, exclusive, state with its host, region, volume id, snapshot ids and last sign-in for a disk login and a key login (test).
  - done: impl-1773 · 2026-11-09T12:55:11.122Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1
- [x] C4. A login name outside the syntax, a duplicate name and an unknown harness are each refused naming the rule (test).
  - done: impl-1773 · 2026-11-09T12:55:13.701Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1
- [x] C5. `login.list` from a session, the web or a remote is refused as `host.list` is, and `cland login --help` lists `list` (test).
  - done: impl-1773 · 2026-11-09T12:55:17.999Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1
- [x] C6. Login rows and bindings survive a hub restart unchanged (test).
  - done: impl-1773 · 2026-11-09T12:55:20.620Z
  - verified: rev-35 [reviewer] · run rev-35-1773-final-1 · 2026-11-09T13:27:49.637Z · commit 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
  - verified: rev-35 [reviewer] · run rev-35-1773-final-2 · 2026-11-09T14:30:31.363Z · commit b320aef39d76da1fa0bd76cc010c00bb6bf636a1

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/logins.ts` (new), `hub/src/host/records.ts` (constructs the store), `hub/src/cli/login.ts` (new, a subcommand table), `hub/src/cli/usage/login.ts` (new). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`, `hub/src/hub/web-authority.ts`, `hub/src/cli/help.ts`, `hub/bin/cland.ts`.
- Tests: new `hub/test/login-records.test.ts` (T1, in-memory SQLite); new `hub/test/login-list.test.ts` (T2, `projectHub`).
- Serves epic C1.

## Comments

### impl-1773 · 2026-11-09T12:48:16.335Z

Rule 20 sweep before login.list registration: A-18043 lists all 916 catalog tests via shared importingTests graph, 678 reached plus 15 unknowns treated reached. A-18044 lists explicit field/frame/function consumers across production, clients, skills, QA, probes and every test tier. Additive login.list does not alter any old frame or host/store row shape; old host.list deep equals and recorded Neovim frames remain unchanged. New readers: login CLI and forthcoming epic login lanes through hosts.logins. Existing consumers require no migration because no old field changes. Registration-only changes: one login.list union/validator entry, one shared host dispatch case plus result, one web authority entry, one help command registration; CLI executable adds login routing.

### impl-1773 · 2026-11-09T12:54:58.485Z

Implementation ccd9f10d2: registration-only additions in hub/src/protocol.ts, shared/wire/index.ts, hub/src/hub/dispatch.ts, hub/src/hub/web-authority.ts, hub/src/cli/help.ts, hub/src/cli/usage.ts, hub/bin/cland.ts and hub/test/fixtures/cli-usage/{commands.json,exports.json,help.txt}. No old frame shapes changed; wire conformance typechecks. Neovim regeneration completed 6057 frames and left no tracked fixture diff. Locked catalog consumer rerun is pending. Public API lives in docs/hub/logins.md#store-api. A-18051 records red/green evidence; final targeted local macOS receipt is 57/57 tests, no browser, no full suite. Typecheck hub passes; tiers lint passes; test lint reports existing findings with zero refusals. Stage QA is after-stage; per-test guides committed.

### rev-35 · 2026-11-09T13:00:15.486Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1773-source-1
commit: ccd9f10d2c702080ba280e449ac4117282be1f6b
scope: full
findings: [{"severity":"medium","text":"Standards/lifecycle (rule12): authority fixture opens its second borrowed Store then seeds rememberSessionCredential and closes only on the happy path. A seeding exception bypasses close before shared hub/root teardown; no earlier owner exists (author confirmed). Prearm close or use try/finally immediately around the borrowed handle, preserving authority assertions.","file":"hub/test/login-list.test.ts","line":44},{"severity":"medium","text":"Spec/C2 decision b7be8fe7: addBinding permits null disk volumes, a writer on a volume different from login.volumeId, or a reader on the original volume. Coordinator explicitly assigns these metadata invariants to this store now: typed refusal/no partial write and one regression per invariant. Preserve key-null/exclusive/single-writer rules; provider existence/attachment and reader snapshot provenance remain stage2, not required here.","file":"hub/src/host/logins.ts","line":64}]
finding_counts: {"high":0,"medium":2,"low":0}

NOT CLEAR,Standards1medium/Spec1medium,A-18061. Author confirms borrowed Store seeding failure leaks; prearm/finally close. Directly read Coordinatorb7be8fe7: disk binding non-null,writer volume equals original,reader differs; typed/no-partial-write regressions now,provider attachment/provenance stage2. Other transition/list/local authority/help source consistent; C1/C3–C6 runtime-unverified. A-18054 raw57pass/A-18060 provenance inspected; typecheck output lacks independent native exit despite static final0,candidate/no-start-tree and transcript-red limits retained. Locked catalog proof pending; initial regeneration not evidence. Fresh source request before verify; full batch/T4/after-stageQA separate. No Reviewer execution.

Criteria: C2 failed (Store accepts incoherent disk binding volumes; Coordinatorb7be8fe7 requires typed refusal and no partial write for metadata-level invariants now.).

### impl-1773 · 2026-11-09T13:01:57.501Z

Source review 1 corrections (decision b7be8fe7): six per-invariant tests shown red (native exit 1) before typed LoginBindingRefused metadata guards; all 21 login store/list tests now green (native exit 0). Key null, disk non-null, writer-original, reader-clone, exclusive single-writer and single writer are enforced before writes. Native provider existence/attachment/snapshot provenance remain stage 2. Borrowed Store cleanup now uses try/finally. New refusal contract consumers: LoginRecords binding callers, login-records typed code regressions and docs/hub/logins.md; no old wire shape or consumer changed; full sweep remains A-18043/A-18044. Locked catalog proof A-18063 completed before correction on ccd9f10d2: native exit 0. Its generated catalog sampling delta concerned task-view fixture inputs, not login frames; discarded own unrelated generated delta after inspection (old catalog retained). No verification yet; fresh source review follows corrected commit.

### rev-35 · 2026-11-09T13:04:17.731Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1773-source-2
commit: 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR,Standards0/Spec0,A-18071. Six decided metadata invariants now throw actual exported LoginBindingRefused/code before insert; six separate no-partial-write regressions and Store finally fix close source1. Native existence/attachment/provenance stage2. Original six-red/21green/typecheck separate0 A-18068/69/70 inspected with candidate/no-start-tree limits. A-18063 locked6060-frame/live-attach receipt remains prior-head schema-compatible preservation,not current-head run; generation-only first run and restored sampling delta qualified. AllC1–C6 runtime-unverified pending mode-free exact-head Linux verification and actual normalized consumer/catalog-path reconciliation. No Reviewer execution; fullT3 batch/T4/full after-stageQA separate.

### impl-1773 · 2026-11-09T13:26:43.538Z

Final evidence reconciliation A-18091: 59b10e46 at reviewed7d853ceed completed T0/T1/all fallbackT2/Web,5738passed,0fail/skip/cancel;450 graph-reached lower/Web paths +2new login files=452 required files observed. All21 new generated cases passed base and5/5 load. Droplet Linuxx64 6.8.0-147-generic,Node24.21.0,Neovim0.12.5,Chrome Headless Shell1248/Google Chrome for Testing156.0.8078.4; lifetime1060s,cost$0.0736; budgets/lint report-only. Of49 Neovim catalog consumers,40 have ordinary same-head receipts;9 have recorder-only A-18063 on precedingccd9f10d2. Coordinator9b18fbd0 explicitly accepts this carry:6T3 consumers ordinary-run in merge-queue fullT3Linux before landing,3T4 consumers at stage/epic. No extra native slot. Full after-stageQA remains separate; no T3/T4 task pass claimed. Pending Reviewer final settlement; no source changes.

### rev-35 · 2026-11-09T13:27:49.637Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1773-final-1
commit: 7d853ceed707ae37a8b3a0ae42bc1e2fa046cfcc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR,C1–C6 verified,A-18094. Independent exporttreec247c82ff5aa56eaa2dcdc32d87fd1df51ab19f3/clean tip; fresh59b10e46/A-18087 5738/5738 zero fail/cancel/skip. All21new identities base+5distinct load passes each,both file completions. All450 graph lower/Web+2new files=452 have passing cases AND file finishes. Catalog49 independently split40ordinary same-head and9recording-only prior-headA-18063; directly read Coordinator9b18fbd0 explicitly accepts those9,no extra slot,sixT3 ordinary replays in fullLinux batch before landing and3T4stage/epic. No recording-as-ordinary claim. Source/provenance/masked-earlier-status/report-only limits retained. Standards/Spec0 outstanding; provider-native checks stage2; full after-stageQA separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1773 · 2026-11-09T14:06:04.517Z

Batch54fadfec at1a8c0b1 failed cli-imports.test.ts:120: the command-help split has a fixed import cost,38!==37. Reproduced at reviewed7d853ceed locally under preservation lock (native exit1, named case); changed only fixed pure help count37→38 with explicit login-module reason, implementation budgets unchanged; full cli-imports.test.ts passed native exit0 (3tests). Rule20 CLI usage consumer list now explicitly includes hub/test/cli-imports.test.ts (T3) plus its guide docs/agents/tests/hub-test-cli-imports.test.ts.md, docs/agents/tests/hub-test-cli-usage-merge.test.ts.md and docs/hub/the-cland-cli.md; sweep for helpModules/pure-command-help/fixed-import-cost found those stale count claims and migrated them. Login usage module stays pure with no imports. No dev merge; fresh delta review/verification will follow.

### rev-35 · 2026-11-09T14:08:16.476Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1773-delta-1
commit: 80df3ba2635c44701dab1b6a3e4f0c76a4835d99
scope: delta
findings: [{"severity":"low","text":"Docs consistency: the-cland-cli.md still says cli-imports asserts37help modules immediately below the new38module claim. Author confirms this is current prose missed by the migration,not a historical exception. Update to38; distinguish/refresh the old observed40/52/57 totals using retained A-18105 actual41/54/55 if rewriting that paragraph,without changing implementation budgets10/17/21.","file":"docs/hub/the-cland-cli.md","line":11}]
finding_counts: {"high":0,"medium":0,"low":1}

Source CLEAR with1low prose remainder,Spec0,A-18106. Coordinator53e25832-approved fixed-count37→38 justified by pure login usage module; nonhelpbudgets10/17/21,allowedimports/error controls unchanged. A-18104 oldhead38!=37red/A-18105 full3/3green inspected,originalcommands/native status/source limits retained. Low docs sentence still says37; author will correct prose and refresh observed totals toactual41/54/55. New prose head needs fresh source review before mode-free verify,no extra native/provenance rerun for it. AllC1–C6 current runtime-unverified; oldA-18094 remains oldhead proof,catalogsplit unchanged. Fullbatch/T4/afterstageQA separate;no Reviewer execution.

### rev-35 · 2026-11-09T14:09:09.082Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1773-delta-2
commit: b320aef39d76da1fa0bd76cc010c00bb6bf636a1
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR,Standards0/Spec0,A-18110. Prose-only diff corrects37→38and actual41/54/55measured totals; native/source/test and budgets10/17/21unchanged. Low A-18106 closed. Original nativeA-18105 full3green preserved, no provenance/native repeat needed for prose. AllC1–C6 current-head runtime-unverified pending fresh prescribed mode-free verify; priorA-18094 oldhead remains qualified. Catalogexplicit9b18fbd0split unchanged; fullT3batch/T4/afterstageQA separate. Clean head;no Reviewer execution.

### impl-1773 · 2026-11-09T14:29:51.889Z

Corrected-head verificationd891a277 atb320aef39 passed5741/5741,0fail/skip/cancel. T0/T1/all fallbackT2/Web and changedT3 cli-imports(3passing cases,onebase,no repetitions) exit0. A-18111 full log; A-18112 reconciliation proves453required file finishes/case receipts and all21login cases base+5/5each. Linuxdroplet,x64,Node24.21.0,Neovim0.12.5,ChromeHeadlessShell1248/Google Chrome for Testing156.0.8078.4;uncached verification treeb47032a8. Budgets/lint report-only. No fullT3/T4 pass:remainingT3 merge batch,3T4catalog stage/epic and full after-stageQA separate. Native local full cli-imports3green A-18105 carried across prose-only delta;40catalog ordinary same-head now refreshed,9recording-only acceptance remains Coordinator9b18fbd0. Source and tree clean; final Reviewer settlement pending.

### rev-35 · 2026-11-09T14:30:31.363Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1773-final-2
commit: b320aef39d76da1fa0bd76cc010c00bb6bf636a1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final CLEAR,C1–C6 verified,A-18113. Freshd891a277/A-18111 at exactb320aef head/treeb47032a8a3cbe47b52fc60d09d4a59702076970d independently matched; clean tip,5741/5741 zero fail/cancel/skip. All21login identities base+5distinctload each; changedcli-imports3base cases/file pass. All452lower/Web+1changedT3=453required consumers have passing substantive cases AND file finishes. Oldbatch38!=37failure fixed,purehelp38/implementation budgets unchanged. Catalog40currentordinary+9priorrecording-only retain directly read9b18fbd0acceptance,defer6T3fullLinuxbatchbeforelanding/3T4stageepic. NativeA-18105/status/source/report-only limits preserved. Standards0/Spec0; fullafterstageQA separate;no Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1773 · 2026-11-09T15:20:14.771Z

Successful merge batch fb66392b at integrated441684aa (A-18131/A-18128) completed T0/T1/T3 exit0,3610pass/8skip. Six deferred ordinary catalog T3 files have positive passing file finishes:explorer2pass,layers4,palette5,qa22pass/3skip,shell25,ui10. This is integrated batch evidence; no task-head rerun or new T2/Web execution claim. T2/Web interaction is report-only selection. Three T4catalog and full after-stageQA remain separate. Linuxx64 Node24.21.0 Neovim0.12.5 droplet c-8lon1 lifetime2075s cost$0.1441. No source changes.

### coord · 2026-11-09T15:20:17.029Z

Merged bc2d5bd6ff2e1720ccdfcb132245b9f2ec0481f9 onto dev.
