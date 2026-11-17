---
id: T-1757
kind: task
title: Hub reference silently drops a docs/hub index entry whose line carries a description
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1592
branch: t/T-1757-hub-reference-silently-drops-a-docs-hub
created: 2026-11-07T16:15:56.538Z
updated: 2026-11-17T08:23:17.057Z
closed: 2026-11-17T08:23:17.057Z
---

## Summary

`shared/hub-reference.ts` recognises a `docs/hub/` index entry in `hub/README.md` only when the line is a bare pointer. Adding a description to the line silently drops that document's content from the hub reference (`hubProcedures`). Nothing fails at the edit; only an unrelated clause-wording test notices later.

## Evidence

Found by impl-1739 during T-1739. A descriptive suffix on the Roles index line removed all of `docs/hub/roles.md` from the reference. The two `roles-clauses.test.ts` "aide: shipped clause wording" tests failed at its head and passed on dev 79b350ec. The strict pointer form was restored on the task branch.

## Acceptance criteria

- [x] C1. Every docs/hub link form that hub/README.md's index uses resolves, whatever description trails it on the line. Any other link-shaped docs/hub candidate is refused with its file and line, never dropped silently, by a test that every mode-free verify selects.
  - done: impl-1757 · 2026-11-17T06:22:04.690Z
  - verified: rev-35 [reviewer] · run rev-35-1757-final-1 · 2026-11-17T07:10:59.754Z · commit 8ac1d90903bd202e5cf789ef76f5549c4bfacc0b
- [x] C2. A test adds a described index line and shows the chosen behaviour, red first against the current reader.
  - done: impl-1757 · 2026-11-17T06:22:08.911Z
  - verified: rev-35 [reviewer] · run rev-35-1757-final-1 · 2026-11-17T07:10:59.754Z · commit 8ac1d90903bd202e5cf789ef76f5549c4bfacc0b

## Comments

### impl-1757 · 2026-11-17T05:53:12.275Z

Consumer inventory (rule 20): repository-wide search for hubReference, hub-reference and hubProcedures found hub/test/roles-clauses.test.ts, hub/test/session-usage.test.ts and hub/test/web-readme.test.ts, plus docs/agents/tests/hub-test-web-readme.test.ts.md. Existing no-argument API and string return preserved; all three test callers remain valid. No wire, persisted-record, production, QA brief or native-tier consumer found. Chosen C1 behavior: resolve all valid docs/hub links including descriptions, anchors and multiple links; malformed pointers fail with README line/text. Red first: described fixture returned only Complete modules guide (expected all three guides); malformed fixture failed Missing expected exception. Both green after fixes under Node v24.21.0 macOS, targeted T1 only; no browser, network, native processes or full suite.

### impl-1757 · 2026-11-17T05:57:36.268Z

Inventory correction at reviewed head e679ed281: prior three-file inventory was incomplete. Additional direct consumer site/test/remote-docs.test.ts (T1 header, two calls), run transitively through hub/test/remote-docs.test.ts (manifest T1) and site prebuild. Existing no-argument API remains compatible; runtime check deferred until source review completes. qa/briefs/E-1537-stage-3.md is a historical reference to the earlier exact-line defect, no executable migration. Full filename hit set and original available command/completion excerpts in A-20673, superseding incomplete inventory A-20668. Raw log files, original red tree hashes and native platform/architecture receipts unavailable. Reviewer identified valid Markdown titles rejected; fix to follow pinned verdict.

