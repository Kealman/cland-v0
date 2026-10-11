# Node compile-cache qualification (T-220)

Automatic module compile-cache activation remains disabled. No released runtime
in the supported engine range (`>=24.13.0 <25`) passed the warm-load check below
on macOS arm64 on 2026-10-11. Fresh per-process directories avoid warm reads but
cost more than disabling caching. The Coordinator approved the item's `wontfix`
fallback for automatic activation on the current engine range; the documented
check still merges. Retain it for a future Node/V8 fix or Node 25 support.

## Repeat the original hub reproduction

From the repository root, run with each candidate Node binary:

```sh
node hub/test/compile-cache-check.ts shared 5
node hub/test/compile-cache-check.ts disabled 5
node hub/test/compile-cache-check.ts isolated 5
```

Each round starts with a fresh cache. Three sequential child processes import
`hub/src/hub/core.ts` and construct `new HubCore()`. In `shared` mode, loads 2 and 3
read the cache populated by load 1; in `isolated` mode every process starts cold.
The check verifies successful construction and the expected active/disabled cache
state, records version/platform/architecture, exit status, signal and elapsed
milliseconds, and removes its temporary cache even after a child fails.
Exit 1 means the candidate failed qualification. The caller's `NODE_OPTIONS` and
cache-control variables are cleared for the children so the default runtime is
tested. Run the checker itself with the candidate binary; it uses `process.execPath`
for every child. It is a manual check, intentionally outside `*.test.ts`, because
the supported runtime currently fails it.

The original T-174 evidence (A-1154) used the same import/construction boundary.
The fault was reconfirmed on T-174's `80f356a` and on dev `22c80d6`. An earlier
30-load experiment on dev passed, so one passing cache generation is insufficient
evidence of safety. The checked-in check then failed warm loads across repeated
fresh generations: TypeErrors such as `Receiver must be class #leadName` and
SIGSEGV. No daemon, teardown, parallel process or duplicate module graph is needed.

## Released engine-range results

Each row is five cold loads plus ten warm loads at `22c80d6`, using the candidate's
default flags. These are all released versions in range in the official
[Node distribution index](https://nodejs.org/dist/index.json) on 2026-10-11.

| Node | Cold passed | Warm passed | Qualifies |
| --- | ---: | ---: | --- |
| 24.13.0 | 5/5 | 1/10 | no |
| 24.13.1 | 5/5 | 0/10 | no |
| 24.14.0 | 5/5 | 0/10 | no |
| 24.14.1 | 5/5 | 0/10 | no |
| 24.15.0 | 5/5 | 0/10 | no |
| 24.16.0 | 5/5 | 1/10 | no |
| 24.17.0 | 5/5 | 0/10 | no |
| 24.18.0 | 5/5 | 0/10 | no |
| 24.18.1 | 5/5 | 1/10 | no |
| 24.19.0 | 5/5 | 1/10 | no |
| 24.20.0 | 5/5 | 0/10 | no |
| 24.21.0 | 5/5 | 0/10 | no |
| 25.6.1 (outside engines) | 5/5 | 10/10 | observation only |

Disabled and isolated controls passed all 15 loads each on 24.13.0, 24.14.0 and
24.21.0. Full-suite verification must use supported Node with automatic caching
still disabled. These macOS arm64 observations do not establish other platforms
or future Node versions as safe.

## Measurement and decision

End-to-end child elapsed time includes Node startup, import and construction.
Medians across 15 loads in separate local batches:

| Node | Disabled | Fresh per-process cache | Cost of isolation |
| --- | ---: | ---: | ---: |
| 24.13.0 | 108.519 ms | 130.226 ms | +21.707 ms |
| 24.14.0 | 111.045 ms | 121.740 ms | +10.695 ms |
| 24.21.0 | 102.698 ms | 125.519 ms | +22.821 ms |

Failed warm constructions are excluded from saving claims. To measure the
compilation benefit on 24.21.0 without the crashing constructor, a separate
import-only check used this child script:

```js
import { HubCore } from './hub/src/hub/core.ts';
if (typeof HubCore !== 'function') throw Error('missing class');
console.log('imported');
```

Eleven shared-cache and eleven disabled children ran alternately against one
fresh cache directory; discard the first pair to leave ten samples each.
All imports passed. Median elapsed time was 77.352 ms cached versus 157.577 ms
disabled: **80.225 ms (50.9%) saved per import-only load**. This isolates the
potential compilation saving, not usable hub startup: it does not construct the
hub or exercise private methods. Outside engines, Node 25.6.1 completed all
constructions and its ten warm loads had median 75.750 ms versus 150.873 ms
disabled (75.123 ms, 49.8% shorter).

Machine load was uncontrolled and batches were small. These measurements cannot
be extrapolated into a full-suite time reduction. They show why shared warm
caching is attractive, and why enabling a fresh directory per process does not
recover that benefit. There is no supported-version allowlist to enable today.

## Upstream status and standalone reproduction

Checked on 2026-10-11: the latest released Node 24 is
[24.21.0](https://nodejs.org/en/blog/release/v24.21.0), and it still reproduces.
The distribution index reports V8 13.6.233.17 for every tested Node 24 release.
Searches of nodejs/node issues and PRs for `compile cache` + `private`,
`code cache` + `private`, and `Receiver must be class` found no matching fix or
report. The open [compile-cache performance PR #63861](https://github.com/nodejs/node/pull/63861)
does not establish a private-brand fix. Node 25 passing is evidence of a runtime
difference, not proof of a particular upstream repair or backport.

Node documents that the [module compile cache](https://nodejs.org/api/module.html#module-compile-cache)
persists compiled code for later processes. The local differential points to
code-cache serialization/deserialization; the exact V8 defect remains unproven.
An upstream report is warranted: this JavaScript-only reproduction removes
TypeScript stripping, SQLite and all cland dependencies. The following creates
the source; then run it cold and twice warm against one new cache directory.

```sh
node --input-type=module -e '
import { writeFileSync } from "node:fs";
const methods = Array.from({ length: 128 }, (_, i) => `#m${i}() {}`).join("\n");
writeFileSync("cache-repro.mjs", `class Repro {
${methods}
static #signature() { return 42; }
constructor() { console.log(Repro.#signature()); }
}
new Repro();\n`);
'
cache_dir=$(mktemp -d)
for load in 1 2 3; do
  NODE_COMPILE_CACHE="$cache_dir" node cache-repro.mjs
done
rm -r "$cache_dir"
rm cache-repro.mjs
```

Use a clean diagnostic directory with `NODE_OPTIONS` and
`NODE_DISABLE_COMPILE_CACHE` unset. Expected output is `42` three times; on
24.21.0 the cold run prints `42`, then warm runs throw a private-brand TypeError
or die with SIGSEGV. A smaller class with 32 private methods passed this local
check, so the source shape matters. This is a standalone reproduction, not a
claim about the minimum failing method count. No upstream issue was filed as
part of this implementation.

Revisit activation only after this hub check and the standalone reproduction
pass repeatedly on a supported runtime, followed by a complete hub/Neovim suite
using that cache configuration. A successful isolated run alone is insufficient.
