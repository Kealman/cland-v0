---
id: T-427
kind: task
title: "TypeScript 7 for the hub's typecheck: adopt it when its output matches on the whole repository"
state: open
status: backlog
size: S
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-425
blocked_by: []
topic: null
branch: null
created: 2026-10-14T16:43:34.573Z
updated: 2026-10-14T16:43:34.573Z
---

## What to build

Found by the web-stack research (`docs/research/web-stack.md` on `research/web-stack`, section 3's side finding and the list's item 11): TypeScript 7.0, released on 2026-07-08 as a native port, typechecks today's hub clean in 1.6 s against 18 to 26 s for TypeScript 5.9 on this machine under load, and the web probe in 0.4 s against 4.8 to 5.8 s. Every verification runs `npm run typecheck` before its tests, so each run would save about 20 seconds. Decided in `docs/spec/v0.1.3.md` §3.5: adopt it when its output matches the current one on the whole repository.

- Add the TypeScript 7 compiler as a dev dependency beside 5.9.
- Run both over what the root `npm run typecheck` covers: the hub's `bin`, `src` and `test` (`hub/tsconfig.json`) and Neovim's `bin` and `test` (`nvim/tsconfig.json`).
- Compare their diagnostics on the clean tree and, in a scratch copy, on planted errors: at least one for each strict option in `hub/tsconfig.json` (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) and one for `allowImportingTsExtensions`. Matching means the same error codes at the same files and lines.
- When they match, switch the typecheck scripts in `package.json` and `hub/package.json` to TypeScript 7. TypeScript 5.9 stays for the two tests that import the compiler API (`hub/test/executor.test.ts` and `hub/test/tracker-container-source.test.ts`), since 7.0 ships no API.
- When they differ, record the differences on this item, keep 5.9, and report a follow-up to the lead.
- Time both compilers only when `cland verify queue` has no holder and no waiter (T-204).

A new dev dependency changes the lock file, so the droplet snapshot is prepared again once; the verification worker's typecheck step needs no change, since it runs `npm run typecheck`.

## Acceptance criteria

- [ ] C1. A comparison table on this item shows both compilers' diagnostics on the clean tree and on each planted error, for the hub and the Neovim projects.
- [ ] C2. When the diagnostics match, `npm run typecheck` runs TypeScript 7 over the whole repository, with its time before and after recorded on this item; otherwise the differences are recorded, 5.9 stays and a follow-up is filed.
- [ ] C3. The two tests that use the compiler API still pass on TypeScript 5.9.
- [ ] C4. `hub/README.md` and `docs/agents/tests.md` name the compiler the typecheck uses and why 5.9 remains in the repository.
