---
id: E-1539
kind: epic
title: Release v0.4.0 from the item
state: closed
criterion_seq: 7
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1531
  - E-1532
  - E-1533
  - E-1534
  - E-1535
  - E-1536
  - E-1537
  - E-1538
topic: topic-1528
branch: null
created: 2026-10-31T18:22:04.894Z
updated: 2026-11-15T23:28:16.024Z
closed: 2026-11-15T23:28:16.024Z
---

## Goal

v0.4, cland beyond one machine, ships from its release item. `cland release --item R-1530` publishes version 0.4.0 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective records the run. Before that, QA checks once on the fakes the paths no single epic's demo covers: where hosts, logins, users and the workbenches meet.

**Changed by the human, 2026-11-15 13:06Z (answer to ask f485cc38):** the live run with the human on real DigitalOcean hosts is not needed for 0.4.0. It is dropped from this epic, and its points go to the notes' "Not verified" section: real-host boot time, Claude Code, Codex and OpenCode sign-ins on real hosts, a live hub restart under load, idle stop with volume re-attach, real spend in the ledger, and the open points of Q-1520 §3 and Q-1522 §3.

## Contents

- **The demos** (spec §4). Every other epic of R-1530 closed on its QA demo with a clear verdict, each on the fake host provider and the fake transport in the suite.
- **The integrated pass**, on the fakes: an `agents` pool of two fake hosts with Implementers and Reviewers on it and the Coordinator local; a waiting launch released by a login added from a remote card; a signed-out login signed in again from the web's hosts view while its host's sessions keep running; two users in users mode, one answering an ask from a remote and the other seeing the outcome in the web; a hub restart with both hosts busy; the hosts' sub-cap reached and the live hosts untouched.
- **The live run**: dropped by the human on 2026-11-15 (see the Goal). Its points are listed in the notes' "Not verified" section.
- **The docs.** The hosts, pools and logins page, the users and sign-in modes page, the web-and-phone page's multi-user section and the price table, checked against the built release; the price table's check date refreshed if the providers' prices changed.
- **The version bump.** An ordinary item sets the root `package.json` and both lockfile version fields to 0.4.0, reviewed and merged before the dry run, since `cland release` refuses a version that differs (the `release` skill).
- **The release** (§4). R-1530's `## Notes` written from the item and its epics, with a "Not verified" section (every point of the dropped live run, listed in the Goal; Kubernetes, which ships in 0.4.x); `cland release --item R-1530 --dry-run`, shown with its notes and version 0.4.0 in an ask; `cland release --item R-1530`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the deferrals of spec §4 (the Fly provider, shape B as a whole, OIDC and SSO, roles beyond admin, serverless providers, several projects on one host, the tool's ties to this repository), which wait for 0.4.x.

Choices where the spec is silent, as in E-1314:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-1530.
- **The notes** go in R-1530's `## Notes`, written by the Coordinator: the goal; one paragraph per epic on what the human can now do; the run's decisions; the deferrals to 0.4.x; the "Not verified" section; the known issues filed in the categories.
- **The version** is R-1530's recorded 0.4.0. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite on the dry run's tip, on droplets with no real host token in the run, and one full local run on macOS for the macOS-only cases.

## Order

