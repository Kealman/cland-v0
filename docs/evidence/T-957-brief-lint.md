# T-957 historical QA brief lint inventory

C4 evidence for source commit 4cca42e95f1c8be358313630328083b7207a4539 (the evidence-only commit follows it). Platform: darwin arm64; executor: local. Static lint is in enforce mode (findings return 1). This is not a suite or a QA demo receipt.

The public CLI entrypoint `runQaLint(['lint', '<brief>'], scratchRoot, io)` ran once for each distinct input below, in one process. Inputs were copies of the committed E-611–E-617 briefs; the process had a disposable root, HOME, XDG and Git configuration, and an environment containing no provider/account/session variables. No brief command was executed and no hub, Git or harness was started. These were seven distinct inventory inputs, not load repetitions.

Help drift fixed in this item: E-612 line 173 invokes `cland open <P1> --headless "+lua …"`. The implementation forwards Neovim argv after the directory, but OPEN_USAGE omitted it. Help now declares `[nvim args…]` and examples of forwarded flags; lint derives that boundary from help and leaves that argv unchecked. That invocation is now clean. Remaining findings follow; historical briefs are retained.

## qa/briefs/E-611.md

Exit 1.

```text
E-611.md:146: rm operand must be a literal cleanup path: "$Q": rm -rf "$Q"
E-611.md:656: duplicate check id D1 (first at line 624)
```

## qa/briefs/E-612.md

Exit 1.

```text
E-612.md:284: rm operand must be a literal cleanup path: "$M": rm -rf "$M" "$E"; mkdir -p "$E" "$M/remote" "$M/bin"
E-612.md:284: rm operand must be a literal cleanup path: "$E": rm -rf "$M" "$E"; mkdir -p "$E" "$M/remote" "$M/bin"
E-612.md:596: rm operand must be a literal cleanup path: "$E/wb.txt": rm -f "$E/wb.txt"
```

## qa/briefs/E-613.md

Exit 1.

```text
E-613.md:473: rm operand must be a literal cleanup path: "$MR": case "$MR" in /private/tmp/cland-init-machine-*|/tmp/cland-init-machine-*) [ -d "$MR" ] && rm -r -- "$MR" ;; esac
E-613.md:474: rm operand must be a literal cleanup path: "$TD": case "$TD" in /tmp/cland-setup-*) [ -d "$TD" ] && rm -r -- "$TD" ;; esac; done
```

## qa/briefs/E-614.md

Exit 1.

```text
E-614.md:140: rm operand must be a literal cleanup path: "$Q": [ ! -d "$Q" ] || rm -r "$Q"
E-614.md:237: rm operand must be a literal cleanup path: "$Q": [ ! -d "$Q" ] || rm -r "$Q"
```

## qa/briefs/E-615.md

Exit 1.

```text
E-615.md:215: rm operand must be a literal cleanup path: "$N/retro": rm -r "$N/retro" "$N/prototype"
E-615.md:215: rm operand must be a literal cleanup path: "$N/prototype": rm -r "$N/retro" "$N/prototype"
```

## qa/briefs/E-616.md

Exit 1.

```text
E-616.md:186: rm operand must be a literal cleanup path: "$Q": [ ! -d "$Q" ] || rm -r "$Q"
E-616.md:216: rm operand must be a literal cleanup path: "$Q": [ ! -d "$Q" ] || rm -r "$Q"
E-616.md:355: rm operand must be a literal cleanup path: "$MR": case "$MR" in /private/tmp/cland-init-machine-*|/tmp/cland-init-machine-*) [ -d "$MR" ] && rm -r -- "$MR" ;; esac
E-616.md:356: rm operand must be a literal cleanup path: "$TD": case "$TD" in /tmp/cland-setup-*) [ -d "$TD" ] && rm -r -- "$TD" ;; esac
```

## qa/briefs/E-617.md

Exit 1.

```text
E-617.md:479: rm operand must be a literal cleanup path: "$MR": case "$MR" in /private/tmp/cland-init-machine-*|/tmp/cland-init-machine-*) [ -d "$MR" ] && rm -r -- "$MR" ;; esac
E-617.md:480: rm operand must be a literal cleanup path: "$TD": case "$TD" in /tmp/cland-setup-*) [ -d "$TD" ] && rm -r -- "$TD" ;; esac; done
```

## Source fingerprints

- hub/src/qa-lint.ts: SHA-256 bca0bd2fccadd572cd21e1fd71dff3013bcb31628a6d8a2b787e417f538f5d09
- hub/src/cli/qa-lint.ts: SHA-256 3b6f683fd27108e0ec247042db570c2b248e0fbf03cadd24d24fb2c000c9e810
- hub/src/cli/usage.ts: SHA-256 38a21fcf5005bf9e5ab75a9f857cb3bf0479d52cd93bcaaa4866613713d199aa
