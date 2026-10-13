---
id: E-117
kind: epic
title: "Release from the item"
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1
  - ready-for-agent
assignee: null
parent: R-130
blocked_by:
  - E-107
  - E-108
  - E-109
  - E-110
  - E-111
  - E-112
  - E-113
  - E-114
  - E-115
  - E-116
topic: topic-140
branch: null
created: 2026-10-09T21:51:34.973Z
updated: 2026-10-11T17:08:06.686Z
---

## Goal

The human ships v0.1.0 from its release item: `cland release --item` takes the version from the item, writes the notes from the item and its epics, tags and pushes, and closes the item. This epic also runs the v0.1 acceptance pass on `dev` and the release itself, so v0.1 is done when its item closes. Today `cland release vX.Y.Z` takes the version by hand, and the notes are only the commit subjects.

## Contents

- **§3.1 Item hierarchy, Releasing**: `cland release --item T-n` tags `v<version>`, writes the notes from the item's `## Notes`, its epics' one-line deliverables and the commit subjects, refuses an item with open children or no version, and on success comments the tag on the item and closes it; without an item, a release behaves as today, so a hotfix needs no planning.
- **The release flow**: the `release` skill and the Coordinator's clause release from the item after the human approves the version and the notes.
- **The v0.1 acceptance pass and v0.1.0**: every v0.1 epic's definition-of-done demo replayed on `dev`, the open `tech-debt` items triaged, and v0.1.0 released from its item.

Not in this epic: anything the other ten epics own. It waits for all of them.

Choices where the spec is silent:

- An epic's one-line deliverable is the first sentence of its `## Goal`; every v0.1 epic opens its Goal with one.
- With `--item`, a version given on the command line must match the item's.
- The `tech-debt` triage follows the standing rule: fix before the release only what blocks it; the rest stays for the v0.1 tail.

## Tracer-bullet order

1. **A dry run from the item.** `cland release --item T-n --dry-run` reads the release item, refuses on open children or a missing version and names them, and previews the tag and the notes. Demo: a dry run on the v0.1 item lists the open epics that still block it.
2. **Notes from the item.** The item's Notes section, its epics with the first sentence of their Goal, then the commit subjects; the `release` skill shows them to the human in an ask before the real run. Demo: the dry run's notes read as finished release notes.
3. **Release and close.** The tag `v<version>`, `main` fast-forwarded to `dev` and pushed to GitHub as today; the hub comments the tag on the item and closes it; the next open release becomes the current one; a release without `--item` behaves as before. Demo: a scratch project releases from a test release item, which then closes with the tag in its comments.
4. **The v0.1 acceptance pass.** QA replays every epic's definition-of-done demo on `dev`, with the cases the epics shipped, and records a QA report artifact; findings are filed as `qa-found` and `needs-triage`; the open `tech-debt` items are triaged; the v0.1 item ends with no open children. Demo: the report lists each epic's demo and its result.
5. **v0.1.0.** The item's Notes are written with the human (or an Aide for them); the Coordinator runs `cland release --item` from its own shell after the human approves; GitHub's `main` carries the tag `v0.1.0`; the item closes with the tag comment. Demo: `v0.1.0` on GitHub and the v0.1 release folded as closed in the items panel.

## Definition of done

QA runs this epic's walkthrough on `dev` and closes it on a clear verdict with its checkboxes verified by id; the release goes out on that (decision D19, 2026-10-11: the human does no acceptance pass). Before it, the other ten epics close on their own QA verdicts as their paragraphs say (D16). The version is v0.1.0 (D18); the stand-in answers the version ask with it. The checks deferred from earlier epic demos (T-109 C1, real Ghostty/tmux keys; T-111 M7, real-model Aide follow-through) are not release blockers: the release notes list them as "verified in v0.1.1".

The Coordinator runs `cland release --item T-<v0.1> --dry-run`: it shows `v0.1.0`, the Notes, the ten other epics with their one-line deliverables, and the commit subjects. After the clear QA verdict it runs the release: `main` moves to `dev`, is tagged `v0.1.0` and pushed to GitHub; the hub comments the tag on the release item and closes it; the items panel folds v0.1 as a closed release.