1. **The integrated pass.** The paths across the epics on the fakes. Demo: a waiting launch released by a login added from a card, and a restart with two busy hosts.
2. **The docs, the bump, the notes and the dry run.** Demo: the dry run prints version 0.4.0 and the notes with their "Not verified" section, with every other child of R-1530 closed.
3. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-1530`, and QA's check of the tag. Demo: tag `v0.4.0` is on GitHub `main`, R-1530 is closed, and QA's verdict on R-1530 is clear.
4. **The retrospective.** After the release: the artifact of the run.

## Definition of done

QA runs the demo below on `dev`, playing the human's part on the fakes through the `cland` CLI, headless Chromium and a headless Neovim workbench; it records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it.

In a scratch project on the fakes, QA runs the integrated pass above and reads each outcome in both workbenches and on the test messengers. It reads the docs pages against the build. On `dev`, `cland task list --under R-1530 --state open --json` lists only this epic; QA reads the root `package.json` and the lockfile versions, R-1530's notes and `cland release --item R-1530 --dry-run` with version 0.4.0, and the latest full suites on that tip, on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-1530 is closed on a clear QA verdict, and no open item other than this epic remains under R-1530.
  - verified: qa-678 [qa] · run qa-e1539d-2026-11-16-qa678-1 · 2026-11-15T23:27:58.310Z · commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d
- [ ] C2. The integrated pass is clear on the fakes: a login added from a card releases a waiting launch, a signed-out login is signed in again with its sessions running, two users answer and see each other's outcomes, a restart with two busy hosts loses nothing, and the sub-cap stops new hosts only.
  - verified: qa-678 [qa] · run qa-e1539d-2026-11-16-qa678-1 · 2026-11-15T23:27:58.310Z · commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d
- [ ] C5. The hosts, pools and logins page, the users and sign-in modes page, the web-and-phone multi-user section and the dated price table describe the release as built.
  - verified: qa-678 [qa] · run qa-e1539d-2026-11-16-qa678-1 · 2026-11-15T23:27:58.310Z · commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d
- [ ] C6. The root `package.json` and the lockfile are at 0.4.0 on `dev`, R-1530's `## Notes` describe the release by epic with a "Not verified" section, and `cland release --item R-1530 --dry-run` shows them with version 0.4.0.
  - verified: qa-678 [qa] · run qa-e1539d-2026-11-16-qa678-1 · 2026-11-15T23:27:58.310Z · commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d
- [ ] C7. A full suite is green on the `dev` tip of the dry run, on droplets, with a local run on macOS for the macOS-only cases.
  - verified: qa-678 [qa] · run qa-e1539d-2026-11-16-qa678-1 · 2026-11-15T23:27:58.310Z · commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-1530` on the answer; QA checks that tag `v0.4.0` is on GitHub `main` and records its verdict on R-1530; the retrospective artifact follows and is linked from R-1530.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Only `cland release` pushes to GitHub: commit on the task branch in its worktree, push it to `origin`, and reach `dev` only through `cland merge`. Suites run through `cland verify`. Items through `cland task` only.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-1530` is the only push to GitHub in this build.
