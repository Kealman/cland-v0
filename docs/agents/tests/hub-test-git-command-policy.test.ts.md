# hub/test/git-command-policy.test.ts

T1 checks the shared pure Git argv classifier. Known read forms disable optional
index writes, promisor lazy fetch and external diff helpers; unsupported commands/options and actual
writer variants retain durable ownership. Symbolic-ref writes, config writes and
output-file options are explicit negative controls. Config mode flags are parsed
after consuming option values: a filename named `--get` or `--list` cannot turn
a default config write into an admitted read.

The frozen `fixtures/git-command-call-sites.json` census lists all producer
modules and literal/forwarding sites. Current source is scanned in batches of 32
with a 2000-file bound, and its normalized sites must equal that inventory.
Concrete argv samples have independent fixed class expectations; runtime argv
forwarders retain explicit dispositions, rather than claiming a fixed class.
The deliberately broad local-wrapper sweep also records non-Git calls as
unaffected by Git admission. Positive source fixtures cover import aliases,
namespace calls, both one-array private wrappers and legacy cwd-plus-array forms.
The two literal demo private calls have concrete read expectations rather than
dynamic forwarding dispositions. The capability cache shares concurrent probes,
requires a successful native-close receipt, caches an older fake Git's code129
refusal, reprobes a replacement executable and logs fallback once. Ordinary
repository proof requires a complete no-match receipt; promisor or unknown facts
stay owned. Each old-Git read requires a fresh receipt, with no repository cache.
Case-insensitive promisor, partialclonefilter-only and partial-clone extension
key shapes are explicit positive controls; unrelated keys do not match. No process,
socket, credential or live tracker is used.
