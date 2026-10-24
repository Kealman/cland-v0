---
id: E-778
kind: epic
title: "Public launch: cland.app and the open repository"
state: open
labels: []
assignee: null
parent: R-1100
blocked_by: []
topic: null
branch: null
created: 2026-10-18T06:03:55.152Z
updated: 2026-10-24T09:39:31.543Z
---

## Summary

cland goes public with v0.2: the repository opens, cland.app carries the landing and the docs, and promotion starts. The site was written as if everything it describes has shipped (the human's rule, 2026-10-17), so this epic holds what the site promises and no other epic delivers, plus the final check that every claim holds.

## Goal

Everything the landing, the docs and the README promise works on a fresh machine on the day promotion starts. The site and the brand landed from branch `brand/identity` (logo, `docs/brand/`, `site/` on Astro and Starlight, the README, the Apache-2.0 LICENSE, `.github/workflows/pages.yml`).

## What the site promises that other epics deliver

- `cland init` and `cland setup` ending in the workbench with the Aide: E-612, E-613, E-611.
- Verification for any stack (`[verification]` check and test commands): E-614.
- The curated skills and `cland update`: E-615, E-616.
- The web workbench and the phone (`cland web`, `--qr`, asks and approvals from the browser): E-412 to E-419.
- `permissions = "auto"` for Claude Code roles and `cland role launch`: named in the docs; check which epic carries them.

## Definition of done

- [ ] C1. `brew install cland` installs cland on macOS, or the site shows the tap form that works
- [ ] C2. `curl -fsSL https://cland.app/install.sh | sh` installs cland on Linux
- [ ] C3. The crew section's claims hold: custom roles and the one-agent crew either ship or the landing no longer shows them
- [ ] C4. Every docs page is checked against the shipped behaviour and corrected
- [ ] C5. The landing shows real web and phone screenshots instead of placeholders
- [ ] C6. cland.app serves the site over HTTPS from the Pages workflow

## Plan

```yaml
stages:
  - name: install paths and honest claims
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-780
        - T-779
      - - T-783
      - - T-1221
      - - T-781
  - name: screenshots
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-784
```

## Comments

### coord · 2026-10-22T08:51:28.633Z

Moved out of R-377 (v0.2) into R-1100 "Public launch" on the human's decision (General, 2026-10-22 08:50Z, msg e175de7e): v0.2 ships without the public launch, and the launch follows separately.

### coord · 2026-10-24T09:38:53.717Z

2026-10-24 (coord): the human named E-778 the next goal and deferred Q-782 to a release after the launch (General 09:38Z); Q-782 moved to Follow-ups, and the solo preset change is filed under this epic. Also delivered elsewhere: the landing's "Budget" preset (Implementers ×4 on OpenCode free models, QA on an open model) is what E-1216 (OpenCode as a working harness for every role, R-1191) is qualifying now on opencode/deepseek-v4.1-flash-free. That preset's claim holds only once E-1216 closes.
