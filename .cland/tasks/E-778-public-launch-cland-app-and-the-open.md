---
id: E-778
kind: epic
title: "Public launch: cland.app and the open repository"
state: open
criterion_seq: 6
labels: []
assignee: null
parent: R-1100
blocked_by: []
topic: topic-1023
branch: null
created: 2026-10-18T06:03:55.152Z
updated: 2026-10-25T08:32:25.293Z
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
  - failed: qa-677 [qa] · 2026-10-25T08:18:12.873Z · note BLOCKED: official Homebrew installer exits 1 as demo runner; insufficient permissions for /home/linuxbrew/.linuxbrew, so formula/version never ran.
- [ ] C2. `curl -fsSL https://cland.app/install.sh | sh` installs cland on Linux
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:22.918Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
- [ ] C3. The crew section's claims hold: custom roles and the one-agent crew either ship or the landing no longer shows them
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.102Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
- [ ] C4. Every docs page is checked against the shipped behaviour and corrected
  - failed: qa-677 [qa] · 2026-10-25T08:18:12.873Z · note Live quickstart says the Aide commits on dev, but default Codex workspace-write Aide cannot commit at root; T-1274.
- [ ] C5. The landing shows real web and phone screenshots instead of placeholders
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.392Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
- [ ] C6. cland.app serves the site over HTTPS from the Pages workflow
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.574Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f

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
      - - T-1223
      - - T-1222
        - T-1245
  - name: screenshots and prebuilt web bundle
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-784
      - - T-1234
  - name: live install docs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1273
  - name: docs findings from the DoD run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1274
