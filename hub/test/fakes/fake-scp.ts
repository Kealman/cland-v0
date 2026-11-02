#!/usr/bin/env node
import { copyFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { authenticate } from './fake-ssh-common.ts';
import { hostPath } from './fake-host.ts';
try {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '-q' || arg === '-p' || arg === '-O') continue;
    if (['-o', '-i', '-F', '-P'].includes(arg)) {
      const value = args[++i]; if (!value) throw new Error('missing scp option value');
      if (arg === '-o') { const pair = value.match(/^([^=\s]+)[=\s]+(.+)$/); if (!pair) throw new Error('invalid scp option'); options[pair[1]!.toLowerCase()] = pair[2]!; }
    } else if (arg.startsWith('-')) throw new Error('unsupported fake scp option');
    else files.push(arg);
  }
  if (files.length !== 2 || files[0]!.includes(':')) throw new Error('fake scp supports one local source');
  const match = files[1]!.match(/^([^:]+):(.+)$/);
  if (!match) throw new Error('fake scp requires a host destination');
  const host = await authenticate(options, match[1]!);
  let target = await hostPath(host.home, match[2]!);
  if (await stat(target).then(s => s.isDirectory(), () => false)) target = await hostPath(host.home, join(target, basename(files[0]!)));
  await copyFile(files[0]!, target);
} catch (error) { console.error((error as Error).message); process.exitCode = 1; }
