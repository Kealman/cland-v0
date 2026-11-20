# hub/test/setup-hosts.test.ts

`missing pool placements remain open without effects even with yes` proves two
missing pools name both roles and exact configure/local repair commands, without
effects, and the whole setup runner returns exit 1 with next `cland setup`.
The untouched skip and configured-ready controls remain unchanged.

T2 exercises setup's scripted prompter, terminal-runner boundary and projectHub
sockets. Provider metadata uses the scripted fake DigitalOcean API with a sentinel;
sign-in uses an in-process fake Host/provider and the production disk owner.
No real provider, credential, harness binary or browser is used.

Preserve T-1830's default-No pool offer and spec price (not stored), role choices,
hub token fingerprint and setter tests. Untouched nonterminal hosts skip, partial
pools remain open, and favourite whole-run exit-zero assertions stay unchanged.
The account regression seeds signed-out pinned A and ready B, then renews A and
observes ok; it covers missing accounts, provider/region mismatch, key filtering,
plain status compatibility and old replies without roleLogins. Its count-only key
is signed out before startup so it cannot intercept key-material readiness.

`T1831 C5 configured nonterminal pool reports image and missing harness commands
without effects` covers open image/login repair commands and no runner call.
`T1831 C1 C3 image build consent false/true names paid machine and defaults No`
covers separate builder consent, state receipt and declined login. Builder
c-16/unpriced cases cover the declared alternative price and no paid action
without a recorded price. The older socket setter test covers newly written pools.
The accepted-image socket case reads the durable fake image key and a current
receipt on the next run through setupHub's real host.prepare operation.

`T1831 C2 C4 terminal login exit 0/1/130 reports durable state and recovery`
covers one login for shared harness roles and exact retry commands. `T1831 socket
sign-in 0/1/130 persists login outcome and reaches Aide` runs the setup runner,
uses connection-owned login.add/login.signed-in, reads login.list and asserts the
final Aide row. These are simulated native-close receipts, not native harness
evidence. Preserve login-add.test.ts and login-terminal.test.ts as the existing
native terminal contracts; login-terminal now also drives setupMachine.addLogin's
native default, capturing the hub-assigned name before exact native completion.
Stage QA runs the complete fake-harness terminal journey on dev.
The wrong-region control refuses a nominally ready row from another region.

Review regressions require current image plus ready logins for quiet ok, retain
exact configured nonterminal commands under --yes/failed metadata reads, retain
add guidance before admission, and refresh eligibility after pinned-A success
before unpinned and distinct-B offers. The 256-row signed-out inventory case asserts zero
full-list scans and exactly one indexed get per named request. Its shared login
has 128 readers plus a writer; the named metadata read enumerates zero bindings,
while the unfiltered array retains all 129. The legacy
stub returns the previous full array despite the name filter. Account-path
assertions keep HOME/CLAUDE_CONFIG_DIR/CODEX_HOME under the disposable root.
Held paid confirmations mutate builder or pool terms; the post-yes re-read leaves
open with the exact command and zero prepare/login effects. Setup forwards the
confirmed normalized pool terms to login admission. Owner refusal regressions
live in host-prepare and login-host-pin; this file preserves the local re-read.

Run this file alone under the assigned preservation slot. Capture sorted-name
inventories of /private/tmp hc-*, ct-* and cland-h-* before and after; hashes and
counts must match. tempProject registers fixture cleanup immediately, projectHub
joins writers before root removal. No duration allowance is needed at T2's 2 s.
