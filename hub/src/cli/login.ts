import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { Login, LoginBinding } from '../host/logins.ts';

export type ListedLogin = Login & { bindings: LoginBinding[] };
const commands = {
 list: async (args: string[], env: NodeJS.ProcessEnv): Promise<number> => {
  if (args.length > 1 || args.length === 1 && args[0] !== '--json') throw Error('usage: cland login list [--json]');
  const discovery = readDiscovery(hubDiscovery(process.cwd()));
  if (!discovery) throw Error('no hub runs for this project — run cland hub start');
  const rows = await askHubFrame(discovery, {type:'login.list'}, 30000, env) as ListedLogin[];
  if (args[0] === '--json') process.stdout.write(JSON.stringify(rows,null,2)+'\n');
  else {
   process.stdout.write('NAME\tHARNESS\tACCOUNT\tKIND\tEXCLUSIVE\tSTATE\tPROVIDER\tREGION\tVOLUME\tSNAPSHOTS\tLAST SIGN-IN\n');
   for (const row of rows) process.stdout.write([row.name,row.harness,row.account,row.kind,
    row.kind === 'disk' ? String(row.exclusive) : '-',
    row.state + (row.bindings.length ? ' ' + row.bindings.map(b=>b.host).join(', ') : ''),
    ...(row.kind === 'disk' ? [row.provider,row.region,row.volumeId ?? '-',row.snapshotIds.join(', ') || '-'] : ['-','-','-','-']),
    row.lastSignIn ?? '-',
   ].join('\t')+'\n');
  }
  return 0;
 },
};
export async function runLogin(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
 const command = args[0];
 if (!command || !Object.hasOwn(commands,command)) throw Error('usage: cland login list [--json]');
 return commands[command as keyof typeof commands](args.slice(1),env);
}
