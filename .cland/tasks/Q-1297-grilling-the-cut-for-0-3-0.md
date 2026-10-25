---
id: Q-1297
kind: question
title: "Grilling: the cut for 0.3.0"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1294
  - Q-1295
  - Q-1296
  - Q-1293
topic: null
branch: null
created: 2026-10-25T10:24:46.524Z
updated: 2026-10-25T13:42:35.935Z
closed: 2026-10-25T13:42:35.935Z
---

## Question

What lands in 0.3.0 and how it is built (map M-1286): the epics under R-1278 and their lanes, the order (gateway seam and authority first, Telegram remote, asks and approvals, media and transcription, Discord remote, setup/doctor/onboarding and docs, the release), the crew and models, the sandbox-based QA plan for messenger work (real bots or a stub), the definition of done, and what is deferred to 0.3.x.

## Comments

### human · 2026-10-25T13:42:35.815Z

## Resolution (2026-10-25, the cut; the human accepted the recommendations with two corrections)

1. **Epics under R-1278, in build order:** (1) The gateway edge and its authority; (2) Pairing, secrets and configuration; (3) The Telegram remote; (4) Remote cards and approvals; (5) Media, the upload frame and speech; (6) The Discord remote; (7) Setup, doctor, onboarding and the workbenches; (8) Release v0.3.0 from the item.
2. **Lanes:** the hub lane 1 → 2 → 3 → 4 → 5; epic 6 after 4, its voice after 5; epic 7 after 2, beside 3 to 6; epic 8 last. About 50 tasks.
3. **Crew and plans (corrected by the human):** the Coordinator decides everything itself: the crew and the models by the project's rules, and it approves every epic plan; no plan approval by the human.
4. **QA (corrected by the human):** every epic's demo runs on fake platform servers in the test suite (a fake Bot API, a fake Discord gateway and REST, as the prototypes did); the human joins one live run on the sandbox bots, Telegram and Discord from the phone, only before the release; real tokens never go to droplets, the live run is on the Mac.
5. **Definition of done:** as v0.2 plus the live run before the release, the documentation pages (web-and-phone gains a remotes section; a new page for `cland remote` and `cland secret`), release notes with a "Not verified" section, a retrospective.
6. **Deferred to 0.3.x (named in the spec as deferred):** Telegram groups and forum topics, Discord Components V2, a thread per item, following a thread started from the chat, several humans, webhooks, transcription cost accounting, Web Push.
7. **Build start:** after 0.2.2 ships, led by the Coordinator, on the human's word (as D49 for 0.1.4); the research and prototype branches stay unmerged, the prototype code may be read, the build follows the spec through TDD.
