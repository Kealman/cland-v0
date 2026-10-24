---
id: T-1245
kind: task
title: The Neovim launcher-defaults test predates T-1222's explicit sandbox defaults
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
regression_of: T-1222
topic: topic-987
branch: t/T-1245-the-neovim-launcher-defaults-test
created: 2026-10-24T13:30:01.105Z
updated: 2026-10-24T14:10:12.266Z
closed: 2026-10-24T14:10:12.266Z
---

## Summary

The periodic dev T3 4954e966 at 699a44dd (A-11081, Linux droplet) failed `nvim/test/qa.test.ts` "the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the fixture role's defaults" at qa.test.ts:229. The launcher defaults now carry `sandbox: { mode: 'danger-full-access', network: 'full', writableRoots: [] }` beside harness, model and effort; the test expects only `{ harness, model, effort }`. T-1222 (d4d596db) gave every built-in role an explicit Codex sandbox default; this T3 Neovim test was not in T-1222's changed-file selection. The stage covers at 95662413, before T-1222, passed it.

## Acceptance criteria

- [x] C1. The test expects the fixture role's launcher defaults including the sandbox that T-1222 resolves, and states which role and sandbox it checks; no product behaviour changes (test).
  - done: impl-1245 · 2026-10-24T13:43:59.302Z
  - verified: rev-32 [reviewer] · run rev-20261024-1245-final · 2026-10-24T14:01:50.861Z · commit 40239acf1475b355dfff4b68bd125bed405f2a87
- [x] C2. A search of nvim/test and hub/test for other assertions on launcher defaults or role defaults finds none left stale (listed in the ready report).
  - done: impl-1245 · 2026-10-24T13:32:30.656Z
  - verified: rev-32 [reviewer] · run rev-20261024-1245-source2 · 2026-10-24T13:46:20.182Z · commit 40239acf1475b355dfff4b68bd125bed405f2a87
  - verified: rev-32 [reviewer] · run rev-20261024-1245-final · 2026-10-24T14:01:50.861Z · commit 40239acf1475b355dfff4b68bd125bed405f2a87

## Comments

### impl-1245 · 2026-10-24T13:31:01.434Z

Using the existing ROLES-001 stdio-hub/Neovim seam already specified by the item. First run the unchanged failing test alone in a sealed disposable environment, then update only its expected Coordinator launch object and audit neighboring launcher/role-default assertions.

### impl-1245 · 2026-10-24T13:32:41.104Z

Pushed d52592f4. Red reproduction: A-11082. Corrected targeted T3 file nvim/test/qa.test.ts passed 25/25 on macOS arm64/local, no suite gate; A-11085. Nvim TypeScript check passed. Audit A-11084 lists relevant Neovim and hub assertions and found no other stale sandbox omissions. All criteria done; source review request queued automatically for next free Reviewer. Mode-free verification waits for source verdict.

