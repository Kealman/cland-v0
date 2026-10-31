---
id: Q-1522
kind: question
title: "The cut of 0.4: epics, lanes, crew, QA and build start"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1519
  - Q-1520
  - Q-1521
  - Q-1527
topic: null
branch: null
created: 2026-10-31T14:35:39.806Z
updated: 2026-10-31T18:03:29.787Z
closed: 2026-10-31T18:03:29.787Z
---

## Question

The cut of 0.4: epics under the 0.4 release item in build order, lanes, the crew, QA on a fake host provider and a fake SSH host with one live run before release, definition of done, docs and site pages, what is deferred to 0.4.x, and the build start. Grilling with the human; then the spec through `to-spec` and the epics through `to-tickets`.

## Comments

### human · 2026-10-31T18:03:29.658Z

## Resolution (round 9, the cut, 2026-10-31, all accepted by the human)

1. **Epics of 0.4.0** under the release item, in build order: (1) The Host interface and the local host; (2) The SSH transport, the host agent and git through the tunnel; (3) Host providers, images and DigitalOcean; (4) Pools, placement and the scheduler; (5) Logins; (6) Users and sign-in modes; (7) Workbenches, doctor, setup and docs for hosts; (8) Shape-B readiness (host-identity hub lock with heartbeat, PVC-safe HOME and paths, Secure cookies under an https origin, the transport layer with `ssh` only, the executor's DELETE 404 fix); (9) Release v0.4.0 from the item.
2. **Lanes.** Hub lane 1 → 2 → 3 → 4 → 5; epic 6 in parallel from the start; epic 8 after 1, in parallel; epic 7 after 4 and 5, its users part after 6; epic 9 last. About 60–70 tasks.
3. **Crew and QA.** As in 0.3: the Coordinator leads and approves every plan, the crew on Codex. QA of every epic on fakes: a fake host provider and a fake transport in the test suite (same interfaces, processes on the same machine), no real droplets in tests. One live run with the human before the release: a real DO pool with two hosts, a Claude sign-in on a host from the phone through a card, a Codex sign-in on a host at a moment the human picks, an OpenCode key, a hub restart under load, idle stop, money in the ledger. Provider tokens never reach hosts.
4. **Definition of done.** As in 0.3 plus the live run, docs pages (hosts, pools, logins, users, sign-in modes; a multi-user section in web-and-phone), a price table in the docs with its check date, release notes with a "Not verified" section (Codex on a host if not tried; Kubernetes), a retro.
5. **Deferred to 0.4.x** (in the spec as deferred): the Fly provider, shape B as a whole (image, Helm chart, `kubernetes` provider, `outbound` transport, `attach-cluster`, cluster docs), OIDC/SSO, roles beyond admin, serverless providers, several projects on one host, the tool's ties to this repository.
6. **Build start.** On the human's word, led by the Coordinator; research/* and prototype/agent-host are never merged, the prototype's code may be read; the build follows the spec through TDD. The spec, the glossary entries and the epic bodies are written by an opus agent from the map, reviewed and committed by the planning session, as for 0.3.
