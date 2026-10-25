---
id: T-1041
kind: task
title: The test harness's frame readers rescan an accumulated string on every chunk
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1044
branch: t/T-1041-the-test-harness-s-frame-readers-rescan
created: 2026-10-21T06:56:53.807Z
updated: 2026-10-25T11:55:20.894Z
closed: 2026-10-25T11:55:20.894Z
---

## Summary

`hub/test/harness.ts` has two frame readers, at about lines 543 and 599. Both append each socket chunk with `buffer += chunk` and search the whole accumulated string with `indexOf('\n')`, so a multi-megabyte frame costs quadratic scanning. While measuring a copy of the live project for T-1038, a client with this harness got no 72 MB `hub.status` reply within 60 s (`no result for hub.status within 60000ms`), although the hub composed and encoded it in about 310 ms. impl-1038 reported it on 2026-10-21 in topic-785.

## What to build

The harness readers keep incomplete chunks in an array and search only the new chunk for a newline, as `shared/socket-client.ts` already does and as T-1037 does for Neovim. Frames, order and error behaviour are unchanged.

## Acceptance criteria

- [x] C1. A harness frame client receives a 20 MB frame delivered in 64 kB chunks in under 2 s (T2 test).
  - done: impl-1041 · 2026-10-25T11:29:39.312Z
  - verified: rev-31 [reviewer] · run rev-20261025-1041-final · 2026-10-25T11:48:56.753Z · commit 43b11218854c12176b878c94afab43b1c4a50d4e
- [x] C2. The existing tests that use `frameClient` and the other harness reader pass unchanged.
  - done: impl-1041 · 2026-10-25T11:32:57.203Z
  - verified: rev-31 [reviewer] · run rev-20261025-1041-final · 2026-10-25T11:48:56.753Z · commit 43b11218854c12176b878c94afab43b1c4a50d4e

## Comments

### impl-1041 · 2026-10-25T11:26:11.673Z

Implementation plan: preserve the public frameClient/connectSocket APIs, wire frames, request correlation, blank-line handling and JSON.parse error behavior; no shared contract changes, so rule 20 migration inventory is not triggered. Agreed seams from the item: T2 scripted frameClient input and an in-process Unix socket peer for connectSocket. Add 20 MiB JSON frames in 64 KiB chunks with observed complete frame/result under 2 s, and mixed partial/coalesced/order/error controls. No child process or native harness required.

