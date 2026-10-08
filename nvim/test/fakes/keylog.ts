#!/usr/bin/env node
// A stand-in for a harness TUI in a session terminal: it puts its tty in raw mode, enables bracketed
// paste as the harnesses do, and appends every read as hex to the file named by its argument, so a test
// sees exactly the bytes a session would receive. Ctrl+D (a read that is exactly 0x04) ends it.
import { appendFileSync, writeFileSync } from 'node:fs';

const log = process.argv[2];
if (!log) {
  process.stderr.write('usage: keylog.ts <log file>\n');
  process.exit(2);
}
writeFileSync(log, '');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write('\x1b[?2004h');
process.stdout.write('keylog ready\r\n');
process.stdin.on('data', (chunk: Buffer) => {
  appendFileSync(log, `${chunk.toString('hex')}\n`);
  process.stdout.write(`read ${chunk.length} bytes\r\n`);
  if (chunk.length === 1 && chunk[0] === 0x04) {
    process.stdout.write('\x1b[?2004l');
    process.exit(0);
  }
});
