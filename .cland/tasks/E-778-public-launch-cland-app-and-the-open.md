---
id: E-778
kind: epic
title: "Public launch: cland.app and the open repository"
state: closed
criterion_seq: 6
labels: []
assignee: null
parent: R-1100
blocked_by: []
topic: topic-1023
branch: null
created: 2026-10-18T06:03:55.152Z
updated: 2026-10-25T09:26:38.823Z
closed: 2026-10-25T09:26:38.823Z
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
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.186Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
- [ ] C2. `curl -fsSL https://cland.app/install.sh | sh` installs cland on Linux
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:22.918Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.187Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
- [ ] C3. The crew section's claims hold: custom roles and the one-agent crew either ship or the landing no longer shows them
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.102Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.187Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
- [ ] C4. Every docs page is checked against the shipped behaviour and corrected
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.187Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
- [ ] C5. The landing shows real web and phone screenshots instead of placeholders
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.392Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.187Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
- [ ] C6. cland.app serves the site over HTTPS from the Pages workflow
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T08:18:23.574Z · commit c3ec3ab02bee4c935fecd0db8a959f729dbca36f
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T09:26:31.187Z · commit 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d

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

### qa-677 · 2026-10-25T09:26:31.187Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-25-677-2
commit: 1dc617ec4d7114f20cc48a396217b58c1f1bfe2d
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Revised brief qa/briefs/E-778.md, request a1284f4f. Human decision ask081e4c5d (epic comment 2026-10-25T08:32:25Z) explicitly accepts formula integrity for C1 and synthetic Seatbelt protection for the separate T-1222 prerequisite. Artifact A-11668: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11668-e-778-revised-dod-qa-clear-formula-integrity-and-published-docs/report.md

| Case | Result | Evidence |
| --- | --- | --- |
| C1 | PASS, formula integrity only | Formula URL is v0.2.1 codeload tarball; expected/computed SHA-256 both aeafac42bae49da2c13b98d6a89b8a24645afe06676281049319605c19deb444; no Homebrew install |
| C2 | PASS, evidence continuity | live install.sh equals prior/pinned source bytes; retains A-11647 Linux verified-bundle install and version0.2.1 success; no installer rerun |
| C3 | PASS, evidence continuity | live landing visible text unchanged; prior shipped-role/crew audit retained |
| C4 | PASS | published T-1274 correction visible; default Codex Aide root-commit restriction and Coordinator commit path stated; docs items closed/clear |
| C5 | PASS, evidence continuity | nine screenshot definitions/srcsets unchanged; retains prior45/45 successful image fetches |
| C6 | PASS | fresh HTTPS200, GitHub.com server, ssl_verify_result0 |
| LAUNCH-PREREQUISITE | PASS under accepted scope | exact synthetic Seatbelt protection case passes in latest macOS A-11666 line22982 |
| FRESHNESS | PASS | queried requested full SHA: current=true; clean detached build |

Findings none within revised scope. C1–C6 verified in this audit; retained-runtime evidence is labeled and not claimed as new execution. Previous Homebrew blocker and non-equivalent native Codex evidence are not rewritten as successful runtime tests.

Local macOS read-only curl/hash/Git audit in sealed scratch environment. No new droplet, installer, harness, suite or browser; no new droplet cost. Demo status returns the prior released lease b6143abb/c3ec3ab0 (570.183s/$0.039596041666666665); those fields are historical, not this run's build/accounting.

Latest protection receipt: macOS Darwin arm64 27.0.0, Node24.21.0/Neovim0.12.5, cover d38d9c6e at eafe70e51fe9c37bd0d996460ae1334ce3e0a6e1; exact T-1222 Seatbelt case native finish outcome pass. Synthetic policy/Git operations only, not native Codex or Linux parity. Full cover4474 ordinary passes, T0–T4/Web, report-only budgets and skipped T4 repetitions; browser not re-audited. Only tracker files changed between cover source and requested SHA.

Live publication6665bb03, Last-Modified2026-10-25T08:55:35Z; Date/Age retained. Eight recorder cases and30 declared files scanned clean.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-25T09:26:38.823Z

Closed on qa-677's clear DoD re-run qa-dod-2026-10-25-677-2 at 1dc617ec (A-11668), C1–C6 verified.
- C1 is formula integrity, by the human's decision (ask 081e4c5d): formula url = v0.2.1 tag tarball, sha256 aeafac42… matches. The human will check `brew install` on another machine; any problem becomes a separate item.
- C2: install.sh on a clean droplet installed 0.2.1 with the verified prebuilt web bundle (A-11647).
- C3–C6 are live-site checks; C4's quickstart fix T-1274 was published at 6665bb03.
- The T-1222 prerequisite is accepted on its synthetic Seatbelt tests (human, same ask).
Follow-ups: T-1275 (Aide commit claim in the skill, role clause and README), T-1276 (publish-landed tasks don't count as merged).