### rev-36 · 2026-11-17T06:00:11.061Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1757-source-1
commit: e679ed2814e0df705c1de8ca5c3e01f839a3b76c
scope: full
findings: [{"severity":"medium","text":"The new pointer regex rejects a valid titled Markdown link such as [Roles](../docs/hub/roles.md \"Role guide\"): after .md it only accepts #fragment or ')', so the leftover-path check throws. C1 requires resolving every index link or a T0 refusal for unsupported syntax; no title-free restriction/T0 owner exists (claimant confirms). Preserve valid titles in the resolving path, or provide the stated T0 alternative, retaining described/anchored/multiple/malformed controls.","file":"shared/hub-reference.ts","line":8}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards0; Spec1medium. A-20676 full pass ate679ed281/tree2a0d41e3 vs3ec545abe. shared/hub-reference.ts:8 rejects valid [Roles](../docs/hub/roles.md "Role guide") because title whitespace cannot precede closing ')'; residual path check throws. No title-free invariant/T0 owner, claimant08185105 confirms. Resolve titled links or implement the stated T0 alternative; retain described/anchored/multiple/malformed controls. C1failed; C2unverified. Existing no-arg API preserved, new callback tests pureT1/no ownership issue. A-20673 corrects omitted site/test/remote-docs plus transitive hub/test/remote-docs T1 wrapper and historical QA; full76path audit includes10pinned filename hits and63doc inputs, references notpasses. Original described red actualmodulesonly vs3docs and malformed Missing expected exception, then candidate52/52 across3files; hubtyping0/wording0/testlint0refusals122report-only. Uncommitted candidate/raw/native/platform/red-tree limits explicit; site/wrapper unexecuted, no configured/native/browser/QA proof. No Reviewer test/probe/compiler/lint/runtime/edit/retry/merge. Fresh clean corrected source review before verification window.

Criteria: C1 failed (Valid titled Markdown index links are rejected by the immediate-closing-parenthesis regex; no approved title-free restriction or T0 alternative exists.).

### rev-36 · 2026-11-17T06:20:59.192Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1757-source-2
commit: 5816abbd71ab501e98c64d07af202b5ef7f4379b
scope: full
findings: [{"severity":"low","text":"The guide still says 'Both regressions' after adding a third new in-memory title regression beside described/multiple links and malformed pointers. Update the count/wording so it accurately names the retained red-first controls.","file":"docs/agents/tests/hub-test-web-readme.test.ts.md","line":12},{"severity":"medium","text":"The new plain-title alternatives still reject valid Markdown titles containing escaped delimiters: e.g. double/single-quoted escaped quotes or escaped parentheses in a parenthesized title. The negated delimiter classes terminate at the escaped delimiter, the link fails to match, and the residual-path check throws. No restriction/T0 fallback exists (claimant908007b1 confirms). Accept escaped characters in all three title forms and retain the described/anchor/multiple/malformed controls.","file":"shared/hub-reference.ts","line":8}]
finding_counts: {"high":0,"medium":1,"low":1}

Standards1low/Spec1medium. A-20699 full source pass5816abbd7/treece4b5c73 directchild/no dev merge. Plain double/single/parenthetical titles resolved; escaped title delimiters still terminate negated classes, leave path unmatched and throw. Claimant908007b1 confirms no restriction/T0 fallback; no reproduction. Accept escaped characters in all3title forms, preserve earlier controls. Guide:12 says Both after3new regressions (low). C1failed/C2unverified. A-20679 plain-title red at first iteration then candidateweb-readme7/7/sitewrapper43/43/typecheck0/wording0; original argv/cwd/uncommitted/raw/native limits retained. Earlier roles/session/lint not current reruns, no configured/T0/browser/native/QA proof. All76consumer/input dispositions retained, site/wrapper candidate outcomes updated; no wire change. No Reviewer runtime/test/compiler/lint/generator/probe/edit/retry/merge. Consolidate escape+guide correction and fresh clean-head review before window.

Criteria: C1 failed (Plain title forms now work, but valid escaped delimiters in quoted/parenthesized Markdown titles still cause malformed-pointer rejection; no approved restriction/T0 fallback exists.).

### coord · 2026-11-17T06:27:54.436Z

Coordinator scope decision (topic-1592, 06:28Z): full CommonMark link-destination grammar is out of scope for this XS item. C1 is met when (a) the forms hub/README.md uses resolve; (b) every other link-shaped docs/hub candidate, including angle-bracket destinations and whitespace before the destination, is refused with file and line, never dropped silently; and (c) that refusal runs in a test every mode-free verify selects (T1 is enough). The two forms the Reviewer found are added as refusal regressions.

### impl-1757 · 2026-11-17T06:28:27.559Z

Coordinator scope decision 4d7bb079: full CommonMark grammar out of scope. Existing supported bare/described/plain-title/escaped-title forms resolve. Other link-shaped docs/hub candidates including angle destinations and whitespace before destination must fail with file/line in mode-free-selected T1 tests; T0 alternative not required. Added refusal regression for both forms; both already refused, so green-first 9/9 web-readme tests on local macOS Node 24.21.0. No parser expansion. Scope and evidence distinctions recorded in per-file guide.

### rev-35 · 2026-11-17T06:31:48.013Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1757-source-1
commit: 8ac1d90903bd202e5cf789ef76f5549c4bfacc0b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear under explicit Coordinator4d7bb079 and updated C1, tree3e303ad4b971034cb5c13a2f313904aa9d93eb1c; A-20705. Current supported index forms resolve; unsupported angle/leading-whitespace destinations fail with exact file/line/source assertions in mode-free-selected T1. Full CommonMark/T0 refusal out of scope by decision, not silently assumed. Prior escaped-title medium and stale-guide low are corrected. Consumer/default no-arg API unchanged; site wrapper included in retained census. No findings. C1/C2 source-correct but unverified until same-head configured evidence; no verified marks. A-20704 new9/9 refusal controls are green-first; earlier red-first behavior/provenance is retained in A-20701/A-20673, not promoted to exact-head configured proof. No Reviewer runtime/probe/edit. Superseded c55 request received no verdict; decline was refused as not current pending reservation and not retried; tracker hold moved normally to this fresh request.

### rev-35 · 2026-11-17T07:10:59.754Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1757-final-1
commit: 8ac1d90903bd202e5cf789ef76f5549c4bfacc0b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-20736 reconciles A-20728/run89e02f35 with source A-20705 and revised C1/Coordinator4d7bb079. Six reader controls ordinary pass; five new identities each have5/5 positive load proof. Full9-case file and all direct/transitive consumer files pass (site via wrapper, not standalone prebuild). C2 historical described-line red retained with limits; unsupported forms green-first. Exact head/source tree unchanged, normalized treeff98bb464615d0231bcc05ab0d7a91149688b0fc, uncached Linux x64/Node24.21.0, isolated HeadlessShell1248/ChromeTesting156.0.8078.4. T0/T1/all-T2/Web exit0;6584 ordinary/707files, separate275load;224T1/428T2/55Web complete,269T3/17T4 unexecuted. Known T-1935 fixture prefix28767/28768 preserved, terminal Finished0/hub passed. Lint122/59/budgets/ratchet/skip checks remain report-only; no skips/missing reasons or scoped tier warning. C1/C2 verified, no findings/new Reviewer runtime/edit.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T08:23:17.056Z

Merged b2b220678ca500e4f6329c96416fd7487e447933 onto dev.
