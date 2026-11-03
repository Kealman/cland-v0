# hub/test/host-ssh-contract.test.ts

T3: `node --test hub/test/host-ssh-contract.test.ts` uses a real SSH carrier with
the fake stand-in and an in-process real agent. Every shared Host behavioral row
runs unchanged. The local-specific forwarding/layout row supplies scratch
endpoints, remote layout and hub Unix-socket expectations; the local defaults
are unchanged. The contract includes identity-fenced stop, callbacks, native
completion, tree usage, exact file bytes and Git worktrees.

Additional cases exercise planted synthetic credentials, a registry-backed f1
launch alongside local and `CLAND_TEST_HOSTS`, every down-tunnel operation and a
native census. Adapter tests send generated Claude/Codex command environments
through a fake native harness boundary on the SSH agent and observe completion
and the durable environment file. Claude supplies a scratch `modDir`. OpenCode
retains its atomic-preparation refusal and proves no process started. Its shared
environment builder has local/remote coverage in host-command-environment.

The fixture uses a UUID suite root, shared socket fallback/alias helpers and
actual connected-path byte assertions. It captures fixture processes by native
birth, stops carrier and agent, joins its census and only then removes owned
fallback paths, reciprocal aliases and storage. The in-process agent itself
starts no `cland host serve`; the census rejects any fixture survivor.

Command stream-loss cases hold native cancellation while the writer is observed
live. Rollback mutations are fenced; shutdown reports incomplete rather than
settled. Releasing the barrier yields a durable cleanup result, and a normal
recovery path resolves the exact command outcome. Invalid command admission does
not leave a permanent fence.

Oversized escaped command output must reach a bounded terminal Host.run result,
both directly and after loss of the accepted reply. Tests retain the native exit
code, diagnostic tails and explicit truncation error, then require a subsequent
command to succeed. A deadline bounds waiting for the actual result; it is not a
sleep or a claim about command latency.

The aggregate contract wrapper retains one fixture and all 14 rows. Its dated
exact-identity allowance in durations.json is 11.001 seconds, owned by E-880 from
2026-11-03 through 2026-11-10. A-16263 records a source-equivalent local macOS
passing sample of 7.099404042 seconds; A-16269 records a Linux droplet passing
wrapper at 7.33375717 seconds, despite that overall run failing Git wording and
the separate aggregate budget gate. The allowance rounds 1.5 times the worst
sample upward to milliseconds. Both passing samples replay through the production
checker with before-failure and after-pass controls; row/native assertions and
timeouts are unchanged. The allowance is not a whole-suite passing receipt.
