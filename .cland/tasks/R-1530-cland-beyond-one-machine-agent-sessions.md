---
id: R-1530
kind: release
version: 0.4.0
title: "cland beyond one machine: agent sessions on pools of remote hosts, logins and users"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-31T18:03:30.138Z
updated: 2026-10-31T18:22:56.874Z
---

## Goal

cland's agent sessions run beyond the human's machine: the hub stays on the Mac and launches sessions on pools of small remote Linux hosts it creates, packs, watches and destroys through a host provider, DigitalOcean first, over one hub-owned SSH tunnel per host that carries the spoke, the hub's socket and the territory over `git daemon`. Harness sign-ins on hosts are logins, each on its own provider volume that cland never reads, handed to hosts by the scheduler; static keys are key logins in an encrypted store. The web workbench gains a sign-in mode, single as today or users with passkeys and invitations. The hub is made ready for shape B, the hub in Kubernetes, which the spec designs for 0.4.x. Spec: `docs/spec/v0.4.md` (complete, 2026-10-31). Vocabulary: Host, Host agent, Host provider, Host pool, Slot, Waiting launch, Tunnel, Login, Login disk, Key login, User and Sign-in mode in `GLOSSARY.md`.

## Notes

- Planned by the map M-1511 (2026-10-31): research Q-1513 (host providers), Q-1514 (harness credentials), Q-1515 (transport) and Q-1516 (Kubernetes); prototypes Q-1517 (an agent host on a small droplet) and Q-1518 (login disks) on `prototype/agent-host` at 7f7ecb0f; grilling Q-1519 (scheduler), Q-1520 (credentials), Q-1521 (shape B), Q-1527 (users) and Q-1522 (the cut). Research and prototype branches are never merged; the build follows the spec through TDD and may read the prototype's code.
- Epics in build order: E-1531 The Host interface and the local host → E-1532 The SSH transport, the host agent and git through the tunnel → E-1533 Host providers, images and DigitalOcean → E-1534 Pools, placement and the scheduler → E-1535 Logins; E-1536 Users and sign-in modes in parallel from the start; E-1538 Shape-B readiness after E-1531, beside the hub lane; E-1537 Workbenches, doctor, setup and docs for hosts after E-1534 and E-1535, its users stage after E-1536; E-1539 Release v0.4.0 from the item last. About 60 to 70 tasks.
- Blocked by: E-1532 ← E-1531; E-1533 ← E-1532; E-1534 ← E-1533; E-1535 ← E-1534; E-1537 ← E-1534, E-1535 (its users stage also ← E-1536); E-1538 ← E-1531; E-1539 ← E-1531 to E-1538.
- The Coordinator leads the build, decides the crew and the models by the project's rules, and approves every epic plan itself; the crew runs on Codex (the human, Q-1522).
- QA: every epic's demo on a fake host provider and a fake transport in the suite (hosts as processes on the same machine), with no real droplet, volume or key in a test. The human joins one live run before the release, in E-1539: a real DigitalOcean pool with two hosts, a Claude Code sign-in on a host from the phone through a card, a Codex sign-in at a moment the human picks (no Codex crew sessions on the Mac, then a day of watching the Mac), an OpenCode key, a hub restart under load, idle stop, and the money in the ledger. Provider tokens never reach hosts (the human, Q-1522).
- Definition of done as in 0.3, plus the live run, docs pages on hosts, pools, logins, users and sign-in modes, a multi-user section in the web-and-phone page, a price table with its check date, and release notes with a "Not verified" section (Codex on a host if not tried; Kubernetes).
- Deferred to 0.4.x: the Fly provider; shape B as a whole (the image, the Helm chart, the `kubernetes` provider, the `outbound` transport, `attach-cluster`, the cluster docs); OIDC and SSO; roles beyond admin; serverless providers; several projects on one host; the tool's ties to this repository (suite planning gated on hard-coded prefixes, the snapshot key hashing only the lockfile).
- Choices the map left open are marked "(assumed)" in the spec; the Coordinator confirms or replaces them during the build and records the outcome in the spec's section 5.
- The build starts on the human's word.
