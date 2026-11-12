---
id: T-1820
kind: task
title: The web's Hosts row in the Sessions area
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: topic-1491
branch: t/T-1820-the-web-s-hosts-row-in-the-sessions-area
created: 2026-11-12T10:07:19.502Z
updated: 2026-11-12T16:07:37.474Z
closed: 2026-11-12T16:07:37.474Z
---

## Summary

The web's Sessions area shows a Hosts row beside Remotes, one line per pool, such as "agents 2/4 hosts · 7/16 slots · logins claude 2/3, codex 1/1". The line turns red at once when its pool is alerted, and the row folds open to the host list: id, size, region, uptime, sessions, price per hour and spend today.

## What to build

A Hosts row drawn from T-1819's frame, built as the Remotes row is (the Sessions area's fold, its own CSS Module, tokens only), on desktop and phone widths. Each pool gets one line of facts, with the harness labels of question 9. The line uses the error token while the pool is alerted and names the unreachable host or the provider failure. The folded-open row lists the hosts. Uptime advances from each host's creation time between pushes; spend is shown as the hub last pushed it. Each fact has a tooltip that explains it. The row is hidden when no pool is configured and no host is live. Opening and closing the fold goes through the existing fold control and the key map's existing actions; no key binding is added. T-1825 turns the open row into the hosts view.

## Acceptance criteria

- [x] C1. With two fake hosts in one pool, the Sessions area shows the pool's line with hosts, slots and logins per harness as the hub reports them, at desktop and phone widths with no horizontal scroll (test).
  - done: impl-1820 · 2026-11-12T13:48:43.893Z
  - verified: rev-35 [reviewer] · run rev-35-1820-final-1 · 2026-11-12T14:38:17.287Z · commit 72932d3333cf8a8930634e91dc32f2771c628ab6
- [x] C2. Opening the row's fold lists each host with id, size, region, uptime, sessions, price per hour and spend today (test).
  - done: impl-1820 · 2026-11-12T13:48:44.087Z
  - verified: rev-35 [reviewer] · run rev-35-1820-final-1 · 2026-11-12T14:38:17.287Z · commit 72932d3333cf8a8930634e91dc32f2771c628ab6
- [x] C3. A fake host made unreachable turns its pool's line red within one second and names the host, and the line is plain again when the tunnel returns (test).
  - done: impl-1820 · 2026-11-12T14:04:01.615Z
  - verified: rev-35 [reviewer] · run rev-35-1820-final-1 · 2026-11-12T14:38:17.287Z · commit 72932d3333cf8a8930634e91dc32f2771c628ab6
- [x] C4. A project without a host pool shows no Hosts row (test).
  - done: impl-1820 · 2026-11-12T13:48:44.645Z
  - verified: rev-35 [reviewer] · run rev-35-1820-final-1 · 2026-11-12T14:38:17.287Z · commit 72932d3333cf8a8930634e91dc32f2771c628ab6
- [x] C5. The typecheck's colour and contrast checks pass, and the hooks check finds no key listener outside the key map (test).
  - done: impl-1820 · 2026-11-12T13:48:44.972Z
  - verified: rev-35 [reviewer] · run rev-35-1820-final-1 · 2026-11-12T14:38:17.287Z · commit 72932d3333cf8a8930634e91dc32f2771c628ab6

## Blocked by

- T-1819

## Notes

- Hot files: `web/src/sessions/HostsLine.tsx` and `HostsLine.module.css` (new), `web/src/sessions/SessionsArea.tsx`, `web/src/connection.ts`, `web/src/sessions/state.ts`.
- Tests: new `web/test/hosts.test.ts` (Web, `projectHub` with the fake host provider and the fake transport, isolated Headless Shell), after `web/test/remotes.test.ts`.
- Serves epic C1.

## Comments

### impl-1820 · 2026-11-12T13:44:08.601Z

Scope/seam: existing hosts.state and optional sessions.hosts are consumed unchanged by the web. No shared wire contract changes. Connection snapshot and delta handlers, Sessions state and Fold presentation are the only runtime consumers changed. Browser regression uses a fake pushed public projection over the scratch projectHub socket (no provider/network/native lifecycle); hub/test/hosts-state.test.ts retains production provider/health/projection coverage. Native T3/T4 consumers and recorded Neovim frames are unaffected.

### impl-1820 · 2026-11-12T13:49:17.459Z

Source review requested at 390e79438a145afa7e3193b940fa8fc3a18bd8b5; A-19049 holds local evidence. Added production fake-provider inventory/hot-config case in addition to public-projection cases: 4/4 Web on Darwin arm64, Node 24.21.0, isolated Headless Shell. Source clear and same-head Linux verification outstanding. Stage QA remains after-stage; no native files reached.

