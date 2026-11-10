import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { Login, LoginBinding } from '../host/logins.ts';
import { runKeyLoginAdd } from './login-key.ts';
import { terminalLogin } from './login-terminal.ts';
import type { LoginAddInput } from '../host/login-signin.ts';

export type ListedLogin = Login & { bindings: LoginBinding[] };
const commands = {
 add: async (args:string[],env:NodeJS.ProcessEnv):Promise<number> => {
  const harness=args[0];
  if(harness!=='claude-code'&&harness!=='codex'&&harness!=='opencode')throw Error('usage: cland login add <claude-code|codex|opencode> [--name <name>] [--pool <pool>] [--account <account>] [--kind disk|key]');
  const input:LoginAddInput={harness,kind:'disk'};
  const seen=new Set<string>();
  for(let i=1;i<args.length;i+=2){
   const key=args[i]!.slice(2),value=args[i+1];
   if(!['--name','--pool','--account','--kind'].includes(args[i]!)||!value||value.startsWith('--')||seen.has(key))throw Error('usage: cland login add: expected unique --name, --pool, --account or --kind values; key values are read from stdin, never arguments');
   seen.add(key);
   if(key==='kind'){if(value!=='disk'&&value!=='key')throw Error('login kind must be disk or key');input.kind=value;}
   else input[key as 'name'|'pool'|'account']=value;
  }
  if(input.kind==='key') {
   const discovery=readDiscovery(hubDiscovery(process.cwd()));
   if(!discovery)throw Error('no hub runs for this project — run cland hub start');
   const existing=await askHubFrame(discovery,{type:'login.list'},30000,env) as ListedLogin[];
   return runKeyLoginAdd(input,metadata=>askHubFrame(discovery,{type:'login.add',...metadata},30000,env),env,existing);
  }
  const discovery=readDiscovery(hubDiscovery(process.cwd()));
  if(!discovery)throw Error('no hub runs for this project — run cland hub start');
  return terminalLogin(discovery,input,env);
 },
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
 if (!command || !Object.hasOwn(commands,command)) throw Error('usage: cland login <list|add>');
 return commands[command as keyof typeof commands](args.slice(1),env);
}
