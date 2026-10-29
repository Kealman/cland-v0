---
id: T-1442
kind: task
title: "Both remotes in one hub: an integrated scenario on the fake platforms"
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: topic-1182
branch: t/T-1442-both-remotes-in-one-hub-an-integrated
created: 2026-10-29T15:55:47.418Z
updated: 2026-10-29T18:11:33.336Z
closed: 2026-10-29T18:11:33.336Z
---

## Summary

Each 0.3 epic proved its remote alone. Nothing yet runs Telegram and Discord paired in one scratch hub at once. This item adds one T3 scenario on the fake Bot API, the fake Discord gateway and REST and the fake speech provider, covering the paths E-1314's integrated pass names, so the pass is reproducible and stays covered after the release.

## What to build

A scenario test, for example `hub/test/scenarios/remotes.test.ts`, mapped T3 in `hub/test/tiers.json`, with a `T3:` header. It starts one real scratch hub with both remotes enabled and paired on the fakes, with explicit loopback roots, since the fixtures fail closed since T-1438. It plays the human on both platforms through the fakes' control APIs.

## Acceptance criteria

- [x] C1. An ask answered from a Discord modal is stored once and turns the Telegram card into its outcome; a hub-side inbox read shows the ask answered.
  - done: impl-1442 · 2026-10-29T16:15:27.313Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
- [x] C2. A photo and a voice note sent from each remote reach the other remote exactly once, marked "you (Telegram)" or "you (Discord)", with the 🎤 transcript.
  - done: impl-1442 · 2026-10-29T16:15:27.412Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
- [x] C3. A hub restart under 90 seconds and one over 3 minutes are each caught up on both remotes: Discord resumes or reads history back, Telegram catches up, and open cards are re-sent per platform rules.
  - done: impl-1442 · 2026-10-29T16:08:55.587Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
- [x] C4. Revoking the Telegram token on the fake stops only Telegram with its cause, while Discord keeps serving General both ways.
  - done: impl-1442 · 2026-10-29T16:08:57.519Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
- [x] C5. The scenario passes 5/5 locally under two busy workers through the shared suite-lock leases with raw receipts, and once on Linux in the mode-free run; any allowance it needs is owned by R-1278 with a reason.
  - done: impl-1442 · 2026-10-29T16:52:42.023Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
- [x] C6. A graceful hub stop persists Telegram's outage state, so a restart catches up: late messages carry their written time and open cards are re-sent per Telegram's rules.
  - done: impl-1442 · 2026-10-29T16:08:57.620Z
  - verified: rev-34 [reviewer] · run rev-34-20261029-1442-final · 2026-10-29T16:54:00.477Z · commit 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d

## Comments

### impl-1442 · 2026-10-29T16:02:48.938Z

C6 consumer inventory before persistence change: rg across hub/src, hub/test (all tiers/scenarios), nvim, web, docs, .agents. Only telegram.ts reads/writes telegram.outage in production; #failed/#saveOutage/#armOffline/#caughtUp/#late/status consume it. Plan additive optional planned flag; old {since,reason,announced} records stay readable and existing T2 outage cases retain that previous shape. hub daemon remoteState projection, gateway/status/configuration, doctor-remotes and remote-stop consume status rather than raw record; suppress planned offlineSince/lastError/notice without wire changes. Web RemotesLine and nvim panels, web-area-state/remote-workbench tests and nvim sessions fixtures consume unchanged optional fields, unaffected. Tests directly reading outage: telegram-{approvals,cards,voice-answers,gap,catchup,pacing,liveness} and telegram fixtures; migrate cards 'plain component restart' null assertion to planned receipt, retaining no extra short-restart card/chat assertion. Existing long network outage/restart cases retain original records. Production factory/CLI startup probes and shipped QA briefs/skills do not decode outage; existing frame shapes remain unchanged. Docs consumers: hub README polling/recovery, telegram catchup/cards guides; update planned-stop behavior there; frozen skill text proposed in topic.

