---
id: T-1412
kind: task
title: "A restart within the resume window resumes: messages typed meanwhile arrive late, and only the pressed cards are re-sent"
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1403
  - T-1411
topic: topic-1170
branch: t/T-1412-a-restart-within-the-resume-window
created: 2026-10-27T23:38:48.333Z
updated: 2026-10-29T03:23:40.318Z
closed: 2026-10-29T03:23:40.318Z
---

## Summary

A hub stop closes the socket resumably and keeps the session in `hub.db`, and the next start resumes. The replay brings the messages typed meanwhile, which reach General marked late. It also brings the clicks made meanwhile, which came too late to answer, so only their cards are re-sent at the bottom. Disabling Discord ends the session cleanly.

## What to build

**Stopping and starting.** `stop()` closes with code 4000 and persists the session id, the resume URL, the last sequence and the stop time under the `discord` messenger. Disabling the remote through configuration closes with 1000 and forgets the session. A start with a stored session sends RESUME first (08's rule); a refused resume falls through to ticket 18.

**Replayed messages.** Between RESUME and RESUMED, a replayed MESSAGE_CREATE that passes 05's checks reaches General with "(written on Discord at HH:MM; the hub was down until HH:MM)".

**Replayed clicks.** A replayed component INTERACTION_CREATE is never answered and never answers an ask. Its card is re-sent at the bottom with "a button pressed then may have been lost; press again", and its old copy is edited to "↓ Re-sent below" without buttons. Cards not pressed meanwhile stay as they are. Replayed command interactions are dropped.

Every replayed event is deduplicated by id against what was handled before the stop.

Spec §3.8 (resume), §3.9 (catch-up order, hub restarts); Q-1293 (resumed after 60 and 90 seconds, refused after 120).

## Acceptance criteria

- [x] C1. A hub stop closes the socket with a code other than 1000, and a start 30 seconds later resumes with no identify on the fake (test).
  - done: impl-1412 · 2026-10-29T01:49:40.151Z
  - verified: rev-26 [reviewer] · run rev-20261029-1412-evidence-2 · 2026-10-29T02:39:29.985Z · commit fe63f37b117cecfb423517e90403620f5cdb038f
- [x] C2. A message typed during a 30-second restart reaches General once, marked with the time it was written and the time the hub came back (test).
  - done: impl-1412 · 2026-10-29T01:49:45.288Z
  - verified: rev-26 [reviewer] · run rev-20261029-1412-evidence-2 · 2026-10-29T02:39:29.985Z · commit fe63f37b117cecfb423517e90403620f5cdb038f
- [x] C3. A press during a 30-second restart answers no ask, and only that card is re-sent at the bottom with its old copy marked "↓ Re-sent below" without buttons (test).
  - done: impl-1412 · 2026-10-29T02:22:10.006Z
  - verified: rev-26 [reviewer] · run rev-20261029-1412-evidence-2 · 2026-10-29T02:39:29.985Z · commit fe63f37b117cecfb423517e90403620f5cdb038f
- [x] C4. Disabling Discord with `cland config set remote.discord.enabled false` and `cland hub reload` closes the socket with 1000, and the next enabled start identifies afresh (test).
  - done: impl-1412 · 2026-10-29T01:49:45.702Z
  - verified: rev-26 [reviewer] · run rev-20261029-1412-evidence-2 · 2026-10-29T02:39:29.985Z · commit fe63f37b117cecfb423517e90403620f5cdb038f

## Notes

Shared files: discord-socket.ts, discord.ts; new hub/src/remote/discord-catchup.ts

## Comments

### impl-1412 · 2026-10-29T01:43:53.023Z

Consumer inventory before changes (rule 20): Remote lifecycle is consumed by Gateway, ConfiguredGateway, messengerFactory, injected daemon remotes and all remote/gateway/configuration fixtures; add an optional disable hook, preserving older adapters. DiscordSocket dispatch is internal: DiscordRemote plus socket test callers; optional replay metadata preserves existing frames. DiscordInbound consumes MESSAGE_CREATE; commands/cards consume INTERACTION_CREATE; handlers and outbox observe dispatch. Persisted RemoteStore readers are DiscordRemote, inbound/cards/outbox/identify and tests across hub/test (T1–T4), QA briefs/docs and startup probes; session and interaction keys are additive, old stores start fresh. Existing inbound tombstones, wire frames, outbox intents and messenger factory signatures remain unchanged. Search covers hub/src, hub/test, web/nvim, qa, docs and shipped skills; no public frame/reply shape change intended.

### impl-1412 · 2026-10-29T01:49:34.412Z

Consumer search results: production changes are ConfiguredGateway/Gateway lifecycle (optional disable marker), DiscordRemote/Socket/Cards/Commands/Inbound and Outbox (unchanged intent contract). Existing Telegram adapter and all injected Remote implementations may omit disable. Native dispatch handlers retain existing fields and receive an additive optional replayed marker. Tests/probes using injected factories or remotes: harness.ts, fakes/discord/hub.ts, gateway.test.ts, gateway-state.test.ts, gateway-secrets.test.ts, outbox-gateway.test.ts, remote-cli.test.ts, doctor-remotes.test.ts, discord-{messenger,pairing,commands,messages,render,cards}.test.ts, telegram-{polling,mute,cards,approvals,notices,inbound,artifacts}.test.ts, setup-remote-component.test.ts, pairing-{codes,approval}.test.ts, artifact-upload.test.ts, web-authority.test.ts, opencode-adapter.test.ts, web/test/{harness,pairing,remote-via}.ts. They remain compatible because factories, stop signatures, wire frames and prior persisted payload shapes stay unchanged. Shipped implement skill is frozen; proposed update is A-13553 for Coordinator stage close. Matching test guide and hub README updated. QA brief search found no direct socket/session-key consumers. No role-clause change or CLI syntax/help change.

### rev-26 · 2026-10-29T01:54:37.079Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1412-source-1
commit: 6d29839c5c697360644aa9f42fa87a544b8acf19
scope: full
findings: [{"severity":"medium","text":"M1: replay ID parsing truncates colon-bearing native approval identities and silently omits their resend. Preserve the whole ID and validate the final offered action; add scripted approval replay control.","file":"hub/src/remote/discord-cards.ts","line":84},{"severity":"medium","text":"M2: slicing rendered replay cards removes approval closing fence/instruction or numbered option explanations. Reserve the warning before rendering variable content; retain fixed structure and all offered explanations.","file":"hub/src/remote/discord-cards.ts","line":255},{"severity":"medium","text":"M3: an ordinary refused inbound result rejects/poisons dispatch confirmation and terminally stops Discord. Distinguish handled refusal from cancelled/uncommitted work; retain liveness and cursor boundaries.","file":"hub/src/remote/discord-socket.ts","line":140},{"severity":"medium","text":"M4: a single startup returnedAt is reused by automatic reconnects, producing stale recovery times on later live resume replay. Capture per-connection return boundary and test across a minute.","file":"hub/src/remote/discord.ts","line":142},{"severity":"medium","text":"M5: replay effects start concurrently despite ordered confirmation, allowing a pressed-card resend before later buffered input is durably stored. Gate resend recovery on full replay input drainage/RESUMED.","file":"hub/src/remote/discord.ts","line":155},{"severity":"medium","text":"M6: terminal stop1000 clears stored session, but later normal stop4000 restores the retained in-memory session. Make terminal close disposition monotonic/idempotent and retain clean fresh-Identify restart control.","file":"hub/src/remote/discord-socket.ts","line":185}]
finding_counts: {"high":0,"medium":6,"low":0}

Full source not clear: consolidated M1–M6 in A-13554 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13554-t-1412-full-source-review-1-not-clear.md). Standards: no separate tier/fixture ownership finding; T2 CLI config case is permitted because CLI itself is subject. Spec: approval identity parsing, replay fixed-content budgeting, handled-refusal/cancel distinction, per-resume return time, input-before-resend ordering and terminal session disposition require fixes/controls. All11 changed files and C1–C4 reviewed at pinned head/base6021ab461; no reviewer execution, Linux evidence or runtime verification. Corrected exact-head source request follows consolidated fixes/targeted consumer checks; keep verification held and do not merge dev for these corrections.

