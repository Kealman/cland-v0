---
id: E-613
kind: epic
title: "Setup: the guided step ending in the workbench"
state: closed
criterion_seq: 7
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-612
  - E-611
topic: topic-561
branch: null
created: 2026-10-16T15:34:18.570Z
updated: 2026-10-20T03:54:31.302Z
closed: 2026-10-20T03:54:31.302Z
---

## Summary

`cland setup` is the guided step after `cland init`: it detects the three harnesses, installs and signs in the missing ones on the human's yes, registers accounts only when asked, records the favourite harness, grants trust for every installed harness, starts the hub and the Aide with the onboarding brief, and opens the workbench with the Aide in the centre. It is safe to rerun, prompts only in a terminal, and doctor's checks follow what the project's roles use.

## Goal

One command takes the human from an initialised project to the onboarding in the workbench. Today the human installs and signs in to each harness, trusts the folder for each one, starts the hub and launches the Aide by hand. Claude Code's trust dialog turns a background launch into a refusal (T-24, T-58, D36) and Codex asks for folder trust at its first attach (T-42); a bare machine fails nine doctor checks because every missing harness counts (Q-592). The setup prototype (Q-597) ran these steps end to end, and the human accepted it after a run in a fresh folder.

## Contents

- **Eight idempotent steps, in order** (Q-597, Q-599 resolutions 2 and 3 and decision 11). Each step detects, offers, confirms, runs the vendor's command as a terminal child with inherited stdio, and detects again; the re-check decides, never the exit code (Q-594). Each prints one line: `ok`, `done`, `skip`, `open` or `fail`.
  1. **Detect** the three harnesses (binary, version, login) with doctor's probes.
  2. **Install.** A missing harness gets its official installer shown and run on yes, then is detected again. A declined install is remembered in `.cland/config.toml` and not offered again until `cland setup --install`.
  3. **Logins.** Every harness a template role uses gets a login check; a signed-out one gets its own login command run in the terminal on yes, then a second check.
  4. **Accounts.** The logged-in accounts are shown and appended to `~/.config/cland/accounts.toml` on a yes, the default No, since every project's hub reads that file; setup says when Yes is worth it (several accounts per harness, limits).
  5. **The favourite harness** goes into `[aide.launch]` of `.cland/roles.toml`.
  6. **Trust** is granted for every installed harness, deterministically and without a question, and reported in one line ("trusted for …"): Claude Code's `hasTrustDialogAccepted` in the profile's `.claude.json` under its lock, Codex's `trust_level` through a short-lived app-server's `config/batchWrite`, nothing for OpenCode (Q-593).
  7. **The hub and the Aide.** Setup starts the hub and launches `aide-1` on the favourite harness with the onboarding brief: `Run the onboarding skill; project: empty | existing; harnesses: …; human's harness: …`.
  8. **The workbench.** Setup downloads the pinned Neovim and opens the workbench with the Aide's terminal in the centre, as the launcher does after `␣A`. `--attach` runs the harness's own attach command in the terminal instead, for a machine without the pinned Neovim. One closing line follows on exit.
