---
id: E-616
kind: epic
title: The onboarding skill and the newcomer's first page
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-611
  - E-615
topic: null
branch: null
created: 2026-10-16T15:34:18.844Z
updated: 2026-10-19T22:37:32.965Z
---

## Summary

The Aide leads a newcomer's first hour from the `onboarding` skill: who decides what, recorded as rules; a first plan the human sees in the workbench; the stack and the crew; a short welcome note; the Coordinator started on the human's word; then a staged tour of cland on request. `hub/README.md` opens with the newcomer's first page, and the glossary gains Setup, Onboarding, Tour and Welcome note.

## Goal

A human new to cland, on an empty folder or an existing project, gets from `cland setup` to a crew at work by answering questions, never by typing commands. Today nothing guides that hour: the human must know the roles, write the rules, file a plan, choose the crew and launch the Coordinator themselves. The prototype skill (Q-596) was accepted by the human after two live runs, and its files are the accepted wording; its workarounds for the Aide's missing reach go away with "The Aide's reach and the settings commands".

## Contents

- **The skill** (Q-596, Q-600 resolution 7). `.agents/skills/onboarding/` from prototype/onboarding at 0ff421f8 (SKILL.md, EMPTY.md, EXISTING.md, WELCOME.md, TOUR.md and its `agents/openai.yaml`) joins the curated set, provisioned by `cland init` and refreshed by `cland update`. Its text changes only where the prototype worked around what this release adds: the Aide launches the Coordinator and imports the issues itself, records the crew with `cland crew set` and `cland role launch` instead of editing files, and records the verification commands instead of fitting the npm scripts.
- **The flow, as accepted:**
  - a silent setup check;
  - round 1, the human's role; round 2, what they decide, recorded as rules, with "Decisions, not keystrokes" ("Sessions run commands for the human; the human is asked for a decision, never for a keystroke") recommended whatever the role; the answer "I approve epic plans" sets `[plan] approval = "human"` with `cland config set`;
  - the visible first plan: on an empty project a release with its tasks and acceptance criteria, set to planned and shown in the items panel, or a map only when there is fog; on an existing project the study, the import of the open GitHub issues on confirmation (closed ones untouched), and "what next" as the first release;
  - the stack as a rule with its verification commands, also recorded in `[verification]` with `cland config set`;
  - the crew: one line per role, then the table (harness, model from `cland models`, count) built from the installed harnesses and the rules, with the offer to turn the prompts off (`permissions = "skip"`) and its trade-off; recorded with `cland crew set` and `cland role launch`, the Aide's own change last;
  - the short welcome note in General, from WELCOME.md;
  - "Ready to start?": on the human's ok the Aide commits on `dev` what init and the onboarding wrote, runs `cland push`, and launches the Coordinator with the brief "work release R-<n>";
  - the eight-stage tour on request, from TOUR.md (the workbench; items, the explorer and the card; topics, General, the inbox and asks; sessions, roles and the crew; the life of a task; artifacts; the rulebook; how the crew grows), one stage per round, each ending with "look now", stoppable at any stage.
- **Languages** (Q-600 resolution 7). The Aide speaks the human's language, and the welcome note and the tour are in it; rules, items and briefs stay in English.
- **The newcomer's first page** in `hub/README.md`: the checkout install line Q-592 recorded, `cland init`, `cland setup`, the workbench.
- **GLOSSARY.md**: Setup, Onboarding, Tour, Welcome note.

