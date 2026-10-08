---
id: T-28
kind: task
title: Session launcher and the sessions panel
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-25
  - T-26
  - T-27
topic: null
branch: null
created: 2026-10-08T11:54:14Z
updated: 2026-10-08T13:17:15.602Z
github:
  repo: Kealman/cland-v0
  number: 28
  url: https://github.com/Kealman/cland-v0/issues/28
---

## Parent

Part of #19. Spec sections 4.3 and 5; design `docs/design/main-screen/Session.dc.html` and the sessions panel in `Main.dc.html`; prototype `sessions` module on branch `prototype/workbench`.

## What to build

From the workbench, the human launches a session of any of the three harnesses with a name, a model and a working directory (role comes with the roles ticket; until then sessions launch without one), sees every session in the sessions panel (name, harness, model, state glyph and text, current item once items exist, cost where the adapter reports it), attaches with Enter (in the centre or in a split), stops a session, and sees the adapter's capability table (which state signals are reliable, heuristic or absent) from the panel. The sessions kind of the picker lists the same sessions, waiting ones first. The hub tool `session.launch` exists behind the UI action (restricted to the Coordinator once roles exist).

## Acceptance criteria

- [ ] Launching Claude Code, Codex and OpenCode sessions from the UI works with the model chosen at launch; each appears in the panel with live state
- [ ] Enter attaches the selected session in the centre; `C-v` attaches in a split; `x` stops it after confirmation
- [ ] The panel shows `unknown` for a session whose process died and a journal event is written
- [ ] The picker's sessions kind filters by name, role and harness and attaches on Enter
- [ ] Headless tests cover launch, attach command resolution, stop and the capability display against fake harnesses
