# Interaction scanner baseline (T-1510)

The scanner fix in T-1492 (`1448aa046`) already handles
`createRequire(pathToFileURL(join(root, 'web/package.json')))`. It proves
resolve-only registry packages from candidate manifests, including literal
`for (const name of [...])` lists; dynamic, shadowed and escaping loaders remain
unknown. This does not execute loaders or consult live node_modules.

A-14877 (suite `5484e36d`, batch `f2031b15`, 2026-10-31 10:39Z) came from
hosting hub #64, started before T-1492 landed. Hub #65 includes that fix.
The Coordinator confirmed that post-restart batch receipts A-14924 (T-1501),
A-14938 (T-1525) and A-14959 (T-1498) contain only the following six non-Web
fallbacks. These receipts establish selection behavior; they do not mean those
six test files failed. No further hub refresh is required for T-1488.

| Candidate test | Recorded reason | Why retained |
| --- | --- | --- |
| `hub/test/mod-bridge.test.ts` | non-literal module specifier | Its dynamic import uses `new URL(..., import.meta.url).href`. The scanner supports literal module arguments, not evaluation of URL expressions. Retain conservatively rather than expanding expression interpretation in this item. |
| `hub/test/plan-approval.test.ts` | vm loader | It imports `node:vm` and executes the shipped draft algorithm with `runInNewContext`. Imports inside evaluated source cannot be proved by the static graph. |
| `hub/test/sqlite-contention.test.ts` | eval or indirect module loader | Its worker uses an evaluated source string and a `workerData.module` dynamic import. The `eval` option triggers the conservative loader guard; string contents are not ordinary source edges. |
| `hub/test/suite-accounting.test.ts` | indirect require | A helper parameter is named `require` (a boolean controlling remote launch), so the conservative identifier guard cannot prove it is unrelated to a loader. Scope-aware classification is separate precision work. |
| `hub/test/task-worktrees.test.ts` | unsupported createRequire base | It loads a synthetic package relative to `join(claimed.worktree.path, 'package.json')`. This runtime fixture location and actual require call are outside the supported project-base resolve-only form. |
| `nvim/test/plan-component.test.ts` | unresolved module specifier yaml | `yaml` is declared in hub/package.json, not an ancestor candidate manifest of the Neovim file. Runtime workspace hoisting is not static declaration proof. Retain rather than infer from installed modules or change dependency ownership. |

These reasons are the baseline for T-1488's separate batch-policy evidence.
This item changes no gate or default: omitted `batch_interaction` remains
`report`; explicit `run` applies conservative additions. An unknown graph adds
its file to the affected T2/Web selection; it does not add unrelated T3/T4.

Consumer audit: `suite-import-parser.ts` exports graphImports and its compatibility
projection graphImportSpecifiers; `suite-import-graph.ts` consumes their edges and
resolveOnly/base fields; `suite-interactions.ts` selects task and batch importers;
`tracker/merge-delta.ts` uses the graph for report-only coupling facts. Tests are
in `hub/test/suite-selection.test.ts`. Searches across hub, web, nvim, shared test
support, QA briefs and shipped skills found no additional direct consumers.
This documentation item changes none of these contracts or persisted shapes.
