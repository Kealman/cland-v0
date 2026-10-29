# nvim/test/closed-pages.test.ts

The T3 real headless Neovim fixture uses the fixed 24-item pinned corpus rather
than the growing project tracker. It still plants 105 closed children to cross
the page boundary, a closed epic and a closed-root hierarchy. Production frame
receipts, explorer rows, board counts, card text, reopen deltas and archive
restoration retain their existing assertions and bounds.