### rev-35 · 2026-11-12T13:59:18.329Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1820-source-1
commit: 390e79438a145afa7e3193b940fa8fc3a18bd8b5
scope: full
findings: [{"severity":"medium","text":"C3 is not exercised end to end. The desktop/phone cases inject an already-alerted hosts.state frame, excluding production HostHealth and HostsState coalescing; the production-backed case only changes max_hosts. There is no approved scope split. Add a fake tunnel loss/recovery through the real hub projection and assert the named red pool within the required exact bound, followed by plain recovery; preserve the projection-only controls separately.","file":"web/test/hosts.test.ts","line":89},{"severity":"medium","text":"The pre-armed config-push observer is not joined if config.set, its assertions or clock.advance rejects before await receipt. void receipt.catch only observes rejection, so the browser poller can continue during page/context teardown. Join it in a finally before teardown and audit the other pre-armed observers for the same failure path.","file":"web/test/hosts.test.ts","line":46},{"severity":"medium","text":"The new standalone Web file has no candidate build owner. webFixture's readiness probe reports stale/missing web/dist but does not build it; the guide and local evidence rely on a manual build. Register the existing ensureWebBuild prerequisite before these cases so isolated runs cannot serve a stale or absent bundle, as the binding brief requires.","file":"web/test/hosts.test.ts","line":18}]
finding_counts: {"high":0,"medium":3,"low":0}

Complete first source pass: A-19055. Three medium findings: missing C3 end-to-end test, pre-armed observer not joined on earlier failure, and missing standalone candidate build owner. A-19054's honest precommit tool excerpts and missing capture facts retained. No Reviewer execution or final evidence verification. Hold released for fixes; fresh committed/pushed source review before mode-free verify. No further merge requested.

Criteria: C3 failed (No full fake-health-to-browser loss/recovery receipt; current test bypasses hub coalescing without an approved scope split.).

### impl-1820 · 2026-11-12T14:03:08.258Z

Review corrections add an optional internal createHostRegistry dependency, defaulting to the existing projectSshHosts. Production CLI hub.ts and every existing serveProject/projectHub caller omit it and keep exactly the same registry; only web/test/hosts.test.ts overrides the transport observation subscription. Registry reply/owner, HostsStatePool, hosts.state, sessions.hosts, persisted records, credentials, dispatch/admission and wire shapes remain unchanged. Sweep used suite-import-graph importingTests across all manifest tests: 643 reached including 16 unknowns counted reached; explicit serveProject/ProjectHubOptions/projectHub/projectSshHosts/subscribeStatus search covers 617 production/test/doc/brief/skill files. Full inventory is retained for review artifact. Native host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back and T4 callers omit this optional dependency: no migration or native behavior change, existing native lifecycle checks remain at integrated occasions. Targeted hosts-state and host-unreachable T2 plus Web exercise default and overridden paths; mode-free verification follows fresh source clear.

### rev-35 · 2026-11-12T14:08:15.709Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1820-source-2
commit: 72932d3333cf8a8930634e91dc32f2771c628ab6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at pinned correction head; A-19062. All three source1 findings corrected: production health/coalescing/socket/browser loss and recovery, finally-joined observers, before ensureWebBuild. Expanded optional registry seam defaults to identical original owner/options; partial acquisition has earlier parent-root disposal. A-19060/A-19061 preserve 926 paths with correct tiers and honest executed/planned/deferred dispositions. A-19059 committed-head 4/4 local Web excerpts and candidate T2/static evidence retained with explicit raw/browser/TMPDIR limitations. No Reviewer runtime execution; final criteria/readiness remain pending same-head configured positive case/file reconciliation. Hold released; proceed mode-free verification without head changes. Remaining T3/T4 release split unchanged.

### rev-35 · 2026-11-12T14:38:17.287Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1820-final-1
commit: 72932d3333cf8a8930634e91dc32f2771c628ab6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-19070. Independently streamed A-19068:6210 base test/686 base file pass finishes, separate125 load test/file finishes, no negatives. Exact four Hosts cases plus ordinary file pass; genuine production health/coalescing/browser C3 and C1/C2/C4 assertions inspected in source. Host-gate colour/contrast/hooks checks pass. Normalized tree independently matches eb8c13036681e7d447c48bfd1091b5c7bc4251a6; clean unchanged72932d333. A-19069 preserves926 unique consumers with correct tiers and raw receipt linkage:417 positive file finishes(24T1/340T2/53Web),0 missing required;233T3/14T4 deferred,262 static nonmanifest. Web10/10 file repetition remains separate/report-only, no isolated per-case repeat inference. Linux droplet and exact Headless Shell provenance retained; local capture limitations and advisory budget/lint modes retained. All C1–C5 verified for readiness; evidence hold released. Full T3 merge/integrated and T4/stage split unchanged; retain claim until normal merge handoff.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-12T16:07:37.474Z

Merged 36f700d73665b0f37593925c564444c34de9b840 onto dev.