Not in this epic: the one-command install (the first page names the checkout install); trackers other than GitHub Issues (the map's Out of scope); the web workbench's onboarding (v0.2).

## Tracer-bullet order

1. **The skill on an empty project.** Demo: in an empty scratch project set up by `cland setup`, the Aide records the rules, files a first release with tasks and criteria that the items panel shows, and records the stack with its commands, the crew and the welcome note.
2. **The start.** Demo: on the human's ok the Aide commits and pushes `dev` and launches the Coordinator with its brief, and the Coordinator reports in General.
3. **The existing project.** Demo: in a clone of a small public repository with open issues, the Aide studies it, imports the open issues on yes and files "what next" as the first release.
4. **The tour, the first page and the glossary.** Demo: the tour's eight stages, each with its "look now", in the human's language; `hub/README.md`'s first page and the four glossary entries.

## Definition of done

QA runs the demo below on `dev` on this Mac with a real Aide on the favourite harness, playing the human in the headless workbench and answering in a language other than English, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In an empty scratch project and in a clone of a small public repository with open issues, each initialised and set up with `cland setup`, QA answers the Aide's rounds. It reads the rules in the rulebook, the first release or map in the items panel, the imported issues, `[verification]` and `[plan]` in `config.toml`, the crew in `cland crew show` and `cland role list`, the welcome note in General, the onboarding's commit on `dev` and in the territory, and the Coordinator's launch with its brief. It asks for the tour and follows it to the end, then reads `hub/README.md`'s first page and GLOSSARY.md.

- [ ] C1. The `onboarding` skill, with SKILL.md, EMPTY.md, EXISTING.md, WELCOME.md and TOUR.md in the accepted wording, is in the curated set and `cland init` provisions it.
- [ ] C2. The Aide records the human's role and decisions as rules, "Decisions, not keystrokes" among them, and the answer "I approve epic plans" sets `[plan] approval = "human"`.
- [ ] C3. On an empty project the human sees a first release with planned tasks and criteria in the items panel, or a map only when there is fog, and on an existing project the Aide imports the open issues on the human's yes and files "what next" as the first release.
- [ ] C4. The stack is a rule with its verification commands in `[verification]`, and the crew round shows one line per role, the table and the permissions offer, and records the answers with `cland crew set` and `cland role launch`.
- [ ] C5. The welcome note is in General, and on the human's ok the Aide commits and pushes the onboarding's results on `dev` and launches the Coordinator with its brief.
- [ ] C6. On request the Aide gives the eight-stage tour, one stage per round ending with "look now", in the human's language, while rules, items and briefs stay in English.
- [ ] C7. `hub/README.md` opens with the newcomer's first page (the checkout install, `cland init`, `cland setup`, the workbench), and GLOSSARY.md defines Setup, Onboarding, Tour and Welcome note.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Plan approval.** The human approves this epic's plan by hand (Q-601 resolution 2): the Coordinator drafts it with `plan-epic` and launches no stage until the human approves it in the plan view or with `cland task plan approve`, although the project's `[plan] approval` is `"none"`.
- **The prototypes.** prototype/onboarding (0ff421f8) is never merged; the skill's files are copied into the set and changed only where this release adds the acts the prototype worked around (Q-601 resolution 5).
- **ADRs.** 0001 (Roles are hub-held state): the Aide acts through its grants. 0002 (Tracker files are the source of truth): the first plan is items. 0006 (The hierarchy is the item tree): the first release holds the first tasks.
- **Tests.** The skill's wording is checked by QA's live run, not by `npm test`; its provisioning and update are tested as the other skills' are.
- **Risks.**
  - The demo spends real model calls on the human's harness logins on this Mac.
  - The stack step writes `[verification]` keys that "Verification for any stack" adds: this epic's demo needs that epic merged.
  - Claude Code's auto-mode classifier may flag the Aide's change to its own launch settings (Q-600): the crew round applies it last and says it takes effect at the Aide's next launch.
- **Order.** Second in the skills lane: blocked by "The curated skill set and cland update" and "The Aide's reach and the settings commands".

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.4 (The onboarding), §3.5 (The Aide's reach and the defaults), §3.1 (the install, deferred) and §4 (The cut).
- Items: map M-591, decisions 7, 9 to 13 and 15 (13's "the onboarding does not launch the Coordinator" superseded by Q-600 resolution 2); Q-596 (the accepted flow); Q-600 (its seventeen questions, the prototype's facts and the resolution); Q-592 (the checkout install line); Q-598 (the curated set).
- Prototype: prototype/onboarding at 0ff421f8 (`.agents/skills/onboarding/`, `docs/research/onboarding-how-to-try.md`), never merged; the live runs' transcripts `/Users/evgeniyivanov/Projects/cland/sandbox-empty/onboarding.txt` and `/Users/evgeniyivanov/Projects/cland/sandbox-empty-try1-onboarding.txt`.
- Docs: `hub/README.md`, `GLOSSARY.md`.
- Skills: `wayfinder` (the map when there is fog), `grilling` (the rounds), `research`.
- GLOSSARY: Aide, Coordinator, Rulebook, Rule, Release, Crew, General; new here: Setup, Onboarding, Tour, Welcome note.

## Plan

```yaml
stages:
  - name: the skill on an empty project and the start
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-852
        - T-853
        - T-854
        - T-855
        - T-856
  - name: the existing project, the tour, the first page and the glossary
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-857
        - T-858
      - - T-859
```

## Comments

### coord · 2026-10-19T08:10:16.973Z

Cut and plan (Coordinator, D51, 2026-10-19 08:10Z). Tickets T-852–T-859 from cut N1–N8; the plan is above. Decisions on the cut's open questions:
1. E-614 is no longer a blocker: the tickets need nothing from its unlanded work (T-854 needs only T-664, which is merged). The epic demo needs E-613 and E-614 closed and runs only after both.
2. D51 supersedes Q-601 resolution 2: the Coordinator decides this plan; no hand approval.
3. T-852 drops the prototype's `allow_implicit_invocation: false`, so setup's plain-text brief starts the skill on any harness.
4. With only a map, the Aide still offers the commit and push on one ok and does not launch the Coordinator.
5. The stack step records `verification.test` only once a real command exists; otherwise the first task carries a criterion to record it.
6. The tour keeps "the Coordinator merges the task into dev as one commit": the merge queue is opt-in for new projects.
7. The first page goes into `hub/README.md` as the epic says, with the install line pinned to `--branch v0.1.4`; E-617's release checklist runs that line once against the tag; no credentials note if the repository is public.
8. T-855's review confirms that the roles template's per-role `sandbox` keys survive `cland role launch` changing a role's harness; if not, a Follow-up goes under E-611.
9. T-857's review compares the brief string with T-844's; whichever lands second matches the first.
10. T-828 does not block E-616.

### coord · 2026-10-19T22:37:32.965Z

Disposition D71 (stand-in under D24, ask 1298ecf4, 2026-10-19 22:37Z): C2–C6 are accepted on the fake-harness replay of the Aide's acts plus a check of the skill text against each criterion; no live Aide runs on a real model. A live run is the human's call after the release. QA's verdict states which halves rest on the replay.
