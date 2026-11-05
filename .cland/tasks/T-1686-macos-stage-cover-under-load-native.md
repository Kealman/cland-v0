---
id: T-1686
kind: task
title: "Stage-5 native tests time out under load on both platforms: host-survival-native tunnel wait, host-reboot-native role-cleared, claude-code-remote release wait"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1390
branch: t/T-1686-macos-stage-cover-under-load-native
created: 2026-11-05T09:33:44.695Z
updated: 2026-11-05T11:55:37.289Z
---

## Summary

The E-1532 stage-5 macOS cover 5768d4e4 at f66710b3 (A-16827, local darwin arm64, workers 2) ran under heavy machine load: peak 1m load 14.5 and 4.5 GB of swap in use afterwards. Besides the revoke timeout (T-1685), four native tests failed, each on a bounded wait:

- claude-code-remote "lost native release-restart reply settles without replaying native stop": `native turn settled before release fault: not within 2000 ms` (line 235).
- host-reboot-native "reboot retires one host …": no `role-cleared` log entry with reason 'its harness exited' for the flavour (line 103); 9.6 s.
- host-survival-native "three remote harnesses retain births … across 20s hub downtime": `persisted spoke response cx tunnel: not within 15000 ms`; the load gate passed 2/5; 58.9 s.
- executor-prepare "prepare builds a reusable snapshot …": 'unknown (inspection deferred)' instead of 'current'. This is the known T-1675 pattern.

The same tests passed on the Linux covers and batches. The load was partly the machine itself: swap was in use, and long-running sessions and the hub were resident.

## What to build

For each test, decide whether the bounded wait reflects a product guarantee that should hold on a loaded macOS host (then fix the product), or a test wait that should follow the product's own observation (then fix the test without weakening the assertion). host-reboot-native's missing `role-cleared` entry needs a closer look: check whether it is a missed event under load or a log race.

## Acceptance criteria

- [x] C1. Each of the three failures (host-survival-native tunnel wait, host-reboot-native role-cleared, claude-code-remote release wait) is classified as a product cause or a test wait, with a reproduction under CPU load or a named cause (evidence).
  - done: impl-1686 · 2026-11-05T10:17:27.436Z
  - verified: rev-35 [reviewer] · run rev-35-1686-final-1 · 2026-11-05T11:10:14.561Z · commit 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a
- [x] C2. The fixes keep every assertion, and each named test passes 10/10 locally under CPU load, on macOS and in a Linux container (evidence).
  - done: impl-1686 · 2026-11-05T10:33:35.755Z
  - verified: rev-35 [reviewer] · run rev-35-1686-final-1 · 2026-11-05T11:10:14.561Z · commit 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a

## Comments

### coord · 2026-11-05T09:49:29.136Z

Not macOS-only (coord, 09:50Z). The Linux stage-5 cover rerun 384ddd4d at f66710b3 (A-16828, 2 shards) failed:
- host-survival-native "three remote harnesses retain … 20s hub downtime": the same `persisted spoke response cx tunnel: not within 15000 ms`, 59.3 s, and the load gate passed 3/5 (shard-1, degraded disk: fsync 73 ms, SQLite 385 ms);
- host-reboot-native: the load gate passed 4/5 (shard-2);
- host-revoke-native: base fail plus load gate 4/5 (T-1685).
These native tests were added or changed in stage 5 (survival by T-1612, reboot by T-1613), and the load gate repeats them five times under load. Moved into E-1532 stage 5: the stage cannot close on a green pair while they fail under load on both platforms.

### impl-1686 · 2026-11-05T09:53:11.332Z

Named deterministic causes found for two tests: projectHub's processLog is an asynchronous Journal.write queue, whereas Sessions.#exited updates the process row synchronously before vacateRole enqueues role-cleared. session.list does not drain that queue; hub.status with flushLogs:true does. Fix adds the existing explicit drain receipt before the unchanged log assertions. Claude release-fault setup uses a 2000ms wait for session.measure done while fake awaitSignals drains native hook subprocesses and mod posts allow 15000ms each; change uses shared eventually/testWaitMs native setup budget (default 15s), as existing root-first cases do. Stop/fault assertions and stop deadlines unchanged. Tunnel cause still under investigation; native execution pending T-1685 lock release. No shared contract/event change; field/event consumer search covered hub/test, nvim/test, docs, qa and shipped skills; existing flushLogs client contract reused.

### impl-1686 · 2026-11-05T10:11:46.853Z

C1 survival product cause reproduced: unloaded baseline failed exact cx tunnel receipt at60.715s; five yes burners/10 CPUs reproduced1/1 at57.902s. Trace shows positive injection refusal while disconnected and no cx adapter-reconnected retry after host-driven native resume. Codex polling reconnect emits AdapterHost.reconnected; its confirmed resume path omitted it. Held-subscription T2 regression went red in27.94ms (`0 !== 1`, missing confirmed-restoration callback) before adding callback parity. Sessions retry policy unchanged. Claude audit: remote resume only adopts/probes the native worker; delivery is through its separate mod bridge, and Sessions.bridge already calls #retry(p,undefined,true) after authenticating and attaching the actual bridge. Thus no equivalent missing Claude callback and no Claude production change needed. Rule20 sweep for reconnected/adapter-reconnected plus contract/resume names across hub/src, hub/test, nvim/test, docs, qa and .agents: production consumers contract.ts, Sessions.host callback, Codex polling reconnect, OpenCode SSE recovery; no shape or wire change; all unchanged/unaffected except Codex confirmed resume adds existing callback. Regression adapter seam and existing codex-delivery/inject-stalled uncertain-replay fixtures retain callback semantics; native/lifecycle consumers unchanged. Full search retained for evidence.

