# Executor credential argv audit (T-942)

The 2026-10-15 `pgrep -fl` observation cannot be attributed to a historical
process from the available evidence. T-492 establishes inheritance, not the
operation that copied a credential into argv. This audit does not reconstruct
or inspect the original token, process listings, shell history or session logs.

A current unsafe serializer **was** reproduced with `test-token-not-real`:
`accountPrefix({ DIGITALOCEAN_TOKEN: fake })` put the value in attach command
text. Codex and OpenCode use that prefix for every attach; Claude uses it for
named accounts. Neovim `sessions.lua:start` passes the command string to
`jobstart`, which runs it through a shell; Setup's `handover.ts` passes it to
`terminalCommand('sh', ['-c', command], ...)`. The shell command argument is the
exposure boundary, even though the eventual harness gets assignments as env.

`accountPrefix` now applies `withoutExecutorCredentials` before reading values
or constructing command text. It preserves account path quoting and OpenCode's
mutually exclusive database/data-home handling. Normal `selectAccount` results
already contain only allowed path variables; the reproduced input is a richer
saved/adapter overlay. There is no evidence that this produced the historical
**npm** process line. This is a concrete defensive fix, not historical attribution.

## Scope and inventory

The source inventory covers `hub`, `nvim` and `shared`, including launch helpers,
tests and fakes. An accompanying artifact lists direct native call sites with
source executable and argv expressions. Its AST scan follows named/namespace
imports and `promisify` aliases. It does not execute those expressions, inspect
environment values or claim to be a complete interprocedural proof. Injected
process methods, shell/Lua and generated fixture code were inspected separately.

The following is the inventory of environment-to-command conversions and
environment-dependent launch sites. “Source” checks follow the named fields;
“runtime” checks feed the fixed fake credential to the actual builder/boundary.
Every row was checked for whether adding `DIGITALOCEAN_TOKEN=test-token-not-real`
to the input environment can make its **value** enter argv. Independent binary,
path and command overrides retain their own meaning; this audit does not claim
to protect commands deliberately configured with a credential in them.

