# hub/test/host-boundary.test.ts

T1 boundary test with named exceptions, enforcing as required by T-1557 C1–C3. Run with
`node --test hub/test/host-boundary.test.ts`. It parses source with TypeScript;
fixtures never execute native calls or start a hub, harness, Git or browser.

Discovery recursively scans TypeScript/JavaScript under `hub/src/adapters` rather
than enumerating today's adapters. Value child_process imports (including aliases,
namespace/default and dynamic/require forms), the named native process helpers,
process.kill, and fs metadata imports/calls produce file/line/use diagnostics.
Native helper namespace member accesses are checked by forbidden member name,
independently of module path (including reexports). Audited exporters include
processes.ts, process-identity.ts, system-processes.ts, project.ts, session-cwd.ts
and hub/lock.ts. Harmless clock namespace imports remain allowed.
Type-only imports and text in comments/strings are allowed. This is a direct
source boundary, not whole-program alias/dataflow analysis; review helper-hidden
native calls and computed expressions separately.

Named exceptions from the dev audit:

- `processes.ts`: native local liveness and birth helpers used by local Host.
- `session-cwd.ts`: local Host directory identity/refusal implementation.
- `claude-code-local.ts`: standalone local Host compatibility and synthetic fixtures.
- `*.test.*`: test source; Host implementations in `hub/src/host` are outside the
  adapter root by design.
- `launch-files.ts`: `stat(path)` only as the `hubFileMeta` arrow body, for hub-owned
  rollback metadata. Its stat import is allowed; other stat calls still fail.
- `opencode/server.ts`: `stat(files.log)` only, reading the hub-side log offset.
  Other metadata calls/imports still fail.
- `sessions.ts`: SIGKILL of process.pid only in the immediate positive
  CLAND_TEST_CRASH_AT launch-reserved or stop-recorded branch.

Fixture cases cover each forbidden helper and metadata name, import aliases,
namespace/default imports, namespace fs access, named promises aliases, type-only
controls, harmless clock/native-helper namespace distinctions, and rejection
outside narrow exceptions. A disposable nested new-file fixture proves discovery
finds a planted bypass, then passes after its source is replaced with a Host call.
The real adapter tree must separately return no findings. Source review still
checks the semantics of each exception and the adequacy of runtime Host tests.