### rev-31 · 2026-10-25T11:32:37.340Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261025-1041-source1
commit: 882a6b78c0b3b62233e5d8229f920dc75876d111
scope: full
findings: [{"severity":"medium","text":"M1: synchronous JSON.parse failure loses the unread suffix of a coalesced chunk because only local start retains it until the end of the callback; old frameClient preserved that suffix for the next receive. Add malformed-prefix/valid-suffix recovery control and preserve error behavior without accumulated rescanning.","file":"hub/test/harness.ts","line":613}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1041 full source review — NOT CLEAR

Reviewed 882a6b78c0b3b62233e5d8229f920dc75876d111 / tree f77440a840269affa8c70044b274f392fe81a11b on t/T-1041-the-test-harness-s-frame-readers-rescan. Fixed comparison: git diff ff73a3d057029f50e133b66272ffa04ccd34cd36...882a6b78c0b3b62233e5d8229f920dc75876d111; one own commit 882a6b78. Branch tip unchanged during review. task.view C1/C2 claimant done, no configured verification yet. Reviewed Standards and Spec personally under the session's Reviewer constraints; no subagents or execution.

## Standards

No separate finding. New six-case file is registered T2 with exact path heading/index and no child/hub process. In-process peer and callback seams fit docs/agents/tests.md test levels. Performance assertions have task-specific reasoned wall-clock exemptions and measure complete parsed receipt, not send completion; setup and serialization are excluded, socket delivery/yields/parsing included. 4 KiB sensitivity controls complement the requested 64 KiB cases. Socket fixture registers resource cleanup through onCleanup, which precedes owned directory removal, and observes endpoint closure. No production protocol/API, role, keymap, permission, dependency or command-help changes. The two small reader loops mirror their separate routing responsibilities; no speculative abstraction is required.

## Spec

M1 — medium, hub/test/harness.ts:613 (unread suffix handling through line 628): a synchronous parse failure drops the rest of a coalesced input chunk. Previously buffer was advanced to the unread suffix before JSON.parse/callback delivery. If frameClient's receive is called with invalid JSON + newline + a valid frame + newline, the caller catches SyntaxError, then another receive (even an empty chunk) resumes and delivers that valid buffered frame. The new implementation resets parts, records only a local start offset, then throws before retaining chunk.slice(start); that already-received valid suffix is lost. This violates the item's explicit "Frames, order and error behaviour are unchanged." Existing new test only supplies malformed input alone and a later valid frame in a separate receive, so it misses this regression.

Reproduce test-first through the public frameClient callback seam: catch receive('invalid JSON\n' + validFrame + '\n'), then invoke receive('') and assert the complete buffered valid frame is delivered exactly once/in order. Add a partial trailing-frame continuation control if needed. Preserve synchronous SyntaxError and unread suffix on exceptional exits without restoring accumulated-line rescanning. Check corresponding reader handling, retaining current result correlation/event order and large-frame assertions. This is static source analysis, not a Reviewer-run red reproduction.

Otherwise, both readers scan only each incoming chunk and join at newline, preserve normal blank-line/CRLF routing, and retain UTF-8 decoding at the socket. Existing consumers remain unedited. C1's under-two-second performance and C2's complete compatibility remain runtime-unverified; C2 fails source because of M1.

## Evidence and disposition

A-11807 is explicitly an implementation-tree local macOS arm64 summary: historical callback 4 KiB red 6027.8ms; socket red 3004.9/5874.5ms; final six cases pass with summarized receipt latencies about 14–50ms and file 602.2ms; typechecks/lint/wording/diff checks reported. No Linux, configured suite or exact-commit runtime claim is established by that summary. Preserve original available invocation/stdout/stderr/exit/native timing records with actual precommit/platform and missing-capture limits; do not rerun merely for transcription.

NOT CLEAR; Standards 0, Spec 1 medium (M1). Fail C2 for changed error behavior; C1 remains pending runtime evidence. This is the consolidated finding set for this head. Correct, commit/push, restore claimant done as applicable and request fresh exact-head source review before one ordinary configured mode-free verify. No dev merge, full/forced-mode run, extra load or unchanged-head retry requested. QA none/after-stage. Reviewer performed read-only immutable source/artifact inspection only.
Durable review: A-11812.

Criteria: C2 failed (The frameClient rewrite loses already-received valid trailing frames after a caught parse error, violating unchanged frame/error behavior.).

### impl-1041 · 2026-10-25T11:33:35.527Z

M1 corrected at 43b11218854c12176b878c94afab43b1c4a50d4e after test-first reproduction. Both reader loops retain unread input offsets before invoking JSON.parse/callbacks; partial chunks remain array-backed, complete/partial/error recovery and callback-throw controls pass. Corrected local implementation-tree test run: 6/6 T2 cases pass; npm run typecheck exit 0; no configured suite yet. Full excerpts and limits in A-11815 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11815-t-1041-corrected-reader-evidence-and-captured-output-excerpts.md). Fresh review requested; awaiting source verdict.

### rev-31 · 2026-10-25T11:34:23.732Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1041-source2
commit: 43b11218854c12176b878c94afab43b1c4a50d4e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1041 corrected full source review — CLEAR

Head 43b11218854c12176b878c94afab43b1c4a50d4e / tree 022e8e27184732db36f470808b215be5a35c4c77, unchanged pushed branch tip. Direct correction after 882a6b78 / A-11812; no intervening dev merge. Read the complete initial diff and correction personally on Standards and Spec axes. C1/C2 claimant done; no configured runtime receipt yet.