Criteria: C3 failed (Replay cannot resend real colon-bearing approval IDs, can truncate long card structure/options, and may resend before later replay input is durably stored.).

### rev-26 · 2026-10-29T02:05:29.887Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1412-source-2
commit: 8e8877c586146a872d531b7374aa9c9b0572404f
scope: full
findings: [{"severity":"medium","text":"M5 partial: replay recovery gate resets only on replayed interactions. A subsequent live RESUME with an earlier owed intent and messages but no new press can recover through inbox publications before the full replay-input drain. Close admission on every RESUME start and cover owed-intent/held-later-input/no-new-press.","file":"hub/src/remote/discord-cards.ts","line":77},{"severity":"medium","text":"M7: renamed legacy-sessionless Identify test retains its old exact duration identity. Migrate only the owning baseline key, preserving0.115632/totals/allowances, with unchanged guard red/green and reference audit.","file":"hub/test/durations.json","line":8282}]
finding_counts: {"high":0,"medium":2,"low":0}

Replacement full source remains not clear: M1/M2/M3/M4/M6 resolved; M5 remains partial, new M7 exact-duration identity migration required. Full correction and consumer diffs inspected; no further findings. Standards/Spec and evidence limits A-13556 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13556-t-1412-full-source-review-2-not-clear.md). A-13555 final local sequential checks remain macOS evidence, not configured Linux/browser or reviewer execution. No runtime verification. Correct M5/M7 then fresh exact-head source request; keep verification held, no dev merge needed.

