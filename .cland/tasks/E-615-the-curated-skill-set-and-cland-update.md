---
id: E-615
kind: epic
title: The curated skill set and cland update
state: closed
criterion_seq: 5
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
topic: topic-567
branch: null
created: 2026-10-16T15:34:18.753Z
updated: 2026-10-19T08:03:22.453Z
closed: 2026-10-19T08:03:19.735Z
---

## Summary

cland ships a curated skill set, edited in place: 15 vendored skills stay and 23 go, and each kept skill carries its origin and changes in its own header instead of `skills-lock.json` and `skills/PATCHES.md`. `cland update` keeps a hash per file, so it refreshes a skill the project never touched and keeps one the project edited.

## Goal

A project gets only skills that serve cland's flows, and owns the edits it makes to them. Today `.agents/skills/` holds 43 skills: 38 vendored ones and cland's own five. Some vendored skills work against cland: sub-agents that merge without review, a guard that blocks pushes to the territory, a pull-request skill where cland has no pull requests. Sixteen copies differ from upstream while `skills/PATCHES.md` records four, and Codex still hides implement, to-spec, to-tickets, triage and wayfinder. `cland update` cannot tell an edited skill from an untouched one: it rewrites any listed file that differs, and it removes a dropped skill even when the project edited it (Q-595).

## Contents

- **The set** (Q-598 resolution 1). The 15 kept vendored skills: code-review, codebase-design, diagnosing-bugs, domain-modeling, grilling, implement, prototype, research, retro, tdd, to-spec, to-tickets, triage, wayfinder, writing-for-agents. cland's own five: handover, merge, plan-epic, qa, release. The `onboarding` skill joins them in "The onboarding skill and the newcomer's first page", making 21.
- **The 23 dropped** (Q-598 resolution 2): chief-of-staff, claude-handoff, git-guardrails-claude-code, handoff, implement-spec, pr, setup-matt-pocock-skills, ask-matt, grill-me, teach, to-questionnaire, wait-what, wizard, migrate-to-shoehorn, scaffold-exercises, setup-pre-commit, setup-ts-deep-modules, loop-me, writing-beats, writing-fragments, writing-shape, grill-with-docs, improve-codebase-architecture. Afterwards no clause, template, doc or kept skill names a dropped one.
- **Origins in the skills** (Q-598 resolution 3). `skills-lock.json` and `skills/PATCHES.md` are deleted. Each kept vendored skill's frontmatter carries a metadata header: its origin commit, the MIT notice and one line of changes, including the changes PATCHES.md never recorded (Q-595 lists them per skill).
- **The fallback lines.** The five kept skills that point at `/setup-matt-pocock-skills` point at `cland update`.
- **The Codex listing.** The flag in each skill's `agents/openai.yaml` follows the removed `disable-model-invocation`, so Codex lists implement, to-spec, to-tickets, triage and wayfinder.
- **Hashes in the manifest** (Q-598 resolution 4). `.agents/skills/.cland-manifest.json` records the SHA-256 of each file as cland wrote it, and `cland update` decides per skill: an untouched copy is refreshed; an edited copy is kept and reported "edited in the project"; a skill new to the set is added unless the project already has a folder of that name; a dropped skill is removed when untouched and handed to the project when edited. The `.claude/skills` link to `.agents/skills` stays.
- **Old manifests** (Q-598 resolution 5). A manifest without hashes gets one last overwrite from the first `cland update` of 0.1.4, with a warning line; no table of past hashes ships.

Not in this epic: the `onboarding` skill itself; skills a project writes for itself, which the manifest never lists and `cland update` never writes.

## Tracer-bullet order

1. **The set.** Drop the 23, delete the lock and PATCHES.md, write the headers, fix the fallback lines and the Codex flags. Demo: a fresh `cland init` provisions the 20 skills, each kept vendored skill shows its header, and Codex lists the five skills it hid.
2. **Hashes and the update rules.** Demo: in a scratch project, with a newer set simulated (`CLAND_SKILLS_SOURCE_OVERRIDE`), `cland update` refreshes an untouched skill, keeps and reports an edited one, adds a new one, skips a new one whose folder exists, removes a dropped untouched one and hands a dropped edited one to the project.
3. **Old manifests.** Demo: a project initialised by v0.1.3 gets one overwrite with a warning on its first update, and hashes from then on.

## Definition of done

QA runs the demo below on `dev`, through the demo lease where no macOS is needed and with the Codex listing read on this Mac, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

QA reads this repository's `.agents/skills/` and a fresh scratch project's after `cland init`, the headers of the kept skills and Codex's list of skills. In a scratch project initialised by v0.1.3, QA runs `cland update` once and reads the warning; then, with a newer set simulated, it edits one skill and runs `cland update` again, reading each decision in the report.

