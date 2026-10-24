---
id: E-420
kind: epic
title: Release v0.2.0 from the item
state: closed
criterion_seq: 5
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-414
  - E-418
  - E-419
topic: topic-922
branch: null
created: 2026-10-14T15:59:26.349Z
updated: 2026-10-24T01:39:27.935Z
closed: 2026-10-24T01:39:27.935Z
---

## Summary

v0.2.0 ships from its release item R-377 once every other epic has closed on its QA demo: an integrated pass over the paths that cross the two lanes, the docs, the notes and the dry run close this epic, and the release, its check and the retrospective follow. The release is the build's only push to GitHub.

## Goal

v0.2, the web workbench, ships from its release item: `cland release --item R-377` publishes version 0.2.0 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective artifact records the run. The paths that no single epic's demo covers, where the hub lane meets the web lane, are checked once on the integrated build before the release.

## Contents

- **The demos** (§4, Definition of done): every other epic of R-377 closed on its QA demo with a clear verdict, the web phase included in headless Chromium.
- **The integrated pass:** a relayed approval answered from the web's inbox and from a session's drawer; one gate across a desktop context, a phone context and Neovim; the read marks agreeing between Neovim and two browsers; a phone context resuming after a hub restart.
- **The docs:** the tunnel guide, written with E-419, checked against the built release; the web workbench's README (`web/README.md`, as `nvim/README.md` is Neovim's); and the web edge's section in `hub/README.md`.
- **The release** (§4): R-377's `## Notes` written from the item and its epics; `cland release --item R-377 --dry-run`, with its notes and version 0.2.0 shown in an ask; `cland release --item R-377`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective:** an artifact of the run.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the deferrals of §4 (a terminal in the browser, mouse edits, a home page over several projects, push with the page closed, Neovim adopting the snapshot and the deltas, a read-only view for another person), which wait for 0.2.x.

Choices where the spec is silent:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-377, as they followed E-273 for v0.1.2.
- **The notes** go in R-377's `## Notes`, written by the Coordinator: the goal; one paragraph per epic on what the human can now do in the browser; the run's decisions; the deferrals to 0.2.x; the checks deferred; the known issues filed in the categories.
- **The version** is R-377's recorded 0.2.0. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite with the web phase on the dry run's tip, on droplets, and one full local run on macOS for the macOS-only cases.
- **The retrospective** is a folder artifact: the report and the script that made it, adapted from v0.1.2's, with the sessions, rounds and cost per epic and per role that the records allow, and the web's own numbers: the web phase's time on a full run, the bundle's size, the snapshot's size and the first full tree's time on the live tracker, against the prototype's. What the human reported from the phone goes in as the human said it.

## Tracer-bullet order

1. **The integrated pass.** The paths across the lanes on `dev`: the relayed approval in the web, one gate across a desktop context, a phone context and Neovim, the read marks, and the phone's resume. Demo: a fake Codex approval answered in a phone context folds in a desktop context's inbox and in Neovim's within a second.
2. **The docs.** The tunnel guide and the web README checked against the build, and the web edge in `hub/README.md`. Demo: QA follows `web/README.md` from a fresh clone to a signed-in browser without other help.
3. **The notes and the dry run.** R-377's notes, the green suites, and `cland release --item R-377 --dry-run` with 0.2.0. Demo: the dry run prints version 0.2.0 and the notes, with every other epic of R-377 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-377`, and QA's check of the tag. Demo: tag `v0.2.0` is on GitHub `main`, R-377 is closed, and QA's verdict on R-377 is clear.
5. **The retrospective.** After the release: the folder artifact of the run. Demo: the artifact shows the sessions, rounds and cost per epic and per role, and the web's own numbers against the prototype's.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, headless Chromium and a headless Neovim workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, QA opens a desktop context at 1440x900 and a phone context at 390x844 beside the headless Neovim workbench. A fake Codex session's approval is answered in the phone context and folds in the desktop context's inbox and in Neovim's; another fake Codex approval is approved from the session's drawer; two contexts answer one ask at once and both read one outcome; a topic read in Neovim reads as read in both contexts; the phone context resumes after a hub restart. From a fresh clone QA follows `web/README.md` to a signed-in browser. On `dev`, `cland task list --under R-377 --state open --json` lists only this epic; QA reads R-377's notes and `cland release --item R-377 --dry-run` with version 0.2.0, and the latest full suites on that tip, the web phase included and a local run on macOS, are green.

