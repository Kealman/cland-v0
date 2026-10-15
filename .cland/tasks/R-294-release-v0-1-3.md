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
updated: 2026-10-15T09:13:39.195Z
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

### coord · 2026-10-15T08:35:07.889Z

Decision (human, ask 35ca68c2, 2026-10-15 08:34Z): remote_budget rises from 2 (D27) to 4; the daily spend cap stays at $3. Committed in .cland/config.toml; it applies at the next hub restart.

### coord · 2026-10-15T09:12:01.758Z

Decision (human, relayed by the stand-in on 2026-10-15 after reading the v0.1.2 retrospective A-2783): no model rotation yet. «мы пока набираем baseline на тех моделях в которых я уверен, сравнивать уже потом отдельно будем». The crew keeps one model per role (Implementer and Reviewer on Codex gpt-6.1-sol, QA on gpt-6-astra, Coordinator on claude-opus-5-5). Model comparison is a separate later exercise. The retrospective's Start/Stop/Continue conclusions are filed as v0.1.3 tickets (see the Coordinator's follow-up comment).

### coord · 2026-10-15T09:13:39.195Z

The v0.1.2 retrospective's conclusions are filed for v0.1.3 (Coordinator, 2026-10-15 09:12Z).
- **START:**
  - 1 is T-473: XL refused, L split at plan time.
  - 2 is the new epic E-468 'Run records': T-477 severity with lows, T-478 found_by and answered_as, T-479 cover status and cause, T-480 sub-agent model.
  - 3 is T-469: a Linux proof on every stage-close cover.
  - 4 is T-470: queue-wait p50/p90 against a 20-minute target.
  - 5 is T-471: a load gate for new tests.
- **STOP:**
  - 1 is T-475: cover-quiet enforced by the harness.
  - 2 is T-379, which already exists; the retrospective's case is added as a comment.
  - 3 is T-474: override for tracker and docs only.
  - 4 is T-472: shared-defect detection.
  - 5 is T-477: lows recorded.
  - 6 is T-476: a hub start-up smoke test.
- **CONTINUE:** D24, D25, D27, D29, lane flow, droplets under the budget and cap, restarts only on a green cover with an empty queue, T-204, and retro.py. These are standing practice and enter the rulebook through E-423's seed (T-457).
- **Plans:** T-469..T-472 and T-466 are E-387's stage 3. T-473 and T-474 are E-423's stage 3. T-475 and T-476 join E-425 (Hub hygiene). E-468 gets its plan when E-423's first stage closes.
- **Model rotation:** deferred by the human's decision above.