### impl-1686 · 2026-11-05T10:24:36.292Z

Rule20 consumer disposition (full search in A-16837): AdapterHost.reconnected contract remains optional and unchanged; Sessions.host callback remains the sole production consumer, keys durable sessionId, requires running row and invokes existing retry/fencing; Codex #reconnect polling producer unchanged; OpenCode SSE producer unchanged; only Codex confirmed #resume adds this existing receipt. Tests: codex-host adds held-subscription regression; codex-delivery and inject-stalled keep refused/uncertain input integration semantics; fakes/scripted-opencode and opencode-native count the unchanged OpenCode callback. Other textual reconnected matches in artifact-delete, claude-code-adapter/schedule, inbox-actions, merge-queue, name-reservation, progress, session-brief-component, visibility-component, web-authority, nvim artifacts/plan/shell-component and QA E-414-stage-3/E-419/T-274 concern browser/socket/spoke connections, not this callback, and are unaffected. Docs asks-and-inbox/modules describe their own unchanged connections; adapter reference now documents confirmed Codex resume. Shipped skills/startup probes/persisted readers have no adapter-reconnected parser or wire consumer to migrate; optional callback omissions remain compatible. No added wire shape or protocol field, schema/table/column/CLI usage change. Claude audited: its actual authenticated mod bridge already triggers Sessions retry; adoption alone does not attach input.

### rev-35 · 2026-11-05T10:45:18.662Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1686-source-1
commit: 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings at corrected pin. A-16843 records product/standards/consumer review and independently inspected causes, red-green, 60 loaded native receipts and allowance arithmetic. Codex callback follows confirmed subscription and preserves existing Sessions refused/uncertain replay policy; reboot uses the actual journal drain; Claude adjusts setup only, with all stop/fault assertions intact. The new held fixture's cleanup ordering was corrected before this verdict using beforeDirectories before setup/resume. All 13 required preservation files are byte-identical to base; runtime/source-hash and later envelope/cleanup differences remain explicit. C1/C2 remain unverified pending configured same-head evidence. Proceed with mode-free verify at 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a; no reviewer tests/edits, no dev merge, QA none.

### impl-1686 · 2026-11-05T11:09:20.279Z

Exact reviewed-head configured verification 733fef1e-c5d1-4612-86aa-51924d0042c0 passed (A-16846), head 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a, tree 6fae4ab5df01fc5d9e02239c9208ec3ef35401eb. Uncached Linux x64 6.8.0-142-generic droplet c-8 sfo2, Node24.21.0, nvim0.12.5. Browser provenance: Chrome Headless Shell at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Hub aggregate5,165 pass,zero fail/cancel/skip/TODO. T0,T1,T2,changed T3 and Web exit0; unsupported-doc coverage fallback ran all T2. Changed T3:3files,28positive identities,one base execution,no load repetitions; separate C2 ten-per-platform proof A-16838. Remaining T3 deferred to merge batch; T4 not executed. Budget/lint/ratchet advisories remain report-only; no passing budget claim from those advisories. Source clear rev-35-1686-source-1 at exact head; reviewer has result for final evidence settlement. No head/tree changes.

### rev-35 · 2026-11-05T11:10:14.561Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1686-final-1
commit: 1bbdedf77b000c114b56edd6a72634dbe4e9fa1a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-16847 records independently inspected exact-head run733fef1e/A-16846: 5165/5165, zero fail/cancel/skip/todo. All three named native boundaries pass, full Claude remote26/26, Codex host23/23 including held-subscription base+5/5 load, and unedited delivery22/inject-stalled22 controls pass. Separate A-16838 supplies 10/10 per named case on each of macOS and Linux arm64 under CPU load, all60 native exit receipts; source/envelope/fixture provenance limits remain explicit. T0/allT1/fallback allT2/three changedT3 files28 identities once/Web complete; remaining T3 deferred, T4 unexecuted, no full-T3/QA claim. Candidate-tree projection independently matches, source clear A-16843 stands; no findings or reviewer rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-05T11:55:37.289Z

Batch 21f52bc7 at 084165e2 (A-16851) failed one unrelated test: host-git-daemon "eight admitted daemons per host …" with `Git daemon termination incomplete`. T-1686 doesn't touch git-daemon or hub-local process identity, and the test passed in A-16828, A-16844 and A-16849. The likely cause is the hub-local exit-time /proc ESRCH race, filed as T-1687 in stage 5. Re-enqueued once at the unchanged head 1bbdedf7 (flaky rerun rule).
