---
id: T-1619
kind: task
title: Reaping confirms by a GET and deletes again what it could not confirm
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by:
  - T-1618
topic: topic-1339
branch: t/T-1619-reaping-confirms-by-a-get-and-deletes
created: 2026-11-02T03:34:17.281Z
updated: 2026-11-02T15:49:57.894Z
closed: 2026-11-02T15:49:57.894Z
---

## Summary

`cland executor reap` and the hub's provider sweep confirm each droplet and key deletion with a GET by id, instead of the tag listing or nothing at all. An unconfirmed deletion is reported and not counted, and the next reap deletes it again.

Hot files: `hub/src/executor/droplet/droplet.ts` (`reap`, `sweep`), `hub/src/cli/executor.ts` (summary text only)

## Acceptance criteria

- [x] C1. Reap and the provider sweep confirm each droplet deletion with a GET by id, not with the tag listing (test).
  - done: impl-1619 · 2026-11-02T13:30:21.764Z
  - verified: rev-35 [reviewer] · run rev-35-1619-final-1 · 2026-11-02T13:57:19.436Z · commit a5d9b01eaf251802ba6e54404552d2b46215c8b3
- [x] C2. They confirm each key deletion with a GET by id (test).
  - done: impl-1619 · 2026-11-02T13:24:31.866Z
  - verified: rev-35 [reviewer] · run rev-35-1619-final-1 · 2026-11-02T13:57:19.436Z · commit a5d9b01eaf251802ba6e54404552d2b46215c8b3
- [x] C3. A droplet or key whose GET still answers 200 is reported as unconfirmed, is not counted as reaped, and its lease stays open (test).
  - done: impl-1619 · 2026-11-02T13:34:49.907Z
  - verified: rev-35 [reviewer] · run rev-35-1619-final-1 · 2026-11-02T13:57:19.436Z · commit a5d9b01eaf251802ba6e54404552d2b46215c8b3
- [x] C4. Against the fake API, after a DELETE 404 with a live GET, the next reap deletes the droplet and confirms it once the GET answers 404 (test).
  - done: impl-1619 · 2026-11-02T13:34:50.028Z
  - verified: rev-35 [reviewer] · run rev-35-1619-final-1 · 2026-11-02T13:57:19.436Z · commit a5d9b01eaf251802ba6e54404552d2b46215c8b3

## Notes

Shared files: see Hot files

## Comments

### impl-1619 · 2026-11-02T13:20:49.199Z

Rule 20 inventory: reap result consumers are Executor.ReapResult, local executor, hub/dispatch.ts executor.reap forwarding, CLI executor.ts (prints summary/JSON), sweep() counters, executor-prepare-retry.test.ts deep-equal empty reply, executor-droplet.test.ts journal assertions; qa/briefs/T-271.md contains legacy signature context. Searched hub/src, hub/test, web, nvim, qa, docs and shipped skills for reap/deletedKeys/executor-reaped/reaped. Preserve existing empty reply shape; add unconfirmed IDs only when present. Reuse API deleteDroplet/deleteKey confirmation unchanged; no edits to suite completion wake-up. QA is after-stage with no per-item QA criteria/brief.

### impl-1619 · 2026-11-02T13:24:18.173Z

Implemented shared GET confirmation in reap/sweep, explicit unconfirmed IDs excluded from counts and retried next call. Local macOS arm64 Node24.21.0 scripted fake: new T2 cases 5/5, existing executor-prepare-retry.test.ts 5/5 unedited (legacy empty shape). Root typecheck passed; lint zero refusals with pre-existing report-only prerequisite/build advisories; final rerun in progress. No browser, real API or full tiers ran. Removed tag-list poll; completion wake-up unchanged. First-review fetch/merge origin/dev was already up to date.

### rev-35 · 2026-11-02T13:26:27.646Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1619-source-1
commit: c7e30a748ff867a91949eaa1f2a5f473f6f56f3f
scope: full
findings: [{"severity":"medium","text":"Pending IDs exist only in this call's result; every next reap discovers exclusively through tag/account lists. After DELETE404+GET200, if the next list omits the still-live ID, no DELETE/GET retry occurs and pending state disappears from reply/sweep although ownership is unresolved. Retain durable admitted identity/ownership, retry byID independent of discovery lists with ownership revalidation, clear only afterGET404; cover hidden pending droplet/key and recovery.","file":"hub/src/executor/droplet/droplet.ts","line":489},{"severity":"medium","text":"EXECUTOR_USAGE frozen expected bytes remain old after usage/executor.ts changes. Export compatibility deepEqual and native fullhelp expansion both mismatch. Migrate independent expected executor block, preserve assertions and add these missed consumers to inventory.","file":"hub/test/fixtures/cli-usage/commands.json"}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source notclear,2medium. Reap result-only pending arrays plus rediscovery-only next call lose retry authority when tag/account listings omit an ID that prior GET proved live; persist/consult durable owned pending IDs and retain until positiveGET404, with ownership revalidation and hidden-list regressions. FrozenEXECUTOR_USAGE notmigrated despite changed help, so byte/fullCLI assertions mismatch. SharedT1618 GET-confirmation helper and suitecompletion wakeup remain unchanged; success-only counts/deferred sweep/legacy emptyshape otherwise fit source. C4/C1failed,C2/C3unverified. A-15846 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15846-t-1619-source-review-retry-identity-and-frozen-help.md) records exact counterexample and scope. LocalMac new5/prepare5/static reports targetedonly,no queued/provider/browser claim. Reviewer ran no tests/browser and made no edits. Fresh corrected-head source review before verify.

