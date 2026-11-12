import {createHash} from 'node:crypto';
import type {RemoteVia} from '../protocol.ts';
/** Native identity captured by the adapter, never supplied by frame content. */
export type RemoteIngress={chatId:string;messageId:string;messengerUserId?:string};
export type GatewayAnswerInput={ingress:RemoteIngress;text?:string;reason?:string};
export const sameRemoteIngress=(a:RemoteIngress,b:RemoteIngress):boolean=>
 a.chatId===b.chatId&&a.messageId===b.messageId&&a.messengerUserId===b.messengerUserId;
export const remoteInputId=(via:RemoteVia,ingress:RemoteIngress):string=>
 `remote-${createHash('sha256').update(JSON.stringify([via,ingress.chatId,ingress.messageId])).digest('hex')}`;