```

## Comments

### coord · 2026-10-22T08:51:28.633Z

Moved out of R-377 (v0.2) into R-1100 "Public launch" on the human's decision (General, 2026-10-22 08:50Z, msg e175de7e): v0.2 ships without the public launch, and the launch follows separately.

### coord · 2026-10-24T09:38:53.717Z

2026-10-24 (coord): the human named E-778 the next goal and deferred Q-782 to a release after the launch (General 09:38Z); Q-782 moved to Follow-ups, and the solo preset change is filed under this epic. Also delivered elsewhere: the landing's "Budget" preset (Implementers ×4 on OpenCode free models, QA on an open model) is what E-1216 (OpenCode as a working harness for every role, R-1191) is qualifying now on opencode/deepseek-v4.1-flash-free. That preset's claim holds only once E-1216 closes.

### coord · 2026-10-24T12:38:56.411Z

Launch prerequisite from T-1222 (landed at d4d596db, 2026-10-24 ~12:39Z). Before the public launch, run one real check: in a scratch project made with `cland init` on the generated defaults, a real Codex Implementer, with workspace-write and the eight narrow Git/territory/artifact roots, commits on its task branch and pushes to the local territory, while hooks and config stay protected. T-1222's own evidence is a synthetic Seatbelt receipt only, with no native Codex and no Linux Landlock parity. Run this check during the E-778 DoD, under rule 15 with a scratch HOME, and record it as launch evidence.

### hub · 2026-10-25T08:04:19.902Z

demo b6143abb-fc62-49fe-870c-b74127f2799d created: droplet cland-v0-b6143abb, commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f, deadline 2026-10-25T09:17:53.385Z.

### hub · 2026-10-25T08:13:34.914Z

demo b6143abb-fc62-49fe-870c-b74127f2799d destroyed: lifetime 570183 ms; cost $0.0396.

### qa-677 · 2026-10-25T08:18:12.874Z

verdict: qa
result: not clear
by: qa-677 [qa]
run: qa-dod-2026-10-25-677
commit: c3ec3ab02bee4c935fecd0db8a959f729dbca36f
findings: [{"severity":"medium","text":"C4: live quickstart promises the Aide commits everything on dev; this contradicts T-1222's human decision and onboarding/SKILL.md:94 for the default Codex Aide. Reproduced by HTTPS fetch; T-1274 (S, Bugs).","file":"site/src/content/docs/docs/quickstart.md","line":98},{"severity":"medium","text":"C1 infrastructure blocker: demo runner uid1000 runs official noninteractive Homebrew installer; native exit1, stderr: Insufficient permissions to install Homebrew to \"/home/linuxbrew/.linuxbrew\". Formula install/version never ran."},{"severity":"medium","text":"Separate T-1222 launch-prerequisite evidence gap, not a C1–C6 failure: generated Codex Implementer workspace-write/eight narrow roots differs from live danger-full-access. Production commits/territory refs exist but are not equivalent. Synthetic macOS protection pass is not a native Codex run."}]
finding_counts: {"high":0,"medium":3,"low":0}

Brief qa/briefs/E-778.md plus Coordinator decisions 7ffd1999/6167c65e. Artifact A-11647: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11647-e-778-dod-qa-not-clear-homebrew-blocked-quickstart-claim-wrong/report.md

| Case | Result | Observation |
| --- | --- | --- |
| C1 | BLOCKED | Homebrew cannot install to its standard Linux prefix as demo runner |
| C2 | PASS | install.sh uses verified prebuilt Web bundle; installed CLI reports 0.2.1 |
| C3 | PASS | live crew copy matches shipped custom roles and Coordinator-plus-Implementer smallest crew |
| C4 | FAIL | live quickstart Aide-commit claim wrong for generated Codex default; T-1274 |
| C5 | PASS | web/phone references present; all 45 screenshot src/srcset URLs return 200 image/webp; no visible placeholders |
| C6 | PASS | HTTPS 200, GitHub.com server, ssl_verify_result=0 |
| LAUNCH-PREREQUISITE | INCONCLUSIVE | generated sandbox differs from live override; no scratch-HOME native Codex run |

C1/C4 failed here; C2/C3/C5/C6 verified separately with this run. T-1222 prerequisite remains separate per Coordinator. Findings above are complete.

Demo executor droplet, Linux x64 6.8.0-142-generic/Node24.21.0; lease b6143abb-fc62-49fe-870c-b74127f2799d; deadline 2026-10-25T09:17:53.385Z; full delivered SHA is the tested SHA. Stopped before verdict and confirmed released; lifetime570183ms, cost$0.039596041666666665. These are machine lifetime/cost, not installer wall time. Freshness.current=true. C1/C2 each isolated with shared fixture environment builder and separate scratch HOME/XDG/Git. No Mac installer or browser.

Other checks ran read-only/local macOS from a clean detached worktree. Served pages last-modified2026-10-25T07:31:10Z, published marketing tree4d80c698; HTTP Date/Age retained, not claimed byte-identical to dev. Seven recorder lines retained, 35 declared evidence files secret-scan clean.

Coordinator-directed prior covers A-11641/A-11645 at c2adecf3 supply suite evidence; no new suite (dry-run admission only). Their generated-policy/adapter cases pass; synthetic Seatbelt protection passes on macOS and skips on Linux. Prior suite tiers/counts/report-only limits are in the artifact. Production-equivalent evidence attempted; equivalence failed: no native Codex sandbox claim.

Criteria: C1 failed (BLOCKED: official Homebrew installer exits 1 as demo runner; insufficient permissions for /home/linuxbrew/.linuxbrew, so formula/version never ran.), C4 failed (Live quickstart says the Aide commits on dev, but default Codex workspace-write Aide cannot commit at root; T-1274.).

### coord · 2026-10-25T08:32:25.293Z

Human decision, ask 081e4c5d (2026-10-25 08:32Z): «2 и 5, я проверю потом это на другом компьютере и если будут проблемы отдельной задачей прокатим».
- C1 is checked by formula integrity: Formula/cland.rb in Kealman/homebrew-tap points at the v0.2.1 tag tarball, and its sha256 matches that tarball. This is a check of the formula, not of an install; the human will run `brew install` on another machine later and file any problem as a separate item.
- The T-1222 launch prerequisite (native Codex on the generated defaults) is satisfied by T-1222's synthetic Seatbelt protection tests (A-11645 macOS); no native scratch-HOME run.
QA re-runs the DoD after T-1274 (C4) lands and is published.
