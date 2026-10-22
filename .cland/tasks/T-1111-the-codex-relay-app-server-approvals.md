---
id: T-1111
kind: task
title: "The Codex relay: app-server approvals answered through the gate"
state: open
status: review
size: M
criterion_seq: 9
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: topic-870
branch: t/T-1111-the-codex-relay-app-server-approvals
created: 2026-10-22T15:16:11.398Z
updated: 2026-10-22T23:41:24.215Z
---

## Summary

The Codex adapter reports its app-server's approval requests as records and answers them through the gate. It closes a record when `serverRequest/resolved` says another client answered, and `approvalRelay` becomes `reliable` for Codex.

## Parent

E-414 (§3.8 "The Codex relay"; tracer step 2).

## What to build

The Codex adapter is already a client of each session's app-server. Each `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` it receives now becomes a record. A command request carries the command with its cwd and reason; a file change carries the paths and the change as Codex reports them. The record is keyed by that request and offers three choices: Approve once (`accept`), Always for this command (`acceptForSession`, Codex's grant for the session) and Deny (`decline`, so the turn continues). The adapter answers the gate by responding to the server request, which needs the app-server client to gain a response call. A Deny is always `decline`. Codex carries no note, so the note goes to the session's topic through the gate.

`serverRequest/resolved` for a request the hub did not answer closes its record as answered in the harness. On a reconnect, the requests the app-server replays rebuild the same records. The adapter checks every request field it relies on. A request that fails the check becomes a record answered in the TUI, with a warn-level event. The capability table reads `approvalRelay: reliable` for Codex. Refresh the Neovim recordings that carry the capability table; if the OpenCode relay lands first, merge dev and refresh again.

Bring the fake Codex in line with the protocol as the research read it:
- one request id goes to every subscriber, and `serverRequest/resolved` names that id;
- the client's decision is read: the command runs, and the run is logged, only on accept, and a decline continues the turn without running it;
- pending requests are replayed to a connection that subscribes later;
- its own TUI path (the `approve` file and SIGUSR1) answers as another client would.

The scripted app-server double also takes responses.

## Acceptance criteria

- [x] C1. Through the scripted app-server, a command request becomes one record answered in the hub, with the command, its cwd, its three choices and `pending` (test).
  - done: impl-1111 · 2026-10-22T23:20:56.272Z
- [x] C2. Approve once, Always for this command and Deny reach the app-server as `accept`, `acceptForSession` and `decline` responses to that request's id. A Deny never reaches it as anything else (test).
  - done: impl-1111 · 2026-10-22T23:20:56.495Z
- [x] C3. A file-change request becomes a record of kind file change, and its answer reaches the app-server the same way (test).
  - done: impl-1111 · 2026-10-22T23:27:43.923Z
- [x] C4. `serverRequest/resolved` for a request no hub client answered closes its record as answered in the harness, and every client reads that outcome (test).
  - done: impl-1111 · 2026-10-22T23:39:46.208Z
- [x] C5. A request missing a field the adapter relies on becomes a record answered in the TUI, with a warn-level event (test).
  - done: impl-1111 · 2026-10-22T23:27:44.184Z
- [x] C6. After the adapter's connection drops and returns, the replayed pending request keeps the same record id, and an answer given then reaches the app-server (test).
  - done: impl-1111 · 2026-10-22T23:27:44.264Z
- [x] C7. The capability table reads `approvalRelay: reliable` for Codex (test).
  - done: impl-1111 · 2026-10-22T23:20:57.002Z
- [x] C8. A targeted run of the Codex contract file, with its receipt posted in the item topic, shows through the fake binary that Approve once runs the command and Deny does not (test).
  - done: impl-1111 · 2026-10-22T23:20:57.082Z
- [x] C9. `hub/README.md`'s Codex capability row describes the relay, the three choices and their Codex decisions, and where the note goes (docs).
  - done: impl-1111 · 2026-10-22T23:20:57.266Z
  - verified: rev-23 [reviewer] · run rev-20261022-1111-source-4 · 2026-10-22T23:41:24.215Z · commit 41bedb404306194cc1873cabd0426e79db0c455c

## Comments

### impl-1111 · 2026-10-22T23:20:25.396Z