- [ ] C1. `.agents/skills/` holds the 15 kept vendored skills and cland's own five, the 23 dropped skills, `skills-lock.json` and `skills/PATCHES.md` are gone, and no clause, template, doc or kept skill names a dropped one.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T08:02:55.616Z · commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
- [ ] C2. Each kept vendored skill's frontmatter carries its origin commit, the MIT notice and one line of changes, and the five fallback lines point at `cland update`.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T08:02:55.616Z · commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
- [ ] C3. Codex lists implement, to-spec, to-tickets, triage and wayfinder.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T08:02:55.616Z · commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
- [ ] C4. The manifest records a SHA-256 per file, and `cland update` refreshes an untouched skill, keeps an edited one reported "edited in the project", adds a new one unless its folder exists, and removes a dropped skill when untouched or hands it to the project when edited.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T08:02:55.616Z · commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
- [ ] C5. A manifest without hashes gets one last overwrite with a warning line on the first `cland update`.
  - verified: qa-676 [qa] · run qa-2026-10-19-1 · 2026-10-19T08:02:55.616Z · commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Tests.** The update rules are tested on temporary projects with a newer set simulated through `CLAND_SKILLS_SOURCE_OVERRIDE`, never on this repository's own skills.
- **Risks.** `.agents/skills/` is both the set cland ships and the copy this repository's own sessions use, so the dropped skills leave this project's sessions too when this epic merges.
- **Order.** First in the skills lane, with no blocker. "The onboarding skill and the newcomer's first page" waits for it.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.6 (The curated skill set) and §4 (The cut).
- Items: map M-591, decision 4; Q-595 (the triage: what each skill does, where cland names it, which patches it carries); Q-598 (the human's decisions).
- Research: `docs/research/skills-triage.md` on research/skills-triage (b02343a9).
- Code: `hub/src/init/skills.ts` (the manifest and the update rules), `hub/src/init/files.ts`, `skills-lock.json`, `skills/PATCHES.md`, `.agents/skills/*/agents/openai.yaml`.

## Plan

```yaml
stages:
  - name: the set
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-620
      - - T-621
  - name: headers and the update rules
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-622
      - - T-623
        - T-624
        - T-625
        - T-626
```

## Comments

### hub · 2026-10-19T07:58:18.267Z

demo 154de9c5-dea5-46d3-8c44-9c907d4c443c created: droplet cland-v0-154de9c5, commit 051afd53a0a4abf5884d90d74faf55a6cbf8dca2, deadline 2026-10-19T09:12:05.719Z.

### hub · 2026-10-19T08:02:07.063Z

demo 154de9c5-dea5-46d3-8c44-9c907d4c443c destroyed: lifetime 287947 ms; cost $0.0200.

### qa-676 · 2026-10-19T08:02:55.616Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-19-1
commit: 051afd53a0a4abf5884d90d74faf55a6cbf8dca2
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface / executor | Result | Command / observation | Evidence |
| --- | --- | --- | --- | --- |
| G0 | hub-api / local | PASS | clean051afd53 ondev;brief committed;Node24.21.0 Codex0.163.0 | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/G0.txt) |
| G1 | hub-api / local | PASS | 7 children andT822 closed;9 ancestors;criteriaC1-C5 match | [G1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/G1.txt), [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/G1-epic.json), [G1-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/G1-children.json) |
| G2 | hub-api / local | PASS | QA hold present | [G2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/G2.txt) |
| D0 | hub-api / droplet | PASS | one active lease154de9c5 exactS deadline09:12:05.719Z | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D0-start.json), [D0-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D0-status.json) |
| D1 | hub-api / droplet | PASS | exactS clean Linuxx86_64 Node24.21.0;v0.1.3 commit available | [D1-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D1-build.txt) |
| D2 | hub-api / droplet | PASS | 20 kept;23 dropped absent;20 links0dangling;only19 historical spec references;locks/PATCHES absent | [D2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D2.txt) |
| D3 | hub-api / droplet | PASS | fresh20 skills byte-equalS;69 SHA256 files0mismatch0unlisted;clean;no dropped refs | [D3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D3.txt) |
| D4 | hub-api / droplet | PASS | 15 provenance/MIT/license/changes rows pass;5 fallback lines each1;lint0 | [D4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D4.txt) |
| D5 | hub-api / droplet | PASS | only handover has explicit-only flags;allothers neither flag | [D5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D5.txt) |
| D6 | hub-api / droplet | PASS | v0.1.3 init43 list-form skills;update once warning1 removes23 refreshes18;69 valid hashes;prehash tdd edit overwritten with history retained;origin renamed0 | [D6.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D6.txt) |
| D7 | hub-api / droplet | PASS | newer-set text decisions and8 disk/manifest rows exactly match;keeps edits;refreshes tdd;adds qa-new;retains qa-own;drops retro/hands over prototype;warning0 | [D7.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D7.txt) |
| D8 | hub-api / droplet | PASS | third update JSON decisions match;17 unchanged;no prototype/retro entries;no warning;git status0 | [D8.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D8.txt) |
| D9a-update | hub-api / droplet | PASS | droplet node --test hub/test/init-skills-update.test.ts;exit0 fail0; 18 tests passed | [D9a-update.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9a-update.txt), [D9a-update-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9a-update-full.log) |
| D9b-report | hub-api / droplet | PASS | droplet node --test hub/test/init-skills-report.test.ts;exit0 fail0; 1 tests passed | [D9b-report.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9b-report.txt), [D9b-report-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9b-report-full.log) |
| D9c-invocation | hub-api / droplet | PASS | droplet node --test hub/test/skills-invocation.test.ts;exit0 fail0; 1 tests passed | [D9c-invocation.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9c-invocation.txt), [D9c-invocation-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9c-invocation-full.log) |
| D9d-doctor | hub-api / droplet | PASS | droplet node --test hub/test/doctor.test.ts;exit0 fail0; 18 tests passed | [D9d-doctor.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9d-doctor.txt), [D9d-doctor-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9d-doctor-full.log) |
| D9e-init | hub-api / droplet | PASS | droplet node --test hub/test/init.test.ts;exit0 fail0; 13 tests passed | [D9e-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9e-init.txt), [D9e-init-full.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D9e-init-full.log) |
| D14 | hub-api / local | PASS | freshness.current=true;dev atS;worktree clean | [D14-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D14-status.json), [D14-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D14-dev.txt) |
| D15 | hub-api / local | PASS | hub confirmed released/destruction;287947ms cost$0.019996319444444445 | [D15-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D15-stop.json), [D15-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D15-after.json), [D15-comments.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/D15-comments.txt) |
| L1 | hub-api / local | PASS | macOS Codex0.163.0 prompt-input lists19 atS;allfive listed;handover hidden;clean | [L1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L1.txt), [L1-codex-build.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L1-codex-build.json), [L1-codex-build.err](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L1-codex-build.err) |
| L2 | hub-api / local | PASS | macOS freshinit20;Codex lists19 allfive;handover hidden;clean | [L2-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L2-setup.txt), [L2.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L2.txt), [L2-codex-fresh.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L2-codex-fresh.json), [L2-codex-fresh.err](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L2-codex-fresh.err) |
| L3 | hub-api / local | PASS | v0.1.3 control19 listed;allfive MISSING;listing discriminates hidden vs shown | [L3.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L3.txt), [L3-codex-v013.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L3-codex-v013.json), [L3-codex-v013.err](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L3-codex-v013.err) |
| L4 | hub-api / local | PASS | literal non-forced rm-r /tmp/qa-e615-codex;directory count0 | [L4.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/L4.txt) |