- [ ] C1. `cland release --item` refuses an item with open children or no version, and names the reason.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.979Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C2. The notes hold the item's Notes, its epics with their one-line deliverables, then the commit subjects.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.979Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C3. A successful release comments the tag on the item and closes it; a release without `--item` behaves as before.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.979Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C4. The `release` skill and the Coordinator's clause release from the item after the human's approval.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.979Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C5. Every v0.1 epic's definition-of-done demo passes on `dev`, recorded in a QA report artifact.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.979Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C6. The v0.1 release item has no open children, and the open `tech-debt` items are triaged.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.980Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c
- [ ] C7. The build used what it shipped: the release item, item leads, an Aide, `crew.toml` and epic plans each show in the tracker or the journal.
  - verified: qa-18 [qa] · run qa-2026-10-11-18-117 · 2026-10-11T17:07:54.980Z · commit ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c

## Dogfooding

v0.1 ships from its own release item. The next release starts as a release item from its first epic, its epics planned with `plan-epic` and its work staffed by `crew.toml`; hotfixes keep releasing without an item.

## Constraints

- **ADRs.** 0004 (Agents work on a local git territory): a release fast-forwards `main` to `dev`, tags it and pushes to GitHub, and only `cland release` pushes there. 0002 (Task tracker: Markdown files are the source of truth, the hub keeps the index): the notes come from the item files. 0001 (Roles are hub-held state delivered as events): the Coordinator releases from its own shell and never delegates a release.
- **Research.** `research/git-engines` (`docs/research/git-engines.md`): the territory and the release mechanics. `research/qa-astra` (`docs/research/qa-astra.md`): the QA lane the acceptance pass runs on.
- **The v0 tail.** T-78 (merge, worktree and release checks read the tracker's synchronous view) touches the release checks. It is not a prerequisite unless it blocks the release; otherwise it carries `tech-debt` and the acceptance pass triages it.
- **Order.** Last in the hub lane and last of all: it waits for every other v0.1 epic.
- **Git and the gate.** Commit on the task branch `t/<id>-<slug>` in its worktree and push it to `origin`, the local territory; work reaches `dev` only through `cland merge` and its verdict gate; only `cland release` pushes to GitHub. This epic's release is the one push that ships v0.1.0.
- **Language.** Every artifact, item, commit and doc in English, the release notes included.
- **Tests** through the v0 seams, in this order: the hub's frame protocol first (a real hub process and a real spoke over MCP and WebSocket, the UI over the JSON-lines socket, the `cland` CLI against a temporary project; `hub/test/harness.ts`); the harness process boundary second, with the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/` run by `cland --headless --qa`). No new seams inside the hub. The release runs against a temporary project with a bare territory and a stand-in GitHub remote, as `hub/test/release.test.ts` does today.

## Links

- Spec: `docs/spec/v0.1.md` on `dev`, §3.1 Item hierarchy (Releasing, Tree and scope); §4 Outside v0.1, which the cut fills.
- Map T-81: decision T-87; the cut, T-101.
- GLOSSARY: Release, Territory, Item.
- ADRs: `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0002-tracker-files-are-the-source-of-truth.md`, `docs/adr/0001-roles-are-hub-held-state.md`.
- Branches: `research/git-engines`, `research/qa-astra`.

## Plan

```yaml
stages:
  - name: release from the item
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-224
        - T-225
```

## Comments

### coord · 2026-10-10T16:54:24.008Z

Deferred to the acceptance walkthrough (D16): T-109 C1, the real Ghostty and tmux key-encoding matrix (brief M2), BLOCKED in qa-2026-10-10-15-109-c because it needs real terminals.

### coord · 2026-10-10T17:03:43.026Z

Deferred to the acceptance walkthrough (D16): T-111 M7, the Coordinator following through on an Aide's decision with a real model (qa-2026-10-10-15-111-c; the decision delivery itself passed).

### coord · 2026-10-11T15:39:08.841Z

C8 ('v0.1.0 is tagged on GitHub's main, and the v0.1 release item is closed') moved to T-130 as the release's post-check (cland-impl, 2026-10-11 15:42Z). The close gate needs every criterion verified at the dev tip, and C8 can only hold after T-117 closes. Order: QA verifies C1–C7 at the tip, T-117 closes, the Coordinator releases from T-130, then QA post-checks the tag and T-130 closes. No human override.

### qa-18 · 2026-10-11T17:07:54.980Z

verdict: qa
result: clear
by: qa-18 [qa]
run: qa-2026-10-11-18-117
commit: ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c

| Case | Result | Checked |
|---|---|---|
| M0 | PASS | Correct C1–C7, closed children, only T-117 open under T-130, T-216 outside |
| M1 | PASS | 25 targeted tests, serial; 8 release-item + 17 release; no failures/skips/cancellations |
| M2 | PASS | Open descendants refuse preview/publication, refs and item unchanged |
| M3 | PASS | Missing version, mismatch, wrong kind and unknown item refusals |
| M4 | PASS | Exact notes, epic first sentences, commit subjects, refs; preview nonmutating |
| M4b | PASS | Real T-130 Notes copied to scratch; both D19 lines retained; 11 expected deliverables recorded |
| M5 | PASS | Scratch annotated publication, refs, human tag/full-SHA comment, closure, journal |
| M6 | PASS | Legacy scratch release only commit notes, open releases and next-item bytes unchanged |
| M7 | PASS | Release skill/clauses; corrected Claude skill links at ed56fca |
| M8 | PASS | All ten prior epics closed with latest clear hub QA and existing report artifacts |
| M9 | PASS | Release tree, item-lead loop, Aide, crew enforcement and epic plan evidence |
| M10 | PASS | 16 open tech-debt children triaged; no needs-triage; only T-117 open in release |

Findings by severity:
- Medium, fixed, M7: `ls .claude/skills` lacked release; Coordinator confirmed its Claude harness reads there. Fixed by Coordinator at ed56fca. `readlink`/resolved SKILL.md bytes and `git diff 9fcad49 dev` confirm release, qa, plan-epic symlinks and no other delta.
- Low, brief correction, M6: scratch `cland merge T-10 --override "QA fixture"` refused merge-unpublished for the manually committed release plan. Scratch `cland push`, then continuing that merge, made the fixture ready. Legacy release then passed. No root push.
- Low, brief correction, M7: qa-record rejected the brief's `docs` surface. Completed docs check recorded as hub-api with original evidence. No omitted check.

Verified marks: C1=M2/M3, C2=M4/M4b, C3=M5/M6, C4=M7, C5=M8, C6=M10/M0, C7=M9; all seven verified in this run. No unresolved product findings.

Evidence gathered initially at 9fcad4977f258477d462ea0ed352735b459d8e84; authorized delta to verdict ed56fca66bd9fb688aab33fdfdcbb4b4bf0faf4c is three Claude skill symlinks only, no product code. M7 checked final tip; re-read dev immediately before this verdict, unchanged. Source clean; only tracker hold modified. Scratch hub stopped. Root release/sync/push never run.

D16 accepts prior epic demos; D19 defers T-109 C1 real terminals and T-111 M7 real-model follow-through, retained in Notes. Real-model Coordinator approval not exercised. M9 observation: T-117's last stage is the only epic plan, rather than plans for epics 8–11; retrospective observation per brief, not C7 failure. P1 belongs to a new T-130 run after the Coordinator releases.

Full case evidence, confirmed C5 table, C7 journal rows and all eleven expected deliverable lines: A-1317, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1317-t-117-qa-clear-release-walkthrough-25-tests-and-complete-evidence/report.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-11T17:08:06.686Z

Closed on QA run qa-2026-10-11-18-117 (A-1317): clear at dev ed56fca, C1–C7 verified, M0–M10 including M4b, 25 targeted tests. M7's missing .claude/skills links (release, qa, plan-epic) were fixed at ed56fca. The post-release check (the old C8) sits on T-130 (D19).
