import type {DatabaseSync} from 'node:sqlite';
import type {LoginAddInput} from './login-signin.ts';
export type LoginCardIntent={input:LoginAddInput&{signin?:boolean};at:number;card?:string;login?:string;host?:string};
export type StoredLoginCardIntent=LoginCardIntent&{id:string;seq:number};
/** Active admissions only. The sequence fences recovery against later answers. */
export class LoginCardIntents {
 readonly #db:DatabaseSync;
 constructor(db:DatabaseSync){this.#db=db;db.exec('create table if not exists login_card_intents(seq integer primary key autoincrement,id text not null unique,record text not null)');}
 put(id:string,value:LoginCardIntent):void{this.#db.prepare('insert into login_card_intents(id,record) values(?,?) on conflict(id) do update set record=excluded.record').run(id,JSON.stringify(value));}
 get(id:string):StoredLoginCardIntent|null{const row=this.#db.prepare('select seq,id,record from login_card_intents where id=?').get(id);return row?{...JSON.parse(String(row.record)),id:String(row.id),seq:Number(row.seq)}:null;}
 through():number{return Number(this.#db.prepare('select seq from login_card_intents order by seq desc limit 1').get()?.seq??0);}
 page(after:number,through:number,limit=64):StoredLoginCardIntent[]{
  if(!Number.isSafeInteger(limit)||limit<1||limit>64)throw Error('card intent page limit must be 1..64');
  return this.#db.prepare('select seq,id,record from login_card_intents where seq>? and seq<=? order by seq limit ?').all(after,through,limit).map(row=>({...JSON.parse(String(row.record)),id:String(row.id),seq:Number(row.seq)}));
 }
 remove(id:string,seq:number):void{this.#db.prepare('delete from login_card_intents where id=? and seq=?').run(id,seq);}
}