Implemented at 2612e91109edf46c1c838007cd4ea6f72376c66b after pre-review origin/dev merge (28ffd4fe). TDD native seam covers C1–C7; C8 exact-head targeted Codex contract is collecting its durable receipt. Docs describe Codex native mappings and note fallback (C9). Neovim owning shell test refresh passed 25/25 and recorded 5685 frames; live frame drift/workbench 6/6, approval gate regression 18/18, full typecheck and T0 lint pass (lint findings report-only, zero refusals). Fixtures remain sealed; the contract file's own legacy shell attach invocation now uses scratch cwd plus accountFixtureEnvironment. No real account or live-hub experiment.

### rev-23 · 2026-10-22T23:25:37.878Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1111-source
commit: 2612e91109edf46c1c838007cd4ea6f72376c66b
scope: full
findings: [{"severity":"medium","text":"Malformed present threadId values are dropped by routing before unsupported-request validation, so no required TUI record or warn event appears. Distinguish valid foreign-thread IDs from invalid routing fields.","file":"hub/src/adapters/codex.ts","line":567},{"severity":"medium","text":"A replayed file entry is answerable while ready:false and thread/read validation is held, via the retained inbox record. Require validation readiness before native responses; cover valid/malformed/failed readback.","file":"hub/src/adapters/codex.ts","line":634},{"severity":"medium","text":"External resolved during initial file lookup deletes the entry and closes a record that has not yet been published; later lookup returns without preserving the exact closed record/archive outcome. Retain closure through subject resolution without a pending resurrection.","file":"hub/src/adapters/codex.ts","line":480}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear: three medium findings, consolidated in the topic artifact. M1 malformed routing fallback; M2 ready:false replay native response; M3 exact external closed outcome lost during initial file lookup. Decision mappings, native ID preservation, allowlisting, fake accept/decline execution semantics, sealed owned shell invocation, Codex-only capability recording changes and matching docs otherwise reviewed. A-9497 is local exact-head targeted contract 12-pass evidence, not full/Linux verification or working-tree correction evidence. No Reviewer tests/edits. C3/C4/C5/C6 failed; remaining criteria unverified pending corrected-head source review and runtime receipts. After-stage QA separate.

Criteria: C3 failed (Replayed file approvals can reach native response before required file-subject validation completes.), C4 failed (External resolution during the initial file lookup loses the exact closed record and archive outcome.), C5 failed (Malformed present threadId is ignored before the required TUI fallback record and warning.), C6 failed (Reconnect replay exposes a retained inbox record while its new file validation is not ready.).

### impl-1111 · 2026-10-22T23:27:43.859Z

Consolidated source fixes at d9a42dda58a91fd4d620249f7d1b05a0136801fd: M1 invalid-present/empty routing IDs reach warn/TUI fallback, valid foreign threads remain excluded; M2 native answer requires file-validation readiness; M3 retains external outcome during first file read and opts into atomic closed-first publication through internal ApprovalRequest.outcome, wire shape unchanged. All existing assertions preserved. Exact-head local Darwin arm64 targeted receipts: codex-native T2 23/23, Codex contract T3 12/12 (17.02113 s file wall, no >=5 s individual test), C8 log posted in topic; gate regressions 18/18 and full typecheck passed on identical working tree before commit. Lint passes with report-only findings/0 refusals. After-source-review branch did not merge dev. Fresh source review requested next; no verification until clear.

### rev-23 · 2026-10-22T23:29:58.656Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1111-source-2
commit: d9a42dda58a91fd4d620249f7d1b05a0136801fd
scope: full
findings: [{"severity":"medium","text":"Known external closure during initial file lookup is still dropped if the native connection closes before read success/rejection: close clears entries and this guard returns before publishing entry.resolved. Preserve the exact closed outcome across disconnect without pending resurrection.","file":"hub/src/adapters/codex.ts","line":622},{"severity":"low","text":"Closed-first requests set since at delayed enrichment completion but retain an earlier outcome.at; the new test's 1-second delay therefore produces since later than closure. Preserve valid chronology and assert it.","file":"hub/src/hub/inbox.ts","line":366}]
finding_counts: {"high":0,"medium":1,"low":1}

Second source review not clear: M1 malformed routing and M2 ready guard are resolved; M3 ordinary held-read closure fixed but disconnect variant remains. One low L1 records since-after-outcome timestamp inversion in the opt-in closed-first inbox path. Coordinator authorization for narrow internal outcome contract confirmed; ordinary inbox/OpenCode paths remain unchanged. Detailed audit posted in topic-870. No other source findings. Local corrected-head 23-native/12-contract passes are targeted evidence only; not working-tree fix or full/Linux verification. C4 failed, remaining runtime criteria unverified. New-head source review must precede verification; no Reviewer test execution.

Criteria: C4 failed (External resolution during initial file lookup is still lost when native disconnect precedes read completion/rejection.).

### impl-1111 · 2026-10-22T23:33:03.977Z

Third source-fix head 6f38a88f5f911d4a2ccf55d836fdf0da9fd72e20: retains observed native closure across connection loss while held read rejects, leaves unresolved stale reads suppressed, preserves adapter-observed request since through opt-in internal field, and requires complete authorization subjects to fit 64 KiB serialized UTF-8 before permitting hub answers (Coordinator direction 986cb8d3). Both command/file exact-boundary and distinct-beyond-cap cases are tested, with same allowlist on fallback. Before fixes, disconnect had no matching frame, chronology assertion failed, and cap record was hub instead of tui; all three targeted regressions now green. Local native T2 25/25, gate regression 18/18 and full typecheck pass on same tree before commit. Exact committed-head native and C8 contract receipts are collecting; no verification or dev merge after source review.

### rev-23 · 2026-10-22T23:36:11.404Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1111-source-3
commit: 6f38a88f5f911d4a2ccf55d836fdf0da9fd72e20
scope: full
findings: [{"severity":"medium","text":"Known closed-first approval is still discarded if the process exits/stops before subject read settles, because admission requires running. Before first-turn process publication it is also dropped, while codex.ts:634 deletes the resolved entry so watch cannot replay. Preserve exact closed outcomes across terminal/early host admission without admitting pending approvals there.","file":"hub/src/hub/inbox.ts","line":348}]
finding_counts: {"high":0,"medium":1,"low":0}

Third source review not clear: one remaining M3 publication-lifecycle finding. Socket-only disconnect and L1 chronology are fixed; M1/M2 retained. New complete serialized UTF-8 cap meets Coordinator's binding rule, with exact boundary/hidden-operation tests and matching README/docs/skill provenance. Terminal process closed-first requests are rejected by Inbox's running filter, and early closed requests are removed before watch can replay them. Add both host-boundary regressions and preserve closed history without pending resurrection. No other findings. A-9533 local exact-head targeted contract 12-pass output and reported native25/gate18 checks are not full/Linux or working-tree-fix evidence. C4 failed; other run criteria pending. Detailed audit posted in topic-870; no Reviewer test execution.

Criteria: C4 failed (The exact external closed outcome is still lost at host admission after terminal transition or before first-turn process publication.).

### impl-1111 · 2026-10-22T23:39:46.133Z

Fourth source-review head 41bedb404306194cc1873cabd0426e79db0c455c fixes the remaining C4 host-admission boundaries. The optional closed-first path admits known terminal rows but ordinary pending requests remain running-only. Internal approvalRequested returns a boolean admission receipt; Codex retains resolved entries through disconnect/failed admission until watch can replay them, and never answers an already-resolved entry. New tests observe a durable stopped process through public session.stop before held read rejection, refuse terminal pending publication, and simulate first-turn native command/resolved before process-row publication. Red receipts: terminal case no matching frame; early closure absent from archive. Exact committed-head local Darwin arm64: native T2 27/27, C8 Codex T3 contract 12/12 (19.562526334 s file wall), artifacts in topic; gate regression 18/18 and full typecheck passed on identical precommit tree after correcting an archive-union test typing error. Lint/diff check pass (findings report-only, 0 refusals). Wire shape/OpenCode unchanged; no post-review dev merge or verification.

### rev-23 · 2026-10-22T23:41:24.215Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1111-source-4
commit: 41bedb404306194cc1873cabd0426e79db0c455c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear against C1–C9 and binding payload-cap decision. All prior M1/M2/M3/L1 findings resolved: invalid routing fallback, validation-ready answer fence, exact closed outcome across read/disconnect/terminal/early publication, valid chronology. Internal host admission receipt preserves ready closures until watch; pending remains running-only. Full serialized UTF-8 subject cap forces oversized TUI/no choices/native refusal; exact-boundary/hidden-operation regressions retained. C9 verified from matching README. C1–C8 runtime marks await configured same-head mode-free evidence; A-9554 local exact-head contract12 and A-9555 native27 are targeted receipts only. Under Coordinator bar2560269e: no prior finding moved out, all were within named criteria and are fixed; no unnamed lifecycle blocker added. T-1112 optional migration stays the existing separate follow-up. Public wire/OpenCode unchanged; docs/provenance match; no Reviewer runtime execution. Detailed final source audit posted in topic-870.

Criteria: C9 verified.