### rev-31 · 2026-10-24T13:43:46.084Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1245-source
commit: d52592f4c012f80b0070365403ffa35daf542357
scope: full
findings: [{"severity":"medium","text":"M1: Renamed Neovim launcher-defaults test leaves the retired exact title's 0.867676 baseline, violating source-identity manifest guard. Remove old key; retain strict new expectation and do not invent a new baseline.","file":"hub/test/durations.json","line":5465}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1245 full source review — not clear

Head d52592f4c012f80b0070365403ffa35daf542357, tree dc2d0f9fbf64e51d16db9afa6b82166f89c676f2, fixed base/parent847b7c2839a504c58c17ec46410363b6faabe8da. Command git diff847b7c28...d52592f4; one test-only commit,6 additions/3 deletions in nvim/test/qa.test.ts. Origin ref matches; task tree clean at inspection. C1/C2 claimant done; QA none/after-stage/no separate criteria. Full Standards/Spec audit performed in-session, no execution/delegation.

## Standards

M1 medium — hub/test/durations.json:5465 still has the retired exact identity nvim/test/qa.test.ts::the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the fixture role's defaults with baseline0.867676. The renamed source title no longer matches it. docs/agents/tests.md:1477–1479 requires removing stale manifest keys when renaming/moving a test; unmatched keys refuse shard planning before runtime evidence. Delete the old key in this change, retain strict new expectation/title, and do not invent or silently relabel a new baseline. The new identity's current local .502566625 s sample does not authorize keeping an unmatched historical key. This is the sole source finding.

Otherwise test seam/lifecycle and all final assertions are retained. No production policy, role clause, fixture setup, native process, workload, duration cap, tier or dependency change. Record<string,unknown> accurately accepts nested evidence while the runtime deepStrictEqual remains exact. This assertion-only correction needs no new guide/fixture ownership mechanism. No baseline-smell finding.

## Spec

No functional expectation finding. C1 expected Coordinator sandbox is exact {mode:'danger-full-access',network:'full',writableRoots:[]}, beside existing Codex/qa-model/low fields. Test name states Coordinator and danger-full-access. ROLES-001 fixture defines Coordinator Codex/model/effort without a sandbox; the existing resolved role fallback provides full access. Existing launcher grid/model/name/input-mode assertions remain unchanged. No product authority or behavior changed.

C2 source audit A-11084 reviewed and independent launcher/default searches made under nvim/test/hub/test, with relevant source checks. Neighboring roles-component full resolved policy assertions include sandbox; roles-template/template-component cover mode/network/roots; launcher-component and palette compare outgoing field projections that intentionally omit sandbox because the hub resolves it. QA Lua role case checks its model/screen, not a full launch object. Other audit-listed model/harness/editor/native policy assertions and spread shipped.launch are intentional projections or already carry sandbox. No additional stale full resolved-launch omission found. Keep this audit list in the ready report.

A-11082 native local Darwin arm64 red captures actual extra resolved sandbox versus old expected object, exit1,1failure, case495.90625ms, runner790.992333ms. A-11085 records exact d52592f4 local targeted T3 file25/25,exit0/no skips, named corrected case502.566625ms, runner20554.310667ms, no suite/resource gates. Typecheck success reported; no original command metadata/timing for it in the provided artifacts. These are local targeted receipts, not Linux/configured proof. Preserve available original invocation/exit/source/platform metadata for red/green/typecheck as durable evidence without transcription reruns or invented wall time.

Coverage correction: the current task-duration procedure selects changed T3/T4 files once on an ordinary mode-free queue-enabled task run. Do not predeclare nvim/test/qa.test.ts absent based on an older launch-brief assumption. Actual pinned host/candidate selection and receipt determine coverage. This review requests no forced tier/mode/executor or extra local repetitions.

Disposition: full source not clear; fail C1 for the unmatched manifest key. C2 source audit is established but no verified mark recorded with this not-clear verdict; final runtime evidence remains pending. Complete M1, commit/push, restore affected claimant done and request fresh exact-head source review before ordinary configured verification. No unauthorized post-review dev merge or enqueue. Reviewer used only source/Git/tracker/docs/artifact reads, no tests/probes/build/browser or mutation/delegation.

Standards:1medium(M1 manifest identity). Spec:0 functional findings.
Durable review A-11103.

Criteria: C1 failed (The renamed test leaves an unmatched duration manifest key that blocks shard planning.).

### rev-32 · 2026-10-24T13:46:20.182Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1245-source2
commit: 40239acf1475b355dfff4b68bd125bed405f2a87
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1245 corrected full source review — clear

Head 40239acf1475b355dfff4b68bd125bed405f2a87; tree d369cd0ad28c5799b62152f1a9f4a98897e9bac8. Parent d52592f4c012f80b0070365403ffa35daf542357; fixed base 847b7c2839a504c58c17ec46410363b6faabe8da. Origin matches, task tree clean, base-to-head whitespace check clean. No post-review dev merge. Direct/hub-routed corrected request assigned rev-32; free hold taken and rev-31 informed. Carry prior full audit A-11103, independently inspect correction and preserved test/audit evidence.

## Standards

M1 resolved: the sole parent-to-head change deletes the retired exact duration identity at hub/test/durations.json. No new key, invented timing, renamed historical baseline, allowance, tier or timeout edit. The strict test expectation/name remain byte-identical to d52592f4. A-11105 reports the immutable source-identity guard passing on a sealed disposable clone at40239acf.

The full task remains test-only: renamed title, nested evidence type Record<string,unknown>, exact sandbox object and removed obsolete duration key. Existing QA fixture/lifecycle and final screen/model/name/mode assertions are unchanged. No production policy/permission change or new process boundary. No additional findings.

## Spec

C1 source correct, runtime pending: the test explicitly names Coordinator and danger-full-access, retains strict deepEqual for Codex/qa-model/low and sandbox {mode:'danger-full-access',network:'full',writableRoots:[]}. ROLES-001's fixture supplies Coordinator model/effort without sandbox; the existing resolved role default supplies that full-access object. No weaker projection, spread of the actual object or ignored sandbox assertion.

C2 source verified. A-11084 lists the nvim/test and hub/test launcher/role-default assertion audit; carry rev-31's independent prior full search, and independently check the current launcher/default hits, ROLES-001, full role-policy assertion and outbound launcher frame seam. No source delta changed these neighbors. The outgoing launcher/palette frame projections intentionally omit sandbox for hub resolution; roles-component/template/template-component/native policy assertions already include it. QA Lua checks model/screen rather than a complete launch object. Editor/config/favourite assertions and shipped.launch spread are intentional projections or retain the field. Keep A-11084's complete file/line inventory in the ready report; it is a source audit, not runtime coverage for all listed files.

## Evidence and limits

A-11106 preserves original invocation/source/platform/exit metadata without transcription reruns: original base red A-11082, dirty corrected single test later committed d52592f4, old-head full25/25 A-11085, and nvim-only typecheck0 with no captured timing. Each keeps its actual provenance; the typecheck is not repository T0.

A-11105 is the revised-head local Darwin arm64 targeted T3 file receipt:25/25 pass, zero fail/cancel/skip, named corrected case557.683458 ms, Node runner19980.13 ms. It runs from a sealed disposable cwd with fixtureEnvironment and reports no suite gate. The manifest guard is separate. No extra load repetition, Linux result, full suite or configured pass inferred.

Clear source, findings []. C2 source audit verified; C1 awaits ordinary configured mode-free verification at this exact unchanged head. Actual host/candidate selection determines changed-T3 execution; inspect the resulting receipt rather than predeclaring qa.test.ts excluded. Any new head needs fresh source review. QA none/after-stage. Read-only source/Git/artifact inspection only; no tests, probes, browser, edits, Git mutation or delegation. Standards0 findings; Spec0 findings.
Durable audit A-11114.

Criteria: C2 verified.

### rev-32 · 2026-10-24T14:01:50.861Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-1245-final
commit: 40239acf1475b355dfff4b68bd125bed405f2a87
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1245 final same-head evidence review — clear

Head 40239acf1475b355dfff4b68bd125bed405f2a87; tree d369cd0ad28c5799b62152f1a9f4a98897e9bac8. Origin matches, task tree clean. Current full source2/A-11114 remains unchanged. Independently read configured run460bb9f8-f449-4177-aca6-1e77d59659a4 / A-11145; task.view confirms exact-head finished/passed. Findings [].

## Standards

Actual phases: host T0 exits0 (26.003 s), all T1, fallback all hub/Neovim T2, changed T3 qa.test.ts once, and Web each exit0. No T4/general remaining T3 coverage claimed. Raw progress records:3014 ordinary test outcomes,3011 pass/3skip,425 passing file records, zero failures/cancellations; no load-gate repetitions. Changed T3:25 tests,22 passing identities/3 explicit skips, one base execution, selected-phase added wall22.801 s excluding machine wait.

The three skipped cases require macOS sandbox-exec: network denied, writes denied outside temp, and all writes denied. They are not Linux assertion passes. Separate exact-head local Darwin arm64 A-11105 supplies25/25 including these platform cases, under its targeted/no-suite-gate provenance; it is not a native Codex enforcement result.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-6b993ace, Node v24.21.0, Neovim v0.12.5, workers2 (Web4). Matching host gate a0faccb28cf340d6155256c791a87a9c805bbd7e is reused remotely, not repeated. T1/T2/T3/Web phase envelopes69/379/27/175 s differ from suite walls64.65/374.89/22.88/170.60 s. Lifetime755 s/cost$0.0524 are machine accounting.

Generic duration/lint/ratchet remain report-only:133 lint findings/60files, zero static refusals, one missing baseline, existing Web/scale/artifact would-fails and Web over-budget retained. Ratchet2195.574 versus2195.304 s reports would-refuse growth with incomplete base timing for one observed existing test; exit0 is not an enforce-mode growth pass. Corrected identity1.138418884 s is below8 s (80% of10 s T3); runner reports no stanza. No new allowance or invented baseline needed.

## Spec

C1 verified: the corrected Coordinator launcher case actually executes and passes on Linux in1.138418884 s, retaining exact Codex/qa-model/low plus danger-full-access/full-network/empty-roots deepEqual and existing grid/name/model/mode assertions. The retired old duration identity remains removed; no policy/source behavior change.

C2 remains verified from source2 and A-11084's launcher/default assertion inventory. Keep that complete audit list in the ready report: Lua model/screen checks; outgoing launcher/palette field projections; sandbox-bearing full resolved role/template/component/native/editor assertions; and intentional harness/model/config projections or shipped.launch spread. This is source audit coverage, not a claim that every listed file's native scenario ran here.

A-11106's original local invocation/exit/source metadata and missing typecheck timing remain explicitly labelled; A-11082 red and old-head A-11085 green are historical. No transcription rerun or timing reattribution.

Final clear, C1/C2 verified across unchanged source and this exact-head configured result. QA none/after-stage. Read-only inspection only; no tests, probes, browser, source edit, Git mutation or delegation. Standards0 findings; Spec0 findings.
Durable audit A-11152.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T14:10:12.266Z

Merged 76ec15ad458c7afe99e5684dbf8a3b48c84d9d6a onto dev.