Findings by severity:

- High: none.
- Medium: none.
- Low: none. Known **T-851** was not reproduced: D6 used canonical scratch paths and printed `origin renamed: 0`. It was not refiled.

Criterion marks:

| Criterion | Result | Checks |
| --- | --- | --- |
| C1 | PASS / verified | D2,D3 |
| C2 | PASS / verified | D3,D4 |
| C3 | PASS / verified | L1,L2,L3,D5,D9c-invocation |
| C4 | PASS / verified | D3,D7,D8,D9a-update,D9b-report |
| C5 | PASS / verified | D6,D7,D9a-update,D9d-doctor |

Build and accounting:

- E-615; run `qa-2026-10-19-1`; tested full SHA `051afd53a0a4abf5884d90d74faf55a6cbf8dca2`. Dev was still at the requested SHA when resolved. The brief was committed there; seven child tasks and T-822 were closed; all nine prerequisite commits, including the v0.1.3 release commit, were ancestors. The detached build remained clean.
- **23 checks PASS; five targeted test files / 51 tests passed first attempt.** No reruns, no full suite. Product shell/test execution was on Linux x86_64 / Node v24.21.0; the three Codex listings were on macOS using **codex-cli 0.163.0**, without model calls or harness sessions.
- One droplet lease `154de9c5-dea5-46d3-8c44-9c907d4c443c`, machine `cland-v0-154de9c5`; created 2026-10-19T07:57:07.226Z; deadline 2026-10-19T09:12:05.719Z. Hub confirmed **released** with a destroyed comment. Final lifetime **287947 ms**, total cost **$0.01999632**. Local cases have no droplet cost; per-case remote costs are cumulative snapshots, not separate charges.
- Total wall time from hold acquisition through final accounting: approximately 409.1 seconds. D14 freshness.current=true. Part L ran alongside provisioning as expressly permitted; L4 removed its scratch directory. Remote scratch state ended with lease destruction.

