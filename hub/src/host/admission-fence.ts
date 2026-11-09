/** In-process revocation complements durable revalidation at each effect.
 * Entries live only while their lease is active; invalidation releases the index. */
const fences=new Map<string,Set<()=>void>>();
const key=(root:string,id:string)=>JSON.stringify([root,id]);
export function admissionFence(root:string,id:string):()=>boolean {
 let active=true;const k=key(root,id),rows=fences.get(k)??new Set<()=>void>();
 rows.add(()=>{active=false;});fences.set(k,rows);return ()=>active;
}
export function invalidateHostAdmission(root:string,id:string):void {
 const k=key(root,id);for(const revoke of fences.get(k)??[])revoke();fences.delete(k);
}
