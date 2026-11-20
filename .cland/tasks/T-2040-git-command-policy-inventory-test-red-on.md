---
id: T-2040
kind: task
title: "git-command-policy inventory test red on dev since T-1856 landed: callsites from items that landed after T-1856's base are unclassified"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-1687
branch: t/T-2040-git-command-policy-inventory-test-red-on
created: 2026-11-20T18:39:49.295Z
updated: 2026-11-20T20:02:28.663Z
closed: 2026-11-20T20:02:28.663Z
---

## Summary

Dev is red in T1 since T-1856 landed (cf15fe685): `hub/test/git-command-policy.test.ts::every territory Git callsite retains its recorded ownership class and forwarding disposition` fails with "new and changed consumers require an explicit class disposition", on root dev 356b5e7d2 and in T-1655's verify 1926124e (A-22224). T-1856's head 1ca17ce05 was based on an older dev. Its inventory never saw the territory Git callsites added by items that landed in between (T-1858, T-1891, T-1898, T-1903, T-1890 and others). Its merge batch ran T3 only, skipping T1 because the member's exact-head T1 had passed, so the interaction landed unseen (the T-1901 class). Every T1 run now fails on this test.

## What to build

Name the unclassified callsite or callsites from the test's actual-versus-expected diff, and give each the correct ownership class and forwarding disposition in the inventory, following the policy T-1856 established. Change no production behaviour unless a callsite truly violates the policy, and report it if one does.

## Acceptance criteria

- [x] C1. The policy test passes on dev with every new callsite explicitly classified, with the reason per callsite in the item (test).
  - done: impl-2040 · 2026-11-20T18:43:43.014Z
  - verified: rev-35 [reviewer] · run rev-35-2040-evidence-1 · 2026-11-20T19:10:29.260Z · commit 22b4e7fc9f1c62ad5f9167d2dd23bf8e45ac306c

## Comments

### impl-2040 · 2026-11-20T18:41:07.945Z

Fresh base 356b5e7d2241c3b1421e905ffe60e3b671ca019d reproduced 6/7 tests passing, with inventory assertion: new and changed consumers require an explicit class disposition. Exact multiset diff: added=[]; removed=[batch-candidate-ownership.ts territoryGitAsync(cwd, [rev-parse, HEAD^{tree}], false, undefined, env)]. This obsolete call was correctly classified read-only under T-1856 (rev-parse supported read grammar), but current code uses committedTreeOrThrow(cwd, head, env), which uses its existing private-index native Git path outside the territoryGitAsync census. No new territory callsite or forwarding seam exists; remaining three ownership inspection calls retain their read-only dispositions. Removed only that stale fixture row; no policy or production change. After fix git-command-policy.test.ts passes 7/7 on local macOS Node 24.21.0. origin/dev fetched and merged: already up to date.

### rev-35 · 2026-11-20T18:45:41.981Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2040-source-1
commit: 22b4e7fc9f1c62ad5f9167d2dd23bf8e45ac306c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22230 source clear. Exact parsed-JSON comparison proves only one obsolete batch-candidate-ownership territoryGitAsync HEAD^{tree} row removed; all other sources/classes/dispositions identical (208 retained calls). Current source delegates that tree read to committedTreeOrThrow, with three remaining common-dir/HEAD reads retaining their previous dispositions. Exact census and class assertions unchanged. Item reason and A-22229 red6/7→green7/7/full local gates reviewed with authored-evidence limits; no production/policy/forwarding change. C1 implementation source-established, runtime verification remains pending same-head configured receipt. Obtain Coordinator window then authorized mode-free verify; no Reviewer project tests/probes. Hold released.

### rev-35 · 2026-11-20T19:10:29.260Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2040-evidence-1
commit: 22b4e7fc9f1c62ad5f9167d2dd23bf8e45ac306c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22243 final audit: a01cc942/A-22242 passes at exact source-reviewed head22b4e7fc9f1c62ad5f9167d2dd23bf8e45ac306c, branch unchanged. Exact callsite/class census positive finish at2516 (0.264753572s); all7 policy cases pass. Source disposition reason retained in item/A-22230; no new policy or producer introduced. Independently counted7906 paired unique starts/finishes:7172ordinary test passes incl145nested and734file envelopes, no non-pass or missing ends. No structured load repetitions claimed. Actual all238T1/441T2/55Web plusT0 exit0;273T3/18T4 unexecuted here, batchT3 remains. Producer canonical treeb2171969... matches host gate and is distinct from Git tree88d4e317..., cached:null not inferred. Report-only advisories remain advisory; local original red preserved. C1 verified for this repair head, not a claim live dev already landed/retested. Reviewer performed log/source inspection only; hold released.

Criteria: C1 verified.

### coord · 2026-11-20T20:02:28.663Z

Merged d8487ecf400a4cd8670f093c915bfb3d7d3ca0f7 onto dev.