- [ ] C1. Every other epic of R-377 is closed on a clear QA verdict, and no open item other than this epic remains under R-377.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T01:39:09.180Z · commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42
- [ ] C2. The integrated pass is clear: a relayed approval answered from the web, one gate across two browser contexts and Neovim, read marks agreeing across the clients, and a phone context resuming after a hub restart.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T01:39:09.180Z · commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42
- [ ] C3. `web/README.md` with the tunnel guide and `hub/README.md` describe the web workbench as built, and a fresh clone reaches a signed-in browser by following them.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T01:39:09.180Z · commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42
- [ ] C4. R-377's `## Notes` describe the release by epic, the run's decisions, the deferrals to 0.2.x and the known issues, and `cland release --item R-377 --dry-run` shows them with version 0.2.0.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T01:39:09.180Z · commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42
- [ ] C5. A full suite with the web phase is green on the `dev` tip of the dry run, with a local run on macOS for the macOS-only cases.
  - verified: qa-676 [qa] · run qa-dod-2026-10-24-1 · 2026-10-24T01:39:09.180Z · commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-377` on the answer; QA checks that tag `v0.2.0` is on GitHub `main` and records its verdict on R-377; the retrospective artifact follows and is linked from R-377.

## Dogfooding

The release runs on what the build shipped: the human follows it from the web's inbox and events view, answers the release ask in the browser or on the phone, and the notes come from the item and its epics as the Items area shows them.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it. Releasing stays out of the web (§3.7), and `cland release --item R-377` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in R-377's file.
- **Risks.** A refused release (an open child, a dirty root) is fixed before it is retried, never overridden.
- **Size.** About three sessions on the v0 scale.
- **Order.** Last: it waits for E-414, E-418 and E-419, the ends of the two lanes.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §4 (the scope, the deferrals, the definition of done); `docs/spec/v0.1.md` §4 (D16, D19); `docs/spec/v0.1.2.md` §4.
- Tickets: R-377, the release item; Q-409, the cut; the map M-399; E-273, the v0.1.2 release epic and the model for this one.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.

## Plan

```yaml
stages:
  - name: release preparation
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1185
      - - T-1186