- **Without a terminal** (Q-594). Setup never prompts, waits, installs or launches: it prints each open step with its exact command and exits 1 while any step is open.
- **Flags.** `--json` (doctor's shape: root, version, interactive, steps, summary, next), `--yes` (the harmless questions only; an install needs `--install`), `--install`, `--harness <h>`, `--no-accounts`, `--no-aide`, `--attach`.
- **The prompter** (Q-594). Confirm, choose and pause over `node:readline/promises`, one interface per question, no library.
- **Doctor's strictness** (map decision 5, Q-599 resolution 4 as amended, Q-593). A harness is required only when a role uses it, and `gh` only with a `github` remote. Each harness's version is shown for information, with no range verdict and no pin step. OpenCode's environment keys no longer count as credentials.

Not in this epic: `cland init` ("Init: roots, the first commit, managed settings, categories"); the onboarding itself ("The onboarding skill and the newcomer's first page"); the one-command install (deferred, Q-592); installing harnesses silently or holding their credentials (the map's Out of scope); the web workbench's onboarding (v0.2). Ctrl+Z inside `--attach` suspends setup together with the attach, accepted as it is (Q-599 resolution 8).

Left to the spec (§3.3) and the plan: what remains of doctor's tested ranges once versions carry no verdict (informational, or gone), and of the release-time OpenCode range check E-424 added (T-533).

## Tracer-bullet order

1. **Detection, the report and no terminal.** The prompter, the step lines, `--json`, the report without a terminal, doctor's strictness. Demo: with fake harnesses on the PATH, one missing, `cland setup < /dev/null` prints the open steps with their commands and exits 1, `--json` parses, and `cland doctor` in a project whose roles use one harness passes with the others missing.
2. **Installs and logins.** Demo: in a terminal, a missing fake harness is installed on yes and detected again, a signed-out one signs in and is checked again, and a declined install is not offered on the second run until `--install`.
3. **Accounts, the favourite and trust.** Demo: the accounts question defaults to No and leaves `accounts.toml` absent, the favourite lands in `[aide.launch]`, and the scratch HOME's Claude Code and Codex configurations trust the project.
4. **The hub, the Aide and the workbench.** Demo: setup starts the hub, `aide-1` runs with the onboarding brief, and the headless workbench shows its terminal in the centre; `--attach` runs the harness's attach command instead; a second `cland setup` reports `ok` for every step.

## Definition of done

QA runs the demo below on `dev` on this Mac, playing the human in a terminal of its own and in a headless workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

With fake harnesses on the PATH, one missing and one signed out, under a scratch HOME, QA runs `cland setup` in an initialised scratch project and answers its questions: the install, the login, the accounts (left at No) and the favourite. It reads the step lines, the trust entries, `[aide.launch]`, the running hub, `aide-1` with its brief, and the workbench with the Aide in the centre. A second run reports `ok` throughout, a declined install stays declined until `--install`, and a run without a terminal reports the open steps and exits 1. QA then runs `cland setup` once with this Mac's real harnesses in a fresh scratch project, answering No to the accounts, and reads the trust and the Aide's launch. Finally `cland doctor` requires only the harnesses the roles use and `gh` only with a `github` remote, shows versions without a verdict, and does not count an OpenCode environment key as a login.

- [ ] C1. `cland setup` runs its eight steps in order, one line each, and a second run reports `ok` for every step already done.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.354Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. A missing harness is installed on yes and detected again, a declined install is remembered until `--install`, and every harness a template role uses is checked for a login and signed in on yes.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.354Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. The accounts step appends to `~/.config/cland/accounts.toml` only on a yes, the default No, and the favourite harness lands in `[aide.launch]`.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.354Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. Trust is granted for every installed harness without a question and reported in one line, for the fake harnesses and for this Mac's real ones.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.354Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. Setup starts the hub, launches `aide-1` with the onboarding brief and opens the workbench with the Aide in the centre, `--attach` runs the harness's attach instead, and one closing line follows.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.355Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C6. Without a terminal setup prints each open step with its command and exits 1, and `--json`, `--yes`, `--install`, `--harness`, `--no-accounts`, `--no-aide` and `--attach` do what the spec says.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.355Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C7. `cland doctor` requires a harness only when a role uses it and `gh` only with a `github` remote, shows versions without a verdict, and does not count OpenCode environment keys as credentials.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T03:52:32.355Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Plan approval.** The human approves this epic's plan by hand (Q-601 resolution 2): the Coordinator drafts it with `plan-epic` and launches no stage until the human approves it in the plan view or with `cland task plan approve`, although the project's `[plan] approval` is `"none"`.
- **The prototypes.** prototype/setup (3b2eabfe, the steps from 3893c66e) is never merged; the implementation takes from it what fits (Q-601 resolution 5).
- **ADRs.** 0003 (The hub is a per-project daemon): setup starts this project's hub only. 0005 (Neovim is the host): setup ends in the workbench. 0001 (Roles are hub-held state): the Aide is a normal hub launch, never a harness started by hand (Q-593).
- **Tests.** A fake prompter drives the flow, fake harnesses on the PATH stand for the real ones with their install and login commands, and one stream-level test covers the real prompter (Q-594). Real installers, logins and trust writes never run in `npm test`.
- **Risks.**
  - A readline interface left open while a child runs steals its keystrokes (three of three runs, Q-594): one interface per question.
  - The trust step writes the human's real harness configuration for the project's path, and the accounts step the machine-wide registry: a line says so each time, and the accounts default to No.
  - Running Codex once leaves its app-server daemon running (Q-594).
  - The prototype exercised the installers, the logins, the attach and the hub start only with fakes; the real-harness case of the demo is their first real run.
- **Order.** Third in the hub lane: blocked by "Init: roots, the first commit, managed settings, categories" and "The Aide's reach and the settings commands".

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.3 (Setup) and §4 (The cut).
- Items: map M-591, decisions 3, 5 and 6 (6 superseded by Q-599's decision 11); Q-599 (its ten questions, decision 11, the resolution and the amendment to decision 4); Q-597 (the prototype and its acceptance); Q-593 (harness facts); Q-594 (the step shape and the prompter); T-603 (the empty profile behind D36).
- Prototype: prototype/setup at 3b2eabfe with `docs/research/setup-how-to-try.md`, never merged.
- Research: `docs/research/harness-setup.md` on research/harness-setup (eb985104); `docs/research/setup-prior-art.md` on research/setup-prior-art (68dffed3), with the prompter sketch and its tests.
- Code: `hub/src/cli/doctor.ts`, `hub/src/doctor/toolchain.ts`, `hub/src/doctor/keys.ts`, `hub/src/doctor/ranges.ts`, `hub/src/accounts/registry.ts`, `hub/src/cli/open.ts`, `nvim/lua/cland/init.lua`; in the prototype, `hub/src/setup/` and `hub/src/cli/setup.ts`.
- GLOSSARY: Harness, Account, Aide, Hub; Setup arrives with "The onboarding skill and the newcomer's first page".

## Plan

```yaml
stages:
  - name: doctor per role, the prompter, the skeleton report, the fakes and the launcher's open
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-832
        - T-833
        - T-834
      - - T-835
        - T-837
      - - T-836
      - - T-843
  - name: the steps - installs, logins, accounts, favourite, trust, hub, Aide and the hand-over
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-838
        - T-839
        - T-840
      - - T-841
        - T-844
        - T-845
      - - T-842
  - name: the end-to-end scenario
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-846
      - - T-847
```

## Comments

### human · 2026-10-16T15:36:05.733Z

Open point resolved by the human's amendment on Q-599 (2026-10-16): harness versions are neither pinned nor judged. Doctor shows each harness's version for information only; its tested ranges and the release-time OpenCode range check from E-424 (T-533, Q-297) become informational notes with no refusal or warning rows; behavioural API checks in the adapters (follow with a check) stay where they test behaviour rather than version numbers. setup offers no pin step.

### human · 2026-10-16T15:51:23.458Z

From the human's setup run (2026-10-16 16:17): the accounts step wrote three entries into ~/.config/cland/accounts.toml: a path-less `claude` (claude-code, no config_dir), `claude-work` (~/.claude-work) and `codex`; the sessions panel then showed four accounts beside the two harness defaults and the human asked to return to the defaults only (done by hand). For the plan: the default profile of a harness is never registered as an account (it is the harness default already); only profiles with their own directory or identity become entries; a path-less claude-code entry on dev makes the hub poll a signed-out profile (the T-603 family), so setup must not create one.

### coord · 2026-10-19T06:34:31.390Z

Coordinator decisions on the ticket cut (2026-10-19, D51, which gives every v0.1.4 plan to the Coordinator; this supersedes the Constraints' "human approves this plan by hand"). The 15 tickets are T-832–T-846; the full cut, with each question's reasoning, is attached in the epic topic.
(1) The step names follow spec §3.3: project, harnesses, logins, accounts, favourite, trust, hub, Aide. One line per step, and one line per harness inside harnesses and logins. The workbench is the hand-over after the summary.
(2) Without a terminal and with no flags, nothing changes. `--yes` allows the harmless writes: the favourite's default, trust and the hub start. `--install <h>` runs that installer. A login and the Aide always need a terminal.
(3) `--yes` takes each question's default, so it never writes accounts.toml.
(4) Declines are remembered in a managed `[setup]` table in .cland/config.toml (`declined_installs`, `declined_accounts`), as the spec chose for installs.
(5) Trust goes to the profile the hub launches each harness with, plus every account a role names.
(6) An unedited roles template is rebuilt after an install, only while isRolesTemplate holds.
(7) TESTED_RANGES stays as a note only. OpenCode 1.x and 3.x lose their refusal; the adapter's behavioural check reports a real mismatch. check:opencode only reports.
(8) Doctor outside a project fails one row when no harness is installed. Neovim's row stays as it is.
(9) No product install override: the fake `curl` answers the official installer URLs.
(10) The T3 scenario uses script(1), with flags per platform.
(11) Codex's pinned install is dropped.
(12) The brief may name the onboarding skill before E-616 ships.
(13) "existing" vs "empty" follows the prototype's rule.
(14) A second interactive run reopens the workbench on aide-1.
(15) Stage 2 runs three lanes; each step is its own module.
(16) Plan approval per D51.
(17) Exit 130 when input ends at a question.
(18) `cland setup <dir>` takes the positional directory with init's root rules.

### hub · 2026-10-20T02:38:24.421Z

demo 865fb560-c476-46c0-ac5f-e671ac6f4a5e created: droplet cland-v0-865fb560, commit 32ae5bdce84f2a74cbcdd8ce0dc14dd14e301d79, deadline 2026-10-20T03:52:20.234Z.

### hub · 2026-10-20T02:42:50.438Z

demo 865fb560-c476-46c0-ac5f-e671ac6f4a5e destroyed: lifetime 315358 ms; cost $0.0219.

### hub · 2026-10-20T03:13:51.770Z

demo 021cc409-3041-4bed-96cb-69a6537b21de created: droplet cland-v0-021cc409, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T04:27:50.652Z.

### hub · 2026-10-20T03:17:15.307Z

demo 021cc409-3041-4bed-96cb-69a6537b21de destroyed: lifetime 249077 ms; cost $0.0173.

### qa-676 · 2026-10-20T03:52:32.355Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-2
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"L6/L8 --no-aide correctly skips launch but detail 'cland starts the hub with the workbench' does not explain the Aide skip. Behavior accepted by requester f7bb7491; Follow-ups XS.","file":"hub/src/setup/steps/aide.ts","line":11},{"severity":"low","text":"L8 first real setup could not acquire scratch Claude lock; explicitly authorized single delayed retry wrote trust and exited0. lsof returned no holder; self-infliction unproven. Initial FAIL retained and superseded by successful remedy per 8fc3ed10. Bugs S investigation.","file":"hub/src/setup/trust.ts","line":47},{"severity":"low","text":"L8 mtime-only safety probe is confounded by live Claude sessions. Observed human-file change occurred in idle gap before retry; requester independently observed another idle change. PASS-with-basis under f71d0ee6: scratch isolation, trust entries, timing and independent sample; no real-HOME config contents read.","file":"qa/briefs/E-613.md"}]
finding_counts: {"high":0,"medium":0,"low":3}

| Check | Placement | Result and observation |
| --- | --- | --- |
| G0 | local records | PASS: clean detached exact S, on dev, brief present, Node24.21.0 and tools |
| G1 | records | PASS: E-613 open under R-577, C1–C7 match; all16 children closed and merges ancestral |
| G2 | records | PASS: qa-676 verifier hold |
| G3 | local files | PASS: all five brief helpers prepared and syntax checked |
| D0 | droplet | PASS: one lease for this pass, exact S |
| D1 | droplet | PASS: clean S, Linux x86_64, Node24.21.0, resolver Neovim v0.12.5 matches pin |
| D2 | droplet | PASS: setup scenario 1/1, first attempt |
| D3a–D3l | droplet | PASS: twelve setup files, 88 tests, all first attempts |
| D4a–D4d | droplet | PASS: four doctor files, 33 tests, all first attempts |
| D5 | droplet | PASS: launcher11/11, including CLAND_OPEN_SESSION terminal focus, wait, and variable removal |
| D14 | records | PASS: fetched origin; freshness.current true; final check also current |
| D15 | records | PASS: one stop, state released, hub destruction comment confirmed |
| L1 | macOS M1 | PASS: plain/JSON no-terminal exit1, ten ordered lines/six open; files unchanged; no install, accounts, hub or launcher |
| L2 | macOS M1 | PASS: fake install/login Yes, accounts defaultNo, favourite Claude, both trust entries, same hub/discovery pid, Aide running with exact empty-project onboarding brief, one launcher call for aide-1 |
| L3 | macOS M1 | PASS: terminal and piped reruns exit0, completed steps ok, no prompts, same hub, two total launcher calls; stop Aide/hub |
| L4 | macOS M2 | PASS: declined Codex remembered; no repeat prompt/curl; explicit --install retry installs once |
| L5 | macOS M3 | PASS: Yes writes only own-directory claude-work account; no identity/default entries; favourite choice2 writes Codex |
| L6 | macOS M4 | PASS: flags and fake attach behave as specified; no workbench launch under --attach; exact detail-text expectation corrected by requester |
| L7 | macOS M5/M5b | PASS: unused harnesses not required, gh required only with github remote, versions informational, OpenCode env-only login warns |
| L8-first | macOS real binaries | FAIL retained: initial Claude scratch lock prevented trust; Codex trusted. Superseded by authorized single delayed remedy below |
| L8-remedy | macOS real binaries | PASS: retry exits0, Claude/Codex scratch trust entries verified; OpenCode no trust gate; all logins No, no hub/Aide/launcher |
| L8 final | macOS real binaries | PASS-with-basis: successful remedy plus scratch isolation and requester correction of confounded mtime-only probe |
| L9 | macOS | PASS: setup scenario1/1 first attempt, no skips |
| L10 | macOS | PASS: scratch process count0; six fixture roots, six recorded tmpdirs and /tmp/qa-e613 removed |

## Findings (low; none high or medium)

1. **Low — L6/L8, hub/src/setup/steps/aide.ts:11.** `cland setup --no-aide` correctly skips launch but says `cland starts the hub with the workbench`; this does not explain why the Aide was skipped. Requester f7bb7491-20cb-4142-b059-4d4dd85b9ff3 accepts behavior against C6, corrects the brief's exact-text expectation and will file polish follow-up (Follow-ups, XS). See [L6 output](L6-output.txt) and [ruling](L6-L8-ruling.txt).
2. **Low — L8-first, hub/src/setup/trust.ts:47.** First real `cland setup --no-aide` could not acquire the scratch Claude lock, reporting the documented retry advice. A single ten-second-delayed retry, explicitly authorized by 8fc3ed10-b56b-488b-83a7-abae9ea0b070, wrote the Claude trust entry and exited0. `lsof -Fpc` before retry found no holder; the lock path was a directory. No lock was manually changed. Whether detection caused the lock is unproven; report as Bugs/S for investigation, not as an attributed self-lock bug. See [first output](L8-output.txt), [holder evidence](L8-lock-holder-before.txt), [retry](L8-remedy-output.txt), [authorization](L8-remedy-ruling.txt).
3. **Low — L8 safety probe, brief defect.** Human Claude-config mtime was unchanged across the first invocation (03:46:54–03:47:01Z). It changed at03:47:48Z, in the idle gap before retry began03:48:16Z. The Coordinator separately sampled another change03:49:01Z with no setup running and attributed periodic writes to other live Claude sessions. Metadata-only checks cannot isolate QA's effect on this shared file. Under decisions b1ec0681 and f71d0ee6, safety passes on explicit scratch-only HOME/profile environments, the trust entries in those scratch files, the timing, and the Coordinator's independent sample. Only intentionally selected installed binary paths and the tested worktree CLI occur under the real HOME in output; no real-HOME configuration/data target is shown. Human file contents were never read. See [timing](L8-timing.txt), [isolation basis](L8-isolation-basis.json), [decision](L8-safety-ruling.txt).

## Criterion marks and substitutes

Verify **C1,C2,C3,C4,C5,C6,C7** in this run. None failed or deferred.

- C1: L1/L2/L3/L9 and D2/D3; ordered steps and idempotent rerun.
- C2: L2/L4 and D2/D3/D4; installs, login and remembered declines.
- C3: L2/L5 and D2/D3; defaultNo, explicitYes and favourite.
- C4: L2, L8 final and D2/D3; fake trust plus real Claude2.1.304, Codex0.163.0, OpenCode2.0.24 under scratch profiles. First lock failure and authorized remedy remain visible; safety is PASS-with-basis as above.
- C5: L2/L6 and D2/D3/D5. **Verified by substitute**: setup's stand-in launcher receives aide-1/root, paired with real headless Neovim component tests demonstrating centre terminal focus. No live end-to-end workbench was used.
- C6: L1/L6/D3 and the install/attach observations; no-terminal and flags behave as specified.
- C7: L7/D4; doctor's role/remote requirements and credential semantics.

Real-harness substitution: L8 uses --no-aide with every login/install declined. No prompt, login or real Aide session ran; fake L2/L6 cover launch and attach. The real trust entries are in [Claude extract](scratch-evidence/real/claude-trust-only.json) and [Codex config](scratch-evidence/real/codex-trust.toml).

## Test and resource evidence

Direct demo testing: **18 Linux files /133 tests + one macOS file /one test =134 tests**, no failures or skips and no test-file retries. The only manual retry was the explicitly authorized L8 remedy.

Lease **021cc409-3041-4bed-96cb-69a6537b21de**, machine **cland-v0-021cc409**, Linux x86_64. Created03:12:52.351Z; deadline04:27:50.652Z. Confirmed destroyed: **249077ms / $0.01729701388888889**. Local tests have no droplet cost. [Accounting](D15-after.json), [hub comments](D15-comments.txt), [final freshness](final-freshness.json).

Supporting Coordinator stage cover #5 at the same S was inspected, not rerun by QA:
- Linux **A-7022**, run51b982ae-ecdc-4e59-a786-b2294bd999ea: T1–T4, 3159 pass/0 fail/8 skips, both shards exit0. Shard1 cland-v0-1d139ca1, duration1222.07s/lifetime1215s/cost$0.0843; shard2 cland-v0-23418384, duration1592.07s/lifetime1584s/cost$0.1100; total$0.1944, wall1615.43s. [Receipt extract](INT_LOG_LINUX-read.txt).
- macOS **A-7026**, run40c55103-93ef-41fc-ac26-b818dd91c44a: T1–T4, 3167/3167, zero failures/skips, exit0. [Receipt extract](INT_LOG_MAC-read.txt).
- Duration-budget warnings remain report-only under D73; they were not counted as test failures.

Historical pass1 at32ae5bdc is **A-7004**, superseded after the release candidate changed; no verdict was recorded. Its destroyed lease cost$0.02189986111111111/lifetime315358ms. Total demo cost across both passes **$0.039196875**. Pass2 interim evidence is A-7018; this final report includes later local evidence.

All local checks were held during cover-quiet and then serialized after qa-3; local done sent to Coordinator and qa-2 after cleanup. No product files changed. The original and replacement build worktrees are removed after the verdict is accepted.

Wall time from pass2 preparation through final evidence capture: 2424.03s, including cover-quiet and local-slot waits. Evidence captured 2026-10-20T03:51:59.994804+00:00.

Verdict artifacts: A-7033 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7033-e-613-qa-clear-c1-c7-authorized-trust-remedy-and-safety-basis.md; full evidence A-7031 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7031-e-613-qa-pass-2-complete-evidence-at-824105c5

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
