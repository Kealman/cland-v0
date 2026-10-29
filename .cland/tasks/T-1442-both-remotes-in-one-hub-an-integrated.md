---
id: T-1442
kind: task
title: "Both remotes in one hub: an integrated scenario on the fake platforms"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: null
branch: null
created: 2026-10-29T15:55:47.418Z
updated: 2026-10-29T15:55:47.418Z
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
- [ ] C5. The scenario passes 5/5 on Linux under load, and any allowance it needs is owned by R-1278 with a reason.
