# Corrected run copies

Start each run from the latest corrected run copy of the relevant brief, including
its recorded corrections, rather than an earlier draft. Record the source brief
path and correction commit. Reconcile reused helpers against those corrections
before pinning them. Keep earlier captures and label run-copy corrections separately
from product failures. The item lead resolves missing or conflicting corrections.

`cland qa lint` always prints the following lexical advisories as
`file:line: report-only <kind>: <advice>`. They neither change exit status nor
block admission. They scan the brief text alone, even without a build inventory;
external helpers must have their relevant setup described in the brief.

| Kind | Trigger | Brief guidance |
| --- | --- | --- |
| seal | `spawn(`, `execFile(` or `exec(` | Name both `fixtureEnvironment` and `scratchGitEnvironment`; apply the full shared builder result after final overlays and add nothing afterwards. |
| kit-pin | QA kit, reused/copied kit, or `.agents/skills/qa/` path | Add a standalone `Kit commit: <40 hex SHA>` line for the helper source, separate from the build SHA. Reconcile every reused kit and record its pin. |
| build | `web/dist`, Chrome Headless Shell, Chrome for Testing or Playwright | Include `npm run build` before checks consuming the browser bundle. |
| census-filter | `ps -…` or `pgrep` | Describe excluding the own/observer pid exactly; retain the unfiltered capture. A process-name filter misses macOS framework Python. Use fixture-owned process receipts for cleanup. |
| exact-list | `exact: false`, `--test-name-pattern` or all/every tests | Add `Required cases: <list or generated-list path>` on its own line, naming the complete generated registrations at the tested build, including subset-matching files. |

These are presence checks, not a shell/JavaScript interpreter or proof of correct
ordering, pin freshness, one pin per kit, census implementation, successful build
or exhaustive case membership. A mention in prose can satisfy them. QA still
checks the actual helper, overlays, pinned bytes and generated registrations;
lint never executes a helper to infer those facts. QA lint's source-reference checks
retain their blocking behaviour. Enforcement of these new advisories requires a
separate item and replay evidence.
