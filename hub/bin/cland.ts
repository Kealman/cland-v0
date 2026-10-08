#!/usr/bin/env node
// The cland CLI. Today it knows its version; `serve` arrives with #22.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const usage = `cland ${pkg.version}

usage: cland <command>

  --version, -v   print the version
  --help, -h      print this help
`;

const [command = '--help'] = process.argv.slice(2);

switch (command) {
  case '--version':
  case '-v':
  case 'version':
    process.stdout.write(`${pkg.version}\n`);
    break;
  case '--help':
  case '-h':
  case 'help':
    process.stdout.write(usage);
    break;
  default:
    process.stderr.write(`cland: unknown command "${command}"\n\n${usage}`);
    process.exitCode = 2;
}
