---
id: Q-601
kind: question
title: "The cut: what lands in 0.1.4, lanes, crew, DoD"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-591
blocked_by:
  - Q-598
  - Q-599
  - Q-600
topic: null
branch: null
created: 2026-10-16T11:26:12.062Z
updated: 2026-10-16T15:14:04.726Z
closed: 2026-10-16T15:14:04.726Z
---

## Question

The cut: what of the decided flow lands in 0.1.4 beside the carried-over hygiene epics, the lanes and their order, the crew and who leads, the definition of done (a fresh machine to a working crew, both sandboxes), and the place before v0.2; spec v0.1.4 §4 and the epics under R-577 follow.

## Comments

### human · 2026-10-16T15:14:04.569Z

## Resolution

Decided with the human on 2026-10-16 ("все да"):

1. Seven theme epics in two lanes beside the four carried-over hygiene epics (E-424, E-482, E-578, E-579). Hub lane: (1) Init: roots, the first commit, managed settings, categories, the state directory and the package-version rule at release; (2) Setup: the guided step ending in the workbench (eight steps, the non-TTY report, the flags, trust for every installed harness, doctor's strictness per role, versions shown without a verdict); (3) The Aide's reach and the settings commands (session launch/stop/resume, import, push, `permissions = "auto"` as the Claude Code default with skip as the explicit choice, `cland role launch`, `cland config set`, `cland models`, T-603, T-608, the template defaults); (4) Verification for any stack. Skills lane: (5) The curated skill set and `cland update` with hashes; (6) The onboarding skill and the newcomer's first page, with the glossary. (7) Release v0.1.4 from the item.
2. Order: the theme first, the carried-over hygiene in the gaps at the Coordinator's discretion. Hub: (3) first (small, unblocks the rest), then (1), then (2); (4) in parallel after (3). Skills: (5), then (6) after (3). (7) last. The human approves the plans of (2) and (6) by hand.
3. Crew as v0.1.3, the Coordinator leads, about 35 sessions; the build starts when the design session hands over the spec and the epics (D49).
4. Definition of done: two QA demos on this Mac: a fresh folder → init → setup → the onboarding of an empty project with the Coordinator taking the first task to merge; a clone of a public repository → init → setup → the onboarding with the issue import and a first release from "what next". Plus a green suite and the first page of the docs.
5. Documents: `docs/spec/v0.1.4.md` (§3 decisions by section: the install deferred, init, setup, the onboarding, the Aide's reach and the defaults, the skills, verification, hygiene; §4 the cut), GLOSSARY entries Setup, Onboarding, Tour, Welcome note; the research stays on its branches, the prototypes stay unmerged and the implementation takes from them what fits. Commit and `cland push` after the Coordinator's signal.
