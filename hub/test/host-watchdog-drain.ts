/** Attempt every owner and fallback cleanup. Errors remain test failures even
 * when fallback positively closes the writers; unknown closure retains roots. */
export async function drainFixtureOwners(owners:Array<()=>Promise<unknown>>,cleanup:()=>Promise<unknown>,confirm:()=>Promise<boolean>):Promise<{drained:boolean;errors:unknown[]}> {
 const errors:unknown[]=[];
 for(const owner of owners)try{await owner();}catch(error){errors.push(error);}
 try{await cleanup();}catch(error){errors.push(error);}
 let drained=false;
 try{drained=await confirm();if(!drained)errors.push(Error('fixture writer closure unconfirmed; root retained'));}catch(error){errors.push(error);}
 return {drained,errors};
}
