import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { Login, LoginBinding } from '../host/logins.ts';
import { runKeyLoginAdd } from './login-key.ts';
import { terminalLogin } from './login-terminal.ts';
import type { LoginAddInput } from '../host/login-signin.ts';

export type ListedLogin = Login & { bindings: LoginBinding[] };
const commands = {
 set: async(args:string[],env:NodeJS.ProcessEnv):Promise<number>=>{
  if(args.length!==3||!/^[a-z0-9][a-z0-9-]{0,31}$/.test(args[0]!)||args[1]!=='--exclusive'||!['true','false'].includes(args[2]!))throw Error('usage: cland login set <name> --exclusive true|false');
  const discovery=readDiscovery(hubDiscovery(process.cwd()));
  if(!discovery)throw Error('no hub runs for this project — run cland hub start');
  await askHubFrame(discovery,{type:'login.set',name:args[0]!,exclusive:args[2]==='true'},30000,env);
  process.stdout.write(`login ${args[0]} exclusive ${args[2]}\n`);return 0;
 },
 snapshot: async(args:string[],env:NodeJS.ProcessEnv):Promise<number>=>{
  if(args.length!==1||!/^[a-z0-9][a-z0-9-]{0,31}$/.test(args[0]!))throw Error('usage: cland login snapshot <name>');
  const discovery=readDiscovery(hubDiscovery(process.cwd()));
  if(!discovery)throw Error('no hub runs for this project — run cland hub start');
  const result=await askHubFrame(discovery,{type:'login.snapshot',name:args[0]!},30000,env) as {state:string;retryAt?:string;reason?:string};
  process.stdout.write(result.state==='snapshotted'?'snapshot confirmed\n':`snapshot ${result.state}: ${result.reason??'unknown'}${result.retryAt?' — retry at '+result.retryAt:''}\n`);
  return result.state==='failed'||result.state==='not-sent'?1:0;
 },
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
 if (!command || !Object.hasOwn(commands,command)) throw Error('usage: cland login <list|add|snapshot|set>');
 return commands[command as keyof typeof commands](args.slice(1),env);
}