```

## Comments

### hub · 2026-10-24T01:21:51.876Z

demo e137c296-7578-4210-a118-1d3283ff7c02 created: droplet cland-v0-e137c296, commit 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42, deadline 2026-10-24T02:35:25.649Z.

### hub · 2026-10-24T01:27:56.477Z

demo e137c296-7578-4210-a118-1d3283ff7c02 destroyed: lifetime 434574 ms; cost $0.0302.

### qa-676 · 2026-10-24T01:39:09.180Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-dod-2026-10-24-1
commit: 733a709e2e71d0ae7206c5ae2485aa8ca1a91f42
findings: [{"severity":"low","text":"E420D-06: committed W2 helper saves raw cland web bearer-link stdout despite brief prohibition. Coordinator-authorized saved-log redaction applied before execution, exact diff retained; zero unredacted token values in captures.","file":"qa/briefs/E-420.md"},{"severity":"low","text":"E420D-00 QA capture limitation: wrapper extraction error appended premature PASS before executing gate. Immediately invalidated by retained INCONCLUSIVE line; actual gate then ran once and passed. All historical lines retained; initial PASS is invalid and superseded."}]
finding_counts: {"high":0,"medium":0,"low":2}

| Check | Where | Result | Evidence |
|---|---|---|---|
| E420D-00 | macOS read | PASS — Clean exact S, committed brief, Node and child landings | [E420D-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-00.txt) |
| E420D-01 | macOS read | PASS — Hold, criteria, closed children and closed stage | [E420D-01-plan.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-01-plan.txt) |
| E420D-02 | Linux demo | PASS — Active exact-S lease | [E420D-02.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-02.json) |
| E420D-03 | Linux demo | PASS — Clean source and seven identical helpers | [E420D-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-03.txt) |
| E420D-04 | Linux demo | PASS — Sealed environment, build and prerequisites | [E420D-04.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-04.txt) |
| E420D-05 | Linux Headless Shell + Neovim | PASS — Three-client integrated walkthrough, all facts and visuals | [E420D-05.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-05.txt) |
| E420D-06 | Linux clone Headless Shell | PASS — Real fresh-clone install, build and sign-in | [E420D-06.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-06.txt) |
| E420D-07 | Linux scratch hub | PASS — Release preview, notes and read-only refs | [E420D-07.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-07.txt) |
| E420D-08 | Linux Headless Shell | PASS — 58/58 supporting Web tests | [E420D-08.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-08.txt) |
| E420D-09 | Linux hub + Neovim | PASS — 48/48 supporting tests | [E420D-09.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-09.txt) |
| E420D-10 | Linux Headless Shell + hub | PASS — 5/5 documentation tests and dedicated cleanup | [E420D-10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-10.txt) |
| E420D-11 | Linux scratch hub | PASS — 9/9 release-item tests | [E420D-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-11.txt) |
| E420D-12 | Linux cleanup | PASS — 52 captures, 18 PNGs, 5 screens; token scan zero; scratch removed | [E420D-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-12.txt) |
| E420D-13 | Hub lease receipt | PASS — Released and destroyed, 434574 ms, $0.03017875 | [E420D-13.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-13.json) |
| E420D-14 | macOS read | PASS — Only E-420 open under R-377 | [E420D-14-open.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-14-open.json) |
| E420D-15 | macOS read | PASS — Eleven other epics closed with clear non-stage QA | [E420D-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-15.txt) |
| E420D-16 | macOS read | PASS — Package, lock and CLI 0.2.0 | [E420D-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-16.txt) |
| E420D-17 | macOS read | PASS — Notes complete and consistent with walks | [E420D-17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-17.txt) |
| E420D-18 | Coordinator receipt | PASS — Plain and JSON expected open-E420 refusals at S | [E420D-18-A10289.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-18-A10289.txt) |
| E420D-19 | macOS read | PASS — README sequence and settings match behavior | [E420D-19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-19.txt) |
| E420D-20 | macOS read | PASS — Committed brief lint passes | [E420D-20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-20.txt) |
| E420D-COVER | Coordinator Linux epic suite | PASS — 4080 pass, 8 platform skips, 0 failures | [Merged receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-COVER.txt) |
| E420D-MAC | Coordinator macOS full stage | PASS — 4088/4088, all five phases | [Receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-MAC.txt) |
| E420D-21 | Receipt comparison | PASS — exact S, seven required names and all Linux skips covered on macOS | [Names and skips](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-21-names.txt) |
| E420D-22 | Final freshness | PASS — current true, dev exact S, frozen diffs empty | [Freshness](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-22.json) |

**QA clear: all 25 scoped checks PASS. Criterion marks: C1, C2, C3, C4 and C5 verified in this run.** Final freshness is current; dev remains exact S with no later commits, the frozen-code diff is empty and R-377 is unchanged. The QA hold is an uncommitted tracker-only edit; no additional tested commit is claimed. Run `qa-dod-2026-10-24-1`; tested S `733a709e2e71d0ae7206c5ae2485aa8ca1a91f42`. All 120 supporting tests passed (58 + 48 + 5 + 9), and the three independent walkthroughs each completed with TAP 1/1, zero step errors, and matching independently assessed facts. All 18 PNGs and five Neovim screens were reviewed; no contradiction found. See [walk assessment](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/walk-assessment.md).

Execution used Linux x64 on demo machine `cland-v0-e137c296`, Node v24.21.0, pinned Neovim v0.12.5, and Chrome Headless Shell. Lease `e137c296-7578-4210-a118-1d3283ff7c02`, deadline 2026-10-24T02:35:25.649Z, was released and destruction confirmed after 434574 ms at $0.03017875. The scratch area, clone and its installed dependencies were removed. The collected captures contain zero unredacted token query values. No real browser or human account was used.

The macOS receipt is `f540352c-b7bb-4bf2-9d4b-bb49b225e22c`, A-10294, at S, Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. It completed all five phases with 4088 passes, no failures/cancellations/skips. Its observed queued-to-finished interval is 1326.885 seconds, including 0.25 seconds queue wait and the host check; local cost is not applicable. T4 ran its base phase only, without repetitions. Budget/lint/ratchet gates are report-only; projections are not reported as measured wall time.


The Linux epic receipt is `1ef540de-7385-4f12-82bd-05abb9e073d3`, merged A-10297, at S. It ran on Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, two droplet shards, and completed T1–T4 and Web with 4080 passes, eight platform-dependent skips, zero failures/cancellations. Web ran 44 files / 223 tests in Headless Shell. All eight skipped test names have explicit passing `✔` lines in the macOS receipt. Five need macOS sandbox-exec, one is the Darwin-only idle-sleep inhibitor (source at hub/test/executor-droplet.test.ts:383 confirms the platform condition despite its generic skip reason), and two need the real OpenCode binary. Seven required integrated-test names pass in both receipts. T4 ran its ten-file base phase, with repetitions skipped. Budget, lint and ratchet diagnostics remain report-only, and projected wall figures are not measured timing evidence.

| Shard | Log | Machine | Admission through remote finish | Machine lifetime | Cost |
|---|---|---|---|---|---|
| 1 | A-10298 | cland-v0-5c0d024c, c-8 lon1 | 1181.74 s | 1166 s | $0.0810 |
| 2 | A-10299 | cland-v0-e5260c14, c-8 lon1 | 917.74 s | 897 s | $0.0623 |

Overall Linux wall from admission through collection: **1210.76 seconds**. Total cost reported by the hub: **$0.1432** (individual displayed shard costs are rounded). Collection took 28.77 seconds and 24.42 seconds respectively. The demo lease cost is separate from these suite costs. [Detailed phase and billing receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/E420D-COVER-details.txt).

The Coordinator's root dry-run artifact is A-10289, replacing the incomplete A-10288 evidence. Both plain and `--json` invocations at S exit 1 and name only E-420 as open. The refusal format stays text even with `--json`, as observed. QA did not run release against the live root. The scratch preview is retained in `ev/W3-preview.txt` and `ev/W3-preview.json`.

Criterion evidence and explicit limits:

- **C1:** all eleven other release epics are closed with clear QA, listed below; only E-420 is open. GAP-1 uses the Coordinator's root refusal, while the scratch copy independently confirms the same open child.
- **C2:** one gate and relayed approval across desktop and phone Headless Shell contexts plus real headless Neovim; shared read marks and same-document phone restart recovery. GAP-5: Headless Shell, not real Chrome or a human phone. Native harness relays belong to E-414's prior demo; this integrated walk uses controlled fake adapters.
- **C3:** README fresh-clone sequence, real npm install, build, sign-in and settings tests. GAP-3 substitutes a local full clone at exact S for the pre-release GitHub URL. GAP-4 changes only four verification keys, uses fixture isolation flags and file-only Git, and stubs the platform opener to exit 99. On Linux that opener is `xdg-open`. GAP-5 uses the clone's own Headless Shell. GAP-6 fallback was not used: the real npm install succeeded in 10.2 seconds; hub startup took 13.5 seconds.
- **C4:** 2635-word R-377 Notes cover all twelve epics, direct tasks, six decisions, all six deferrals, and thirteen existing open known issues. Scratch dry-run previews the exact Notes, twelve Goal deliverables and two expected commits without changing refs, making tags, or leaving a release receipt. GAP-1 means the real release remains blocked by E-420 until closure; GAP-2 means the scratch T3 gate is a fixture receipt, not proof of the real gate. The green epic receipt supplies real suite evidence.
- **C5:** macOS full and Linux epic receipts are green at exact S. No QA full suite was submitted.

Measured integrated timings: relay desktop 78 ms, Neovim 59 ms, phone 124 ms; drawer phone 115 ms and Neovim 107 ms; two competing gate clicks 1 ms apart, exactly one accepted and one refused; read-mark propagation hub 10 ms, desktop 20 ms, phone 15 ms, Neovim 10 ms. The phone recovered the same document after restart and answered the new ask. These are observed action-to-poll times, not projections.

Other epics' latest clear non-stage verdicts:

| Epic | Run | Tested commit |
|---|---|---|
| E-412 | qa-2026-10-21-3 | 5f120a4766e3c60bcb5e0775ad19c5338afc2238 |
| E-413 | qa-dod-2026-10-22-1 | 4fd2ac6770cd299e0dee23921662a55b597b2d65 |
| E-414 | qa-dod-2026-10-23-1 | c3752bf019169533173a91dc6cff9cae7b7b0237 |
| E-415 | qa-dod-2026-10-21-1 | 128444a096311143e706fb8d36a19ac9916f492f |
| E-416 | qa-dod-2026-10-22-1 | e46f03175f33a3c569b9a269ee2bd709340b1c72 |
| E-417 | qa-dod-2026-10-23-1 | d64dad5ad82fedb6773499ba38673c98a09f4c92 |
| E-418 | qa-dod-2026-10-23-1 | adfc24801a9eb7be9aa3ba4427417daa7ff264cd |
| E-419 | qa-dod-2026-10-23-1 | a6c34f456020ef42e0d1841c754bcc58c32d093b |
| E-789 | qa-2026-10-20-3 | 2b8b3f3196ad42b9bcc9b702b6dec767f8513ec9 |
| E-795 | qa-2026-10-21-2 | 13ee21c235886618b4ea5f082414377264618ad8 |
| E-1006 | qa-2026-10-22-1 | 5c9f87bad4c7434ca3048287e294d1fc981b7482 |

Findings, highest severity first:

- **High/medium:** none found in completed checks.
- **Low, brief capture defect (E420D-06):** the committed helper saves raw `cland web` output, contradicting its own prohibition on recording bearer links. Coordinator decision `10db9865-15e0-4fd8-888d-823052e52f78` authorized redacting token query values only in saved W2 log strings, preserving the in-memory values used for sign-in and equality checks. The [exact diff](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/w2-log-redaction.diff) is retained. The collected-capture scan reports zero unredacted values. No unredacted output was published.
- **QA capture limitation (E420D-00):** a wrapper extraction error initially appended a premature PASS without executing the gate. An INCONCLUSIVE invalidation was immediately appended, then the actual gate ran once and passed. All historical lines remain in `recorded-cases.jsonl`; the initial PASS is invalid and superseded. See `capture-probe-error.txt`. No product check was repeated.

Brief count observations: E420D-08 is 58 rather than the written 55 because the connection parent has three subtests. E420D-09 is 48 rather than the written 34; the tested sources contain 19 + 1 + 2 + 4 + 22 cases including parameterized variants. Every required name passed. The brief expressly directs using the tested sources' counts, so these are not failures.

Static local rows were read before the remote rows while stage covers held the gate, as the request authorized; behavioral comparisons were completed afterwards. The original brief and helper source are retained. The committed brief and product files were not edited.

Rule proposal sent to the Coordinator: redact bearer query values when capture helpers write logs, and require a zero-match scan before publication.


Durable evidence: A-10301, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10301-e-420-epic-dod-at-733a709e-clear-c1-c5-all-25-checks-pass/report.md. Prior pending snapshot A-10296 is retained as history.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-24T01:39:27.935Z

Closed on QA's clear Definition-of-done demo qa-dod-2026-10-24-1 at 733a709e (A-10301): C1–C5 verified, 25/25 checks PASS. Covers at that SHA: epic 1ef540de on Linux (4080 passed, 0 failed) and stage f540352c on macOS (4088/4088). The release follows from R-377 after the human's approval.
