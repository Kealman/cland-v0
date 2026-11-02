---
id: T-1628
kind: task
title: The human inbox rebuild scans the whole message history every 250 ms under load
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-1334
branch: t/T-1628-the-human-inbox-rebuild-scans-the-whole
created: 2026-11-02T06:14:53.348Z
updated: 2026-11-02T10:20:58.019Z
closed: 2026-11-02T10:20:58.019Z
---

## Summary

With a busy crew the live hub spends most of its CPU rebuilding the human inbox: `Inbox.#changed` re-runs `list()` every 250 ms while traffic arrives, and `list()` runs `Store.inboxMessages()`, whose candidate scan grows with every unread agent message in every topic and every `request` row ever written. CLI calls (`verify queue`, `verify` submissions) then miss their 15 s reply deadline (exit 75) and QA admission loops stall.

## Evidence

Live hub pid 97875 (restart #68 code), 2026-11-02 06:15Z, 13 implementers + QA, load ~11: 91 % CPU, `verify queue` 4–7 s with peaks over 15 s. An 8 s inspector CPU profile (SIGUSR1, 0.5 ms sampling, 2537 samples) shows inclusive time `inbox.ts:630` (the `#changed` timer) → `Inbox.list` 57 %, `Store.inboxMessages` 43 %, `toMessage` 6.6 % self. Profile script and output: coord session tmp `prof/prof.mjs`.

## What to build

The inbox rebuild costs time proportional to what can change, not to the message history:
- `inboxMessages()` candidates are bounded: the request branch reads only unsettled requests through an index (or a maintained set), and the unread-agent branch does not rescan a topic's whole unread tail on every rebuild (for example an index on `(topic, seq)` with `from_kind`/`notice` filters, or incremental candidate maintenance on message insert, read and reply).
- `#changed` skips the rebuild when nothing inbox-relevant changed since the last publication (message inserts that cannot be candidates, presence or usage events), instead of rebuilding on every event.

## Acceptance criteria

- [x] C1. A store with 50,000 messages across 200 topics, 5,000 of them unread agent messages in one topic and 2,000 settled requests, returns from `inboxMessages()` exactly what the current query returns, its query plan scans no full `messages` table, and the candidates visited stay bounded as history grows (test); the measured timing is recorded as evidence, not asserted.
  - done: impl-1628 · 2026-11-02T07:11:09.911Z
  - verified: rev-35 [reviewer] · run rev-35-1628-final-1 · 2026-11-02T07:48:51.439Z · commit 6ea37158e6a2c35717bc043f0131f28f8f321db6
- [x] C2. A burst of 1,000 progress and event messages that cannot become inbox candidates triggers at most one inbox rebuild, and no `inbox` emit when the published inbox is unchanged (test).
  - done: impl-1628 · 2026-11-02T06:46:22.760Z
  - verified: rev-35 [reviewer] · run rev-35-1628-final-1 · 2026-11-02T07:48:51.439Z · commit 6ea37158e6a2c35717bc043f0131f28f8f321db6
- [x] C3. Every existing inbox, ask, approval and request-departure test passes with no test edited.
  - done: impl-1628 · 2026-11-02T07:27:13.338Z
  - verified: rev-35 [reviewer] · run rev-35-1628-final-1 · 2026-11-02T07:48:51.439Z · commit 6ea37158e6a2c35717bc043f0131f28f8f321db6
- [x] C4. Any new index is created in place on an existing `hub.db` at start, and a hub started on a copy of a large fixture database serves `hub.status` within its normal start deadline (test).
  - done: impl-1628 · 2026-11-02T06:32:36.274Z
  - verified: rev-35 [reviewer] · run rev-35-1628-final-1 · 2026-11-02T07:48:51.439Z · commit 6ea37158e6a2c35717bc043f0131f28f8f321db6

## Comments

### impl-1628 · 2026-11-02T06:22:37.685Z

Consumer inventory (rule 20): Store.inboxMessages has one production caller, InboxBoard.list (hub/src/hub/inbox.ts). Searched hub/src AND hub/test by method, inbox.list, inbox.observe, inbox.refresh; additionally searched web, nvim, qa, .agents/skills, docs. Public Inbox wire shape and rows remain unchanged, so dispatcher/CLI, remote Telegram/Discord cards and commands, web/nvim inbox projections, shipped skills/QA briefs and older-client regressions are unaffected. Existing inbox/ask/approval/request departure files stay unedited. New fixture preserves pre-change SQL as independent oracle. Baseline red: 95.29 ms full read; irrelevant burst mutation control red: 11 rebuilds. Latest candidate run cold 47.26ms, warm median 37.96ms (5 samples), legacy synthetic migration + hub.status 1.87s, local darwin Node24.21; full verification not run yet.

### impl-1628 · 2026-11-02T06:31:44.714Z

Coordinator decision ff38f3e0: no broader remote run; run relevant unchanged T3 locally <=2 at once/load<=10 before ready. Exact rg search returns 99 T3 because 'ask' also matches 'task'. Semantic inventory narrows to inbox-requests, approval-restart, suite-timeouts (cleanup warning), codex-adapter, claude-code-adapter, opencode-adapter (approval lifecycles), rule-sessions (retirement inbox), default-subscriptions-lifecycle, visibility, cli-identity, worktree-cli (ask answer), scenarios/remotes (ask cards/departures), cli-imports (inbox/answer commands), config-reload (inbox idle setting), init (inbox visibility config). Other 84 matches are task-related substrings, comments ('asking'), capability stubs, routing wording, or runner selection/config facts with no exercised inbox/ask/approval/departure path. T0–T2/Web still through mode-free verify after clear source review; remaining T3 in merge batch.

### rev-35 · 2026-11-02T06:37:12.784Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1628-source-1
commit: aa1fce13ee25cff46d567de527916b1ea9f8d219
scope: full
findings: [{"severity":"medium","text":"Skipping only the original progress/event frame does not bound real progress traffic: sendFromSession in a non-Agents topic also emits a hub 'agent-message' mirror (core.ts:3654), which falls through to #changed on every publication window although it cannot be an inbox candidate. The burst test calls board.observe directly and omits that production side effect. Exercise the real core/dispatch mutation path and suppress irrelevant companion events while retaining relevant topic/ask/approval invalidation.","file":"hub/src/hub/inbox.ts","line":196}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear, one medium. inbox.ts:196 filters original progress/event only; core.ts:3651–3658 mirrors agent-to-agent progress from other topics into Agents as hub kind agent-message, and those irrelevant companion messages still fall through to #changed every window. The new test directly calls board.observe with to:[] and omits the real mutation path. Add a core/dispatch multiwindow burst regression and skip only irrelevant companion events, retaining meaningful topic/ask/approval invalidations. SQL/index/request-set candidate changes otherwise preserve the independent old oracle in inspected cases. A-15667 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15667-t-1628-source-review-at-aa1fce13e.md) records the exact source chain and limits. C2 failed, C1/C3/C4 unverified; local4/4/timing/static claims are not queued/Linux evidence, C3 preservation receipts pending. No reviewer tests/browser/live DB reads. Fresh corrected-head source review required before verification.

Criteria: C2 failed (Real non-Agents progress sends also emit irrelevant agent-message mirror notices, which still schedule repeated inbox rebuilds; the direct-observe test bypasses them.).

### rev-35 · 2026-11-02T06:48:15.222Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1628-source-2
commit: d9f445e306727f3d6f7493d8971d46db1d328f77
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at corrected authoritative head d9f445e306727f3d6f7493d8971d46db1d328f77; no findings. Prior C2 issue resolved by excluding noncandidate hub agent-message mirrors and replacing the direct observer test with 1000 real spoke sends, persisted source checks, all actual companion frame receipts, traced rebuild/emit counts and a durable human-review positive control. Rate/loop policies remain enabled; meaningful topic/ask/approval paths stay active. Measured E-880 legacy duration allowances have reasons and dates within D72; C1/C4 assertions unchanged. SQL/index/request-set changes unchanged. A-15675 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15675-t-1628-corrected-source-review-at-d9f445e30.md). C1–C4 remain unverified; C3 still incomplete pending its unchanged native receipts. Reviewer ran no tests/browser/live DB read. Reported local red51/green0/static checks are not queued/Linux evidence. Final evidence requires named same-head queued outcomes plus required C3 receipts.

### rev-35 · 2026-11-02T07:10:44.432Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1628-evidence-1
commit: d9f445e306727f3d6f7493d8971d46db1d328f77
scope: evidence
findings: [{"severity":"medium","text":"Queued unchanged workload fails 'inbox scans retained message history' (inbox-archive-workload.ts:191); the ordinary request-candidate JOIN permits SCAN m instead of bounded request-ID lookups. C1 structural bounds and C3 preservation are not established. Preserve the old workload assertion, add explicit bounded-plan/history-growth coverage and request fresh source review at the fix.","file":"hub/src/hub/store.ts","line":1928}]
finding_counts: {"high":0,"medium":1,"low":0}

Actual A-15693 failures: 'cold inboxMessages took 73.5157549999999 ms' at inbox-query.test.ts:56 and 'inbox scans retained message history' at inbox-archive-workload.ts:191 via inbox-workload.test.ts:117. One medium: request-set JOIN can be reordered into SCAN m. Coordinator036594dc amended C1 to structural plan/candidate/oracle checks, with timings diagnostic only; 73.5ms is measured evidence, not a current criterion failure itself. Run3cc66f8d exact reviewed head exit1: T0/T1 green, T2 red, Web unexecuted/interrupted, T3 deferred, T4 unexecuted. Linuxx64 dropletc8lon1 Node24.21.0 Nvim0.12.5 workers2; report-only duration/lint notices separate. Base aggregate4013 tests/4011pass/2fail; completed with repetitions4158/4153/5. Local A-15679 native106 passes remain separate macOS evidence. C1/C3 failed; C2/C4 unverified. A-15699 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15699-t-1628-failed-queued-evidence-at-d9f445e30.md). No reviewer tests/browser. Corrected source needs fresh review before verification.

