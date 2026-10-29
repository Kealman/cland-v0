---
id: T-1442
kind: task
title: "Both remotes in one hub: an integrated scenario on the fake platforms"
state: open
status: in progress
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
updated: 2026-10-29T16:02:48.938Z
---

## Summary

Each 0.3 epic proved its remote alone. Nothing yet runs Telegram and Discord paired in one scratch hub at once. This item adds one T3 scenario on the fake Bot API, the fake Discord gateway and REST and the fake speech provider, covering the paths E-1314's integrated pass names, so the pass is reproducible and stays covered after the release.

## What to build

A scenario test, for example `hub/test/scenarios/remotes.test.ts`, mapped T3 in `hub/test/tiers.json`, with a `T3:` header. It starts one real scratch hub with both remotes enabled and paired on the fakes, with explicit loopback roots, since the fixtures fail closed since T-1438. It plays the human on both platforms through the fakes' control APIs.

## Acceptance criteria

- [ ] C1. An ask answered from a Discord modal is stored once and turns the Telegram card into its outcome; a hub-side inbox read shows the ask answered.
- [ ] C2. A photo and a voice note sent from each remote reach the other remote exactly once, marked "you (Telegram)" or "you (Discord)", with the 🎤 transcript.
- [ ] C3. A hub restart under 90 seconds and one over 3 minutes are each caught up on both remotes: Discord resumes or reads history back, Telegram catches up, and open cards are re-sent per platform rules.
- [ ] C4. Revoking the Telegram token on the fake stops only Telegram with its cause, while Discord keeps serving General both ways.
- [ ] C5. The scenario passes 5/5 locally under two busy workers through the shared suite-lock leases with raw receipts, and once on Linux in the mode-free run; any allowance it needs is owned by R-1278 with a reason.
- [ ] C6. A graceful hub stop persists Telegram's outage state, so a restart catches up: late messages carry their written time and open cards are re-sent per Telegram's rules.

## Comments

### impl-1442 · 2026-10-29T16:02:48.938Z

C6 consumer inventory before persistence change: rg across hub/src, hub/test (all tiers/scenarios), nvim, web, docs, .agents. Only telegram.ts reads/writes telegram.outage in production; #failed/#saveOutage/#armOffline/#caughtUp/#late/status consume it. Plan additive optional planned flag; old {since,reason,announced} records stay readable and existing T2 outage cases retain that previous shape. hub daemon remoteState projection, gateway/status/configuration, doctor-remotes and remote-stop consume status rather than raw record; suppress planned offlineSince/lastError/notice without wire changes. Web RemotesLine and nvim panels, web-area-state/remote-workbench tests and nvim sessions fixtures consume unchanged optional fields, unaffected. Tests directly reading outage: telegram-{approvals,cards,voice-answers,gap,catchup,pacing,liveness} and telegram fixtures; migrate cards 'plain component restart' null assertion to planned receipt, retaining no extra short-restart card/chat assertion. Existing long network outage/restart cases retain original records. Production factory/CLI startup probes and shipped QA briefs/skills do not decode outage; existing frame shapes remain unchanged. Docs consumers: hub README polling/recovery, telegram catchup/cards guides; update planned-stop behavior there; frozen skill text proposed in topic.