### rev-34 · 2026-10-29T16:14:17.831Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1442-source1
commit: 6887d96427eb6da21751cc248dcf26118eea4ad8
scope: full
findings: [{"severity":"medium","text":"M1: New remotes and graceful-restart entries violate path sorting (remotes before release; graceful-restart before gap), so the unchanged owning manifest guard rejects the head. Move only the new rows. Remove the blank line before the new Notes index rows so they remain in the Markdown table.","file":"hub/test/tiers.json","line":391},{"severity":"medium","text":"M2: Raw projectHub acquisition has no independently bounded setup observer or closing admission fence. Pre-registering an exchange.stop callback that waits acquiring does not bound startup or prevent late scenario continuation. Reuse a pre-owned bounded acquisition/late-hub disposal owner and prove omitted/aborted serving-receipt paths before root/Store disposal.","file":"hub/test/scenarios/remotes.test.ts","line":43},{"severity":"medium","text":"M3: C2 checks destination content/caption only; it does not verify destination native file upload/attachment bytes. It can pass with a missing/corrupted cross-remote photo/audio attachment. Preserve source history checks and add each destination's exact file hash/size/attachment identity and one upload, including no source-platform echo.","file":"hub/test/scenarios/remotes.test.ts","line":101},{"severity":"medium","text":"M4: C1's cardinality assertion counts the original ask row by id, not answer messages. Add exactly one answerTo=ask.ask record with expected text and Discord provenance, preserving the native Telegram outcome edit and inbox archive checks.","file":"hub/test/scenarios/remotes.test.ts","line":71}]
finding_counts: {"high":0,"medium":4,"low":0}

Full source not clear: M1 sorted manifest/index, M2 bounded pre-owned hub acquisition, M3 destination native media proof, M4 actual answer cardinality. Additive planned Telegram outage behavior is source-consistent, with legacy compatibility and restart/fatal controls retained. C1/C2 proof incomplete; C3/C4/C6 unverified and C5 load/Linux pending. Consolidate corrections, preserve assertions and request fresh pushed-head review before probe/verify.

Criteria: C1 failed (Scenario counts the original ask row rather than exactly one stored modal answer.), C2 failed (Cross-remote assertions prove rendered text but omit destination native file/upload bytes and identity.).

### rev-34 · 2026-10-29T16:18:51.418Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1442-source2
commit: 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
scope: full
findings: [{"severity":"medium","text":"M5: Proposed load driver A-13768 starts setup commands before its try/finally, bounds child work only by sending SIGTERM, leaves CPU startup/join without independent bounds, and skips later cleanup/releases if an earlier step fails. Pre-own setup/test child and worker lifetimes with bounded native close/drain, continue every cleanup attempt and retain individual lease release receipts before the authorized C5 probe."}]
finding_counts: {"high":0,"medium":1,"low":0}

M1–M4 closed in branch source: manifest/index, bounded shared acquisition controls, destination native file proof and actual answer cardinality. No additional production finding. Sole remaining M5 is proposed C5 driver A-13768 native child/worker/lease ownership and bounds. Publish corrected driver and request same-head clearance before probe/verify; no further branch edit requested. All runtime criteria remain unverified and C5 load/Linux pending.

### rev-34 · 2026-10-29T16:32:50.273Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1442-source3
commit: 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head full source/proof plan clear. M1–M4 remain closed; revised driver A-13783 closes M5 with pre-owned bounded native child/worker completion, sibling cleanup and individual lease releases after confirmed drainage, retaining incomplete ownership otherwise. No workload executed by Reviewer; all C1–C6 runtime verification pending. Authorized five-run leased CPU proof plus one exact-head Linux mode-free result required before final evidence audit; any allowance owned by R-1278.

### rev-34 · 2026-10-29T16:54:00.477Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261029-1442-final
commit: 30a305a4a310ffa07d14ddc4fe42da8e0d3f624d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13821: original A-13819 independently parsed 4155 ordinary passes plus 20 task load/50 unrelated site load; changed T3 scenario passes 1.078330692 s, T0/T1/all fallback T2/Web complete. A-13800 five exact-head local leased/two-busy-worker runs all native pass with advancing counters, eight child joins, two worker exits0 and both lease releases fulfilled. C1–C6 verified with source3 assertions. Host receipt is tree-checked reuse, not Linux typecheck. Report-only timing/lint/growth warnings and retained-clone/native-object capture limits preserved. Remaining T3/T4 absent; Coordinator full verify-all gate remains before enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-29T18:11:33.336Z

Merged 3f0045b1c3ea1a1cfc2297bc346af1420ca3b975 onto dev.