Criteria: C3 failed (A later replay with a durable owed resend and no new press can recover the card before that replay's input is fully stored.).

### rev-26 · 2026-10-29T02:09:25.001Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1412-source-3
commit: e08cea126e454426590907950e91bace497cea2f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source clear at e08cea126e. Standards M7 resolved: independent full-JSON comparison confirms only renamed Identify key with value0.115632 preserved. Spec M5 resolved: every-RESUME callback closes recovery admission before native I/O; RESUMED joins all input before opening recovery. Native owed-intent/no-new-press control proves held input before resend, settlement-based reaction pacing, final mapping and old-copy edit. Prior M1/M2/M3/M4/M6 fixes and exact controls retained. Original plus all correction/consumer diffs reviewed; parent8e8877c5, no dev merge. A-13559 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13559-t-1412-full-source-review-3-clear-corrected-parent-metadata.md) supersedes A-13558's erroneous parent metadata. C1–C4 done present; local A-13557 remains macOS targeted evidence, no reviewer execution or runtime verification. Proceed with unchanged-head configured mode-free verify, then original-record evidence review.

### rev-26 · 2026-10-29T02:20:40.799Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1412-evidence-1
commit: e08cea126e454426590907950e91bace497cea2f
scope: evidence
findings: [{"severity":"medium","text":"M8: replay input-before-resend control passed base but failed configured load repetitions1 and3: input/resend completion then old-copy edit timeout, final3/5. Diagnose actual injected pacing/native settlement boundary without weakening assertions/bounds; preserve failed receipt and require corrected-head source review before another run.","file":"hub/test/discord-cards.test.ts","line":888}]
finding_counts: {"high":0,"medium":1,"low":0}

Original-record evidence not clear at e08cea126e: A-13560/run dce0ded9 exit1. Independent records3414 ordinary passes plus98 separate load passes/2 load failures; no unfinished started identity. Exact owned replay-order base0.243607321s passed; repetitions1/3 failed4.390506880s/4.423581651s at distinct input/resend and old-copy boundaries, summary3/5. T0/T1 green, T2 incomplete/red, Web/T3/T4 unexecuted. No runtime criteria verified. Possible frozen reaction/message pacing requires reproduced attribution, not an assumed product defect. I missed this remaining fixture scheduling boundary in source clearance. A-13561 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13561-t-1412-evidence-review-1-not-clear.md) preserves exact lines/provenance/report-only limits. Retain failed run; corrected head needs fresh source review before new verification.

Criteria: C3 failed (Configured Linux replay-order control has only3/5 load passes: input/resend completion and old-copy edit timed out in two repetitions.).

### rev-26 · 2026-10-29T02:23:21.568Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1412-source-4
commit: fe63f37b117cecfb423517e90403620f5cdb038f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source4 clear. Only replay-order fixture/owning guide changed from e08cea126e. M8 correction forces early durable delivery while stored reaction is held, observes actual sent settlement, then advances injected250ms bucket; original bounds and all input-before-resend/General/native mapping/old-copy assertions retained. Coordinator/observer precede input release; immediate caught observer and existing native hold owner retained. Prior production findings M1–M7 remain resolved, no production/dev merge/allowance change. A-13563 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13563-t-1412-full-source-review-4-clear.md). C1–C4 done present; no runtime verification. A-13560 remains failed Linux3/5 load/T2 red, Web/T3/T4 unrun. Local A-13562 red→green/cards51/typecheck are distinct. Proceed unchanged-head configured mode-free verify then original-record evidence review.

### rev-26 · 2026-10-29T02:39:29.985Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1412-evidence-2
commit: fe63f37b117cecfb423517e90403620f5cdb038f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1–C4 verified at unchanged source4 fe63f37b1. A-13564/run69acf120 independently parsed4079 ordinary passes plus100 separately scoped load passes, no failed/cancelled/skipped or unfinished started identity. T0/T1/all fallback T2/Web exit0; T3/T4 unexecuted, no full-all claim. Card file51 base passes; all12 new identities each base+5/5 load. C1 native4000/resume/no Identify, C2 exact late General/dedup, C3 only pressed-card resend/no answer/no callback/old copy stripped plus scripted approval and ordered/no-new-press controls, C4 actual CLI disable/reload1000 then fresh Identify. Corrected replay-order0.313306392s base and5/5 load max0.470469703s; new maxincludingload1.333442826s. Old failed A-13560 remains distinct. Linux c-8 lon1/Node24.21/Nvim0.12.5, CHS156/v1248 setup; host1bf220e reused, report-only warnings preserved. A-13565 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13565-t-1412-final-evidence-review-2-clear.md) records exact timing/criterion/provenance limits. No reviewer execution or QA claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-29T03:23:40.318Z

Merged 8abed7fab9383a3107352e2834850d78e5391e67 onto dev.
