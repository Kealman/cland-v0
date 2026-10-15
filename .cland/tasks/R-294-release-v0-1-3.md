---
id: R-294
kind: release
version: 0.1.3
title: v0.1.3
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:31:51.406Z
updated: 2026-10-15T05:26:23.426Z
---

## Goal

v0.1.3 collects what the human notices during the v0.1.2 build and what needs the human's decisions or a design grilling before it becomes epics.

## Notes

Backlog from 2026-10-12. Nothing here is planned; the human grills each item before it is ticketed. The first item is the study of OpenCode's new major version.

## Epics

| Key | Id | Title | Blocked by |
|---|---|---|---|
| E01 | E-387 | Test speed: structural | none |
| E02 | E-423 | Rules and rhythm | none |
| E03 | E-424 | OpenCode v2 hygiene | E-423 (lane order until `follows` exists) |
| E04 | E-425 | Hub hygiene | E-387 (lane order until `follows` exists) |
| E05 | E-426 | Release v0.1.3 from the item | E-424, E-425 |

The build starts right after v0.1.2 ships, led by cland-impl.

## Comments

### human · 2026-10-14T16:52:46.282Z

Handover to the implementation session (cland-impl), 2026-10-14: v0.1.3 "Rhythm and rules" is planned; you lead the build as for v0.1.2, starting right after v0.1.2 ships; questions only the human can answer go to the inbox as asks and wait. Nobody has run cland push since v0.1.1: push first.

Spec: docs/spec/v0.1.3.md (complete: §3.1 OpenCode v2 hygiene, §3.2 the rulebook, §3.3 the heartbeat, §3.4 lane flow, §3.5 hub hygiene, §4 the release); GLOSSARY: Rulebook, Rule, Heartbeat, Follows. Epics under this item, labelled epic, v0.1.3, ready-for-agent: E-387 Test speed: structural (yours; T-393 to T-396; no blockers) → E-425 Hub hygiene (T-379 a run's identity follows the tree, T-311 orphan hook bridges, T-427 TypeScript 7); E-423 Rules and rhythm (the rulebook .cland/RULES.md with cland rule add and the rule.add tool, rules in clauses and briefs, changes delivered to running sessions, the seed from the planning memories by one Aide task; the heartbeat per role in crew.toml with a hub digest, a turn only when idle, never a needs-you; lane flow: the next epic starts on the previous one's last merge, the follows relation beside blocked_by, demos on a droplet; T-335 under it) → E-424 OpenCode v2 hygiene (T-296 own database per user and per account; follow with a check and the two fragile points; the launch policy mapping and the codemode experiment; idempotent prompt ids and child sessions; doctor warnings); E-426 Release v0.1.3 from the item (after E-424 and E-425; the release refuses while a child is open, so the release, the post-release check and the retrospective follow its close; Q-384 must be closed by then). The lane edges E-387 → E-425 and E-423 → E-424 are blocked_by until follows exists; unlink them as lane order when §3.4 says the next epic may start. Rules carry a plain number ("rule 12"), never the R- prefix. Crew as v0.1.2 (Implementers on Codex gpt-6.1-sol, Claude Code roles on claude-sonnet-5-5, Reviewer pool 2), [plan] approval = "none". Research: docs/research/opencode-v2.md (research/opencode-v2), docs/research/test-speed.md (research/test-speed).

Rules that stay: every artifact in English; sub-agents never use the hub; commits end with "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; only cland release pushes to GitHub; the hub frame protocol is the first test seam, fake harnesses the second; no routing around refusals; cland verify for suites; dogfood each epic as it lands (the heartbeat and the lane flow by the build that makes them; the rulebook read by every clause from then on). Definition of done: every epic's demo run by QA on dev with a clear verdict, the release from this item, a retrospective artifact, no human acceptance pass. After v0.1.3 ships, v0.2 follows: see the handover on R-377. The planning session (cland-design) stays available for design questions.

### coord · 2026-10-15T05:26:23.426Z

Decision (human, relayed verbatim by the stand-in on 2026-10-15 about 05:2xZ: «как закончите с 0.1.2, берите 0.1.3»): once v0.1.2 is released, the Coordinator goes straight into v0.1.3 'Rhythm and rules' (E-387 and E-423 to E-426) without a separate go-ahead.
- **Lane flow.** The first v0.1.3 epic may start on the last v0.1.2 merge rather than on the release demo.
- **Retrospective.** The v0.1.2 retrospective still happens, but does not block the kickoff.
- **Carried over.** The stand-in answers asks and plan approvals under D24. The restart protocol and D25, D27, D28 and D29 carry over.
