---
id: T-1116
kind: task
title: Markdown for messages as a safe pure parser
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: topic-853
branch: t/T-1116-markdown-for-messages-as-a-safe-pure
created: 2026-10-22T15:16:12.285Z
updated: 2026-10-22T15:32:16.353Z
---

## Summary

A pure module that parses one message's Markdown into a token tree the web renders as elements, so no raw HTML from an agent ever reaches the page. It has no React or browser dependency and runs in a parallel lane.

## Parent

E-417 (§3.4 and v0.1 §3.14 "Markdown per message"; the Risks constraint; part of tracer step 1).

## What to build

Each message is parsed on its own (v0.1 §3.14): headings, paragraphs, lists aligned under their text, quotes, tables kept as text, fenced code with its language label, inline code, bold, italic, links and bare http(s) addresses, and item ids (any configured prefix, `T-12`, `E-417`) as tokens of their own so a renderer keeps them whole and makes them links. An unclosed fence ends at the message's end and never spills into the next message; plain text is the fallback for anything the parser does not know. Raw HTML stays text. A link token carries only an `http` or `https` address; anything else (`javascript:`, `data:`, relative paths) becomes text. The parser is a hand-rolled subset with no new dependency, ported from the prototype's `thread/markdown.tsx` (`prototype/web-shell`, Q-405) but split so the parsing is pure TypeScript a unit test can import. The web's static checks refuse `dangerouslySetInnerHTML` and writes to `innerHTML` or `outerHTML` anywhere in the workspace's sources.

## Acceptance criteria

- [x] C1. The parser turns headings, paragraphs, lists, quotes, fenced code with its language, inline code, bold, italic, links and item ids into tokens, and an unclosed fence ends at the message's end (test).
  - done: impl-1116 · 2026-10-22T15:30:46.489Z
- [x] C2. Raw HTML in a message stays a text token, and a link token is produced only for an `http` or `https` address (test).
  - done: impl-1116 · 2026-10-22T15:24:26.659Z
- [x] C3. The web typecheck fails on `dangerouslySetInnerHTML` or an `innerHTML`/`outerHTML` write in the web sources, with a seeded fixture proving the check (test).
  - done: impl-1116 · 2026-10-22T15:30:46.763Z

## Comments

### impl-1116 · 2026-10-22T15:17:49.671Z

Read E-417, v0.2 §3.4 and the Q-405 prototype parser. TDD seams proposed to supervising lead: pure parseMarkdown token contract (T1) and seeded typecheck safety guard (T0). No UI/dependency work; fenced language and configured item prefixes retained in the token API.

### impl-1116 · 2026-10-22T15:24:27.023Z

Implementation committed/pushed to territory at 3ba8aa71. All C1–C3 marked done. Six pure T1 parser contracts pass locally on macOS; npm run check passed (typecheck, seeded HTML-sink guard, build and static/test lint; lint report mode, zero refusals). No suite receipt yet: requesting source review before mode-free verification. QA policy is after-stage, no per-item QA criteria/brief.

### rev-26 · 2026-10-22T15:27:01.543Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-1
commit: 3ba8aa710aa8a0242ed76e50cbd096ca9744f725
scope: full
findings: [{"severity":"high","text":"M2: blockStart can recognize a line the specific block parser rejects (e.g. ``` followed by U+2028 plus payload). Fence (.*)$ fails, paragraph excludes blockStart, i never advances and parsing loops forever. Restore guaranteed plain-text fallback/progress and bounded separator regressions.","file":"web/src/markdown.ts","line":114},{"severity":"medium","text":"M1: node[('innerHTML')] = message bypasses the raw-HTML guard because the sink literal's immediate parent is a transparent wrapper. TS assertion/satisfies/non-null keys also evade it. Resolve static keys through wrappers and seed rejected fixtures.","file":"web/check-html.ts","line":17}]
finding_counts: {"high":1,"medium":1,"low":0}

Full source not clear; A-9205 audits fixedf35f5e2b→3ba8aa71/treeb235b4f3 plus prototype/spec and Coordinator HTTP/HTTPS-only correction. Standards0;Spec2 findings: high M2 parser progress, medium M1 guard wrappers. Remaining token contract/pure boundary/test tiers/docs reviewed with no further findings. A-9202 narrative local precommit6/6/check evidence is supporting only; raw original receipts requested without reruns, no configured/exact-head runtime proof inferred. No criteria verified. Fix both and request fresh pushed-head source review before mode-free verification; stage QA separate.

Criteria: C1 failed (Unsupported fence input containing U+2028/U+2029 can leave the parser index unchanged and loop forever instead of returning plain-text fallback.), C3 failed (Direct literal bracket writes with parenthesized or TS-wrapped raw-HTML sink keys are not refused.).

### impl-1116 · 2026-10-22T15:29:27.440Z

Corrected head 20345afd committed/pushed after not-clear rev-20261022-1116-source-1; no dev merge. M1 wrapped bracket keys now resolved across transparent TS wrappers; M2 empty-body fallback always consumes a line. Seven T1 contracts and npm run check pass on macOS local in the source tree committed at 20345afd (lint report mode, zero refusals). A-9207 preserves original precommit stdout/provenance limits; A-9209 preserves correction receipts, source hashes and native timings. Fresh review requested before configured verification.

### rev-26 · 2026-10-22T15:30:32.270Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1116-source-2
commit: 20345afd4ad024d7a91c978f29f83df019f95deb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-9213 incorporates first audit A-9205. M2 resolved by unconditional fallback consumption with literal U+2028/U+2029/following-paragraph assertions. M1 resolves all transparent TS wrappers and uses actual path syntax, with rejected bracket/computed-prop fixtures; safe ordinary strings/comments retained. Standards0;Spec0; no other source findings. A-9207/A-9209 original development receipts retain explicit precommit/red limits. Corrected parser/guard/test hashes independently match committed blobs,7/7 localmacOS/check0 supporting evidence; no whole dirty-tree or configured pass inferred. AllC1–C3 await mode-free verification at unchanged20345afd. Lead notified C1/C3 claimant done marks need restoration. Any head change needs fresh source review; stage QA separate.

### rev-26 · 2026-10-22T15:32:16.353Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1116-evidence-1
commit: 20345afd4ad024d7a91c978f29f83df019f95deb
scope: evidence
findings: [{"severity":"medium","text":"Configured run386ad4a3/A-9216 could not obtain c-8 capacity in lon1,nyc1,sfo2; runtime execution unavailable. Host check passed, but no T1/T2/Web pass exists. This is an execution-evidence blocker, not an observed parser assertion failure."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear; A-9217 audits original A-9216 and hub failure envelope at unchanged20345afd. Host check/seeded guard passed, report-only lint132/59/zero refusals; runtime counts/platform unavailable, projections not passes. No criterion failed on observed behavior; no source defect or head change established. Allcriteria remain unverified pending executable configured evidence. Already-admitted retry71dc102d is separate; historical386ad4a3 remains failed/unavailable.
