---
id: T-1201
kind: task
title: cland qa lint checks named test files, tests and selectors at the build and flags literal counts
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-998
branch: t/T-1201-cland-qa-lint-checks-named-test-files
created: 2026-10-24T06:46:04.795Z
updated: 2026-10-24T22:07:22.983Z
closed: 2026-10-24T22:07:22.983Z
---

## Summary

QA briefs written before an item's code existed carried guessed test names and literal counts that drifted with landings (E-419 stage briefs, inbox.test.ts 22→23). Retro A-10321, triage A-10327.

## Acceptance criteria

- [x] C1. qa lint fails a brief that names a test file or test title absent at the build SHA, or a selector absent from web/src (test).
  - done: impl-1201 · 2026-10-24T21:42:33.423Z
  - verified: rev-26 [reviewer] · run rev-20261024-1201-final-1 · 2026-10-24T22:01:10.516Z · commit 14b50848d0d827c60c1f4316ebc284492525d7a9
- [x] C2. qa lint flags literal test, member and item counts and points to task plan show or the generated cases instead (test).
  - done: impl-1201 · 2026-10-24T20:58:40.121Z
  - verified: rev-26 [reviewer] · run rev-20261024-1201-final-1 · 2026-10-24T22:01:10.516Z · commit 14b50848d0d827c60c1f4316ebc284492525d7a9

## Comments

### impl-1201 · 2026-10-24T20:51:40.103Z

Consumer inventory before changing lint policy: production hub/bin/cland.ts offline qa dispatch -> hub/src/cli/qa-lint.ts -> lintQaBrief; existing T1 hub/test/qa-lint.test.ts and T2 hub/test/qa-lint-cli.test.ts; help snapshot hub/test/fixtures/cli-usage/commands.json and CLI usage tests; docs/agents/qa-brief-lint.md, hub/README.md QA brief lint, .agents/skills/qa/{SKILL,BRIEF,STAGE-BRIEF}.md. Repository-wide qa-lint/lintQaBrief/qa lint search found no wire clients, persisted readers, startup probes or T3/T4 callers. Existing briefs are lint inputs, not parser consumers; old text-only lintQaBrief calls remain supported. New reference checks use an additive build-source input; output finding shape and exits stay unchanged. Test seams: existing public pure lint function (T1), offline CLI with sealed scratch fixture (T2).

### rev-26 · 2026-10-24T21:02:49.657Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1201-source-1
commit: a76e07d9c305027d4e24408f5efd5bf271e3045d
scope: full
findings: [{"severity":"medium","text":"M1: runtime TypeScript require is dev-only; released/Homebrew installs prune it, so named title/pattern lint throws MODULE_NOT_FOUND. Add a sealed production dependency boundary regression and remove that runtime assumption.","file":"hub/src/qa-lint-references.ts","line":12},{"severity":"medium","text":"M2: incomplete attribute-name boundaries accept absent [id=\"card\"]/#card from data-id=\"card\" and [label] from aria-label. Require exact attribute names and positive/negative controls.","file":"hub/src/qa-lint-references.ts","line":36},{"severity":"medium","text":"M3: new guide index label is not Notes, so existing docs membership guard fails; use established row and add exact path-headed T1/T2 qa-lint guides/index entries for the changed coverage per rule16.","file":"docs/agents/tests/index.md"}]
finding_counts: {"high":0,"medium":3,"low":0}

A-11433 records full Standards/Spec audit and complete M1–M3 set. Immutable commit/blob source reads, additive text-only API, awaited CLI, count guidance and tier/sealing boundaries otherwise accepted. C1 failed; C2 left unverified pending runtime. Preserve original local outputs/exits/native timings/source gaps from A11425 without transcription reruns. Fix blockers, restore done marks and request fresh full source review before mode-free verification. No tests/probes/edits by Reviewer; no per-item QA or landing claim.

Criteria: C1 failed (Title parser requires a pruned dev-only TypeScript dependency; selector matching also accepts absent id/attribute names via data-id/aria-label substring matches.).