| Site and downstream launch | Environment input used in executable/argv | Check and result |
| --- | --- | --- |
| `accounts/registry.ts:accountPrefix` → all three adapters' `attachCommand` → Neovim `sessions.lua:start`, Setup `handover.ts` | All account overlay entries before fix | Runtime red/green T1 regression; runtime all three adapter boundaries: fake absent after fix, including named Claude account. |
| `adapters/codex.ts:mcpOverrides` → `#startServer` `spawn` | Locally constructed `CLAND_HUB_FILE`, session id/name, delivery and role; launch token is an env **name** in `env_vars` | Source: no inherited env enumeration. Runtime native argv check with fake in adapter environment and account overlay. |
| `adapters/claude-code.ts:#sessionFlags` → `#cli` `execFile` | Explicit spoke identity, hooks/settings, per-launch hub token | Source: explicit map, no inherited provider credentials. Same native runtime check. The per-launch hub token is a different credential and is outside this provider-token task. |
| `adapters/opencode/server.ts:startServer`, `accounts/poller.ts:#probe`, `models.ts:#probe`, `doctor/opencode-smoke.ts` | Harness binary overrides; fixed serve/app-server/usage flags, generated port | Source: inherited env is an options object, never argv entries. OpenCode adapter runtime check. |
| `accounts/registry.ts:openCodeLogin`, `selectAccount`, Claude `#dirPrefix`; `setup/steps/logins.ts` → `setup/machine.ts` → `terminalCommand` | Only `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `OPENCODE_DB`, `XDG_DATA_HOME`, HOME-derived paths and harness binary overrides | Source: registry rejects other variable keys; login `variable` is chosen from literals. Fake provider key cannot be selected. Account-prefix regression retains path selection. |
| `cli/artifact.ts:openEditor` | `VISUAL`/`EDITOR` become shell program text | Source: only those keys are read; provider key is not read or expanded into text. |
| `cli/open.ts`, `setup/handover.ts` → `terminalCommand` | `CLAND_LAUNCHER` selects executable | Source: root and explicit rest args; provider key not used. Attach branch uses fixed account serializer above. |
| `nvim/bin/cland-nvim` | `CLAND_NVIM` resolved by `nvim-path.ts`; root, `NVIM_APPNAME` and explicit CLI arguments | Source: fixed `env -u NVIM_LOG_FILE NVIM_APPNAME=... CLAND_ROOT=...`; no enumeration of inherited env. |
| `nvim-path.ts` → tar/xattr; `nvim/test/client.ts` both spawn branches; `cli/qa.ts` → Neovim; `nvim/test/graph-layout.test.ts` | `CLAND_NVIM`, cache/download paths; generated fixture/socket/script paths | Source: provider key never contributes to binary/path. Child env filtering is T-492; runtime client-component test already uses fake provider credential. |
| Neovim `init.lua:cli_command` → `hub.lua:_spawn`; `qa.lua:cland_cli/build_fixture`; `artifacts.lua` | `CLAND_COMMAND` JSON argv, `CLAND_NODE`, `CLAND_OPENER`; explicit serve/fixture args | Source: only named command overrides are parsed, no inherited env serialization. Fake provider key has no source-to-argv edge. |
| `nvim/test/qa-runner.ts:qa` | Explicit prefix/args; `CLAND_NVIM` remains in env | Source: env enumeration populates spawn **options**, not argv; final environment filtered. |
| `hub/test/run-suite.ts:runSuite`, `packageSuitePlan`; `hub/test/load-gate.ts` | Tier-assignment presence selects a fixed import; workers become a validated integer; selection supplies filenames | Source: fake provider key is neither enumerated into argv nor used for selection. Environments use `suiteTestEnv`/shared filter. |
| `hub/src/hub/suites.ts:#hostGate`, `suite-worker.ts` → `suite-command.ts` | Recorded project check/test command strings; selection/limits stay env/file data | Source: no expansion of hub env into shell text. T-492 filter runs before native spawn. Root `test:nvim` script is `node hub/test/run-suite.ts nvim`. |
| `executor/local.ts:#start` | Worker module path and job filename | Source: run metadata is written to a file, not serialized from env into argv; env separately filtered. |
| `executor/droplet/machine.ts` → injected `#execute` (SSH/SCP) | Only `CLAND_SSH_BIN`/`CLAND_SCP_BIN` select executable; lease/key/path/command build argv | Runtime T1 fake native boundary covers `exec`, `result`, `put`, `get`; fake absent in argv and env. |
| `executor/droplet/run.ts:deliver`, `prepare.ts`, `dependencies.ts` | Runner script exports a fixed verification metadata map; SSH keygen receives generated key path/name | Source: remote env file has no generic host-env enumeration. Scripts are uploaded as files; provider API reads token in-process for HTTP authorization. |
| `executor/droplet/watchdog.ts:armWatchdog/main` | Node + module + lease directory; caffeinate + current PID | Source: provider credential intentionally stays in watchdog env; neither launch serializes env into argv. |
| `cli/hub.ts:startProjectHub` | Fixed CLI entry and starter identity | Source: starter JSON contains identity, not the supplied environment. Hub inherits env intentionally. |
| `doctor/report.ts:run`, `setup/terminal.ts:terminalCommand`, `system-processes.ts` | Caller-supplied executable/args | Source: reviewed callers above and process-table operations pass selected binary/path/PID fields; generic wrapper does not serialize env. |
| `hub/bin/typecheck.ts`, `verify-prepare.ts`; test recording, selection replay and compile-cache tools | Pinned compiler/Neovim paths, explicit source/test/fixture paths and flags | Source: env controls options/cache, not generic argv serialization. |
| `hub/test/harness.ts`, fixture helpers, generated test programs, fake harnesses/machine launchers | Explicit CLI args; fake Claude spoke dispatch uses `CLAND_NODE`/`CLAND_CLI`; MCP transports use supplied command arrays | Source: env copies go to options/config/log data, not process args. Fake machine runs explicit shell command with a constructed HOME/PATH/LANG env. No provider-key-to-argv conversion. |
| Git/process inspection calls in the native inventory | Refs, paths, numeric PIDs, fixed format flags; PATH resolves binary | Source: no generic env-to-argument mapper. `process-cleanup.ts` reads environment ownership markers internally (`ps eww` on macOS); it explicitly does not log the result. That is not a credential argv constructor. |

The generic entry mappers found were `accountPrefix` (fixed), Codex's locally
constructed MCP map (checked above), and env copies into options/config/fixture
records. `Object.values(env)` in diagnostics is for redaction, not command
construction. Direct provider-token value reads outside test fixtures are the
provider HTTP client, admission/status checks and transport error redaction;
none feeds a child argument. The shared filter skips denied names before reading
their values. No remaining automatic provider-environment-to-argv path was found
within this source scope.

## Repeatable checks

These targeted commands do not acquire or run a whole suite:

```sh
env -u DIGITALOCEAN_TOKEN node --test hub/test/accounts-registry.test.ts
env -u DIGITALOCEAN_TOKEN node --test hub/test/executor-contract.test.ts
env -u DIGITALOCEAN_TOKEN node --test --test-name-pattern='successful spawn, watch' hub/test/adapter-native-boundary.test.ts
```

The first command failed before the fix because the fake value occurred in the
shell argument. It passes after the fix and checks that denied values are never
read, API input is unchanged, and account selection remains present. The adapter
checks exercise actual launch/control argv builders and returned attach commands
at the existing native boundary; they do not claim a real terminal attachment or
historical npm reproduction. The machine checks inject a transport observer and
start no subprocess. T1 is sufficient for both added tests; the existing adapter
contract remains T3. Mode-free task verification supplies the separate T0–T2 gate;
T3 is deferred to the repository's periodic/integrated occasions.
