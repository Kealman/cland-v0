# hub/test/release-preflight-component.test.ts

`hub/test/release-preflight-component.test.ts` is T2. Executable lookup and command execution are faked. A disposable root and the shared fixture environment isolate the test. It proves hub PATH selection, absolute executable paths, the existing-auth command, committed files pinned to the observed dev head, and an allowlist of read-only commands. It makes no real Git, gh, network or provider call.

The authenticated Coordinator CLI regression uses an in-process hub with a nonexistent executable PATH; no gh, Git or network call can execute. It proves successful report admission without covers and an Implementer refusal. Exact-byte controls include a missing final newline and trailing whitespace, both of which startup rewrites; a project-owned file stays kept.

Run `node --test hub/test/release-preflight-component.test.ts` on supported Node. The CLI transport and report-mode exit semantics are covered by `hub/test/cli.test.ts`; the previous release wire shape remains covered by `hub/test/homebrew.test.ts`.