## Standards

No findings. Six generated T2 tests retain the callback stream and owned in-process Unix peer seams, existing resource-first cleanup, shared isolated account fixture, exact guide heading/index and sorted tier entry. Performance assertions retain explicit task-required wall-clock exemptions and measure actual complete parsed payload. The correction changes only both readers, their error recovery controls and matching guide; no consumer/test expectation removals, new process, product API, wire, dependency, command, policy, permission or keymap change. No new smell warrants a finding.

## Spec

M1 resolved. Each reader now retains an ordered queue of incoming chunks and unread offsets. It advances the current offset (and removes an exhausted chunk) before JSON parsing or consumer callbacks. If parsing/callback delivery throws, the remaining suffix stays in persistent state; the next receive drains queued input in order before new bytes. A partial line remains as parts and joins once at its newline, with scans confined to the current chunk's unconsumed portion. It does not rescan accumulated incomplete lines.

The new public frameClient controls catch a malformed prefix with a complete valid suffix plus a partial following frame, drain the retained complete frame through empty input, then complete and assert the partial frame. A separate throwing waiter callback retains and subsequently delivers the next complete buffered frame. Synchronous exception identity/type remains asserted. Existing result correlation, refused results, ordering, CRLF/blank lines, queued/waiting socket reads, split UTF-8 and peer closure controls remain intact. Both 20 MiB readers retain 64 KiB and 4 KiB full-receipt <2-second assertions; consumers are unchanged. No other requirement is missing in source.

## Original evidence

A-11815 preserves available original command-output excerpts, exits and native timings with explicit precommit/macOS arm64 attribution and missing separate raw/stderr capture limits. M1 original red at 882a6b78 plus test edit: expected buffered-after-error, actual after-error, exit 1 / 5 pass and 1 fail. Corrected implementation-tree run exits 0 / 6 pass, 0 skip, file duration_ms 861.72025; receipt latencies callback 23.8/22.8ms and socket 53.3/138.4ms for 64/4 KiB. This run overlapped typechecking and is not a quiet benchmark. Corrected-tree typecheck exits 0; exact committed-head Linux/configured evidence is still absent. Historical performance reds remain attributed to their preceding trees. No reruns for transcription requested.

## Disposition

Source CLEAR, Standards 0 / Spec 0, findings empty. C1 performance and C2 full unchanged-consumer compatibility remain runtime-unverified until the same-head configured result. Submit one ordinary mode-free configured verify at unchanged 43b11218, then request exact-head evidence review with original named 20 MiB receipt diagnostics, actual case outcomes/load repetitions and completed phases/platform/executor/browser/gate provenance. No full/forced run, extra stress or dev merge requested. QA none/after-stage. Reviewer performed read-only source/artifact/metadata inspection only; no tests, browser, subprocess subjects, fetch or Git mutation.
Durable review: A-11818.

### rev-31 · 2026-10-25T11:48:56.753Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261025-1041-final
commit: 43b11218854c12176b878c94afab43b1c4a50d4e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1041 final configured evidence — CLEAR

Unchanged 43b11218854c12176b878c94afab43b1c4a50d4e / tree 022e8e27184732db36f470808b215be5a35c4c77 remains branch tip. Carry corrected full source A-11818 / rev-20261025-1041-source2 and original M1 disposition A-11812. task.view confirms mode-free configured 96d676ab-06c2-4629-9f5e-b0e7041d3305 finished/passed at this head, original log A-11844. Both claimant done marks remain current.

## Criteria

C1 verified. Original ordinary diagnostics measure actual complete 20 MiB parsed receipt: frameClient 64 KiB 52.1ms, 4 KiB 48.7ms; connectSocket 64 KiB 95.4ms, 4 KiB 191.1ms. All satisfy their retained <2000ms assertions and exact payload equality. Setup, serialization and payload construction are excluded from these receipt measurements, while delivery/parsing and socket yields are included. Native whole-case timings are distinct from those measurements. Each of all six new identities also passes five separate load-gate repetitions at configured two workers.

