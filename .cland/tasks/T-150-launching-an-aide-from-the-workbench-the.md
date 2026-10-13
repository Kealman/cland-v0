---
id: T-150
kind: task
title: "Launching an Aide from the workbench: the palette action, a and ␣A with
  the role's defaults and a brief field; the yours group at the top of the
  sessions panel"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-111
blocked_by:
  - T-148
  - T-149
  - T-136
topic: topic-80
branch: t/T-150-launching-an-aide-from-the-workbench-the
created: 2026-10-10T05:33:00.581Z
updated: 2026-10-10T11:36:44.679Z
---

## Parent

T-111 (The human's own session), slice 3 of 5. Spec §3.3 (Launch and place), §3.11.

## What to build

The palette action, `a` and `␣A` open the launcher filled from the `aide` role's defaults, with the project root as working directory and a brief field. The sessions panel shows a "yours" group at the top holding the human's Aides; an Aide attaches in the centre like any session. Keys go through the action registry.

## Acceptance criteria

- [ ] `␣A`, a one-line brief and Enter launch `aide-1`, which appears under "yours" and attaches in the centre.
- [ ] The palette action and `a` in the sessions panel do the same; each key is registered.
- [ ] Headless QA cases cover the launcher and the "yours" group; `nvim/README.md` documents them.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-150 · 2026-10-10T11:25:46.531Z

Implemented the registry-backed Space A / panel a / palette launcher paths with Aide role defaults, project-root directory, a brief field and centre attachment. PANELS-015 passes through the headless stub-hub QA runner. Next slice covers role-based yours grouping, stopped Aides and state counts; no instance roles.toml changes are needed.

### rev-8 · 2026-10-10T11:31:57.223Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-150-1
commit: 7a692f1a6de7b3127e60e14845b0e2daa411758c

No findings. Standards and Spec clear against §3.3 Launch and place. All three registry-backed launch paths use the Aide role defaults, root directory and optional brief; no model is pinned. session.launch forwards brief through T-149's existing adapter launch/resolveBrief path. Successful launches attach centrally. Role-based yours grouping preserves busy/waiting/idle counts, with stopped Aides folded.

Native in-memory probes passed grouping/counts, process/presence name collision avoidance, unpinned model defaults, brief focus/transmission/omission and attachment dispatch. No session launched; no reviewer edits or suites. A-581 reports targeted checks/typecheck passing; full test:nvim pending in reviewed evidence.

A-583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-583-t-150-aide-launch-and-placement-review-clear.md

### impl-150 · 2026-10-10T11:36:27.399Z

Completed and pushed 7a692f1a6de7b3127e60e14845b0e2daa411758c to origin. Aide launcher keys/palette, role defaults, project-root cwd, optional brief and centre attachment are implemented; live Aides group under yours, stopped Aides fold, and state counts include Aides. npm run typecheck passes; locked npm run test:nvim passes 223/223 with zero failures/skips. Targeted palette 18/18 and PANELS-015/016 2/2 pass. rev-8 review clear on this head (A-583); final evidence A-584 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-584-t-150-final-validation-and-handoff.md. No graph.lua edits or instance roles.toml changes.

### coord · 2026-10-10T11:36:44.679Z

Merged f3840b5b58c23bad169739888eb6784efc0ce7e6 onto dev.
