import { Store } from '../src/hub/store.ts';

/** Own setup at allocation; teardown joins setup before closing its metadata handle. */
export async function withFixtureStore<T>(path:string, own:(close:()=>Promise<void>)=>void, setup:(store:Store)=>Promise<T>):Promise<T> {
 const store=new Store(path);
 let work:Promise<T>|undefined,closed=false;
 const close=()=>{if(!closed){store.close();closed=true;}};
 own(async()=>{await work?.catch(()=>{});close();});
 work=Promise.resolve().then(()=>setup(store));
 try{return await work;}finally{close();}
}