| Identity | Ordinary whole-case seconds | Load passes | Worst load whole-case seconds |
| --- | ---: | ---: | ---: |
| frameClient 20 MiB / 64 KiB | 0.167643326 | 5/5 | 0.199091056 |
| frameClient 20 MiB / 4 KiB | 0.143413735 | 5/5 | 0.190433589 |
| connectSocket 20 MiB / 64 KiB | 0.234485859 | 5/5 | 0.238858371 |
| connectSocket 20 MiB / 4 KiB | 0.316550573 | 5/5 | 0.374258622 |
| frameClient framing/correlation/order/parse recovery | 0.003227597 | 5/5 | 0.013948237 |
| connectSocket queued/waiting/UTF-8/peer close | 0.004466066 | 5/5 | 0.024885825 |

These are six exact named ordinary passes plus thirty actual additional load passes, not an exit-only or zero-match claim. Load completion proves their full assertions ran; no separate per-repetition latency diagnostic capture is invented.

C2 verified across accepted unchanged APIs/consumers and the configured all-T2 fallback plus Web compatibility evidence. The retained error-path case includes M1's malformed-prefix/complete-suffix/partial-continuation and throwing consumer recovery controls; ordinary and all five load instances pass. Normal partial/coalesced, CRLF/blank, refused/out-of-order results and event order, UTF-8 decoding and peer closure assertions remain. Existing client users/assertions are unedited. This is the configured scope of compatibility evidence; unselected T3/T4 consumers are not claimed executed.

## Scope and provenance

Independent parsing of unique progress finishes excluding file containers yields 3160 ordinary passing outcomes plus 30 load-gate passing outcomes; zero failed/cancelled/skipped/todo. Entire added file 6/6 ordinary with each identity 5/5. No additional Web repetitions (zero new Web files/zero required).

T0 host check exit 0 / 41.693s, all T1 exit 0 / 69s, fallback all hub+Neovim T2 exit 0 / 381s, Web exit 0 / 158s. Shared harness infrastructure forces fallback selection. No T3/T4 ran: remaining T3 is deferred to periodic/integrated occasions and absent configured batch tiers, queue enabled. No all-tier/stage/provider QA or original 72MB workload measurement is claimed.

Executed Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-b1bc609d, Node 24.21.0 / Neovim 0.12.5, configured workers 2; T1 uses one and Web internally four. Machine lifetime 711s / provider cost $0.0494 are distinct from suite wall. Original log prepares isolated Chrome Headless Shell 156.0.8078.4, Playwright chromium-headless-shell v1248, linux64 binary at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248; fixture cleanup receipts are retained. Reviewer starts no browser.

Host typecheck gate.tree 7add0bb73274315bafb77f17bd2d42492f36aa42 is reused, not remotely repeated or an alternate source commit. A-11815's original local implementation-tree typecheck/test excerpts and macOS provenance retain their capture limits; they are not relabeled exact-commit Linux reruns.

Ordinary budgets, test lint and T3 ratchet remain report-only: 133 lint findings/60 files, three missing baselines (dependency-install, install-claims, harness-framing), seven summarized budget warnings, Web actual phase wall 153.471s against 40s; T3 ratchet 2209.786s unchanged. These are disclosed overages/missing data, not enforced-budget passes. The separate generic new-identity gate also passed; no new allowance or head mutation.

## Disposition

Final CLEAR, C1/C2 verified, findings empty. Source M1 is resolved and exact-head original runtime proof is sufficient under the configured policy. Coordinator owns enqueue after the lead's fresh read-only conflict inspection; no dev merge, further run, stress repetition or transcription rerun requested. QA none/after-stage. Reviewer performed immutable source, artifact and metadata inspection only; no tests, fetch, browser, process signals, GC or Git mutation.
Durable final review: A-11848.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T11:55:20.894Z

Merged b7953817220a60b74aa69200248b3fa034358d40 onto dev.