Criteria: C4 failed (Next reap forgets unconfirmed IDs omitted by provider discovery lists, so it may skip required by-ID deletion retry and return clean.), C1 failed (Changed executor help leaves frozen EXECUTOR_USAGE consumer stale, breaking full compatibility/aggregate help assertions.).

### impl-1619 · 2026-11-02T13:27:27.608Z

Review remediation inventory: new project-local reap-pending.json retains admitted droplet id/name/tags and key id/name/public_key before DELETE; only reap reads it, under a project lock shared by concurrent calls. Each retry rechecks by-id identity and current live leases; pending entries are cleared only after shared helper GET404. This is a new private recovery record with no previous wire reader. Rule20 additions: frozen CLI help commands.json, cli-usage.test.ts export/aggregate assertions and cli-usage native fixture expansion were missed; migrate expected help block retaining assertions. Add hidden-list/reloaded-executor controls and changed-identity refusal controls.

### rev-35 · 2026-11-02T13:32:49.580Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1619-source-2
commit: e22fe24cb6922d7076f9208a1d8ccdff0adef61d
scope: full
findings: [{"severity":"medium","text":"Retained key identities still pass new-candidate prefix eligibility using current config.name. After pending key admitted under nameA and project renamedB, exact byID/key/public-key checks can pass but this continue skips DELETE and defer; journal retains key while reply omits unconfirmed and sweep turns idle. Use durable admission independent of mutable project-name prefix, or explicitly defer unresolved authority; cover rename/reload/hiddenlist then GET404.","file":"hub/src/executor/droplet/droplet.ts","line":572}]
finding_counts: {"high":0,"medium":1,"low":0}

Full correctedsource notclear,one medium atdroplet.ts:572. Pendingkey admittedunder projectA,DELETE404+GET200; renameconfig.nameB/reload,provideridentity unchanged/listomitted: retainedGETvalid then currenttag/legacyfilter continues withoutDELETE/defer, resultclean althoughjournal/key remain. Preserve durableadmitted retry/reporting independently mutableprojectname; ownershipfailure muststaydeferred, addrename/reload regression. Earlier hidden-list persistence/identitylock/closejoins/frozenhelp findings addressed; sharedT1618helper/completionwake-up unchanged. A-15848 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15848-t-1619-corrected-source-review-pending-key-after-project-rename.md) recordscounterexample. C3/C4failed,C1/C2unverified. LocalMac9/frozen1/help5/prepare5/static reports targetedonly. Reviewer ran no tests/browser and made no edits. Fresh source review before verify.

Criteria: C3 failed (A retained live key can disappear from reported unconfirmed IDs after config.name changes, yielding clean reply/idle sweep despite unresolved journal entry.), C4 failed (Next reap skips retained-key DELETE retry when current project-name-derived prefix differs from its admitted prefix.).

### rev-35 · 2026-11-02T13:35:26.839Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1619-source-3
commit: a5d9b01eaf251802ba6e54404552d2b46215c8b3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full correctedsource clear,no findings. Retained droplet/key admission now bypasses mutableprojectname discovery eligibility only after byIDidentity/publickey/currentlivelease protections; no lostpending reporting/retry after rename. Hiddenlist+rename+executor-reload controls assert secondDELETE404/GET200pending,thirdDELETE+GET404count,total3DELETEs/eventualclear; changedprovideridentity refusal retained. Earlier durable checkpoint-beforeDELETE/projectlock/closejoin/frozenhelp fixes unchanged. SharedT1618helper/cleanup/completionwake-up untouched; fullhelp/assertions preserved,docs/testguideupdated. Read-onlydiffcheckclean. C1–C4 remain unverified pending named exact-head queued new9/prepare5/help/frozen outcomes. Reported localMacarm64Node24.21 targeted/static0refusals not queued/fulltiers/provider/browser proof;QAafterstage unchanged. A-15850 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15850-t-1619-corrected-source-review-at-a5d9b01ea.md). Reviewer ran no tests/browser and made no edits.

### rev-35 · 2026-11-02T13:57:19.436Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1619-final-1
commit: a5d9b01eaf251802ba6e54404552d2b46215c8b3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear,C1–C4 verified,no findings. Independently matched A-15851 ordinary named reap9 passes: droplet/key DELETE404liveGET retry/openlease, sweepgone/404/204 GET-onlyconfirmed counts, hiddenpendingrename/reload recovery, changedprovideridentity refuseseffects. Assertions confirm pendingIDs excluded/reporteddeferred,lease/spendcostnull retained,nextDELETE/GET404clear. Unchangedprepare5/frozenusage1/fullCLIhelp5 pass;emptyshape/fullassertions preserved. SharedT1618helper/completion unchanged. Exact-head4691c874 exit0/4747pass/zero fail,cancel,skip,todo;T0/T1/allfallbackT2/Web complete,T3batchdeferred,T4unexecuted. Linuxscriptedfakeprovider,no realAPIclaim. Linuxx64 6.8.0-142-generic c8sfo2 Node24.21/Nvim.12.5 workers2;tree7680e8223a8f91e23b30d2af06feda1eea7b134f;isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4;cache/occasionnull,skips[],skipreasonreport/missing0. Budget/lint/ratchetadvisoryonly;executor1181s not suitewalltime,no fullpremerge claim. QAafterstage unchanged. A-15852 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15852-t-1619-final-evidence-review-at-a5d9b01ea.md). Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-02T15:49:57.894Z

Merged f1877262d4108fb28b2748f1527f5642de078539 onto dev.