- **The live run.** Dropped by the human on 2026-11-15 13:06Z. No session creates or uses real DigitalOcean hosts for this epic; the integrated pass runs on the fakes only.
- **ADRs.** 0004 (agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (tracker files are the source of truth): the notes live in R-1530's file.
- **Risks.**
  - A refused release (an open child, a dirty root, a version that differs) is fixed before it is retried, never overridden.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Last: blocked by the eight other epics. These edges stay `blocked_by`, since the release needs every other epic closed, not only merged.

## References

- Spec: `docs/spec/v0.4.md` §4 (the cut, QA, the definition of done, the deferrals), §3.7 (the open points), §3.13 (hygiene); `docs/spec/v0.3.md` §4.
- Items: R-1530, the release item; Q-1522 (the cut); Q-1520 §3 (the open points); the map M-1511; E-1314, the v0.3.0 release epic and the model for this one.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict, Host, Login.

## Plan

```yaml
stages:
  - name: integrated pass, docs and version
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1870
      - - T-1871
      - - T-1872
```

## Comments

### hub · 2026-11-15T23:15:39.235Z

demo 96a89d60-74e3-4219-8baa-90d8629d10a5 created: droplet cland-v0-96a89d60, commit 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d, deadline 2026-11-16T00:28:13.739Z.

### hub · 2026-11-15T23:18:02.942Z

demo E-1539 lease 96a89d60-74e3-4219-8baa-90d8629d10a5 droplet 619657228: operator attention required; deletion not confirmed. {"reason":"deletion-unconfirmed","fields":[],"expected":{"id":619657228,"name":"cland-v0-96a89d60","tags":["cland","cland-p-8a978a214ba5"]},"observed":{"id":619657228,"name":"cland-v0-96a89d60","tags":[],"status":"active"}}

### hub · 2026-11-15T23:18:12.796Z

demo 96a89d60-74e3-4219-8baa-90d8629d10a5 destroyed: lifetime 272384 ms; cost $0.0189.

### qa-678 · 2026-11-15T23:27:58.310Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-e1539d-2026-11-16-qa678-1
commit: 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d
findings: [{"severity":"low","text":"Run-copy R-1/R-2: recorder Git subprocess required the shared seal and absolute Git; walk sidecar writes required redaction/publication checks. Corrected only in run copy under Coordinator ff235f64-6f99-462f-8389-e33ee5aa7e38, assertions unchanged, zero withholding. Original and diff retained in A-19792.","file":"qa/briefs/E-1539.md"},{"severity":"low","text":"R-3 presentation-only: historical English finding text triggered the publication policy. Exactly one field omitted from exported tracker snapshot under Coordinator e3a2d683-74a9-4096-a358-770cae78e7db; private original and first scan retained, corrected read-only scan clean. No credential or product finding.","file":".cland/tasks/T-1793"},{"severity":"low","text":"Known T-1676 found aside: seven dead fixture-owner receipts in this run's T directory after E1539D-13. Owners absent, no open handles, fixture roots gone; producer unchanged from E-1537. Retained until post-verdict cleanup; no global residue delta or T-1806 regression.","file":"nvim/test/stub-hub.ts","line":45}]
finding_counts: {"high":0,"medium":0,"low":3}

| Check | Executor of this check | Result | Evidence |
| --- | --- | --- | --- |
| E1539D-00 | local | PASS | [E1539D-00.txt](E1539D-00.txt) |
| E1539D-01 | local | PASS | [E1539D-01.txt](E1539D-01.txt) |
| E1539D-02 | droplet | PASS | [E1539D-02.txt](E1539D-02.txt), [E1539D-02.json](E1539D-02.json) |
| E1539D-03 | droplet | PASS | [E1539D-03.txt](E1539D-03.txt) |
| E1539D-04 | local | PASS | [E1539D-04.txt](E1539D-04.txt) |
| E1539D-05 | local | PASS | [E1539D-05.txt](E1539D-05.txt) |
| E1539D-10 | local | PASS | [E1539D-10.txt](E1539D-10.txt), [E1539D-10.log](E1539D-10.log), [E1539D-10.slots.txt](E1539D-10.slots.txt), [E1539D-10.inventory-delta.txt](E1539D-10.inventory-delta.txt), [E1539D-10.receipts.txt](E1539D-10.receipts.txt) |
| E1539D-11 | local | PASS | [E1539D-11.txt](E1539D-11.txt), [E1539D-11.log](E1539D-11.log), [E1539D-11.slots.txt](E1539D-11.slots.txt), [E1539D-11.inventory-delta.txt](E1539D-11.inventory-delta.txt), [E1539D-11.receipts.txt](E1539D-11.receipts.txt) |
| E1539D-12 | local | PASS | [E1539D-12.txt](E1539D-12.txt) |
| E1539D-13 | local | PASS | [E1539D-13.log](E1539D-13.log), [E1539D-13.check.txt](E1539D-13.check.txt), [E1539D-13.inventory-delta.txt](E1539D-13.inventory-delta.txt), [E1539D-13-receipts.txt](E1539D-13-receipts.txt) |
| E1539D-14 | local | PASS | [E1539D-14.log](E1539D-14.log), [E1539D-14.check.txt](E1539D-14.check.txt), [E1539D-14-expanded.txt](E1539D-14-expanded.txt), [E1539D-14.inventory-delta.txt](E1539D-14.inventory-delta.txt) |
| E1539D-15 | local | PASS | [E1539D-15.txt](E1539D-15.txt) |
| E1539D-19 | droplet | PASS | [E1539D-19.json](E1539D-19.json), [E1539D-19-after.json](E1539D-19-after.json), [E1539D-19-confirmed.json](E1539D-19-confirmed.json) |
| E1539D-20 | local | PASS | [E1539D-20.txt](E1539D-20.txt) |
| E1539D-21 | local | PASS | [E1539D-21.txt](E1539D-21.txt) |
| E1539D-40 | local | PASS | [E1539D-40.txt](E1539D-40.txt) |
| E1539D-41 | local | PASS | [E1539D-41.txt](E1539D-41.txt) |
| E1539D-42 | local | PASS | [E1539D-42.txt](E1539D-42.txt) |
| E1539D-42-current | local | PASS | [E1539D-42-current.txt](E1539D-42-current.txt) |
| E1539D-43 | local | PASS | [E1539D-43.txt](E1539D-43.txt), [W3-publication-count.json](W3-publication-count.json), [W3-preview.txt](W3-preview.txt), [W3-preview.json](W3-preview.json) |
| E1539D-44 | droplet | PASS | [E1539D-44.txt](E1539D-44.txt), [E1539D-44.log](E1539D-44.log), [E1539D-44.check.txt](E1539D-44.check.txt) |
| E1539D-50 | droplet | PASS | [E1539D-50.txt](E1539D-50.txt), [E1539D-50.log](E1539D-50.log), [E1539D-50.check.txt](E1539D-50.check.txt) |
| E1539D-51 | local | PASS | [E1539D-51.txt](E1539D-51.txt) |
| E1539D-52 | local | PASS | [E1539D-52.txt](E1539D-52.txt) |
| E1539D-53 | local | PASS | [E1539D-53.txt](E1539D-53.txt) |
| E1539D-70 | local | PASS | [E1539D-70.txt](E1539D-70.txt), [cover-audit.json](cover-audit.json) |
| E1539D-80 | local | PASS | [E1539D-80.txt](E1539D-80.txt), [E1539D-13-receipts.txt](E1539D-13-receipts.txt) |
| E1539D-90 | local | PASS | [E1539D-90.txt](E1539D-90.txt), [E1539D-90-R3.txt](E1539D-90-R3.txt) |
| E1539D-91 | local | PASS | [E1539D-91.txt](E1539D-91.txt) |
| E1539D-99 | local | PASS | [E1539D-99.txt](E1539D-99.txt), [E1539D-99.json](E1539D-99.json) |
| E1539D-COVER | local | PASS | [E1539D-COVER.txt](E1539D-COVER.txt), [cover-audit.json](cover-audit.json) |
| E1539D-MAC | local | PASS | [E1539D-MAC.txt](E1539D-MAC.txt), [cover-audit.json](cover-audit.json) |
| S0 | local | PASS | [S0.txt](S0.txt) |

Run `qa-e1539d-2026-11-16-qa678-1`, QA qa-678. Tested full SHA `1f22ad4a727127ea7335f1e4f7a6666bd1e5728d`. All 32 scoped checks passed, plus one supplemental D42 artifact read. Criteria C1, C2, C5, C6 and C7 are supported by their complete row mappings in the brief; no other criterion is claimed. No high or medium product finding.

The source worktree was detached at S. Root dev and the requested head stayed S, the source worktree was clean, the root's non-tracker status stayed unchanged and the release item file was unchanged. The hold caused no commit. Final D99 provides the hub freshness receipt. R-1530 remains unreleased: this QA verdict authorizes neither a push nor publication of the version.

Local checks used macOS arm64 Darwin 27.0.0, Node v24.21.0 and pinned Neovim v0.12.5. Web used Google Chrome for Testing 156.0.8078.4, Headless Shell revision 1248 at `/Users/evgeniyivanov/Projects/cland/v0/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`, with test-owned profiles. No GUI or human browser was opened. The web build stamp was current; building created ignored outputs only.

The isolated Linux x64 demo ran the release and documentation files through a fresh shared-builder environment per command. Its immediate credential-name gates were zero. Lease `96a89d60-74e3-4219-8baa-90d8629d10a5`, deadline `2026-11-16T00:28:13.739Z`, was confirmed released before the verdict. The final hub receipt reports lifetime 272384 ms and estimated cost USD 0.018915555555555557. Earlier releasing-state readings are retained but are not the final lifetime or cost. Node was v24.21.0. These are targeted runs, not an additional full suite; no duration budgets or resource tripwire preload were enforced by plain node --test.

The retained exact runtime audit names all 97 top-level cases across ten files: integrated scenario 1, cleanup 8, Neovim 6+1, Headless Shell 26+1, release item 9, documentation 43+1+1. All passed, none skipped/cancelled/todo. Web inbox's whole 26-case expanded source list was independently compared to runtime names, in addition to the brief's required-title check. Walk 3's additional TAP case passed; its facts were judged individually rather than inferred from exit 0. Required names and exact outputs are in `expanded-registration-audit.json`, `exact-runtime-audit.txt` and the unaltered per-file logs.

Integrated scenario evidence (C2):

```
# path 1: remote card released the waiting launch
# path 2: web renewal retained the native session and binding
# path 3: the other user sees Bob and the remote answer
# path 4: both births and the pending ask survived restart
# path 5: sub-cap refused a NEW host and retained both live hosts
```

The scenario occupied its own preservation slot 2026-11-15 23:17:59–23:18:11Z; cleanup regressions occupied theirs 23:18:23–23:18:25Z. These are slot intervals, not test wall-time measurements. Admission load was within the brief's ceiling. Both native rows used the authorized std runner with filtered credentials and ordinary native paths. Full unfiltered system/user/suite inventories were unchanged across each interval. Both had zero new receipts, zero new surviving hc processes and zero new hc/ct/cland-h names. Both locks were released. The sealed Neovim run left seven dead source-worktree owner receipts in its own T directory, detailed below. The Web row added no entries.

C1's eight prior epics were closed with clear non-stage verdicts and every criterion verified. Their exact run/commit readings follow; evidence ids in the same order are A-15641, A-17179, A-17472, A-18035, A-18965/A-18967, A-16246, A-19626 and A-16260.

```
E-1531 closed R-1530 clear qa-dod-2026-11-02-qa678-1 qa-678 [qa] 5bfd7c24a5a02fedc1c2244d851194c3518ee083 criteria verified 6 of 6
E-1532 closed R-1530 clear qa-dod-2026-11-06-qa678-1-L2 qa-678 [qa] 6f0cf6aed9db5946862705fd8c5f765fc8e81067 criteria verified 10 of 10
E-1533 closed R-1530 clear qa-dod-2026-11-07-qa678-1 qa-678 [qa] 79b350ec536cda3404c346fec0e9f8318e14369d criteria verified 8 of 8
E-1534 closed R-1530 clear qa-e1534d-2026-11-09-qa678-1 qa-678 [qa] 94f4a8c6ac5d26091bde98477e744356d45748bb criteria verified 8 of 8
E-1535 closed R-1530 clear qa-e1535d-2026-11-12-qa678-1 qa-678 [qa] aa14a4b23a76de2b8566dc295200d6261864522a criteria verified 10 of 10
E-1536 closed R-1530 clear qa-dod-2026-11-03-qa678-1 qa-678 [qa] 28e2b22616a78be6b7a1c37eac4197f4f1f3811a criteria verified 7 of 7
E-1537 closed R-1530 clear qa-e1537d-2026-11-15-qa678-1 qa-678 [qa] 5906a1e144b85cb1d4799aa74b12333e8e29569a criteria verified 7 of 7
E-1538 closed R-1530 clear qa-dod-2026-11-03-qa678-2 qa-678 [qa] 853946e501c3f2a3c9725ccf0762aaec1b136399 criteria verified 5 of 5

```

The tracker currently listed only E-1539 open under R-1530. The package, both lockfile version fields and CLI reported 0.4.0. The notes contained 3974 words, all nine epic descriptions, the recorded decisions and deferrals, and existing known-issue ids; no placeholder remained. The documentation pages were freshly read, their command/default/doctor facts checked against sources and tests, and the closed-item wording lint covered 776 documents and 1874 items with zero findings. No changed MDX page falls in known T-1867's lint gap. The dated price table matched the built declarations; this run made no external price lookup.

Root dry-run evidence (C1/C6): A-19791 is the Coordinator's root attempt at exactly S, supplied by decision b4c64ea4-1f50-4ce5-9c2b-8f9f60c14db4. Plain and --json both exit 1 and print the same plain refusal naming only E-1539. JSON mode does not emit a JSON object for this refusal. D42's first ledger entry refers to A-19748 at c9c4fffe885507d6e5388bf7f5ddfaf3d66fdef1; the supplemental D42-current entry reads A-19791 and supersedes that historical citation for the criterion. No QA root release command ran.

Walk 3 copied the 218-item subtree from S into an isolated release fixture. Its initial open-child refusal matched the root refusal and did not change remote refs. Closing E-1539 occurred in scratch only. The subsequent plain and JSON previews selected v0.4.0 at scratch dev be4c6f9649058c4489a7f399ddfd25b559b5c637, included the exact item notes followed by all nine epic deliverables and exactly the two scratch commit notes, and left remote refs, tags and working-tree status unchanged. No release temporary file remained. Both previews and expected deliverables are retained. All individual facts passed; step-error count and R-2 withholding count were zero.

Full-suite evidence (C7) is the Coordinator's stage pair at S, tree d642982363b4b41decfe2a89d81a426e4c40e899, per decision 6d0f4a18-4d8c-4acf-ae91-a70f843bde34. No duplicate QA epic occasion was submitted.

| Run | Evidence | Platform/executor | Actual wall and cost |
| --- | --- | --- | --- |
| 1e4d8909-ec41-483f-84a8-04baedf0955e | A-19785 | Linux x64 6.8.0-147-generic, droplet, two shards | 2604.19 s from admission through collection, excludes queue; USD 0.3405 |
| 6e038a35-39fc-4404-8805-c652f3099177 | A-19789 | Darwin arm64 27.0.0, local | Overall wall unavailable in receipt; not inferred from phase sums. No droplet cost |

Linux shard 1, cland-v0-142b36d4 (c-8 sfo2): 2558.27 s admission through remote finish, lifetime 2530 s, cost USD 0.1757, collection 44.67 s. Shard 2, cland-v0-a244bd96: 2408.27 s, lifetime 2374 s, cost USD 0.1648, collection 31.71 s. Both covers used Node 24.21.0, Neovim 0.12.5 and Chrome for Testing 156.0.8078.4 / Headless Shell 1248 (Linux executable `/home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`). T0, T1, T2, T3, T4 base phase and Web completed with exit 0. T4 repetitions did not run; its 17 files ran only in the base phase. Duration/lint/skip-reason gates were report mode; their warnings are neither enforced failures nor proof of performance compliance. The 122 lint findings in 59 files remain diagnostics. The phase-counter totals are 8573 tests each: Linux 8564 pass/9 skip, macOS 8572 pass/1 skip, zero fail/cancel/todo. Every skipped exact case has a successful result on the other platform, enumerated with its platform reason in cover-audit.json. No unexecuted skip is called a pass on its original platform. All five criterion-specific names appear as successful results in both logs.

Limits carried into this verdict:

| Gap | Criterion | Evidence and limit |
| --- | --- | --- |
| GAP-1 | C1/C6 | Root A-19791 is the expected open-child refusal. Only scratch produces the preview here. The real post-close preview/release remains the Coordinator's work. |
| GAP-2 | C6/C7 | Scratch releaseCover supplies a fixture T3 receipt; it does not exercise the real root gate. Actual full-suite evidence is the stage pair; root gate is checked after closure. |
| GAP-3 | C2 | Scenario clients are protocol projections. Rendered coverage is the new Neovim/Web rows plus unchanged E-1537 DoD A-19626 rows D20–D25; no whole live journey is implied. |
| GAP-4 | C2 | Bob's Telegram answer to Alice's web is exercised here; reverse web-to-remote direction cites E-1536 A-16246 and the scenario card-fold assertion. |
| GAP-5 | C2 | Restart is in-process projectHub with retained deliveries seeded while down. Cap refusal calls production createHost at cap zero with fake price; neither is a CLI restart or scheduler timing measurement. |
| GAP-6 | C5 | Dated declarations matched; public price accuracy cites T-1871 review rev-36-1871-final-1 at 9036a139, not a new network check. |
| GAP-7 | C6 | Human ask f485cc38 dropped the real-host run. The notes explicitly retain the unverified live behavior below. |

Not verified, as read in the release notes: real-host boot time; real harness sign-ins and phone cards; whether running Claude/Codex processes pick up renewed credentials without relaunch; Mac Codex sign-in preservation; Codex 0.5 weight on real hosts; loaded live hub restart; idle-stop volume detach/rebind; real billing/ledger/sub-cap; login-volume reconcile after watchdog deletion; destroyed-host session settlement on real hosts; Kubernetes. Neither fakes nor this run cover real provider create/pacing/refusal/reap/volume/snapshot operations or building a real pool image; real sshd/tunnel outages and attach; real passkeys/phone authenticators or Telegram/Discord users; the four combined workbench/login/setup/doctor live journeys lacking T-1868 drivers. The executor's real droplets are suite infrastructure, not those product demonstrations.

Corrections and findings (all low; no new product defect):

- Run-copy R-1, Coordinator ff235f64-6f99-462f-8389-e33ee5aa7e38: recorder-only PATH entry invokes absolute /usr/bin/git through fixtureEnvironment then scratchGitEnvironment, with no post-seal overlay or relative recursion; hub calls retain QA identity. R1-recorder-git.mjs records the replacement. This is separate from the already-committed remote-launcher R-1 in the reused kit.
- Run-copy R-2, same decision: all walk facts/errors/plain/JSON preview writes now pass the unchanged redactor and publication policy before EV. Exact original retained privately, exact diff in R2-walk-publication.diff. No arguments/assertions changed; withheld count zero. This is separate from the brief's existing cleanup-order R-2.
- Run-copy R-3, Coordinator e3a2d683-74a9-4096-a358-770cae78e7db: the first D90 scan refused one historical English finding in T-1793's tracker snapshot. Exactly its 442-character text field was replaced in the exported copy by a labelled omission; every other byte and all row20 facts remain unchanged. Original is private, original scan remains, read-only corrected scan passed. No test reran and no scanner rule changed. The Coordinator classified it as prose, not a credential.
- Known low T-1676 (Bugs, found aside): D13 left seven owner receipts under this run's literal T/cland-fixture-owners-501. Every owner is absent, every fixture root gone, no open handles; source-worktree roots remain expected until cleanup. Producer nvim/test/stub-hub.ts:43–49 and shared/fixture-ownership.ts are unchanged against E-1537's clear build (empty retained diff); D15 also confirms unchanged Neovim tests. Receipts and before/after inventories retained; removal is authorized only after this verdict. Global D80 deltas are zero, including new cland-h directories, so no T-1806 regression was observed.

No other listed known issue is claimed reproduced merely because it appears in the notes. T-1808's publication guard and T-1864's path-based artifact discipline were followed. A rule proposal was sent to the Coordinator: preflight every recorder child environment and sidecar publication boundary, not only test launches/stdout.

Cleanup follows the verdict. Q and T, the worktree, original private blocks and recorded facts were retained through the final gate. Shared temporary/history roots are untouched; the seven own-T dead receipts will be named in the cleanup artifact. The demo is already released and no preservation lock remains.


Evidence: A-19792, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-19792-e-1539-dod-qa-32-scoped-checks-clear-at-1f22ad4a7/report.md. Final publication scan: 161 files, 132293 lines, zero refusals; positive control refused as required.

Criteria: C1 verified, C2 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-15T23:28:16.024Z

Closed on qa-678's clear Definition-of-done verdict at dev 1f22ad4a727127ea7335f1e4f7a6666bd1e5728d (run qa-e1539d-2026-11-16-qa678-1, A-19792). C1, C2, C5, C6 and C7 are verified; C3 and C4 were removed when the human dropped the live run (ask f485cc38). The stage "integrated pass, docs and version" closed on covers 1e4d8909 (Linux, A-19785) and 6e038a35 (macOS, A-19789). The run-copy corrections were R-1 and R-2 (ff235f64) and R-3 (e3a2d683). The root refusal at S is A-19791.
