---
id: T-1661
kind: task
title: T-1625 C2 says each transport socket is mode 0700; the contract checks the run directory at 0700 and the sockets as 0600 nodes
state: closed
status: done
size: XS
criterion_seq: 1
labels: []
assignee: null
parent: E-1887
blocked_by: []
regression_of: T-1625
topic: topic-1599
branch: t/T-1661-t-1625-c2-says-each-transport-socket-is
created: 2026-11-03T11:05:50.288Z
updated: 2026-11-17T08:03:38.958Z
closed: 2026-11-17T08:03:17.638Z
---

## Summary

Found by QA in the E-1538 stage-2 run (qa-678, topic-1346, dev 3b391058). T-1625 C2 reads "each of the four is a Unix socket in the host's agent-owned run directory at mode 0700". The contract asserts the run directory is 0700 (`transport-contract.ts:32`) and that each endpoint is a socket node (lines 33–37), and the fixture creates the stub sockets at 0600 (`transport-contract-fixture.ts:80`). The behaviour is sound, since the 0700 directory guards the sockets, but the criterion's wording doesn't match it, which can mislead a later carrier's author.

## What to build

Amend the guide (`docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md`) to state the actual requirement: the run directory is 0700 and agent-owned, and each endpoint is a Unix socket inside it. Optionally assert the sockets' own mode, if a carrier must guarantee it. Correct T-1625's closed criterion text through the tracker, with a note.

## Acceptance criteria

- [x] C1. The transport contract guide states the directory-mode and socket-node requirements exactly as the contract asserts them (run directory 0700, each endpoint a Unix socket node, no socket-file mode asserted), and T-1625 carries a dated note clarifying C2's directory-mode meaning.
  - done: impl-1661 · 2026-11-17T07:55:41.424Z
  - verified: rev-35 [reviewer] · run rev-35-1661-source-1 · 2026-11-17T07:59:58.789Z · commit 445f5af0d38f77882ba16298f22f2c759cf690c7

## Comments

### impl-1661 · 2026-11-17T07:55:07.994Z

2026-11-17: source inspection confirms directory mode 0700 plus endpoint isSocket assertions; no socket permission assertion. Consumer search covered transportContract/0700/socket wording in hub/test, nvim/test, docs, QA briefs and shipped skills: both contract entry files and fixture remain unchanged; E-1538 stage briefs already describe the directory guarantee. Guide now makes the unasserted socket permission bits explicit. Coordinator added authoritative dated interpretation to closed T-1625 instead of editing verified C2 (topic-1599 decision cbb21db5). Temporary wording probe failed before edit and passed after; no permanent prose-mirroring test or native run added.

### rev-35 · 2026-11-17T07:59:58.790Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1661-source-1
commit: 445f5af0d38f77882ba16298f22f2c759cf690c7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, tree8cb34c565fa994d1cd69c08ca40b0c02c802ad3f; A-20756. One guide paragraph exactly names directory0700 and endpoint isSocket assertions, explicitly no socket-mode assertion; fixture0600 detail remains descriptive. Contract/production/entry tests/config unchanged. Coordinator cbb21db5/4ad91731 amendments confirmed in topic; live T-1625 has dated2026-11-17 authoritative directory-mode note instead of rewriting historical verified C2. C1 verified by static committed-guide and tracker-note evidence; no runtime inference. A-20754 local full lint/typecheck exit0 and temporary prose-only wording probe remain qualified candidate evidence;122/59 report advisories, raw/per-run pin/signal limits retained. No new-head configured/native/browser execution claimed. No findings. General same-head configured verification still pending Coordinator window. No Reviewer test/probe/edit/submission.

Criteria: C1 verified.

### coord · 2026-11-17T08:03:09.661Z

Rule 6 docs-only waiver, recorded by coord before enqueue (2026-11-17 08:03Z). Head 445f5af0d changes one guide paragraph only (docs/agents/tests/hub-test-transport-ssh-contract.test.ts.md, +5/-3); no code, test or config change. At the head merged with origin/dev:
- npm run typecheck exit 0;
- full npm run test:lint with 0 refusals;
- closed-item wording lint 0 findings;
- no test in hub/test or nvim/test names the guide;
- the test-guide tests pass: test-docs.test.ts 4/4 and test-docs-merge.test.ts 4/4.
Delta review: rev-35-1661-source-1 clear (A-20756). No configured verify run; that's waived for this docs-only change, and the merge batch's T1/T3 run covers the integrated tree.

### coord · 2026-11-17T08:03:17.638Z

Merged a1145c3313394a62198c677a96abe20d9e23aef6 onto dev.

### coord · 2026-11-17T08:03:38.958Z

Correction to the waiver note above. The hub merged this docs-only item directly onto dev at a1145c331, not through a merge batch, so no batch T1/T3 run covers it. The coverage is the rule 6 waiver evidence listed above (typecheck, full lint, wording lint and the test-guide tests at the merged tree), plus the next periodic dev run.
