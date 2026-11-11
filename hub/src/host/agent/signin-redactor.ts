/** Raw input and undecided echo prefixes live only in this operation's memory. */
export class SignInRedactor {
 #secrets:string[]=[];
 #tail='';
 #bytes=0;
 register(text:string){
  if(Buffer.byteLength(text)>4096||this.#bytes+Buffer.byteLength(text)>65536)throw new Error('sign-in input byte cap');
  this.#bytes+=Buffer.byteLength(text);
  for(const value of [text,text.replace(/[\r\n]+$/,'')])if(value&&!this.#secrets.includes(value))this.#secrets.push(value);
 }
 push(text:string):string{
  this.#tail+=text;let output='';
  while(this.#tail){
   const matches=this.#secrets.filter(s=>this.#tail.startsWith(s)).sort((a,b)=>b.length-a.length);
   if(this.#secrets.some(s=>s.startsWith(this.#tail)&&s.length>this.#tail.length))break;
   if(matches[0]){this.#tail=this.#tail.slice(matches[0].length);output+='[redacted]';}
   else{output+=this.#tail[0];this.#tail=this.#tail.slice(1);}
  }
  return output;
 }
 finish():string{const output=this.#tail?'[redacted]':'';this.#tail='';this.#secrets=[];return output;}
}