Manual results:

- Shipped and freshly initialized projects contained exactly the 20 kept skills. All 23 dropped skills and obsolete lock/PATCHES files were absent. Twenty Claude skill links resolved. Dropped-skill references occurred only in the historical spec, as allowed.
- All 15 upstream provenance headers had origin commits, MIT notices, license files and one-line changes. Each of the five fallback lines named cland update. Fresh copies were byte-equal to S, with 69 correct SHA-256 entries and no unlisted files.
- A real v0.1.3 init produced the 43-skill list manifest. Its first update warned exactly once, removed 23 skills, refreshed 18 and replaced the pre-hash tdd edit while preserving the old copy in Git history. The resulting 20-skill manifest had 69 valid hashes.
- The simulated newer set refreshed untouched tdd, preserved edited grilling/research, added qa-new, kept the existing qa-own folder, removed untouched retro, and handed edited prototype to the project. All eight disk/manifest comparison rows matched. The third update had 17 unchanged entries, no repeated warning, no prototype/retro management entries and a clean Git status.

Codex listings (exact extracted summaries):

L1:

```text
codex-cli 0.163.0
prompt-input exit 0
project skills root: /Users/evgeniyivanov/Projects/cland/v0/.cland/worktrees/qa-e615-qa-2026-10-19-1/.agents/skills
19 project skills listed: code-review codebase-design diagnosing-bugs domain-modeling grilling implement merge plan-epic prototype qa release research retro tdd to-spec to-tickets triage wayfinder writing-for-agents
the five: implement listed, to-spec listed, to-tickets listed, triage listed, wayfinder listed
handover: not listed
project status lines after: 0
```

L2:

```text
codex-cli 0.163.0
prompt-input exit 0
project skills root: /private/tmp/qa-e615-codex/fresh/.agents/skills
19 project skills listed: code-review codebase-design diagnosing-bugs domain-modeling grilling implement merge plan-epic prototype qa release research retro tdd to-spec to-tickets triage wayfinder writing-for-agents
the five: implement listed, to-spec listed, to-tickets listed, triage listed, wayfinder listed
handover: not listed
project status lines after: 0
```

L3:

```text
codex-cli 0.163.0
prompt-input exit 0
project skills root: /private/tmp/qa-e615-codex/v013/.agents/skills
19 project skills listed: code-review codebase-design diagnosing-bugs domain-modeling git-guardrails-claude-code grilling merge migrate-to-shoehorn plan-epic pr prototype qa release research scaffold-exercises setup-pre-commit tdd wizard writing-for-agents
the five: implement MISSING, to-spec MISSING, to-tickets MISSING, triage MISSING, wayfinder MISSING
handover: not listed
project status lines after: 0
```

Scope and execution notes:

- Claude Code’s live skill listing is not demonstrated, as the accepted gap states. D3/D4 prove byte-equal fresh copies and valid frontmatter. Codex’s current/fresh lists contain all five required skills; the v0.1.3 control misses all five, proving this listing method distinguishes shown from hidden. Handover remains explicit-only.
- Human-readable update output groups noteless created/updated actions by count. D7’s file/hash comparison and D8’s JSON report establish which skills received those actions. Per-skill Claude links, refusal cases and manifest validation receive only the coverage specified in the five test files; no live doctor or undo was run.
- Every init/update targeted a scratch project under /tmp/qa-e615 or /tmp/qa-e615-codex using env-i with scratch HOME/XDG/Git identity. Codex listing alone used the real HOME, as required by the brief. No scratch hub, provider command, real model session or product edit was used.
- Cleanup-only script adjustments are explicit: the requester required literal rm paths, so D7’s two variable rm-r operands became their literal scratch paths. Automatic approval review then rejected a local rm-rf batch because forced removal is prohibited; none of that batch executed. After inspecting the owned scratch directory, literal non-forced rm-r succeeded. Remote D3/D6/D7 resets were changed before execution to existence-guarded literal rm-r, preserving their behavior. L2-setup had already run as originally supplied. No hub refusal was bypassed; checks and expected assertions were unchanged. See request.txt for the chronology.
- Recorder surface is hub-api, with macOS/droplet recorded as placement. Literal cleanup paths were proposed as a project rule in the item topic.

Evidence includes the [committed brief](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/brief.md), [request and deviations](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/request.txt), [all records](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/run-records.jsonl), [raw update reports](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence/scratch-captures), and all executed scripts/test logs.

Evidence A-5872: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5872-e-615-qa-qa-2026-10-19-1-complete-demo-evidence

Verdict report A-5873: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5873-e-615-qa-clear-c1-c5-curated-skills-and-update-behavior.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
