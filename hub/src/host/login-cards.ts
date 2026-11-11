import type { WaitingLaunch } from '../protocol.ts';
import type { Store } from '../hub/store.ts';
import type { HubCards } from '../hub/hub-cards.ts';
import { loginSignInHint } from './login-signals.ts';

const metadataKey = 'login-wait-cards';
export type SignOutEpisode=NonNullable<import('./logins.ts').Login['signedOut']>;
type SignInCard={id:string;episode:string;noticed?:true};
type SignOutOptions={episode?:(name:string)=>SignOutEpisode|undefined;notice?:(name:string,episode:SignOutEpisode)=>void};
type WaitCard = { pool: string; harness: string; id: string };

/** One prompt for each continuous pool/harness wait, including answered prompts.
 * Only active waits are retained; no ask history scan is needed on restart. */
export class LoginCards {
  readonly store: Store;
  readonly cards: HubCards;
  readonly signOutOptions:SignOutOptions;
  constructor(store: Store, cards: HubCards, options:SignOutOptions={}) {
    this.signOutOptions=options;
    this.store = store; this.cards = cards;
    cards.onAnswer('login-signin', (_payload, _answer, context) => {
      if(context.declined||context.option===2)return 'Not now';
      throw Error('Sign-in handler unavailable');
    });
    cards.onAnswer('login-create', (payload, _answer, context) => {
      const { pool, harness } = payload as WaitCard;
      return context.declined || context.option !== 1
        ? 'Not now'
        : `cland login add ${harness} --pool ${pool}`;
    });
    for(const name of Object.keys(JSON.parse(store.meta('login-signin-cards')??'{}')))this.loginChanged(name);
  }

  /** Startup supplies indexed active rows; individual changes use one primary-key read. */
  recoverSignedOut(rows:Iterable<{name:string}>):void {
    for(const row of rows)this.signedOut(row.name);
  }

  /** Shared card admission: a durable removal claim suppresses sign-in, including recovery. */
  withdrawRemoving(name:string):boolean {
    if(!this.store.hosts.logins.isRemoving(name))return false;
    this.store.transaction(()=>{
      const active=JSON.parse(this.store.meta('login-signin-cards')??'{}') as Record<string,SignInCard>;
      if(!Object.hasOwn(active,name))return;
      const previous=active[name]!;
      if(this.store.ask(previous.id)?.state==='open')this.cards.withdraw(previous.id,'Login removal in progress');
      delete active[name];this.store.setMeta('login-signin-cards',JSON.stringify(active));
    });
    return true;
  }

  signedOut(name:string):void {
    if(this.withdrawRemoving(name))return;
    const login=this.store.hosts.logins.get(name);
    if(login?.state!=='signed-out')return;
    const episode=this.signOutOptions.episode?.(name)??login.signedOut;
    if(!episode?.id)throw Error(`login ${name}: signed-out episode identity missing`);
    this.store.transaction(()=>{
      const active=JSON.parse(this.store.meta('login-signin-cards')??'{}') as Record<string,SignInCard>;
      const previous=Object.hasOwn(active,name)?active[name]:undefined;
      if(previous?.episode===episode.id)return;
      if(previous&&this.store.ask(previous.id)?.state==='open')this.cards.withdraw(previous.id,'New sign-out episode');
      const hint=[loginSignInHint(episode),this.store.hosts.logins.signInFenceReason(name)].filter(Boolean).join(' ');
      const id=this.cards.raise('login-signin','general',`Login ${name} is signed out. Sign in again?${hint?' '+hint:''}`,['Sign in again','Not now'],false,{login:name,episode:episode.id});
      active[name]={id,episode:episode.id};
      this.store.setMeta('login-signin-cards',JSON.stringify(active));
    });
    if(this.signOutOptions.notice)this.store.transaction(()=>{
      const active=JSON.parse(this.store.meta('login-signin-cards')!) as Record<string,SignInCard>;
      const card=Object.hasOwn(active,name)?active[name]:undefined;
      if(!card||card.episode!==episode.id||card.noticed)return;
      this.signOutOptions.notice!(name,episode);
      // Positive receipt and message checkpoint commit together, surviving message retention.
      card.noticed=true;
      this.store.setMeta('login-signin-cards',JSON.stringify(active));
    });
  }

  loginChanged(name:string):void {
    const login=this.store.hosts.logins.get(name);
    if(login?.state==='signed-out'){this.signedOut(name);return;}
    if(login&&login.state!=='ready'&&login.state!=='in-use')return;
    this.store.transaction(()=>{
      const active=JSON.parse(this.store.meta('login-signin-cards')??'{}') as Record<string,SignInCard>;
      if(!Object.hasOwn(active,name))return;
      const card=active[name]!;
      if(this.store.ask(card.id)?.state==='open')this.cards.withdraw(card.id,login?'Login ready':'Login removed');
      delete active[name];this.store.setMeta('login-signin-cards',JSON.stringify(active));
    });
  }

  reconcile(waits: readonly WaitingLaunch[]): void {
    const wanted = new Map<string, { pool: string; harness: string }>();
    for (const wait of waits) {
      // The reason is supplied by the placement verdict, never re-selected here.
      const match = /^waiting for a login (claude-code|codex|opencode)$/.exec(wait.reason);
      if (match) wanted.set(JSON.stringify([wait.pool, match[1]]), { pool: wait.pool, harness: match[1]! });
    }
    this.store.transaction(() => {
      const previous = JSON.parse(this.store.meta(metadataKey) ?? '{}') as Record<string, WaitCard>;
      const current: Record<string, WaitCard> = {};
      for (const [key, demand] of wanted) {
        current[key] = previous[key] ?? { ...demand, id: this.cards.raise('login-create', 'general',
          `Not enough ${demand.harness} logins. Create one?`, ['Create one', 'Not now'], false, demand) };
      }
      for (const [key, card] of Object.entries(previous)) {
        if (!wanted.has(key) && this.store.ask(card.id)?.state === 'open') this.cards.withdraw(card.id, 'No launches waiting for this login');
      }
      this.store.setMeta(metadataKey, JSON.stringify(current));
    });
  }
}
