# hub/test/rulebook-file.test.ts

This T1 file exercises `RulebookFile` directly with a fake clock and disposable
files, without a hub, socket, child process or browser. Await each write before
reading the persisted bytes; stop the rulebook before removing its fixture.

The generated `rulebook add writes exactly one final newline`, `rulebook edit
writes exactly one final newline` and `rulebook retire writes exactly one final
newline` cases seed two rules and append legacy extra EOF blank lines. Edit and
retire change the first rule, leaving the final sibling untouched. Each operation
must persist the literal final bytes `.\n`, proving the writer removes the old
blank lines as well as avoiding new ones.

EOF normalization belongs to the atomic write boundary, not the pure codec.
`hub/test/rulebook.test.ts` retains the untouched-source round trip and CRLF
preservation boundary. The existing sibling/provenance, reload/refusal, hand-edit
race and high-water assertions in this file remain in place.

Run `node --test hub/test/rulebook-file.test.ts` for this seam. It supplies T1
written-byte evidence; it does not exercise CLI transport or process lifecycle.