Criteria: C1 failed (Queued Linux query plan scans retained message history; amended C1 requires bounded candidate/index access without full messages scans.), C3 failed (Unedited inbox-workload startup case fails its retained-history scan assertion in queued run3cc66f8d.).

### rev-35 · 2026-11-02T07:11:59.457Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1628-source-3
commit: 6ea37158e6a2c35717bc043f0131f28f8f321db6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. CROSS JOIN pins unsettled-request identities outside indexed message lookups, resolving prior reversible join. New C1 guard observes actual production SQL, rejects SCAN m/h, requires unread partial index and SCAN r, doubles retained history50k→100k with unchanged produced candidates and full frozen old-query/decoder equality at both scales. Timing assertions removed per Coordinator036594dc/current C1; readings stay diagnostic. Old workload unedited, C2/C4 boundaries unchanged. Guide replaces stale50ms gate text; E880 duration advisory caps use1.5x actual Linux measurements and explicitly preserve failed-run history. A-15704 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15704-t-1628-bounded-join-source-review-at-6ea37158e.md). C1–C4 remain unverified pending exact-head queued outcomes and required unchanged C3 native receipts; no reviewer tests/browser. Reported macOS query4/workload8 are targeted, not queued/Linux evidence. Prior failed A-15693 remains failed.

