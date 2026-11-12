import type {LoginAddInput} from './login-signin.ts';

type Harness=LoginAddInput['harness'];
// Origins, never suffixes or arbitrary HTTPS URLs. Sources:
// https://code.claude.com/docs/en/authentication (Claude account and Console)
// https://github.com/openai/codex/blob/main/codex-rs/login/src/server.rs
// https://github.com/anomalyco/opencode/blob/v1.2.0/packages/opencode/src/plugin/codex.ts
// login.example.test is the existing fake harness's non-network sign-in output.
const patterns:Record<Harness,{origins:readonly string[];url:RegExp;code?:RegExp}>={
 'claude-code':{origins:['https://claude.ai','https://platform.claude.com','https://login.example.test'],url:/https:\/\/[^\s<>"']+(?=[\s<>"'])/g},
 codex:{origins:['https://auth.openai.com','https://login.example.test'],url:/https:\/\/[^\s<>"']+(?=[\s<>"'])/g,code:/(?:(?:device|user)\s+code\s*:\s*|one-time code[^\n]*\n\s*)([A-Z0-9-]+)(?=\s)/i},
 opencode:{origins:['https://auth.openai.com','https://login.example.test'],url:/https:\/\/[^\s<>"']+(?=[\s<>"'])/g},
};

export function allowedSignInLink(harness:unknown,link:unknown):link is string{
 if(typeof harness!=='string'||!Object.hasOwn(patterns,harness)||typeof link!=='string')return false;
 try{const url=new URL(link);return !url.username&&!url.password&&patterns[harness as Harness].origins.includes(url.origin);}
 catch{return false;}
}

/** Only complete tokens from bounded, memory-only native output become a card. */
export function parseSignInOutput(harness:Harness,output:string):{url:string;code?:string}|undefined{
 const clean=output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),pattern=patterns[harness];
 const url=[...clean.matchAll(pattern.url)].map(match=>match[0]).find(link=>allowedSignInLink(harness,link));
 const code=pattern.code?.exec(clean)?.[1];
 if(!url||(harness==='codex'&&!code))return;
 return {url,...(code?{code}:{})};
}
