import { mountedOpenCodeDatabase } from './state-paths.ts';
import type { SignInInput } from './signin-types.ts';
/** Shared by the human terminal plan and the agent operation. No secret arguments. */
export function signInCommand(input:SignInInput){
 if(!/^\/cland\/auth\/[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*$/.test(input.path))throw new Error('invalid sign-in path');
 switch(input.harness){
  case 'codex':return {command:'codex',args:['login','--device-auth'],key:'CODEX_HOME',value:input.path};
  case 'claude-code':return {command:'claude',args:['auth','login'],key:'CLAUDE_CONFIG_DIR',value:input.path};
  case 'opencode':return {command:'opencode',args:['auth','login'],key:'OPENCODE_DB',value:mountedOpenCodeDatabase(input.path)};
  default:throw new Error('invalid sign-in harness');
 }
}
