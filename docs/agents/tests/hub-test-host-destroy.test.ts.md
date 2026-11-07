# hub/test/host-destroy.test.ts

T2 CLI unknown-id refusal and fake release confirming reads, including repeated release. Uses disposable tempProject and fixtureEnvironment. No network or browser. Existing ReleaseResult shapes are preserved; optional read observer is additive.

Run: `node --test hub/test/host-destroy.test.ts`.

`destroy requires confirming reads: missing` and `throw` retain destroying/deletion-not-confirmed and never settle rows without a provider read. The missing-read case was red (destroyed instead of destroying) before the receipt requirement.

Source-review regressions (T2, no native workers): restarted ambiguous no-machine
acquisition remains incomplete; held local release preserves an onward host's
replacement row and pending stop; moved retained generations drain independently
of the display row; wrong-generation and missing-forward-owner receipts refuse
completion. Each was observed red before its source correction.

The forced held-release body-failure case returns with deletion blocked and
checks that its prearmed resource-phase drain releases and joins that producer
before Sessions and the table close. Hub-phase cleanup registration order cannot
strand the gate or close storage under the deleting operation.
