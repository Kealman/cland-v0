# hub/test/suite-command-output.test.ts

Exercise credential prefixes split across chunks and earlier than the returned
tail. The complete bounded capture must be protected before any suffix is
released. Oversized output is drained with an explicit withholding marker;
assert retained bytes throughout rather than after an unbounded collection.
