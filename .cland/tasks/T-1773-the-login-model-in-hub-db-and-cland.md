---
id: T-1773
kind: task
title: The login model in `hub.db` and `cland login list`
state: open
status: review
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
updated: 2026-11-09T13:04:17.731Z
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
- [ ] C2. Each invalid transition is refused naming the current state, and a `creating` login is reported neither free nor bound (test).
  - failed: rev-35 [reviewer] · 2026-11-09T13:00:15.486Z · note Store accepts incoherent disk binding volumes; Coordinatorb7be8fe7 requires typed refusal and no partial write for metadata-level invariants now.
- [x] C3. `cland login list` and `cland login list --json` show name, harness, account, kind, exclusive, state with its host, region, volume id, snapshot ids and last sign-in for a disk login and a key login (test).
  - done: impl-1773 · 2026-11-09T12:55:11.122Z
- [x] C4. A login name outside the syntax, a duplicate name and an unknown harness are each refused naming the rule (test).
  - done: impl-1773 · 2026-11-09T12:55:13.701Z
- [x] C5. `login.list` from a session, the web or a remote is refused as `host.list` is, and `cland login --help` lists `list` (test).
  - done: impl-1773 · 2026-11-09T12:55:17.999Z
- [x] C6. Login rows and bindings survive a hub restart unchanged (test).
  - done: impl-1773 · 2026-11-09T12:55:20.620Z

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
