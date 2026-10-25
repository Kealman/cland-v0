# hub/test/git-maintenance-cli.test.ts

T3 exercises normal socket `hub.stop` and actual CLI process exit with a live
collector and descendant in a sealed disposable repository. A fixture preload
accelerates only the post-serving maintenance timer and substitutes a gated
collector; it holds the collector's SIGKILL attempt while recording genuinely
referenced native process and pipe handles. The production command deadline and
bounded close logic stay unchanged. This is process-lifecycle evidence, not a
measurement of the thirty-second startup delay.

Arm native close and its end-to-end bound before stop. Assert actual CLI exit,
continued collector life and retained durable ownership independently. Then run
real recovery, observe both captured PIDs gone and the receipt cleared, and drain
all owned writers before root removal. Failure diagnostics retain native exit or
an explicit incomplete outcome and a bounded log tail. Run this file alone under
cover-quiet admission; Linux cases >=3 s need a duration allowance before ready.