### rev-35 · 2026-11-02T07:48:51.439Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1628-final-1
commit: 6ea37158e6a2c35717bc043f0131f28f8f321db6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C4 verified. A-15740 exact-head04125132 exit0/4703pass/zero fail,cancel,skip,todo: T0/T1/all fallbackT2/Web. Independently read named query4/workload8 pass facts, including structural plan/oracle/history-growth, real1000send/mirror positive-control and legacy migration/status receipt1612.207ms. Plan uses SCAN r→indexed SEARCH m, unread partial index, no full messages scan;5235 candidates stable50k→100k. Timing diagnostics only: old62.22/newcold37.99/warmmedian29.82ms, exclude setup/migration. C3 native106 named passes:14 unchanged files105 A-15720 plus remotes1 A-15725; A-15741 retained original wrapper exit0/source batch linkage and all14 SHA256 bindings independently match. Signalnull for wrappers explicitly derived, direct remotes childexit0/signalnull. macOSarm64Node24.21 local/no browser, separate from Linux suite. Earlier2 remotes setup failures retained, unmodified same-head isolated success plus dev control; diagnosticA-15730 does not classify original cause or add coverage. T3 deferred to merge batch,T4 unexecuted; not full premerge. Linuxx64 6.8.0-142-generic c8lon1 Node24.21/Nvim.12.5; tree22d69b2710e7c17e8bcf508dd55ae0f0212a6c84; isolated HeadlessShell1248/ChromeForTesting156.0.8078.4; cache/occasionnull,skips[],skipReasonCheckreport/missing0. Duration/lint/ratchet advisory only; old A-15693 remains failed. A-15742 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15742-t-1628-final-evidence-review-at-6ea37158e.md). No findings; reviewer ran no tests/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-02T10:20:58.019Z

Merged 774af78a7afea93f3f341be55b1b9126dbb873d2 onto dev.