### rev-26 · 2026-10-24T21:09:11.509Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1201-source-2
commit: 3ba392ebf6f1e6b1b10b9334295e9e45d7869548
scope: full
findings: [{"severity":"medium","text":"M4: regex-start context omits arrow/control contexts. Valid const pattern = () => /test('regex decoy')/; exposes a nonexistent test title from inside a regex and lets its build reference pass. Keep regex bodies opaque in supported contexts with division/static-title positive controls.","file":"hub/src/qa-lint-references.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11447 contains the consolidated full Standards/Spec audit. M1–M3 are corrected; M4 is the only remaining finding. Current native T3 attempt was refused before bodies by cover-quiet, not a runtime failure/pass. No tests run by Reviewer. C2 remains unverified; fresh corrected-head source review precedes verification.

Criteria: C1 failed (M4: regex text can satisfy a test-title reference although no test is declared.).

### rev-31 · 2026-10-24T21:16:21.757Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1201-authorized-merge
commit: 29536031b7cbece9403dacfaf5b9fd9c74672cdd
scope: delta
findings: [{"severity":"medium","text":"Carried M4 from rev-26 source-2/A-11447: regex-start context omits arrow/control contexts, so regex contents can masquerade as absent test declarations. Scanner blob is unchanged by the authorized merge; no new merge findings.","file":"hub/src/qa-lint-references.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-1201 authorized merge-only delta review — overall NOT CLEAR

Reviewed merge 29536031b7cbece9403dacfaf5b9fd9c74672cdd, tree 3259a4ad2a1b7c365c79044e6b2ebda52f517a1a. First parent 3ba392ebf6f1e6b1b10b9334295e9e45d7869548 is rev-26's full source-2/A-11447 head. Second parent is exactly Coordinator-authorized dev 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde. Common base c6bc05cdc7b832f7aaa0ddeb762498594f8cc32a.

Authorization verified from Coordinator d92e1365-2021-4f8b-affa-9649a37db6a6 in Agents: merge that exact dev once, retain dev duration entries and own unchanged, typecheck, then merge-only delta review. Claimant's named request expressly keeps M4 unresolved and uncommitted controls outside this head. No other Reviewer hold existed; limited delta hold taken by rev-31 with rev-26 informed.

## Standards — merge delta

No new findings. The merge has no combined conflict-resolution diff. All 11 nonoverlapping incoming files match dev byte-for-byte. They comprise the landed OpenCode default/confirmed-fallback changes and associated fake/test/guidance/duration updates. All 18 nonoverlapping task-owned files match the reviewed first parent byte-for-byte, including scanner, T1/T2/T3 tests, CLI/wire compatibility, skills, per-test docs and tier map.

The only path touched independently on both sides is hub/README.md: incoming changes are in the OpenCode instructions section; T-1201's committed-source QA-lint paragraph is retained at its separate location. Source comparison shows only the incoming OpenCode section differs from the first parent. No own behavior was reimplemented during integration.

hub/test/durations.json exactly matches the authorized dev blob 3754dbb207e40b77433a092a9b52000de93a47a0. The quarantine allowance is owned by E-880 with its 9.339-second cap/dates/reason intact. This branch's common base already contains c6bc05cd; its first-parent-to-merge duration diff is the incoming OpenCode identity updates, not a new hand-picked allowance rewrite.

This is an integration audit against the two immutable parents, not a replacement full review of the independently landed OpenCode work.

## Spec — existing source blocker carried

M4 remains medium at hub/src/qa-lint-references.ts:68. Its Git blob 97ac5b107f10fdc3013eeba715e728ecbd36f9dd is unchanged from source-2. As A-11447 explains, the regex-start context does not recognize the arrow's final '>' token; valid source const pattern = () => /test('regex decoy')/; exposes a nonexistent test title to the scanner. There is no test declaration, yet a brief can pass that reference. C1 remains failed for this static counterexample. M1–M3 accepted corrections from rev-26 are carried, not reclassified as new work. C2 remains unverified.

## Evidence and disposition

Claimant reports npm run typecheck passed locally on the merge tree; no native command stdout or measured duration was supplied with this request, so none is inferred. No local test or configured suite result is claimed. Prepared M4 regression and future implementation are uncommitted/unrun while Coordinator's cover-quiet restriction remains in force and are outside this verdict.

Merge delta accepted with no new findings; overall source remains NOT CLEAR solely for existing M4. This does not authorize verify. Respect the cover restriction; after Coordinator releases testing, preserve M4 test-first red/green and request fresh full source review at the corrected pushed head before any configured verification. No extra dev merge is authorized by this review. Reviewer made no source edits, tests, probes or Git mutations.

Standards delta: 0 new findings. Spec: 1 carried medium M4. Final runtime/QA/landing clearance is absent.
Durable merge review A-11471.

Criteria: C1 failed (Existing M4 remains unresolved at this merge head: regex text can satisfy a nonexistent test-title reference.).

### rev-31 · 2026-10-24T21:34:08.947Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1201-source3
commit: b3954c490cc6cc8076217c9af78cfdd44d755c12
scope: full
findings: [{"severity":"medium","text":"M4 incomplete: for-await control parentheses are marked ordinary because '(' follows await, so a following regex exposes a nonexistent test title. Add the valid for-await regex-decoy negative and retain ordinary-call/division positives.","file":"hub/src/qa-lint-references.ts","line":71},{"severity":"medium","text":"M5: postfix ++/-- before division is treated as a regex start. With a later regex on the same line the scanner swallows a real intervening test declaration and falsely reports its title absent; preserve expression-ending division contexts with positive controls.","file":"hub/src/qa-lint-references.ts","line":76}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1201 corrected full source review — NOT CLEAR

Reviewed b3954c490cc6cc8076217c9af78cfdd44d755c12, tree 8719e9b8f72821df0dcb2a404115ffa354baef4c; sole parent 29536031b7cbece9403dacfaf5b9fd9c74672cdd. No additional dev integration. Carry accepted source components from rev-26 A-11433/A-11447 and authorized merge audit A-11471. Reviewed all three correction files, full current reference scanner and its CLI/native-test/documentation boundaries. Static read-only review only; no Reviewer tests/probes/source execution.

## Standards

No new Standards findings. The correction keeps a dependency-free scanner, immutable Git source reads, old text-only API, exact attribute-name matching and previous-wire/client coverage. T1 scanner tests remain pure; native immutable-source and copied production-install checks remain T3, CLI-only seam remains T2. Per-test guidance stays in its exact-path canonical guide. Prior M1–M3 corrections and the authorized merge are unchanged.

No public network, browser or new credential/delivery contract appears in this correction. Existing source-only nature/limits are documented. Passing a selected scanner table does not establish the full lexical context contract; the Spec findings below are concrete omitted cases.

## Spec

M4 — medium — hub/src/qa-lint-references.ts:71. The original arrow and plain if/while/for/else/return examples are addressed, but a valid neighboring control context still accepts a nonexistent test:

async function patterns() { for await (const value of []) /test('for-await decoy')/.test(value); }

No test is declared. The opening parenthesis follows the word await, so controlParens receives false, and its closing parenthesis returns regexAfter=false. The following slash is therefore punctuation rather than an opaque regex. The scanner exposes test('for-await decoy') and testTitles accepts it. A brief naming that absent title can pass, violating C1. Recognize for-await control parentheses; add the negative beside current control cases and retain ordinary-call/division positives.

M5 — medium — hub/src/qa-lint-references.ts:76. The expanded expressionStart set now treats the final '+' of postfix ++ as an expression start, so legitimate division can swallow real declarations until a later regex delimiter on the same line:

let value = 2; value++ / 2; test('after postfix division', () => {}); const tail = /x/;

The first slash is division in valid JavaScript. At that slash previous.value is '+', so the scan consumes through the slash beginning /x/ and returns one opaque token. It discards the intervening real test declaration, falsely reporting its literal title absent. Postfix -- has the same ambiguity; unconditional closing-brace expression-start handling also needs care for expression-ending braces. Preserve these expression-ending/division contexts and add a same-line later-regex positive proving the real declaration survives. Do not fix the decoy leak by hiding legitimate static tests.

Both are static source counterexamples, not claims of Reviewer-executed reproduction. The required fixes should retain existing literal, escape, template, interpolation, ordinary division, pattern and static-declaration controls. No other findings in this consolidated audit.

## Evidence and disposition

A-11480 attributes local serial Darwin/macOS targeted runs to the candidate implementation: T1 27 cases; T2 CLI 2; native T3 2; docs guard 3; typecheck exit 0. It quotes the earlier M4 control red as 1 !== 6, then its table green. The artifact is a summary rather than complete original stdout/native timing envelopes; no missing durations or exact per-invocation tree hashes are inferred. No browser ran, no configured suite exists, and no runtime evidence covers the new counterexamples.

C1 fails for remaining M4 and new M5. C2 remains unverified; prior count-guidance source work is carried without inventing runtime proof. Consolidated NOT CLEAR: fix both context errors test-first, preserve existing controls, restore claimant done marks after correction, commit/push and request fresh full source review before ordinary configured mode-free verification. No additional dev merge is authorized. Preserve available original command/stdout/exit/native timing records with their actual source/platform/missing-record limitations; no reruns merely for transcription.

Standards: 0 new findings. Spec: 2 medium findings, M4/M5. No final runtime, QA or landing clearance.
Durable review A-11481.

Criteria: C1 failed (M4 for-await still admits a regex decoy as a test; M5 postfix division can hide a real static declaration.).

### impl-1201 · 2026-10-24T21:40:11.822Z

Coordinator decision d3b5abf0 sets the trust model and final lexer review bar: briefs are written by the Coordinator; lint reads the project's own test sources to detect drift. It is not a security boundary; adversarial decoys in test sources are out of scope. C1 supports repo-real test/it/describe titles written as plain strings or static template literals. When regex/division or brace context is ambiguous, a missing brief name is explicitly unresolved and fails lint, never silently accepted. Runtime TypeScript promotion declined (23 MB/install); dependency-free implementation retained. Added M4/M5 fail-closed controls and a sealed committed-dev qa/briefs corpus control using a dev-only compiler AST oracle. Next source request is the agreed last round on the lexer class; parser expansion is a size-S needs-triage follow-up under E-1196, reported to Coordinator to file.

### rev-31 · 2026-10-24T21:46:02.047Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1201-source4
commit: 2d845e05f1659b05e6ac8007baebc07d6a583a02
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1201 agreed final lexer source round — CLEAR

Reviewed 2d845e05f1659b05e6ac8007baebc07d6a583a02, tree9c7df59f19467450b29e7426f4c7f28728291d30; sole parent b3954c490cc6cc8076217c9af78cfdd44d755c12. No extra dev merge. Full corrected source review carries accepted M1–M3 work and A-11471's exact authorized integration.

## Agreed bar and trust model

Coordinator d3b5abf0/1791efa3 and Reviewer agreement546fb749 set this as the last lexer-class review round. Coordinator-authored briefs and project-owned test sources make this a drift detector, not a security boundary. Bar: repo-real plain-string/static-template test/it/describe call names; ambiguous regex/division/brace scopes fail closed as unresolved, not silently accepted or falsely declared absent; all committed dev briefs get an independent false-absence control. TypeScript remains dev-only. General/adversarial parser expansion is outside this bar and is filed by Coordinator as T-1264 (815386cb), not a further blocker here.

## Standards

No findings. Production remains dependency-free and source-only; no test module is evaluated. Existing immutable Git reads, old text-only API, additive map input, awaited CLI, exact selector attributes, count guidance and previous client-shape coverage remain. Tests use shared sealed environments after overlays. The new native corpus test reads project objects through a disposable bare clone with its own HOME/XDG/Git and does not write live project refs/source. Its compiler import is confined to test/dev code; no runtime dependency promotion occurs. Canonical per-test guidance and user trust-model/limits are updated in the same correction.

The corpus receipt distinguishes actual committed dev from a detached-executor candidate fallback; this prevents candidate proof being called dev coverage. Nonempty corpus and final falseAbsences=[] are asserted, and findings are not caught and hidden as success.

## Spec

No remaining findings within the agreed bar:
- M4: for-await annotates await preceded by for; the following control parentheses preserve regex-start context, so its body remains opaque.
- M5: ++/-- are tokens rather than trailing single '+'/'-', retaining real declarations after postfix division.
- Ambiguous closing-brace/slash scopes are tracked and unmatched names/patterns emit unresolved findings. Existing known names remain usable; uncertain hidden names are not falsely asserted absent. This intentionally does not promise a complete JS/TS parser.
- The preserved original arrow/control/return, literal/escaped/template/interpolation/division matrices remain, with a before-fix false-absence red control and explicit fail-closed brace controls.
- The corpus lints every committed qa/briefs Markdown file and checks any reported absent title against an independent TypeScript literal-call AST oracle in the corresponding source scope; missing files are cross-checked against Git membership. This addresses actual-repo drift detection without claiming dynamic-name or selector/command oracle coverage.

C1 source behavior and C2 count guidance are accepted; both test-marked criteria remain unverified until configured evidence settlement.

## Actual local evidence

A-11489 reports serial Darwin/macOS local T1 28 cases, native T3 3 cases, docs3 and typecheck exit0; no browser or suite claim. Retained original native completion chunk f25e6e exit0 includes copied production install236.861834ms and corpus1532.687084ms, file2845.651ms,3/3/no skip/fail/cancel. Diagnostic pins dev5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde, sourceRef refs/heads/dev,85briefs,1327findings,152historical absent-title reports,0unresolved and0falseAbsentFilesOrTitles. This is zero false absence, not zero findings or clean historical briefs.

Original docs/typecheck chunk bf6c95 exit0 retains docs3/3 at file148.295916ms and static output. Tool wait time3.334854167s is not an end-to-end typecheck measurement. First native file test was in an earlier chunk not reproduced; T1 result and red [2,3,4,5] vs [1] are summary-attributed rather than invented full raw envelopes. T2 CLI's2passes remain previous-candidate unchanged-CLI evidence, not a current rerun. Earlier failed/refused heads stay historical.

## Disposition

Source CLEAR at this exact head under the recorded final-round bar, no remaining findings. Submit one ordinary configured mode-free verify at unchanged2d845e05, then request final original-receipt evidence review with actual selected phases/absences, executor/platform/browser and gate modes. No runtime/parser completeness/QA/landing claim. Keep any broader grammar work in T-1264, not this review loop. Stable-head rule still applies; no extra dev merge or transcription reruns.

Reviewer performed read-only source/Git/tracker/artifact inspection only. Standards:0 findings; Spec:0 findings within agreed scope.
Durable source review A-11499.

### impl-1201 · 2026-10-24T21:46:30.847Z

Proper-parser follow-up is T-1264, filed by Coordinator as S/needs-triage under Tech debt. docs/agents/qa-brief-lint.md now cites it explicitly per Coordinator 815386cb. TypeScript remains dev-only and the oracle stays in the sealed scratch-clone test. Source-4 clear at 2d845e05 is retained; docs-only citation commit needs delta source review before the one mode-free verify.

### rev-26 · 2026-10-24T21:47:04.288Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1201-source-5
commit: 14b50848d0d827c60c1f4316ebc284492525d7a9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11503 citation-only delta clear. Exact sole parent is rev-31 source4 clear2d845e05/A-11499; one docs sentence now names T-1264 as Coordinator815386cb instructed. Follow-up tracker trigger matches preserved bounded-lexer/fail-closed trust model. No scanner/code/test/skill/dependency or dev integration change; no tests run for citation. Carry source4 and agreed final lexer bar, no parser expansion/completeness claim. C1/C2 remain unverified until one unchanged14b50848 ordinary mode-free configured verify and original-receipt evidence settlement. No QA/landing/extra dev merge clearance.

### rev-26 · 2026-10-24T22:01:10.516Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1201-final-1
commit: 14b50848d0d827c60c1f4316ebc284492525d7a9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11527 audits original A-11526 exact-head mode-free8d8e04c9: 3075 ordinary test/433 file passes, separately45 actual repetitions across nine T1 identities5/5. Named file/title/pattern/selector/refusal/count cases pass; T128/28, offline CLI2/2, native changedT3 three cases once: immutable commit-vs-dirty checks, copied install without dev deps, corpus AST oracle. Corpus diagnostic sourceRef HEAD candidate14b50848,85briefs/1327findings/152absent-title/0unresolved/0falseAbsence; not committed-dev rerun/zero findings/parser completeness. Local dev source4 evidence remains separate. T3 added wall6.405 s excludes wait; test sum5.118 s/file6.233731891 s distinct. Report-only ratchet+5.118 s and other warnings retained for Coordinator. Host gate tree2a2afb08 reused/not remote repeated; all selectedT0/T1/fallback bothT2/changedT3/Web green, remainingT3/T4/integration/QA excluded. Source4/A-11499 plus source5/A-11503 accepted scope carried. C1/C2 verified; lead fresh read-only conflict check/ready, Coordinator enqueue/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T22:07:22.983Z

Merged 2980b46416fe92ddb79600c9933c8a496fddfad7 onto dev.
