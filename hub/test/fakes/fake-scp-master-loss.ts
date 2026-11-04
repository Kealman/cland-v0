#!/usr/bin/env node
// One native-admission fault: lose the mux after the hub's ready check.
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { authenticate } from './fake-ssh-common.ts';
const args=process.argv.slice(2),options:Record<string,string>={};
for(let i=0;i<args.length;i++)if(args[i]==='-o'){const [key,...value]=args[++i]!.split('=');options[key!.toLowerCase()]=value.join('=');}
const destination=args.at(-1)!.split(':')[0]!;
const host=await authenticate(options,destination);
await writeFile(join(host.directory,'copy-attempt.json'),JSON.stringify(options));
await unlink(options.controlpath!);
if(options.proxycommand==='false')process.exitCode=1;
else await writeFile(join(host.directory,'independent-connection'),'ordinary SSH fallback would connect');
