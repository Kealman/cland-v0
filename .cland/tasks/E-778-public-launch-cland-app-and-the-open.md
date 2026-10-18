---
id: E-778
kind: epic
title: "Public launch: cland.app and the open repository"
state: open
labels: []
assignee: null
parent: R-377
blocked_by: []
topic: null
branch: null
created: 2026-10-18T06:03:55.152Z
updated: 2026-10-18T06:03:55.152Z
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

- [ ] `brew install cland` installs cland on macOS, or the site shows the tap form that works
- [ ] `curl -fsSL https://cland.app/install.sh | sh` installs cland on Linux
- [ ] The crew section's claims hold: custom roles and the one-agent crew either ship or the landing no longer shows them
- [ ] Every docs page is checked against the shipped behaviour and corrected
- [ ] The landing shows real web and phone screenshots instead of placeholders
- [ ] cland.app serves the site over HTTPS from the Pages workflow
